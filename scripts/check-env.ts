/**
 * Script de verificação de sanidade das variáveis de ambiente.
 * Executa sem expor segredos nem tokens.
 */
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

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

// Carregar arquivo de ambiente alvo (padrão: .env.local; configurável via DEVESSENT_ENV_FILE)
const targetEnvFile = process.env.DEVESSENT_ENV_FILE || ".env.local";
const envLocalPath = path.resolve(process.cwd(), targetEnvFile);
loadEnvFile(envLocalPath);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

console.log("🔍 Verificando variáveis de ambiente...");

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Falha na validação das variáveis de ambiente:");
  for (const [key, issues] of Object.entries(result.error.flatten().fieldErrors)) {
    console.error(`  - ${key}: ${(issues as string[]).join(", ")}`);
  }
  process.exit(1);
}

console.log("✅ Variáveis de ambiente configuradas corretamente:");
console.log(`  - NODE_ENV: ${result.data.NODE_ENV}`);
console.log(`  - NEXT_PUBLIC_APP_ENV: ${result.data.NEXT_PUBLIC_APP_ENV}`);
console.log(`  - NEXT_PUBLIC_APP_URL: ${result.data.NEXT_PUBLIC_APP_URL}`);
console.log(`  - NEXT_PUBLIC_SUPABASE_URL: ${result.data.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`  - NEXT_PUBLIC_SUPABASE_ANON_KEY: [Configurado - ${result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} chars]`);
console.log(`  - SUPABASE_SERVICE_ROLE_KEY: [Configurado - ${result.data.SUPABASE_SERVICE_ROLE_KEY.length} chars]`);

