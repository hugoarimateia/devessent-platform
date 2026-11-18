import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectUrl } from "@/core/auth/validations/auth.schema";

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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(buildLogoutDestination(request), {
    status: 303,
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(buildLogoutDestination(request));
}


