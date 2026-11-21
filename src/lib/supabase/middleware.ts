import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/environment/env";
import { isSecureCookieContext } from "@/lib/environment/cookie-options";
import {
  createMiddlewareAuthBridgeHeader,
  MW_AUTH_BRIDGE_HEADER,
} from "./auth-bridge";
import { logPerfSpan, perfNow } from "@/lib/perf/perf-trace";

export function getExpectedSupabaseCookiePrefix(): string {
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
  const tStart = perfNow();

  // Remove incondicionalmente qualquer header de ponte forjado pelo cliente
  const cleanHeaders = new Headers(request.headers);
  cleanHeaders.delete(MW_AUTH_BRIDGE_HEADER);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: cleanHeaders,
    },
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

  let pendingCookies: Array<{
    name: string;
    value: string;
    options?: Parameters<typeof supabaseResponse.cookies.set>[2];
  }> = [];

  const secureCookie =
    request.nextUrl.protocol === "https:" || isSecureCookieContext();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof supabaseResponse.cookies.set>[2];
          }>
        ) {
          pendingCookies = cookiesToSet.map((c) => ({
            ...c,
            options: {
              ...c.options,
              secure: secureCookie,
              sameSite: c.options?.sameSite ?? "lax",
            },
          }));
          pendingCookies.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: {
              headers: cleanHeaders,
            },
          });
          pendingCookies.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: Nunca remover getUser() — validação autoritativa junto ao GoTrue + refresh de sessão
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    logPerfSpan("middleware", "supabase.auth.getUser", perfNow() - tStart, {
      path: request.nextUrl.pathname,
      authenticated: Boolean(user),
    });

    if (user) {
      const bridgeToken = await createMiddlewareAuthBridgeHeader({
        user: {
          id: user.id,
          email: user.email || "",
          fullName:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : null,
          createdAt: user.created_at,
        },
        cookiesList: request.cookies.getAll(),
        cookiePrefix: expectedPrefix,
      });

      if (bridgeToken) {
        const forwardedHeaders = new Headers(cleanHeaders);
        forwardedHeaders.set(MW_AUTH_BRIDGE_HEADER, bridgeToken);
        const bridgedResponse = NextResponse.next({
          request: {
            headers: forwardedHeaders,
          },
        });
        pendingCookies.forEach(({ name, value, options }) =>
          bridgedResponse.cookies.set(name, value, options)
        );
        supabaseResponse = bridgedResponse;
      }
    }

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

