import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { RetailProductService } from "@/modules/retail/services/retail-product-service";
import { getScannerServerConfig } from "./env";

export type ScannerSupabaseClient = Parameters<typeof RetailProductService.listProducts>[0];

/**
 * Cliente Supabase Auth exclusivo do servidor (anon key, sem persistência em disco).
 * Utilizado somente para login com e-mail/senha e validação autoritativa de JWT (`auth.getUser`).
 */
export function createScannerAuthClient(): ScannerSupabaseClient {
  const cfg = getScannerServerConfig();
  return createClient<Database>(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as ScannerSupabaseClient;
}

/**
 * Cliente privilegiado (service_role) exclusivo do servidor.
 * Só deve ser obtido APÓS `requireScannerOwner()` validar dupla autorização
 * (sessão válida + UUID na allowlist + platform_admin) e verificação explícita do tenant alvo.
 */
export function createScannerPrivilegedClient(): ScannerSupabaseClient {
  const cfg = getScannerServerConfig();
  return createClient<Database>(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as ScannerSupabaseClient;
}
