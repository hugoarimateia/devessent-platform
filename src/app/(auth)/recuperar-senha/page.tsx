import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar Senha | DevEssent Platform",
  description: "Recuperação de acesso e redefinição de senha da plataforma DevEssent.",
};

export default function RecuperarSenhaPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
          Segurança da Conta
        </p>
        <h1 className="font-display text-[1.75rem] sm:text-[2rem] font-bold tracking-[-0.03em] text-foreground leading-[1.1]">
          Recuperação de Acesso
        </h1>
        <p className="text-sm text-foreground-muted leading-relaxed">
          Informe seu e-mail corporativo para receber as instruções de recuperação.
        </p>
      </header>

      <ForgotPasswordForm />
    </div>
  );
}
