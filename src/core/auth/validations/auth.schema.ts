import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "E-mail é obrigatório." })
    .trim()
    .toLowerCase()
    .email("Informe um endereço de e-mail válido."),
  password: z
    .string({ required_error: "Senha é obrigatória." })
    .min(6, "A senha deve conter no mínimo 6 caracteres."),
  rememberMe: z.boolean().optional().default(true),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "E-mail é obrigatório." })
    .trim()
    .toLowerCase()
    .email("Informe um endereço de e-mail válido."),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string({ required_error: "Nova senha é obrigatória." })
      .min(6, "A nova senha deve conter no mínimo 6 caracteres."),
    confirmPassword: z
      .string({ required_error: "Confirmação de senha é obrigatória." })
      .min(6, "A confirmação deve conter no mínimo 6 caracteres."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

/**
 * Validação de redirecionamento seguro para mitigar Open Redirects.
 * Garante que a URL seja estritamente relativa interna (começa com / e não // nem /\\).
 */
export function sanitizeRedirectUrl(url: string | null | undefined, fallback = "/dashboard"): string {
  if (!url || typeof url !== "string") {
    return fallback;
  }

  const trimmed = url.trim();

  // Rejeita protocolos absolutos (http:, https:, javascript:, data:) e barras duplas
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes(":")
  ) {
    return fallback;
  }

  // Previne redirecionamento para rotas de auth
  if (trimmed.startsWith("/login") || trimmed.startsWith("/recuperar-senha")) {
    return fallback;
  }

  return trimmed;
}

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

