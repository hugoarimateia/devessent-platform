import mysql from "mysql2/promise";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

const globalForXampp = globalThis as unknown as {
  __xamppMysqlPool?: mysql.Pool;
};

export function assertXamppRuntimeAllowed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "VIOLAÇÃO CRÍTICA: Adaptador XAMPP/MariaDB não pode ser executado em produção."
    );
  }
  if (!isXamppTestMode()) {
    throw new Error(
      "Adaptador XAMPP não está habilitado. Defina APP_BACKEND_MODE=xampp-test."
    );
  }
}

export function getXamppPool(): mysql.Pool {
  assertXamppRuntimeAllowed();

  if (!globalForXampp.__xamppMysqlPool) {
    const host = process.env.XAMPP_DB_HOST || "127.0.0.1";
    const port = Number(process.env.XAMPP_DB_PORT || 3306);
    const user = process.env.XAMPP_DB_USER || "root";
    const password = process.env.XAMPP_DB_PASSWORD || "";
    const database = process.env.XAMPP_DB_NAME || "devessent_test";

    globalForXampp.__xamppMysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 5,
      idleTimeout: 60000,
      queueLimit: 0,
      charset: "utf8mb4",
    });
  }

  return globalForXampp.__xamppMysqlPool;
}

export async function xamppQuery<T = mysql.RowDataPacket[]>(
  sql: string,
  params: unknown[] = []
): Promise<T> {
  try {
    const activePool = getXamppPool();
    const [rows] = await activePool.execute(sql, params as never);
    return rows as T;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
      throw new Error(
        "Banco de testes XAMPP indisponível. Inicie o MySQL/MariaDB no painel do XAMPP."
      );
    }
    if (code === "ER_BAD_DB_ERROR") {
      throw new Error(
        "Banco 'devessent_test' não encontrado no MariaDB. Execute 'pnpm xampp:migrate' antes de iniciar."
      );
    }
    throw err;
  }
}

export async function withXamppTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const activePool = getXamppPool();
  const conn = await activePool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignora erro de rollback se conexão já fechou
    }
    throw err;
  } finally {
    conn.release();
  }
}
