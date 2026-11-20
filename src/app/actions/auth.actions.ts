"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sanitizeRedirectUrl,
} from "@/core/auth/validations/auth.schema";
import { AuthService } from "@/core/auth/services/auth-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import { RATE_LIMIT_POLICIES, RateLimitService } from "@/core/security";
import {
  getActiveTenantCookieName,
  isXamppTestMode,
} from "@/lib/environment/backend-mode";
import { isSecureCookieContext } from "@/lib/environment/cookie-options";

export interface ActionState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
}

/**
 * Server Action para autenticação com e-mail e senha.
 */
export async function loginAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const rawRedirect = formData.get("redirect")?.toString();

  const validated = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!validated.success) {
    return {
      success: false,
      error: "Preencha todos os campos obrigatórios corretamente.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  // Modo secundário local XAMPP/MariaDB (somente desenvolvimento/testes)
  if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
    const { XamppAuthAdapter } = await import("@/infrastructure/xampp-test/auth");
    const xamppResult = await XamppAuthAdapter.signInWithPassword({
      email: validated.data.email,
      password: validated.data.password,
    });

    if (!xamppResult.success) {
      return {
        success: false,
        error: xamppResult.error,
      };
    }

    const destination = sanitizeRedirectUrl(rawRedirect, "/dashboard");
    redirect(destination);
  }

  try {
    await RateLimitService.assertNotBlocked(RATE_LIMIT_POLICIES.authLoginFailure, validated.data.email);
  } catch (err: unknown) {
    // Se for erro de RateLimit, exibe; se for falha de conexão ao banco, não bloqueia silenciosamente com 500
    if (err instanceof Error && err.name === "RateLimitError") {
      return {
        success: false,
        error: toPublicErrorMessage(err),
      };
    }
    console.warn("[loginAction] Aviso ao verificar rate limit:", err instanceof Error ? err.message : err);
  }

  let result;
  let supabaseClient: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabaseClient = await createClient();
    result = await AuthService.signInWithPassword(supabaseClient, {
      email: validated.data.email,
      password: validated.data.password,
    });
  } catch (err: unknown) {
    console.error("[loginAction] Erro inesperado ao autenticar:", err instanceof Error ? err.message : err);
    return {
      success: false,
      error: "Não foi possível conectar ao servidor de autenticação. Tente novamente em instantes.",
    };
  }

  if (!result.success) {
    if ("isServiceUnavailable" in result && result.isServiceUnavailable) {
      return {
        success: false,
        error: result.error,
      };
    }

    const failureState = await RateLimitService.recordFailure(
      RATE_LIMIT_POLICIES.authLoginFailure,
      validated.data.email
    ).catch(() => ({ allowed: true, retryAfterSeconds: 0 }));

    return {
      success: false,
      error: failureState.allowed
        ? result.error
        : RATE_LIMIT_POLICIES.authLoginFailure.message,
    };
  }

  await RateLimitService.reset(
    RATE_LIMIT_POLICIES.authLoginFailure,
    validated.data.email
  ).catch(() => {});

  // Pré-define o cookie canônico de tenant (UUID) para o usuário autenticado,
  // permitindo paralelizar o bootstrap do workspace com as consultas RLS da página.
  if (supabaseClient && "user" in result && result.user?.id) {
    try {
      const { data: firstMembership } = await supabaseClient
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", result.user.id)
        .limit(1)
        .maybeSingle<{ tenant_id: string }>();

      const cookieStore = await cookies();
      if (firstMembership?.tenant_id) {
        cookieStore.set(getActiveTenantCookieName(), firstMembership.tenant_id, {
          path: "/",
          sameSite: "lax",
          httpOnly: true,
          secure: isSecureCookieContext(),
          maxAge: 60 * 60 * 24 * 30,
        });
      } else {
        cookieStore.delete(getActiveTenantCookieName());
      }
    } catch {
      // falha silenciosa: o workspace resolve normalmente sem cookie hint
    }
  }

  const destination = sanitizeRedirectUrl(rawRedirect, "/dashboard");
  redirect(destination);
}

/**
 * Server Action para solicitação de recuperação de senha por e-mail.
 */
export async function forgotPasswordAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawEmail = formData.get("email");

  const validated = forgotPasswordSchema.safeParse({
    email: rawEmail,
  });

  if (!validated.success) {
    return {
      success: false,
      error: "Informe um endereço de e-mail válido.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    await RateLimitService.consumeOrThrow(
      RATE_LIMIT_POLICIES.authForgotPassword,
      validated.data.email
    );
  } catch (err: unknown) {
    return {
      success: false,
      error: toPublicErrorMessage(err),
    };
  }

  const supabase = await createClient();
  const result = await AuthService.sendPasswordResetEmail(supabase, validated.data.email);

  return {
    success: true,
    message: result.message,
  };
}

/**
 * Server Action para redefinição de senha em contexto autenticado ou de recuperação.
 */
export async function resetPasswordAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawPassword = formData.get("password");
  const rawConfirmPassword = formData.get("confirmPassword");

  const validated = resetPasswordSchema.safeParse({
    password: rawPassword,
    confirmPassword: rawConfirmPassword,
  });

  if (!validated.success) {
    return {
      success: false,
      error: "A senha informada não atende aos requisitos mínimos.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const result = await AuthService.updateUserPassword(supabase, validated.data.password);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  redirect("/dashboard?status=password_updated");
}

/**
 * Server Action para encerramento de sessão (Logout).
 */
export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(getActiveTenantCookieName());
  } catch {
    // ignora caso headers não permitam mutação
  }

  if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
    const { XamppAuthAdapter } = await import("@/infrastructure/xampp-test/auth");
    await XamppAuthAdapter.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
  }

  const supabase = await createClient();
  await AuthService.signOut(supabase);
  revalidatePath("/", "layout");
  redirect("/login");
}

