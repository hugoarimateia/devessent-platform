import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/environment/env";
import { isSecureCookieContext } from "@/lib/environment/cookie-options";

export function createClient() {
  const secureCookie =
    typeof window !== "undefined"
      ? window.location.protocol === "https:"
      : isSecureCookieContext();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: {
        secure: secureCookie,
        sameSite: "lax",
      },
    }
  );
}

