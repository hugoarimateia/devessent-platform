import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir Senha | DevEssent Platform",
  description: "Criação de nova senha de acesso na DevEssent Platform.",
};

export default function RedefinirSenhaPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
          Atualização de Credencial
        </p>
        <h1 className="font-display text-[1.75rem] sm:text-[2rem] font-bold tracking-[-0.03em] text-foreground leading-[1.1]">
          Definir Nova Senha
        </h1>
        <p className="text-sm text-foreground-muted leading-relaxed">
          Crie uma nova senha forte para retomar o acesso à sua conta.
        </p>
      </header>

      <ResetPasswordForm />
    </div>
  );
}
