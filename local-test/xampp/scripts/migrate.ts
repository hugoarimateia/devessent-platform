import * as fs from "fs";
import * as path from "path";
import mysql from "mysql2/promise";

async function main() {
  const host = process.env.XAMPP_DB_HOST || "127.0.0.1";
  const port = Number(process.env.XAMPP_DB_PORT || 3306);
  const user = process.env.XAMPP_DB_USER || "root";
  const password = process.env.XAMPP_DB_PASSWORD || "";

  const migrationsDir = path.resolve(process.cwd(), "local-test/xampp/migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`🔄 Conectando ao MariaDB XAMPP em ${host}:${port}...`);

  let conn: mysql.Connection;
  try {
    conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
      console.error(
        "❌ Banco de testes XAMPP indisponível. Inicie o MySQL/MariaDB no painel do XAMPP."
      );
      process.exit(1);
    }
    throw err;
  }

  try {
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await conn.query(sql);
      console.log(`✅ Migration aplicada: ${file}`);
    }
    console.log("✅ Schema 'devessent_test' criado/atualizado com sucesso no MariaDB!");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("❌ Erro ao executar migration XAMPP:", err);
  process.exit(1);
});

