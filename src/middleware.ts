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

function buildPostAuthRedirectUrl(request: NextRequest): URL {
  const safeTarget = sanitizeRedirectUrl(
    request.nextUrl.searchParams.get("redirect"),
    "/dashboard"
  );
  const parsedTarget = new URL(safeTarget, "http://localhost");
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = parsedTarget.pathname;
  redirectUrl.search = parsedTarget.search;
  return redirectUrl;
}

function applyEdgeSecurityHeaders(
  response: NextResponse,
  pathname: string,
  isPrivate: boolean
): NextResponse {
  if (isPrivate) {
    response.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate"
    );
    const existingVary = response.headers.get("Vary");
    if (!existingVary) {
      response.headers.set("Vary", "Cookie");
    } else if (!existingVary.toLowerCase().includes("cookie")) {
      response.headers.set("Vary", `${existingVary}, Cookie`);
    }
  }

  if (process.env.NEXT_PUBLIC_APP_ENV === "staging") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  if (pathname.startsWith("/auth/") || pathname.startsWith("/convite")) {
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  return response;
}

function copyCookies(source: NextResponse, target: NextResponse): void {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/recuperar-senha") ||
    pathname.startsWith("/redefinir-senha");

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  const isPrivateEdgeRoute =
    isProtectedRoute ||
    isAuthRoute ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/convite") ||
    pathname.startsWith("/api");

  // Modo exclusivamente local XAMPP (desenvolvimento/testes sem Docker)
  if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
    const hasXamppSession = hasValidXamppCookieShape(request);

    if (hasXamppSession && (pathname.startsWith("/login") || pathname.startsWith("/recuperar-senha"))) {
      return applyEdgeSecurityHeaders(
        NextResponse.redirect(buildPostAuthRedirectUrl(request)),
        pathname,
        true
      );
    }

    if (!hasXamppSession && isProtectedRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      const originalDestination = sanitizeRedirectUrl(pathname + search, "/dashboard");
      loginUrl.searchParams.set("redirect", originalDestination);
      return applyEdgeSecurityHeaders(NextResponse.redirect(loginUrl), pathname, true);
    }

    return applyEdgeSecurityHeaders(
      NextResponse.next({ request }),
      pathname,
      isPrivateEdgeRoute
    );
  }

  // Modo Oficial: Supabase SSR
  const { supabaseResponse, user } = await updateSession(request);

  if (user && (pathname.startsWith("/login") || pathname.startsWith("/recuperar-senha"))) {
    const redirectRes = NextResponse.redirect(buildPostAuthRedirectUrl(request));
    copyCookies(supabaseResponse, redirectRes);
    return applyEdgeSecurityHeaders(redirectRes, pathname, true);
  }

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const originalDestination = sanitizeRedirectUrl(pathname + search, "/dashboard");
    loginUrl.searchParams.set("redirect", originalDestination);
    const redirectRes = NextResponse.redirect(loginUrl);
    copyCookies(supabaseResponse, redirectRes);
    return applyEdgeSecurityHeaders(redirectRes, pathname, true);
  }

  return applyEdgeSecurityHeaders(supabaseResponse, pathname, isPrivateEdgeRoute);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
