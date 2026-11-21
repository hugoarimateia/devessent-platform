import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/environment/env";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import { isSecureCookieContext } from "@/lib/environment/cookie-options";

function createXamppSupabaseGuard() {
  const throwGuard = (prop: string | symbol) => {
    throw new Error(
      `VIOLAÇÃO DE AMBIENTE: Tentativa de acessar Supabase (${String(prop)}) enquanto APP_BACKEND_MODE=xampp-test. Use o adaptador MariaDB correspondente.`
    );
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined;
        return () => throwGuard(prop);
      },
    }
  ) as unknown as ReturnType<typeof createServerClient<Database>>;
}

export const createClient = cache(async () => {
  if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
    return createXamppSupabaseGuard();
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }>) {
          const secureCookie = isSecureCookieContext();
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                secure: secureCookie,
                sameSite: options?.sameSite ?? "lax",
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
});
