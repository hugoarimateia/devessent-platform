import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { AuthService } from "@/core/auth/services/auth-service";
import type { StorefrontTemplate } from "../../types/retail.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

/**
 * Resolve o parâmetro `?preview_template=...` de forma segura:
 * Somente usuários autenticados da equipe técnica DevEssent (`platform_admin`)
 * podem pré-visualizar um template diferente do publicado no banco.
 * Visitantes anônimos, clientes e operadores sempre visualizam o template oficial publicado.
 */
export async function resolveAuthorizedPreviewTemplate(
  supabase: AppSupabaseClient,
  rawPreviewTemplate?: string
): Promise<StorefrontTemplate | undefined> {
  if (rawPreviewTemplate !== "editorial" && rawPreviewTemplate !== "experimental") {
    return undefined;
  }

  try {
    const sessionUser = await AuthService.getSessionUser(supabase);
    if (sessionUser?.isPlatformAdmin) {
      return rawPreviewTemplate;
    }
  } catch {
    // Falha de sessão trata o usuário como sem privilégio técnico
  }

  return undefined;
}
