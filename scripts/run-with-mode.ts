import { spawn } from "child_process";
import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";

const require = createRequire(import.meta.url);

const mode = process.argv[2] as "supabase" | "xampp-test" | undefined;
const command = process.argv[3] || "dev";

if (mode !== "supabase" && mode !== "xampp-test") {
  console.error("Uso: tsx scripts/run-with-mode.ts <supabase|xampp-test> [dev|build]");
  process.exit(1);
}

if (mode === "xampp-test" && command === "build") {
  console.error(
    "❌ PROIBIDO: Builds de produção não podem ser executados em modo xampp-test."
  );
  process.exit(1);
}

// Limpa .next ao trocar de modo para evitar chunks/caches RSC incompatíveis
const modeMarkerPath = path.resolve(process.cwd(), ".next/.backend-mode");
const nextCacheDir = path.resolve(process.cwd(), ".next");
const previousMode = fs.existsSync(modeMarkerPath)
  ? fs.readFileSync(modeMarkerPath, "utf-8").trim()
  : null;

if (previousMode && previousMode !== mode && fs.existsSync(nextCacheDir)) {
  try {
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
    console.log(`🧹 Cache .next limpo ao alternar de '${previousMode}' para '${mode}'.`);
  } catch {
    // ignora se bloqueado
  }
}

console.log(`🚀 Iniciando DevEssent Platform no modo: ${mode.toUpperCase()} (${command})`);

const nextBin = require.resolve("next/dist/bin/next");
const childArgs = [nextBin, command];
if (mode === "xampp-test" && command === "dev") {
  // Restringe acesso ao loopback local por padrão no modo XAMPP
  childArgs.push("-H", "127.0.0.1");
}

const child = spawn(process.execPath, childArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    APP_BACKEND_MODE: mode,
  },
});

const forwardSignal = (signal: NodeJS.Signals) => {
  if (!child.killed) {
    child.kill(signal);
  }
};
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code) => {
  if (fs.existsSync(nextCacheDir)) {
    try {
      fs.writeFileSync(modeMarkerPath, mode, "utf-8");
    } catch {
      // ignora
    }
  }
  process.exit(code ?? 0);
});
