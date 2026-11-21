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

type Subcommand = "build" | "preview" | "verify-bundle" | "sync-secrets" | "deploy";
const subcommand = (process.argv[2] || "") as Subcommand;

if (!["build", "preview", "verify-bundle", "sync-secrets", "deploy"].includes(subcommand)) {
  console.error("Uso: tsx scripts/cf-staging.ts [build|preview|verify-bundle|sync-secrets|deploy]");
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

  const devVarsLines = [
    `APP_BACKEND_MODE=supabase`,
    `NEXT_PUBLIC_APP_ENV=staging`,
    `NEXT_PUBLIC_APP_URL=${previewUrl}`,
    `NEXT_PUBLIC_SUPABASE_URL=${validated.supabaseUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${validated.anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${validated.serviceRoleKey}`,
    `PAYMENT_CREDENTIALS_ENCRYPTION_KEY=${paymentEncKey}`,
    `AUTH_BRIDGE_SECRET=${authBridgeSecret}`,
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

  const secretPayload = {
    SUPABASE_SERVICE_ROLE_KEY: validated.serviceRoleKey,
    AUTH_BRIDGE_SECRET: authBridgeSecret,
    PAYMENT_CREDENTIALS_ENCRYPTION_KEY: paymentEncryptionKey,
  };

  console.log("🔐 DevEssent Platform — Sincronização Segura de Cloudflare Secrets (STAGING)");
  console.log(`   Conta CF    : ${AUTHORIZED_CLOUDFLARE_ACCOUNT_ID} (DevEssent verificada)`);
  console.log(`   Worker alvo : ${EXPECTED_STAGING_WORKER_NAME}`);
  console.log("   Chaves      : SUPABASE_SERVICE_ROLE_KEY, AUTH_BRIDGE_SECRET, PAYMENT_CREDENTIALS_ENCRYPTION_KEY");
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
    } else if (subcommand === "deploy") {
      await runDeploy();
    }
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
})();
