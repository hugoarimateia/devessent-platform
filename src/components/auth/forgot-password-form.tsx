"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordAction } from "@/app/actions/auth.actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    setError(null);

    const formData = new FormData();
    formData.append("email", email);

    startTransition(async () => {
      try {
        const result = await forgotPasswordAction(null, formData);
        if (result.success) {
          setSubmitted(true);
        } else {
          setError(result.error || "Ocorreu um erro ao processar sua solicitação.");
        }
      } catch {
        setError("Erro de comunicação ao solicitar recuperação. Tente novamente.");
      }
    });
  };

  if (submitted) {
    return (
      <div className="space-y-6 p-6 rounded-xl border border-surface-border bg-surface-muted/40">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-[10px] bg-accent/12 text-accent border border-accent/25">
          <CheckCircle2 className="w-5 h-5" />
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Instruções enviadas
          </h2>
          <p className="text-sm text-foreground-muted leading-relaxed">
            Se o endereço{" "}
            <span className="text-foreground font-semibold">{email}</span> estiver
            cadastrado, enviamos um link seguro para redefinição da sua senha.
          </p>
        </div>

        <div className="pt-2 border-t border-surface-border">
          <Link
            href="/login"
            className="inline-flex items-center text-xs font-semibold text-accent hover:text-accent-secondary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-[10px] border border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{error}</span>
        </div>
      )}

      <div>
        <Label htmlFor="email" required>
          E-mail Cadastrado
        </Label>
        <div className="relative">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            placeholder="seu.email@empresa.com.br"
            className="pl-10 min-h-[46px]"
          />
          <Mail className="w-4 h-4 text-foreground-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <p className="mt-1.5 text-xs text-foreground-muted">
          Enviaremos um link de confirmação para este e-mail.
        </p>
      </div>

      <Button
        type="submit"
        isLoading={isPending}
        disabled={isPending || !email}
        className="w-full min-h-[46px] font-semibold"
      >
        {isPending ? "Enviando link..." : "Enviar Instruções"}
      </Button>

      <div className="pt-2">
        <Link
          href="/login"
          className="inline-flex items-center text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Voltar para o login
        </Link>
      </div>
    </form>
  );
}
