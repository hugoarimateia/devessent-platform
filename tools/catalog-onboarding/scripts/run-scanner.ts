import { spawn } from "child_process";
import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";

const require = createRequire(import.meta.url);
const subcommand = (process.argv[2] || "dev") as "dev" | "build" | "start";

if (!["dev", "build", "start"].includes(subcommand)) {
  console.error("Uso: tsx scripts/run-scanner.ts [dev|build|start]");
  process.exit(1);
}

const toolRoot = process.cwd();
const envPath = path.join(toolRoot, ".env.scanner.local");
const AUTHORIZED_STAGING_REF = "auebnppzxcvtaaqqlbts";

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const raw of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    out[key] = val;
  }
  return out;
}

const fileVars = loadEnvFile(envPath);
const merged: Record<string, string> = { ...fileVars };
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && !(k in merged)) {
    merged[k] = v;
  }
}

if (subcommand !== "build") {
  const sbUrl = merged.SUPABASE_URL || "";
  if (!sbUrl.includes(`${AUTHORIZED_STAGING_REF}.supabase.co`)) {
    console.error(
      `❌ BLOQUEIO DE SEGURANÇA: SUPABASE_URL ausente ou não autorizada em .env.scanner.local.\n` +
        `   Execute primeiro: pnpm setup:staging-env`
    );
    process.exit(1);
  }
  if (!merged.CATALOG_SCANNER_ALLOWED_USER_IDS) {
    console.error(
      "❌ BLOQUEIO DE SEGURANÇA (Fail-Closed): CATALOG_SCANNER_ALLOWED_USER_IDS é obrigatório."
    );
    process.exit(1);
  }
}

const port = merged.SCANNER_PORT || "3020";
const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist/bin/next");

// Compatibilizar variáveis de ambiente esperadas pelos serviços oficiais de ../../src/
const childEnv: NodeJS.ProcessEnv = {
  ...process.env,
  ...fileVars,
  APP_BACKEND_MODE: "supabase",
  NEXT_PUBLIC_APP_ENV: "staging",
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
  NEXT_PUBLIC_SUPABASE_URL:
    merged.SUPABASE_URL || "https://auebnppzxcvtaaqqlbts.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    merged.SUPABASE_ANON_KEY || "build-placeholder-anon-key-not-used-in-browser-0001",
  SUPABASE_SERVICE_ROLE_KEY:
    merged.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-service-key-not-used-at-build-0001",
  NEXT_TELEMETRY_DISABLED: "1",
};

const args =
  subcommand === "build"
    ? [nextBin, "build"]
    : [nextBin, subcommand, "-H", "127.0.0.1", "-p", port];

console.log(`🔎 DevEssent Catalog Scanner (${subcommand})`);
if (subcommand !== "build") {
  console.log(`   URL Privativa : http://127.0.0.1:${port}`);
  console.log(`   Supabase alvo : ${AUTHORIZED_STAGING_REF}.supabase.co (STAGING)`);
}

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: childEnv,
});

process.on("SIGINT", () => {
  if (!child.killed) child.kill("SIGINT");
});
process.on("SIGTERM", () => {
  if (!child.killed) child.kill("SIGTERM");
});

child.on("exit", (code) => process.exit(code ?? 0));
