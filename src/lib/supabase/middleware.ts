import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/environment/env";

function getExpectedSupabaseCookiePrefix(): string {
  try {
    const hostname = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    const ref = hostname.split(".")[0];
    if (ref && /^[a-z0-9-]+$/i.test(ref)) {
      return `sb-${ref}-`;
    }
  } catch {
    // fallback seguro
  }
  return "sb-";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Verifica somente cookies de sessão pertencentes ao projeto Supabase ativo,
  // evitando reutilização ou roundtrips desnecessários com cookies de outro ambiente.
  const expectedPrefix = getExpectedSupabaseCookiePrefix();
  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith(expectedPrefix));

  if (!hasAuthCookie) {
    return { supabaseResponse, user: null };
  }

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof supabaseResponse.cookies.set>[2] }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: Nunca remover getClaims / getUser para refresh seguro da sessão
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { supabaseResponse, user };
  } catch (err) {
    // Falha de conexão com o serviço de autenticação não deve derrubar rotas públicas com 500
    console.warn(
      "[Supabase Middleware] Falha ao validar sessão com o servidor de autenticação:",
      err instanceof Error ? err.message : "Erro desconhecido"
    );
    return { supabaseResponse, user: null };
  }
}

