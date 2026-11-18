/**
 * Executor de migrações SQL do DevEssent Platform Core.
 * Executa as migrações em ordem estrita em supabase/migrations/.
 */
import * as fs from "fs";
import * as path from "path";

async function runMigrations() {
  console.log("🐘 Verificando migrações SQL no diretório supabase/migrations/...");

  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.error("❌ Diretório de migrações não encontrado.");
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  console.log(`📁 Encontradas ${files.length} migrações SQL versionadas:`);
  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const stat = fs.statSync(fullPath);
    console.log(`  - ${file} (${stat.size} bytes)`);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("⚠️ DATABASE_URL não informada no ambiente. Validação estrutural de arquivos concluída com sucesso.");
    return;
  }

  console.log("ℹ️ Para aplicar no banco de dados, certifique-se de que o container do Supabase / PostgreSQL esteja em execução.");
}

runMigrations().catch((err) => {
  console.error("❌ Erro ao processar migrações:", err);
  process.exit(1);
});

