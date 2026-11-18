import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { sanitizeRedirectUrl } from "@/core/auth/validations/auth.schema";

export const metadata: Metadata = {
  title: "Entrar | DevEssent Platform",
  description: "Autenticação de usuários na plataforma DevEssent.",
};

interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const redirectParam =
    typeof resolvedSearchParams.redirect === "string"
      ? resolvedSearchParams.redirect
      : undefined;
  const safeRedirect = sanitizeRedirectUrl(redirectParam, "/dashboard");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
          Credenciais Corporativas
        </p>
        <h1 className="font-display text-[1.875rem] sm:text-[2.125rem] font-bold tracking-[-0.03em] text-foreground leading-[1.08]">
          Acesse sua conta
        </h1>
        <p className="text-sm text-foreground-muted leading-relaxed">
          Entre com seu e-mail e senha para abrir seu espaço de trabalho.
        </p>
      </header>

      <LoginForm redirectTo={safeRedirect} />
    </div>
  );
}
