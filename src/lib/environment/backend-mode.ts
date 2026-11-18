/**
 * Seleção explícita de infraestrutura da DevEssent Platform.
 *
 * - "supabase": Infraestrutura oficial definitiva (Supabase Local ou Supabase Cloud).
 * - "xampp-test": Segundo ambiente exclusivamente local (MariaDB/XAMPP) para testes cotidianos sem Docker.
 *
 * REGRA DE SEGURANÇA (Fail-Closed):
 * O modo "xampp-test" é estritamente proibido em builds/execuções de produção.
 */
export type AppBackendMode = "supabase" | "xampp-test";

export function getAppBackendMode(): AppBackendMode {
  const rawMode = process.env.APP_BACKEND_MODE?.trim() || "supabase";

  if (rawMode !== "supabase" && rawMode !== "xampp-test") {
    throw new Error(
      `APP_BACKEND_MODE inválido ("${rawMode}"). Valores permitidos: "supabase" ou "xampp-test".`
    );
  }

  if (process.env.NODE_ENV === "production" && rawMode === "xampp-test") {
    throw new Error(
      "VIOLAÇÃO CRÍTICA DE AMBIENTE (Fail-Closed): O modo de testes XAMPP (xampp-test) é estritamente proibido em produção."
    );
  }

  return rawMode;
}

export function isXamppTestMode(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return getAppBackendMode() === "xampp-test";
}

export const BACKEND_COOKIES = {
  supabaseActiveTenant: "devessent_active_tenant",
  xamppSession: "devessent_xampp_session",
  xamppActiveTenant: "devessent_xampp_active_tenant",
} as const;

export function getActiveTenantCookieName(): string {
  return isXamppTestMode()
    ? BACKEND_COOKIES.xamppActiveTenant
    : BACKEND_COOKIES.supabaseActiveTenant;
}

