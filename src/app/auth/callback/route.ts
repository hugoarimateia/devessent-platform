import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectUrl } from "@/core/auth/validations/auth.schema";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  const next = sanitizeRedirectUrl(nextParam, "/dashboard");

  const supabase = await createClient();

  // 1. Suporte ao fluxo de autorização PKCE / OAuth (via parâmetro code)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }

    console.error("❌ Falha na troca de código por sessão (Auth Callback):", error.message);
  }

  // 2. Suporte ao fluxo de verificação de token/OTP (via token_hash e type)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }

    console.error("❌ Falha na verificação de token_hash (Auth Callback):", error.message);
  }

  // 3. Em caso de ausência de credenciais válidas ou falha de verificação, redirecionar para login
  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin));
}

