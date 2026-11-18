import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { sanitizeRedirectUrl } from "@/core/auth/validations/auth.schema";
import { BACKEND_COOKIES, isXamppTestMode } from "@/lib/environment/backend-mode";

function hasValidXamppCookieShape(request: NextRequest): boolean {
  const token = request.cookies.get(BACKEND_COOKIES.xamppSession)?.value;
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  try {
    const base64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64)) as { userId?: string; exp?: number };
    return Boolean(json.userId && json.exp && Date.now() < json.exp);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/recuperar-senha");

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  // Modo exclusivamente local XAMPP (desenvolvimento/testes sem Docker)
  if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
    const hasXamppSession = hasValidXamppCookieShape(request);

    if (hasXamppSession && isAuthRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    if (!hasXamppSession && isProtectedRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      const originalDestination = sanitizeRedirectUrl(pathname + search, "/dashboard");
      loginUrl.searchParams.set("redirect", originalDestination);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next({ request });
  }

  // Modo Oficial: Supabase SSR
  const { supabaseResponse, user } = await updateSession(request);

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const originalDestination = sanitizeRedirectUrl(pathname + search, "/dashboard");
    loginUrl.searchParams.set("redirect", originalDestination);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
