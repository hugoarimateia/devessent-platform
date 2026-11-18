/**
 * Script utilitário para provisionamento de usuário de teste EXCLUSIVAMENTE em ambiente local.
 * Proteção fail-closed: recusa execução caso não esteja em localhost / 127.0.0.1.
 */
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { createAdminClient } from "@/lib/supabase/admin";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const safetySchema = z.object({
  NODE_ENV: z.enum(["development", "test"]),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "test"]),
  AUTHORIZED_SANDBOX_PROJECT_ID: z.literal("devessent-platform-local"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().refine(
    (url) => url.includes("127.0.0.1") || url.includes("localhost"),
    "Operação permitida apenas no Supabase local (127.0.0.1 ou localhost)."
  ),
});

const safetyCheck = safetySchema.safeParse(process.env);
if (!safetyCheck.success) {
  console.error("🛑 EXECUÇÃO BLOQUEADA (FAIL-CLOSED): Tentativa de execução fora do ambiente local autorizado.");
  process.exit(1);
}

const TEST_EMAIL = process.env.TEST_USER_EMAIL || "usuario.teste@devessent.test";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "SenhaForteLocal123!";
const isCleanup = process.argv.includes("--cleanup");

async function main() {
  const adminClient = createAdminClient();

  if (isCleanup) {
    console.log(`🧹 Removendo usuário de teste (${TEST_EMAIL})...`);
    const { data: users } = await adminClient.auth.admin.listUsers();
    const existing = users.users.find((u) => u.email === TEST_EMAIL);
    if (existing) {
      await adminClient.auth.admin.deleteUser(existing.id);
      console.log("✅ Usuário temporário removido com sucesso.");
    } else {
      console.log("ℹ️ Usuário não encontrado para remoção.");
    }
    return;
  }

  console.log(`👤 Provisionando conta de teste no Supabase local: ${TEST_EMAIL}`);

  // Verificar se o usuário já existe
  const { data: users } = await adminClient.auth.admin.listUsers();
  const existing = users.users.find((u) => u.email === TEST_EMAIL);

  if (existing) {
    // Atualizar senha do usuário existente
    await adminClient.auth.admin.updateUserById(existing.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: "Usuário Teste Local",
      },
    });
    console.log("✅ Senha do usuário de teste local sincronizada com sucesso.");
    return;
  }

  // Criar novo usuário com confirmação de email automática
  const { data, error } = await adminClient.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: "Usuário Teste Local",
    },
  });

  if (error || !data.user) {
    console.error("❌ Falha ao criar usuário de teste:", error?.message);
    process.exit(1);
  }

  console.log("✅ Conta de teste criada com sucesso no Supabase local.");
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});

