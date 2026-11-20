/**
 * Gera `tools/catalog-onboarding/.env.scanner.local` de forma segura a partir do
 * `.env.staging.local` da raiz e do UUID real do Platform Admin em Supabase Cloud Staging.
 * Nunca exibe chaves ou segredos no console.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const AUTHORIZED_STAGING_REF = "auebnppzxcvtaaqqlbts";
const toolRoot = process.cwd();
const repoRoot = path.resolve(toolRoot, "../..");
const rootStagingEnvPath = path.join(repoRoot, ".env.staging.local");
const scannerEnvPath = path.join(toolRoot, ".env.scanner.local");

function parseEnv(filePath: string): Record<string, string> {
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

async function main() {
  if (!fs.existsSync(rootStagingEnvPath)) {
    throw new Error(
      `Arquivo ${rootStagingEnvPath} não encontrado. Configure primeiro o Supabase Cloud Staging na raiz.`
    );
  }

  const rootVars = parseEnv(rootStagingEnvPath);
  const supabaseUrl = rootVars.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = rootVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceRoleKey = rootVars.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl.includes(`${AUTHORIZED_STAGING_REF}.supabase.co`)) {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA: .env.staging.local não aponta para o projeto autorizado (${AUTHORIZED_STAGING_REF}).`
    );
  }
  if (!anonKey || !serviceRoleKey) {
    throw new Error("Chaves de staging ausentes em .env.staging.local.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: admins, error } = await admin
    .from("platform_admins")
    .select("user_id")
    .limit(5);
  if (error || !admins || admins.length === 0) {
    throw new Error(
      `Nenhum platform_admin encontrado no Staging para autorizar o scanner: ${error?.message ?? "lista vazia"}`
    );
  }

  // Selecionar explicitamente o primeiro proprietário (ou manter lista já existente)
  const existing = fs.existsSync(scannerEnvPath) ? parseEnv(scannerEnvPath) : {};
  const allowedUserIds =
    existing.CATALOG_SCANNER_ALLOWED_USER_IDS &&
    !existing.CATALOG_SCANNER_ALLOWED_USER_IDS.startsWith("PREENCHER")
      ? existing.CATALOG_SCANNER_ALLOWED_USER_IDS
      : admins[0].user_id;

  const { data: userRes } = await admin.auth.admin.getUserById(allowedUserIds.split(",")[0].trim());
  const allowedEmail = userRes?.user?.email || "";

  const sessionSecret =
    existing.CATALOG_SCANNER_SESSION_SECRET &&
    existing.CATALOG_SCANNER_SESSION_SECRET.length >= 32 &&
    !existing.CATALOG_SCANNER_SESSION_SECRET.startsWith("PREENCHER")
      ? existing.CATALOG_SCANNER_SESSION_SECRET
      : crypto.randomBytes(32).toString("hex");

  const lines = [
    "# Gerado automaticamente por scripts/bootstrap-staging-env.ts (NUNCA versionar)",
    "SCANNER_ENV=staging",
    "SCANNER_PORT=3020",
    "APP_BACKEND_MODE=supabase",
    `SUPABASE_URL=${supabaseUrl}`,
    `SUPABASE_ANON_KEY=${anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
    `CATALOG_SCANNER_ALLOWED_USER_IDS=${allowedUserIds}`,
    `CATALOG_SCANNER_ALLOWED_EMAILS=${allowedEmail}`,
    `CATALOG_SCANNER_SESSION_SECRET=${sessionSecret}`,
    "CATALOG_SCANNER_OPEN_LOOKUP=disabled",
    "CATALOG_SCANNER_ALLOWED_IMAGE_HOSTS=",
    "",
  ];

  fs.writeFileSync(scannerEnvPath, lines.join("\n"), "utf-8");
  console.log("✅ .env.scanner.local configurado com segurança para Supabase Cloud Staging.");
  console.log(`   Projeto Supabase : ${AUTHORIZED_STAGING_REF}.supabase.co`);
  console.log(`   Proprietário ID  : ${allowedUserIds}`);
  console.log(`   Proprietário Mail: ${allowedEmail}`);
  console.log("   Porta local      : 3020 (exclusivamente local, sem deploy público)");
}

main().catch((err) => {
  console.error("❌ Falha ao configurar .env.scanner.local:", err instanceof Error ? err.message : err);
  process.exit(1);
});
