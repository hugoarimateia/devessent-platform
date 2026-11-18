/**
 * Script de Reset (Limpeza) de dados sintéticos do banco local (DEV ONLY).
 * Reutiliza a rotina de limpeza seletiva e segura com proteção Fail-Closed.
 */
import { runSandboxCleanup } from "./cleanup";

const isDryRun = process.argv.includes("--dry-run");
const isForce = process.argv.includes("--force") || process.argv.includes("--yes") || !process.stdout.isTTY;

runSandboxCleanup({ force: isForce, dryRun: isDryRun })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("🛑 Erro durante o reset de sandbox:", err.message);
    process.exit(1);
  });
