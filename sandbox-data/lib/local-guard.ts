import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export class SandboxSecurityError extends Error {
  public override name = "SandboxSecurityError";
  constructor(message: string, public readonly details?: unknown) {
    super(`[FAIL-CLOSED SECURITY] ${message}`);
  }
}

/**
 * Esquema de validação estrito para execução em ambiente Sandbox Local.
 * Rejeita qualquer tentativa de execução contra bancos remotos, produção ou projetos não autorizados.
 */
export const sandboxSafetySchema = z.object({
  NODE_ENV: z.enum(["development", "test"], {
    errorMap: () => ({ message: "NODE_ENV deve ser 'development' ou 'test'." }),
  }),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "test"], {
    errorMap: () => ({ message: "NEXT_PUBLIC_APP_ENV deve ser 'development' ou 'test'." }),
  }),
  AUTHORIZED_SANDBOX_PROJECT_ID: z.literal("devessent-platform-local", {
    errorMap: () => ({
      message: "AUTHORIZED_SANDBOX_PROJECT_ID deve ser obrigatoriamente 'devessent-platform-local'.",
    }),
  }),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida.")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const isLocal = host === "127.0.0.1" || host === "localhost";
        const hasRemoteIndicators =
          url.includes("supabase.co") ||
          url.includes(".aws.") ||
          url.includes(".azure.") ||
          url.includes(".cloud");
        return isLocal && !hasRemoteIndicators;
      } catch {
        return false;
      }
    }, "NEXT_PUBLIC_SUPABASE_URL deve apontar estritamente para o loopback local (127.0.0.1 ou localhost). Conexões remotas são sumariamente proibidas."),
  DATABASE_URL: z
    .string()
    .optional()
    .refine((url) => {
      if (!url) return true;
      try {
        const isLocalHost = url.includes("127.0.0.1") || url.includes("localhost");
        const hasRemoteIndicators =
          url.includes("pooler.supabase.com") ||
          url.includes("supabase.co") ||
          url.includes(".render.com") ||
          url.includes(".railway.app") ||
          url.includes(".neon.tech");
        return isLocalHost && !hasRemoteIndicators;
      } catch {
        return false;
      }
    }, "DATABASE_URL deve apontar para 127.0.0.1 ou localhost. Conexões de banco remoto são proibidas."),
});

export class LocalGuard {
  /**
   * Carrega variáveis de `.env.local` se ainda não estiverem presentes no ambiente.
   */
  public static loadLocalEnv(): void {
    const envLocalPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envLocalPath)) return;

    try {
      if (typeof process.loadEnvFile === "function") {
        process.loadEnvFile(envLocalPath);
        return;
      }
    } catch {
      // Fallback para parser manual se process.loadEnvFile falhar
    }

    const content = fs.readFileSync(envLocalPath, "utf-8");
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

  /**
   * Validação síncrona de variáveis de ambiente com política fail-closed.
   */
  public static assertSafeEnvironment(customEnv?: Record<string, string | undefined>): void {
    this.loadLocalEnv();
    const targetEnv = customEnv || process.env;

    const result = sandboxSafetySchema.safeParse(targetEnv);

    if (!result.success) {
      const formatted = result.error.flatten().fieldErrors;
      throw new SandboxSecurityError(
        "Tentativa de execução fora do ambiente local autorizado ou contra infraestrutura remota.",
        formatted
      );
    }
  }

  /**
   * Verificação booleana sem lançamento de exceção.
   */
  public static isSafeEnvironment(customEnv?: Record<string, string | undefined>): boolean {
    try {
      this.assertSafeEnvironment(customEnv);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validação assíncrona em profundidade do banco de dados PostgreSQL conectado:
   * 1. Verifica se a URL do Supabase é local.
   * 2. Confirma a existência das tabelas estruturais obrigatórias.
   * 3. Confirma que a tabela de administradores ou tenants responde localmente.
   */
  public static async assertSafeDatabaseConnection(
    supabaseClient: SupabaseClient<Database>
  ): Promise<void> {
    this.assertSafeEnvironment();

    try {
      // Teste de consulta de integridade no schema public
      const { data, error } = await supabaseClient
        .from("tenants")
        .select("id")
        .limit(1);

      if (error) {
        throw new Error(`Erro ao verificar catálogo do banco local: ${error.message}`);
      }

      // Verificação da existência de platform_admins
      const { error: adminErr } = await supabaseClient
        .from("platform_admins")
        .select("user_id")
        .limit(1);

      if (adminErr) {
        throw new Error(`Tabela platform_admins ausente ou inacessível: ${adminErr.message}`);
      }
    } catch (err: unknown) {
      throw new SandboxSecurityError(
        "Falha na validação de integridade do banco de dados local.",
        (err as Error).message
      );
    }
  }
}

// Auto-inicialização de variáveis locais ao importar a guarda de segurança
LocalGuard.loadLocalEnv();

