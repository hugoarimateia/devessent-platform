import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectUrl } from "@/core/auth/validations/auth.schema";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";

function buildLogoutDestination(request: NextRequest): URL {
  const redirectParam = request.nextUrl.searchParams.get("redirect");
  if (!redirectParam) {
    return new URL("/login", request.nextUrl.origin);
  }
  const safeRedirect = sanitizeRedirectUrl(redirectParam, "/dashboard");
  const target = new URL("/login", request.nextUrl.origin);
  target.searchParams.set("redirect", safeRedirect);
  return target;
}

async function performLogout(request: NextRequest, status = 307): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(getActiveTenantCookieName());
  } catch {
    // ignora caso headers não permitam mutação
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  const res = NextResponse.redirect(buildLogoutDestination(request), { status });
  res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  res.headers.set("Vary", "Cookie");
  return res;
}

export async function POST(request: NextRequest) {
  return performLogout(request, 303);
}

export async function GET(request: NextRequest) {
  return performLogout(request, 307);
}


