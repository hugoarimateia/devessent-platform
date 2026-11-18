import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/environment/env";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

/**
 * Cliente administrativo com privilégios de Service Role.
 * ATENÇÃO: Nunca importar ou utilizar no client-side.
 * Utilizar apenas em operações administrativas de sistema ou migrações controladas.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("VIOLAÇÃO DE SEGURANÇA: createAdminClient() não pode ser executado no navegador.");
  }

  if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") return undefined;
          return () => {
            throw new Error(
              `VIOLAÇÃO DE AMBIENTE: createAdminClient().${String(prop)} bloqueado no modo xampp-test.`
            );
          };
        },
      }
    ) as unknown as ReturnType<typeof createClient<Database>>;
  }

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

