import { z } from "zod";
import { getAppBackendMode } from "./backend-mode";

/**
 * Esquema de validação para variáveis de ambiente públicas (client & server)
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida").optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY é obrigatória").optional(),
});

/**
 * Esquema completo para o backend oficial Supabase (Local ou Cloud)
 */
const supabaseServerEnvSchema = publicEnvSchema.extend({
  APP_BACKEND_MODE: z.literal("supabase").default("supabase"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY é obrigatória e deve ter formato JWT válido"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY é obrigatória no ambiente do servidor"),
  DATABASE_URL: z.string().min(10, "DATABASE_URL é obrigatória para migrações").optional(),
  AUTHORIZED_SANDBOX_PROJECT_ID: z.string().optional(),
});

/**
 * Esquema exclusivo para o ambiente secundário de testes locais XAMPP/MariaDB
 */
const xamppServerEnvSchema = publicEnvSchema.extend({
  APP_BACKEND_MODE: z.literal("xampp-test"),
  NODE_ENV: z.enum(["development", "test"]),
  XAMPP_DB_HOST: z.string().min(1).default("127.0.0.1"),
  XAMPP_DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  XAMPP_DB_USER: z.string().min(1).default("root"),
  XAMPP_DB_PASSWORD: z.string().default(""),
  XAMPP_DB_NAME: z.string().min(1).default("devessent_test"),
  XAMPP_SESSION_SECRET: z.string().min(16, "XAMPP_SESSION_SECRET deve ter pelo menos 16 caracteres"),
  XAMPP_STORAGE_DIR: z.string().min(1).default("local-test/xampp/storage"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  AUTHORIZED_SANDBOX_PROJECT_ID: z.string().optional(),
});

export interface ServerEnv {
  APP_BACKEND_MODE: "supabase" | "xampp-test";
  NODE_ENV: "development" | "test" | "production";
  NEXT_PUBLIC_APP_ENV: "development" | "test" | "staging" | "production";
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DATABASE_URL?: string;
  AUTHORIZED_SANDBOX_PROJECT_ID?: string;
  XAMPP_DB_HOST?: string;
  XAMPP_DB_PORT?: number;
  XAMPP_DB_USER?: string;
  XAMPP_DB_PASSWORD?: string;
  XAMPP_DB_NAME?: string;
  XAMPP_SESSION_SECRET?: string;
  XAMPP_STORAGE_DIR?: string;
}

function validateEnv(): ServerEnv {
  const isServer = typeof window === "undefined";

  if (!isServer) {
    const result = publicEnvSchema.safeParse({
      NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

    if (!result.success) {
      const missingKeys = Object.keys(result.error.flatten().fieldErrors);
      console.error("❌ Variáveis de ambiente públicas inválidas:", missingKeys.join(", "));
      throw new Error(`Variáveis de ambiente públicas inválidas: ${missingKeys.join(", ")}`);
    }

    return result.data as unknown as ServerEnv;
  }

  const mode = getAppBackendMode();

  if (mode === "xampp-test") {
    const result = xamppServerEnvSchema.safeParse({
      ...process.env,
      APP_BACKEND_MODE: "xampp-test",
    });

    if (!result.success) {
      const missingKeys = Object.keys(result.error.flatten().fieldErrors);
      console.error(
        `❌ Falha na configuração do ambiente XAMPP (variáveis ausentes/inválidas): ${missingKeys.join(", ")}`
      );
      throw new Error(
        `Configuração XAMPP inválida. Verifique as variáveis: ${missingKeys.join(", ")}`
      );
    }

    return {
      ...result.data,
      NEXT_PUBLIC_SUPABASE_URL: result.data.NEXT_PUBLIC_SUPABASE_URL || "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      SUPABASE_SERVICE_ROLE_KEY: result.data.SUPABASE_SERVICE_ROLE_KEY || "",
    };
  }

  const result = supabaseServerEnvSchema.safeParse({
    ...process.env,
    APP_BACKEND_MODE: "supabase",
  });

  if (!result.success) {
    const missingKeys = Object.keys(result.error.flatten().fieldErrors);
    console.error(
      `❌ Falha crítica na configuração do Supabase oficial (variáveis ausentes/inválidas): ${missingKeys.join(", ")}`
    );
    throw new Error(
      `Configurações obrigatórias do Supabase ausentes ou inválidas: ${missingKeys.join(", ")}`
    );
  }

  return result.data;
}

export const env = validateEnv();
