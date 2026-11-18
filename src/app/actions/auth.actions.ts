"use server";

import { redirect } from "next/navigation";
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
import { isXamppTestMode } from "@/lib/environment/backend-mode";

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
  try {
    const supabase = await createClient();
    result = await AuthService.signInWithPassword(supabase, {
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
  if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
    const { XamppAuthAdapter } = await import("@/infrastructure/xampp-test/auth");
    await XamppAuthAdapter.signOut();
    redirect("/login");
  }

  const supabase = await createClient();
  await AuthService.signOut(supabase);
  redirect("/login");
}

