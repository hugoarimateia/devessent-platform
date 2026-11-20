import { spawn } from "child_process";
import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";
import {
  AUTHORIZED_STAGING_ORG_NAME,
  AUTHORIZED_STAGING_PROJECT_NAME,
  buildIsolatedStagingChildEnv,
  loadAndValidateStagingEnv,
} from "./lib/staging-env";

const require = createRequire(import.meta.url);

const subcommand = (process.argv[2] || "dev") as "dev" | "build" | "start";
if (subcommand !== "dev" && subcommand !== "build" && subcommand !== "start") {
  console.error("Uso: tsx scripts/dev-staging.ts [dev|build|start]");
  process.exit(1);
}

let validated;
try {
  validated = loadAndValidateStagingEnv({ requireServiceRole: true });
} catch (err) {
  console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const modeId = `supabase-staging:${validated.projectRef}`;
const distDirName = process.env.NEXT_DIST_DIR?.trim() || ".next";
const nextCacheDir = path.resolve(process.cwd(), distDirName);
const modeMarkerPath = path.join(nextCacheDir, ".backend-mode");

const previousMode = fs.existsSync(modeMarkerPath)
  ? fs.readFileSync(modeMarkerPath, "utf-8").trim()
  : null;

// Ao trocar entre XAMPP/Local e Staging (ou outro ref), limpa .next para garantir
// que bundles NEXT_PUBLIC_* não retenham URLs de outro backend.
if (subcommand !== "start" && previousMode && previousMode !== modeId && fs.existsSync(nextCacheDir)) {
  try {
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
    console.log(`🧹 Cache ${distDirName} limpo ao alternar de '${previousMode}' para '${modeId}'.`);
  } catch {
    console.warn(`⚠️ Não foi possível limpar ${distDirName} automaticamente.`);
  }
}

try {
  fs.mkdirSync(nextCacheDir, { recursive: true });
  fs.writeFileSync(modeMarkerPath, modeId, "utf-8");
} catch {
  // segue sem falhar se diretório ainda estiver bloqueado
}

console.log("🚀 DevEssent Platform — Supabase Cloud Staging");
console.log(`   Organização : ${AUTHORIZED_STAGING_ORG_NAME}`);
console.log(`   Projeto     : ${AUTHORIZED_STAGING_PROJECT_NAME} (${validated.projectRef})`);
console.log(`   Supabase    : ${validated.supabaseHost}`);
console.log(`   Backend     : supabase (NEXT_PUBLIC_APP_ENV=staging)`);
console.log(`   App URL     : ${validated.appUrl}`);
console.log(`   Comando     : next ${subcommand}`);

const childEnv = buildIsolatedStagingChildEnv(validated);
const nextBin = require.resolve("next/dist/bin/next");
const extraArgs = process.argv.slice(3);
const childArgs = [nextBin, subcommand, ...extraArgs];

const child = spawn(process.execPath, childArgs, {
  stdio: "inherit",
  env: childEnv,
});

const forwardSignal = (signal: NodeJS.Signals) => {
  if (!child.killed) {
    child.kill(signal);
  }
};
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code) => {
  try {
    if (fs.existsSync(nextCacheDir)) {
      fs.writeFileSync(modeMarkerPath, modeId, "utf-8");
    }
  } catch {
    // ignora
  }
  process.exit(code ?? 0);
});
