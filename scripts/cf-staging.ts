/**
 * Orquestrador seguro de build, verificação de bundle e preview local (workerd)
 * para a DevEssent Platform no Cloudflare Workers (STAGING).
 *
 * - Nunca lê `.env.local` (XAMPP/dev local).
 * - Nunca embute `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`
 *   ou `AUTH_BRIDGE_SECRET` no build estático.
 * - Valida estritamente o projeto Supabase Cloud Staging autorizado (`auebnppzxcvtaaqqlbts`).
 */
import { spawn } from "child_process";
import * as crypto from "crypto";
import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import {
  AUTHORIZED_STAGING_ORG_NAME,
  AUTHORIZED_STAGING_PROJECT_NAME,
  AUTHORIZED_STAGING_PROJECT_REF,
  extractSupabaseCloudRef,
  loadAndValidateStagingEnv,
} from "./lib/staging-env";

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();
const distServerDir = path.resolve(projectRoot, "dist/server");
const distClientDir = path.resolve(projectRoot, "dist/client");
const generatedWranglerPath = path.join(distServerDir, "wrangler.json");
const generatedDevVarsPath = path.join(distServerDir, ".dev.vars");

const WORKER_UNCOMPRESSED_LIMIT_BYTES = 64 * 1024 * 1024; // 64 MiB Cloudflare Workers Free & Paid
const AUTHORIZED_CLOUDFLARE_ACCOUNT_ID = "bf89f7f990af2c019abf8e7604db760d"; // Conta DevEssent (devessent@outlook.com)
const FORBIDDEN_CLOUDFLARE_ACCOUNT_IDS = new Set([
  "0d0228f378b5e4f3f63c67b4210bf3ea", // Conta Cloudflare EJC — estritamente proibida para DevEssent Platform
]);
const FORBIDDEN_CLOUDFLARE_EMAILS = new Set([
  "hugogeeta.gamer@gmail.com", // E-mail da conta Cloudflare EJC — proibido
]);
const EXPECTED_STAGING_WORKER_NAME = "devessent-platform-staging";

type Subcommand =
  | "build"
  | "preview"
  | "verify-bundle"
  | "sync-secrets"
  | "upload-preview"
  | "preview-mp-sandbox"
  | "deploy";
const subcommand = (process.argv[2] || "") as Subcommand;

if (
  ![
    "build",
    "preview",
    "verify-bundle",
    "sync-secrets",
    "upload-preview",
    "preview-mp-sandbox",
    "deploy",
  ].includes(subcommand)
) {
  console.error(
    "Uso: tsx scripts/cf-staging.ts [build|preview|verify-bundle|sync-secrets|upload-preview|preview-mp-sandbox|deploy]"
  );
  process.exit(1);
}

interface BuildPublicEnv {
  supabaseUrl: string;
  supabaseHost: string;
  anonKey: string;
  appUrl: string;
}

function resolveStagingBuildPublicEnv(): BuildPublicEnv {
  const envFilePath = path.resolve(projectRoot, ".env.staging.local");
  if (fs.existsSync(envFilePath)) {
    const validated = loadAndValidateStagingEnv({ requireServiceRole: false });
    return {
      supabaseUrl: validated.supabaseUrl,
      supabaseHost: validated.supabaseHost,
      anonKey: validated.anonKey,
      appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || validated.appUrl,
    };
  }

  // Modo CI (sem .env.staging.local): lê exclusivamente variáveis públicas de process.env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://devessent-platform-staging.devessent.workers.dev";
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim() || "staging";

  if (appEnv !== "staging") {
    throw new Error(
      `NEXT_PUBLIC_APP_ENV deve ser "staging" no build Cloudflare Staging (recebido: "${appEnv}").`
    );
  }
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias para o build Cloudflare Staging."
    );
  }

  const { ref, host } = extractSupabaseCloudRef(supabaseUrl);
  if (ref !== AUTHORIZED_STAGING_PROJECT_REF) {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA: projeto Supabase "${ref}" não autorizado para Staging (esperado: "${AUTHORIZED_STAGING_PROJECT_REF}").`
    );
  }

  return { supabaseUrl, supabaseHost: host, anonKey, appUrl };
}

function collectFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursive(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function verifyBuiltBundle(): void {
  if (!fs.existsSync(generatedWranglerPath) || !fs.existsSync(path.join(distServerDir, "index.js"))) {
    throw new Error(
      "Artefatos do Worker não encontrados em dist/server/. Execute `pnpm cf:build:staging` primeiro."
    );
  }

  // Garantir que .dev.vars local nunca permaneça nos artefatos de build
  if (fs.existsSync(generatedDevVarsPath)) {
    fs.rmSync(generatedDevVarsPath, { force: true });
    console.log("🧹 Removido dist/server/.dev.vars gerado automaticamente pelo bundler.");
  }

  const serverFiles = collectFilesRecursive(distServerDir);
  const codeFiles = serverFiles.filter((f) => /\.(js|mjs|cjs|wasm)$/.test(f));
  const clientFiles = collectFilesRecursive(distClientDir);

  let uncompressedCodeBytes = 0;
  let gzippedCodeBytes = 0;
  const leaks: string[] = [];
  const forbiddenPatterns: Array<{ name: string; regex: RegExp }> = [
    { name: "mysql2", regex: /\bmysql2\b/ },
    { name: "XamppAuthAdapter", regex: /\bXamppAuthAdapter\b/ },
    { name: "XamppRetailAdapter", regex: /\bXamppRetailAdapter\b/ },
    { name: "XamppRetailOrderAdapter", regex: /\bXamppRetailOrderAdapter\b/ },
    { name: "old-staging-ref", regex: /vjoodpqjzxpmrfvjbxrq/ },
    { name: "ejc-project-ref", regex: /guppedddwnuvluhiaaas/ },
    { name: "brokeos-project-ref", regex: /hhjqlkickedbnlbuxwlo/ },
    { name: "mp-access-token-leak", regex: /(?:APP_USR|TEST)-[0-9]{6,}-[0-9]{4,}-[a-zA-Z0-9_-]{12,}/ },
  ];

  for (const file of codeFiles) {
    const buf = fs.readFileSync(file);
    uncompressedCodeBytes += buf.byteLength;
    gzippedCodeBytes += zlib.gzipSync(buf, { level: 9 }).byteLength;

    if (!file.endsWith(".wasm")) {
      const text = buf.toString("utf-8");
      for (const p of forbiddenPatterns) {
        if (p.regex.test(text)) {
          leaks.push(`${p.name} em ${path.relative(projectRoot, file)}`);
        }
      }
    }
  }

  const clientBytes = clientFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);

  const uncompressedMiB = uncompressedCodeBytes / (1024 * 1024);
  const gzippedMiB = gzippedCodeBytes / (1024 * 1024);
  const clientMiB = clientBytes / (1024 * 1024);
  const pctOfLimit = (uncompressedCodeBytes / WORKER_UNCOMPRESSED_LIMIT_BYTES) * 100;

  console.log("📦 Verificação do artefato Cloudflare Workers (dist/):");
  console.log(
    `   Worker JS/WASM (uncompressed): ${uncompressedMiB.toFixed(2)} MiB (${codeFiles.length} arquivos, ${pctOfLimit.toFixed(1)}% do limite de 64 MiB)`
  );
  console.log(`   Worker JS/WASM (gzip-9)      : ${gzippedMiB.toFixed(2)} MiB`);
  console.log(`   Static Assets (dist/client)  : ${clientMiB.toFixed(2)} MiB (${clientFiles.length} arquivos)`);

  if (uncompressedCodeBytes >= WORKER_UNCOMPRESSED_LIMIT_BYTES) {
    throw new Error(
      `Bundle do Worker excede o limite de 64 MiB uncompressed (${uncompressedMiB.toFixed(2)} MiB).`
    );
  }

  if (leaks.length > 0) {
    throw new Error(`Vazamento proibido detectado no bundle do Worker:\n  - ${leaks.join("\n  - ")}`);
  }

  console.log("✅ Artefato Worker aprovado (zero mysql2/XAMPP, zero projetos não autorizados, dentro do limite Free).");
}

function buildIsolatedProcessEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const cleanEnv: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (
      k.startsWith("XAMPP_") ||
      k.startsWith("NEXT_PUBLIC_") ||
      k.startsWith("BILLING_") ||
      k === "APP_BACKEND_MODE" ||
      k === "SUPABASE_SERVICE_ROLE_KEY" ||
      k === "PAYMENT_CREDENTIALS_ENCRYPTION_KEY" ||
      k === "AUTH_BRIDGE_SECRET" ||
      k === "DATABASE_URL" ||
      k === "ALLOW_LIVE_PAYMENTS"
    ) {
      continue;
    }
    cleanEnv[k] = v;
  }
  return { ...cleanEnv, ...extra } as NodeJS.ProcessEnv;
}

async function runBuild(): Promise<void> {
  const pub = resolveStagingBuildPublicEnv();
  console.log("🏗️  DevEssent Platform — Cloudflare Workers Build (STAGING via vinext)");
  console.log(`   Organização : ${AUTHORIZED_STAGING_ORG_NAME}`);
  console.log(`   Projeto DB  : ${AUTHORIZED_STAGING_PROJECT_NAME} (${AUTHORIZED_STAGING_PROJECT_REF})`);
  console.log(`   Supabase    : ${pub.supabaseHost}`);
  console.log(`   App URL     : ${pub.appUrl}`);
  console.log("   Segredos    : 0 segredos de runtime injetados no build (Cloudflare Secrets only)");

  const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin/vite.js");
  // Preservar .next/types/routes.d.ts do Next.js (vinext sobrescreve routes.d.ts durante vite build)
  const nextRoutesDtsPath = path.resolve(projectRoot, ".next/types/routes.d.ts");
  const prevNextRoutesDts = fs.existsSync(nextRoutesDtsPath)
    ? fs.readFileSync(nextRoutesDtsPath, "utf-8")
    : null;

  const childEnv = buildIsolatedProcessEnv({
    NODE_ENV: "production",
    APP_BACKEND_MODE: "supabase",
    NEXT_DIST_DIR: ".next-vinext",
    NEXT_PUBLIC_APP_ENV: "staging",
    NEXT_PUBLIC_APP_URL: pub.appUrl,
    NEXT_PUBLIC_SUPABASE_URL: pub.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: pub.anonKey,
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, [viteBin, "build"], {
      stdio: "inherit",
      env: childEnv,
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });

  // Restaurar ou remover routes.d.ts caso vinext tenha gravado em .next/types/
  if (fs.existsSync(nextRoutesDtsPath)) {
    const current = fs.readFileSync(nextRoutesDtsPath, "utf-8");
    if (current.startsWith("// This file is generated by vinext.")) {
      if (prevNextRoutesDts && !prevNextRoutesDts.startsWith("// This file is generated by vinext.")) {
        fs.writeFileSync(nextRoutesDtsPath, prevNextRoutesDts, "utf-8");
      } else {
        fs.rmSync(nextRoutesDtsPath, { force: true });
      }
    }
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  verifyBuiltBundle();
}

async function runPreview(): Promise<void> {
  if (!fs.existsSync(generatedWranglerPath)) {
    throw new Error("Execute `pnpm cf:build:staging` antes de iniciar `pnpm cf:preview:staging`.");
  }

  const validated = loadAndValidateStagingEnv({ requireServiceRole: true });
  const port = process.env.CF_PREVIEW_PORT?.trim() || "8787";
  const previewUrl = `http://127.0.0.1:${port}`;
  const paymentEncKey =
    validated.paymentEncryptionKey ||
    validated.rawVars.PAYMENT_CREDENTIALS_ENCRYPTION_KEY ||
    validated.serviceRoleKey;
  const authBridgeSecret =
    validated.rawVars.AUTH_BRIDGE_SECRET ||
    validated.serviceRoleKey;

  const billingSandboxSecret =
    validated.rawVars.BILLING_WEBHOOK_SANDBOX_SECRET?.trim() ||
    crypto.randomBytes(32).toString("hex");

  const devVarsLines = [
    `APP_BACKEND_MODE=supabase`,
    `NEXT_PUBLIC_APP_ENV=staging`,
    `NEXT_PUBLIC_APP_URL=${previewUrl}`,
    `NEXT_PUBLIC_SUPABASE_URL=${validated.supabaseUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${validated.anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${validated.serviceRoleKey}`,
    `PAYMENT_CREDENTIALS_ENCRYPTION_KEY=${paymentEncKey}`,
    `AUTH_BRIDGE_SECRET=${authBridgeSecret}`,
    `BILLING_WEBHOOK_SANDBOX_SECRET=${billingSandboxSecret}`,
    ...(validated.rawVars.BILLING_PROVIDER_MODE?.trim()
      ? [`BILLING_PROVIDER_MODE=${validated.rawVars.BILLING_PROVIDER_MODE.trim()}`]
      : []),
    ...(validated.rawVars.BILLING_MP_ENVIRONMENT?.trim()
      ? [`BILLING_MP_ENVIRONMENT=${validated.rawVars.BILLING_MP_ENVIRONMENT.trim()}`]
      : []),
    ...(validated.rawVars.BILLING_MP_COLLECTOR_ID?.trim()
      ? [`BILLING_MP_COLLECTOR_ID=${validated.rawVars.BILLING_MP_COLLECTOR_ID.trim()}`]
      : []),
    ...(validated.rawVars.BILLING_MP_APPLICATION_ID?.trim()
      ? [`BILLING_MP_APPLICATION_ID=${validated.rawVars.BILLING_MP_APPLICATION_ID.trim()}`]
      : []),
    ...(validated.rawVars.BILLING_MP_WEBHOOK_AUTH_MODE?.trim()
      ? [`BILLING_MP_WEBHOOK_AUTH_MODE=${validated.rawVars.BILLING_MP_WEBHOOK_AUTH_MODE.trim()}`]
      : []),
    ...(validated.rawVars.BILLING_MP_ACCESS_TOKEN?.trim()
      ? [`BILLING_MP_ACCESS_TOKEN=${validated.rawVars.BILLING_MP_ACCESS_TOKEN.trim()}`]
      : []),
    ...(validated.rawVars.BILLING_MP_WEBHOOK_SECRET?.trim()
      ? [`BILLING_MP_WEBHOOK_SECRET=${validated.rawVars.BILLING_MP_WEBHOOK_SECRET.trim()}`]
      : []),
    ...(process.env.DEVESSENT_PERF_TRACE
      ? [`DEVESSENT_PERF_TRACE=${process.env.DEVESSENT_PERF_TRACE}`]
      : []),
  ];

  fs.writeFileSync(generatedDevVarsPath, `${devVarsLines.join("\n")}\n`, "utf-8");

  const cleanupDevVars = () => {
    try {
      if (fs.existsSync(generatedDevVarsPath)) {
        fs.rmSync(generatedDevVarsPath, { force: true });
      }
    } catch {
      // ignora
    }
  };

  console.log("🧪 DevEssent Platform — Cloudflare Workers Local Preview (workerd / Miniflare)");
  console.log(`   URL local   : ${previewUrl}`);
  console.log(`   Supabase    : ${validated.supabaseHost} (${validated.projectRef})`);
  console.log("   Conta CF    : 100% local (zero chamadas à API Cloudflare)");

  const wranglerBin = path.join(
    path.dirname(require.resolve("wrangler/package.json")),
    "bin/wrangler.js"
  );
  const child = spawn(
    process.execPath,
    [
      wranglerBin,
      "dev",
      "--config",
      generatedWranglerPath,
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      port,
      "--show-interactive-dev-session=false",
    ],
    {
      stdio: "inherit",
      env: buildIsolatedProcessEnv({
        NODE_ENV: "production",
        WRANGLER_SEND_METRICS: "false",
      }),
    }
  );

  const forwardSignal = (signal: NodeJS.Signals) => {
    cleanupDevVars();
    if (!child.killed) {
      child.kill(signal);
    }
  };
  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));
  process.on("exit", cleanupDevVars);

  child.on("exit", (code) => {
    cleanupDevVars();
    process.exit(code ?? 0);
  });
}

function getWranglerBin(): string {
  return path.join(
    path.dirname(require.resolve("wrangler/package.json")),
    "bin/wrangler.js"
  );
}

async function assertAuthorizedCloudflareAccount(wranglerBin: string): Promise<void> {
  const envAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim().toLowerCase() || "";
  if (envAccountId) {
    if (FORBIDDEN_CLOUDFLARE_ACCOUNT_IDS.has(envAccountId)) {
      throw new Error(
        "BLOQUEIO CRÍTICO (Fail-Closed): CLOUDFLARE_ACCOUNT_ID pertence à conta EJC. Operação proibida nessa conta."
      );
    }
    if (envAccountId !== AUTHORIZED_CLOUDFLARE_ACCOUNT_ID) {
      throw new Error(
        `BLOQUEIO CRÍTICO (Fail-Closed): CLOUDFLARE_ACCOUNT_ID ("${envAccountId}") difere da conta DevEssent autorizada ("${AUTHORIZED_CLOUDFLARE_ACCOUNT_ID}").`
      );
    }
  }

  const whoamiOutput = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn(process.execPath, [wranglerBin, "whoami"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("error", reject);
    child.on("exit", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });

  const whoamiLower = whoamiOutput.toLowerCase();
  if (whoamiLower.includes("not authenticated") || whoamiLower.includes("you are not authenticated")) {
    throw new Error(
      "Sessão Wrangler não autenticada. Autentique a conta DevEssent (`wrangler login` ou CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)."
    );
  }

  for (const forbiddenId of FORBIDDEN_CLOUDFLARE_ACCOUNT_IDS) {
    if (whoamiLower.includes(forbiddenId)) {
      throw new Error(
        `BLOQUEIO CRÍTICO (Fail-Closed): Sessão Wrangler contém a conta EJC proibida (${forbiddenId}). Operação abortada.`
      );
    }
  }
  for (const forbiddenEmail of FORBIDDEN_CLOUDFLARE_EMAILS) {
    if (whoamiLower.includes(forbiddenEmail)) {
      throw new Error(
        `BLOQUEIO CRÍTICO (Fail-Closed): Sessão Wrangler associada ao e-mail EJC proibido (${forbiddenEmail}). Operação abortada.`
      );
    }
  }

  if (!whoamiLower.includes(AUTHORIZED_CLOUDFLARE_ACCOUNT_ID)) {
    throw new Error(
      `BLOQUEIO CRÍTICO (Fail-Closed): Conta DevEssent autorizada (${AUTHORIZED_CLOUDFLARE_ACCOUNT_ID}) não confirmada em \`wrangler whoami\`. Operação abortada.`
    );
  }
}

async function runSyncSecrets(): Promise<void> {
  const wranglerBin = getWranglerBin();
  await assertAuthorizedCloudflareAccount(wranglerBin);

  const validated = loadAndValidateStagingEnv({ requireServiceRole: true });
  const paymentEncryptionKey =
    validated.paymentEncryptionKey ||
    validated.rawVars.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    "";

  if (!paymentEncryptionKey || paymentEncryptionKey.length < 32) {
    throw new Error(
      "BLOQUEIO DE COMPATIBILIDADE FINANCEIRA: PAYMENT_CREDENTIALS_ENCRYPTION_KEY ausente ou curta em .env.staging.local. Não é permitido sobrescrever/rotacionar a chave sem migração dos dados sandbox existentes."
    );
  }

  const authBridgeSecret =
    validated.rawVars.AUTH_BRIDGE_SECRET?.trim() ||
    crypto.randomBytes(32).toString("hex");

  const billingSandboxSecret =
    validated.rawVars.BILLING_WEBHOOK_SANDBOX_SECRET?.trim() || "";
  if (!billingSandboxSecret || billingSandboxSecret.length < 32) {
    throw new Error(
      "BLOQUEIO DE SEGURANÇA BILLING: BILLING_WEBHOOK_SANDBOX_SECRET exclusivo (>= 32 caracteres) obrigatório em .env.staging.local antes de sincronizar segredos."
    );
  }
  if (
    billingSandboxSecret === validated.serviceRoleKey ||
    billingSandboxSecret === authBridgeSecret ||
    billingSandboxSecret === paymentEncryptionKey
  ) {
    throw new Error(
      "BLOQUEIO DE SEGURANÇA BILLING: BILLING_WEBHOOK_SANDBOX_SECRET deve ser exclusivo e distinto dos segredos de Auth, Supabase e Retail."
    );
  }

  const secretPayload: Record<string, string> = {
    SUPABASE_SERVICE_ROLE_KEY: validated.serviceRoleKey,
    AUTH_BRIDGE_SECRET: authBridgeSecret,
    PAYMENT_CREDENTIALS_ENCRYPTION_KEY: paymentEncryptionKey,
    BILLING_WEBHOOK_SANDBOX_SECRET: billingSandboxSecret,
  };

  const mpAccessToken = validated.rawVars.BILLING_MP_ACCESS_TOKEN?.trim() || "";
  const mpWebhookSecret = validated.rawVars.BILLING_MP_WEBHOOK_SECRET?.trim() || "";
  const mpEnv = (validated.rawVars.BILLING_MP_ENVIRONMENT?.trim() || "sandbox").toLowerCase();
  const mpCollectorId = validated.rawVars.BILLING_MP_COLLECTOR_ID?.trim() || "";
  const mpAppId = validated.rawVars.BILLING_MP_APPLICATION_ID?.trim() || "";
  const mpMode = validated.rawVars.BILLING_PROVIDER_MODE?.trim() || "";

  if (mpEnv !== "sandbox") {
    throw new Error(
      `BLOQUEIO FAIL-CLOSED: BILLING_MP_ENVIRONMENT deve ser 'sandbox' em Staging (recebido: '${mpEnv}').`
    );
  }
  if (mpAccessToken) {
    if (!mpCollectorId || !/^\d+$/.test(mpCollectorId)) {
      throw new Error(
        "BLOQUEIO DE SEGURANÇA BILLING: BILLING_MP_COLLECTOR_ID numérico da Conta de Teste é obrigatório junto com BILLING_MP_ACCESS_TOKEN."
      );
    }
    if (!mpWebhookSecret || mpWebhookSecret.length < 16) {
      throw new Error(
        "BLOQUEIO DE SEGURANÇA BILLING: BILLING_MP_WEBHOOK_SECRET é obrigatório quando BILLING_MP_ACCESS_TOKEN está definido."
      );
    }
    secretPayload.BILLING_MP_ACCESS_TOKEN = mpAccessToken;
    secretPayload.BILLING_MP_WEBHOOK_SECRET = mpWebhookSecret;
    secretPayload.BILLING_MP_COLLECTOR_ID = mpCollectorId;
    if (mpAppId) secretPayload.BILLING_MP_APPLICATION_ID = mpAppId;
    if (mpMode) secretPayload.BILLING_PROVIDER_MODE = mpMode;
  }

  const syncedKeyNames = Object.keys(secretPayload).join(", ");

  console.log("🔐 DevEssent Platform — Sincronização Segura de Cloudflare Secrets (STAGING)");
  console.log(`   Conta CF    : ${AUTHORIZED_CLOUDFLARE_ACCOUNT_ID} (DevEssent verificada)`);
  console.log(`   Worker alvo : ${EXPECTED_STAGING_WORKER_NAME}`);
  console.log(`   Chaves      : ${syncedKeyNames}`);
  console.log("   Sigilo      : envio direto por stdin (zero arquivos temporários, zero impressão de valores)");

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        wranglerBin,
        "secret",
        "bulk",
        "--name",
        EXPECTED_STAGING_WORKER_NAME,
      ],
      {
        stdio: ["pipe", "inherit", "inherit"],
        env: {
          ...process.env,
          CLOUDFLARE_ACCOUNT_ID: AUTHORIZED_CLOUDFLARE_ACCOUNT_ID,
          WRANGLER_SEND_METRICS: "false",
        },
      }
    );
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
    child.stdin.write(JSON.stringify(secretPayload));
    child.stdin.end();
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  console.log("✅ Segredos configurados exclusivamente no Worker de Staging.");
}

async function runDeploy(): Promise<void> {
  verifyBuiltBundle();

  const generatedConfig = JSON.parse(
    fs.readFileSync(generatedWranglerPath, "utf-8")
  ) as { name?: string; account_id?: string };
  if (generatedConfig.name !== EXPECTED_STAGING_WORKER_NAME) {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA: Worker alvo inválido ("${generatedConfig.name}"). Esperado exclusivamente "${EXPECTED_STAGING_WORKER_NAME}".`
    );
  }
  if (
    generatedConfig.account_id &&
    generatedConfig.account_id.toLowerCase() !== AUTHORIZED_CLOUDFLARE_ACCOUNT_ID
  ) {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA: account_id no artefato ("${generatedConfig.account_id}") difere da conta DevEssent autorizada ("${AUTHORIZED_CLOUDFLARE_ACCOUNT_ID}").`
    );
  }

  const pub = resolveStagingBuildPublicEnv();
  if (
    !pub.appUrl.startsWith("https://") ||
    pub.appUrl.includes("localhost") ||
    pub.appUrl.includes("127.0.0.1") ||
    pub.appUrl.includes("app.devessent.com.br") ||
    pub.appUrl.includes("devessent-landing.pages.dev")
  ) {
    throw new Error(
      `BLOQUEIO DE AMBIENTE: NEXT_PUBLIC_APP_URL inválida para deploy remoto de staging Workers ("${pub.appUrl}"). Informe explicitamente a URL HTTPS do Worker de staging.`
    );
  }

  const wranglerBin = getWranglerBin();
  await assertAuthorizedCloudflareAccount(wranglerBin);

  console.log("🚀 DevEssent Platform — Deploy Seguro Cloudflare Workers (STAGING)");
  console.log(`   Conta CF    : ${AUTHORIZED_CLOUDFLARE_ACCOUNT_ID} (DevEssent verificada)`);
  console.log(`   Worker alvo : ${EXPECTED_STAGING_WORKER_NAME}`);
  console.log(`   Supabase    : ${pub.supabaseHost} (${AUTHORIZED_STAGING_PROJECT_REF})`);
  console.log(`   App URL     : ${pub.appUrl}`);
  console.log("   Segredos    : preservados em Cloudflare Secrets (nunca enviados via wrangler.jsonc)");

  const deployArgs = [
    wranglerBin,
    "deploy",
    "--config",
    generatedWranglerPath,
    "--var",
    `NEXT_PUBLIC_APP_URL:${pub.appUrl}`,
    "--var",
    `NEXT_PUBLIC_SUPABASE_ANON_KEY:${pub.anonKey}`,
  ];

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, deployArgs, {
      stdio: "inherit",
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: AUTHORIZED_CLOUDFLARE_ACCOUNT_ID,
        WRANGLER_SEND_METRICS: "false",
      },
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function runUploadPreviewVersion(): Promise<void> {
  verifyBuiltBundle();

  const generatedConfig = JSON.parse(
    fs.readFileSync(generatedWranglerPath, "utf-8")
  ) as { name?: string; account_id?: string };
  if (generatedConfig.name !== EXPECTED_STAGING_WORKER_NAME) {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA: Worker alvo inválido ("${generatedConfig.name}"). Esperado exclusivamente "${EXPECTED_STAGING_WORKER_NAME}".`
    );
  }
  if (
    generatedConfig.account_id &&
    generatedConfig.account_id.toLowerCase() !== AUTHORIZED_CLOUDFLARE_ACCOUNT_ID
  ) {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA: account_id no artefato ("${generatedConfig.account_id}") difere da conta DevEssent autorizada ("${AUTHORIZED_CLOUDFLARE_ACCOUNT_ID}").`
    );
  }

  const pub = resolveStagingBuildPublicEnv();
  const wranglerBin = getWranglerBin();
  await assertAuthorizedCloudflareAccount(wranglerBin);

  console.log("🧪 DevEssent Platform — Upload de Versão Não-Ativa (Cloudflare Preview Version)");
  console.log(`   Conta CF    : ${AUTHORIZED_CLOUDFLARE_ACCOUNT_ID} (DevEssent verificada)`);
  console.log(`   Worker alvo : ${EXPECTED_STAGING_WORKER_NAME} (sem alterar tráfego ativo)`);
  console.log(`   Supabase    : ${pub.supabaseHost} (${AUTHORIZED_STAGING_PROJECT_REF})`);
  console.log("   Segredos    : preservados no Worker; nenhuma credencial enviada no artefato");

  const uploadArgs = [
    wranglerBin,
    "versions",
    "upload",
    "--config",
    generatedWranglerPath,
    "--var",
    `NEXT_PUBLIC_APP_URL:${pub.appUrl}`,
    "--var",
    `NEXT_PUBLIC_SUPABASE_ANON_KEY:${pub.anonKey}`,
  ];

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, uploadArgs, {
      stdio: "inherit",
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: AUTHORIZED_CLOUDFLARE_ACCOUNT_ID,
        WRANGLER_SEND_METRICS: "false",
      },
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

/**
 * Publica uma Preview Version NÃO-ATIVA contendo atomica e garantidamente:
 * - Código 6E.2C verificado (`dist/server/wrangler.json`)
 * - Bindings Supabase e segredos anteriores preservados
 * - Credenciais oficiais Mercado Pago Sandbox pré-validadas em `GET /users/me` (`test_user` + `MLB` + `collector_id`)
 * - Seleção explícita `BILLING_PROVIDER_MODE=official_sandbox_api` e `BILLING_MP_ENVIRONMENT=sandbox`
 *
 * Nunca chama `wrangler versions deploy`: mantém o tráfego ativo do Staging 100% intocado.
 */
async function runPreviewMpSandbox(): Promise<void> {
  verifyBuiltBundle();

  const generatedConfig = JSON.parse(
    fs.readFileSync(generatedWranglerPath, "utf-8")
  ) as { name?: string; account_id?: string };
  if (generatedConfig.name !== EXPECTED_STAGING_WORKER_NAME) {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA: Worker alvo inválido ("${generatedConfig.name}"). Esperado exclusivamente "${EXPECTED_STAGING_WORKER_NAME}".`
    );
  }

  const validated = loadAndValidateStagingEnv({ requireServiceRole: true });
  const pub = resolveStagingBuildPublicEnv();
  const rawVars = validated.rawVars;

  const mpToken = rawVars.BILLING_MP_ACCESS_TOKEN?.trim() || "";
  const mpWebhookSecret = rawVars.BILLING_MP_WEBHOOK_SECRET?.trim() || "";
  const mpCollectorId = rawVars.BILLING_MP_COLLECTOR_ID?.trim() || "";
  const mpAppId = rawVars.BILLING_MP_APPLICATION_ID?.trim() || "";
  const mpEnv = (rawVars.BILLING_MP_ENVIRONMENT?.trim() || "sandbox").toLowerCase();
  const mpWebhookAuthMode = (
    rawVars.BILLING_MP_WEBHOOK_AUTH_MODE?.trim() || "hmac_strict"
  ).toLowerCase();

  if (mpEnv !== "sandbox") {
    throw new Error(
      `BLOQUEIO FAIL-CLOSED: BILLING_MP_ENVIRONMENT deve ser 'sandbox' (recebido: '${mpEnv}').`
    );
  }
  if (!mpToken || mpToken.length < 24 || (!mpToken.startsWith("APP_USR-") && !mpToken.startsWith("TEST-"))) {
    throw new Error(
      "BILLING_MP_ACCESS_TOKEN ausente ou inválido em .env.staging.local. Preencha localmente a credencial da Conta Vendedora de Teste DevEssent (sem expor em chat/Git)."
    );
  }
  if (!mpCollectorId || !/^\d+$/.test(mpCollectorId)) {
    throw new Error(
      "BILLING_MP_COLLECTOR_ID numérico (User ID da Conta Vendedora de Teste DevEssent) obrigatório em .env.staging.local."
    );
  }
  if (mpWebhookAuthMode !== "hmac_strict" && mpWebhookAuthMode !== "authoritative_fallback") {
    throw new Error(
      `BILLING_MP_WEBHOOK_AUTH_MODE inválido ('${mpWebhookAuthMode}'). Use 'hmac_strict' ou 'authoritative_fallback'.`
    );
  }
  if (mpWebhookAuthMode === "hmac_strict" && (!mpWebhookSecret || mpWebhookSecret.length < 16)) {
    throw new Error(
      "BILLING_MP_WEBHOOK_SECRET (>= 16 chars) obrigatório em .env.staging.local no modo hmac_strict."
    );
  }

  // Pré-validação autoritativa local em GET /users/me ANTES de tocar no Cloudflare
  console.log("🔎 Validando credencial Mercado Pago em GET https://api.mercadopago.com/users/me ...");
  const meRes = await fetch("https://api.mercadopago.com/users/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${mpToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!meRes.ok) {
    throw new Error(
      `BLOQUEIO FAIL-CLOSED: Mercado Pago recusou BILLING_MP_ACCESS_TOKEN em GET /users/me (HTTP ${meRes.status}). Nenhum segredo foi enviado ao Cloudflare.`
    );
  }
  const meData = (await meRes.json()) as {
    id?: string | number;
    site_id?: string;
    tags?: unknown;
  };
  const tags = Array.isArray(meData.tags)
    ? meData.tags.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase())
    : [];
  const hasTestUserTag = tags.includes("test_user");
  const resolvedId = meData.id !== undefined && meData.id !== null ? String(meData.id).trim() : "";
  const resolvedSite = (meData.site_id || "").trim().toUpperCase();

  if (!hasTestUserTag) {
    throw new Error(
      "BLOQUEIO FAIL-CLOSED: A credencial em BILLING_MP_ACCESS_TOKEN NÃO possui tag 'test_user' em GET /users/me. Pode ser uma conta real de produção! Operação abortada antes do upload."
    );
  }
  if (resolvedSite !== "MLB") {
    throw new Error(
      `BLOQUEIO FAIL-CLOSED: Conta de teste pertence ao site_id '${resolvedSite}' (obrigatório 'MLB' Brasil/BRL).`
    );
  }
  if (resolvedId !== mpCollectorId) {
    throw new Error(
      `BLOQUEIO FAIL-CLOSED: GET /users/me retornou collector_id '${resolvedId}', divergente de BILLING_MP_COLLECTOR_ID='${mpCollectorId}'.`
    );
  }
  console.log(
    `✅ Credencial comprovada via GET /users/me: Conta de Teste oficial Brasil (MLB · collector #${resolvedId} · tag test_user confirmada).`
  );

  const wranglerBin = getWranglerBin();
  await assertAuthorizedCloudflareAccount(wranglerBin);

  // Passo 1: Upload do código 6E.2C como versão não-ativa (garante base atualizada)
  console.log("🧪 Passo 1/2 — Enviando código 6E.2C como versão não-ativa (wrangler versions upload)...");
  const uploadExit = await new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        wranglerBin,
        "versions",
        "upload",
        "--config",
        generatedWranglerPath,
        "--tag",
        "fase-6e2c-code",
        "--message",
        "Fase 6E.2C base code for official MP Sandbox preview",
        "--var",
        `NEXT_PUBLIC_APP_URL:${pub.appUrl}`,
        "--var",
        `NEXT_PUBLIC_SUPABASE_ANON_KEY:${pub.anonKey}`,
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          CLOUDFLARE_ACCOUNT_ID: AUTHORIZED_CLOUDFLARE_ACCOUNT_ID,
          WRANGLER_SEND_METRICS: "false",
        },
      }
    );
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
  if (uploadExit !== 0) process.exit(uploadExit);

  // Passo 2: Patch atômico único via stdin com wrangler versions secret bulk (ZERO arquivos temporários, ZERO impressão de valores!)
  const bulkSecrets: Record<string, string> = {
    BILLING_PROVIDER_MODE: "official_sandbox_api",
    BILLING_MP_ENVIRONMENT: "sandbox",
    BILLING_MP_ACCESS_TOKEN: mpToken,
    BILLING_MP_COLLECTOR_ID: mpCollectorId,
    BILLING_MP_WEBHOOK_AUTH_MODE: mpWebhookAuthMode,
  };
  if (mpWebhookSecret) bulkSecrets.BILLING_MP_WEBHOOK_SECRET = mpWebhookSecret;
  if (mpAppId) bulkSecrets.BILLING_MP_APPLICATION_ID = mpAppId;

  console.log(
    `🔐 Passo 2/2 — Criando versão Preview atômica com segredos oficiais via stdin (${Object.keys(bulkSecrets).join(", ")})...`
  );
  const bulkExit = await new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        wranglerBin,
        "versions",
        "secret",
        "bulk",
        "--name",
        EXPECTED_STAGING_WORKER_NAME,
        "--tag",
        "fase-6e2c-mp-sandbox-preview",
        "--message",
        "Fase 6E.2C + official_sandbox_api secrets (non-active preview)",
      ],
      {
        stdio: ["pipe", "inherit", "inherit"],
        env: {
          ...process.env,
          CLOUDFLARE_ACCOUNT_ID: AUTHORIZED_CLOUDFLARE_ACCOUNT_ID,
          WRANGLER_SEND_METRICS: "false",
        },
      }
    );
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
    child.stdin.write(JSON.stringify(bulkSecrets));
    child.stdin.end();
  });
  if (bulkExit !== 0) process.exit(bulkExit);

  console.log(
    "✅ Preview Version não-ativa criada com sucesso! O tráfego ativo de Staging permanece inalterado até execução explícita de `wrangler versions deploy`."
  );
}

(async () => {
  try {
    if (subcommand === "build") {
      await runBuild();
    } else if (subcommand === "verify-bundle") {
      verifyBuiltBundle();
    } else if (subcommand === "preview") {
      await runPreview();
    } else if (subcommand === "sync-secrets") {
      await runSyncSecrets();
    } else if (subcommand === "upload-preview") {
      await runUploadPreviewVersion();
    } else if (subcommand === "preview-mp-sandbox") {
      await runPreviewMpSandbox();
    } else if (subcommand === "deploy") {
      await runDeploy();
    }
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
})();
