"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type ActionState } from "@/app/actions/auth.actions";

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState<ActionState | null, FormData>(
    loginAction,
    null
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state && !state.success && state.error && (
        <div
          role="alert"
          className="p-3.5 rounded-[10px] border border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{state.error}</span>
        </div>
      )}

      {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}

      <div>
        <Label htmlFor="email" required>
          E-mail Corporativo
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
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label htmlFor="password" required className="mb-0">
            Senha de Acesso
          </Label>
          <Link
            href="/recuperar-senha"
            className="text-xs font-semibold text-accent hover:text-accent-secondary transition-colors"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            placeholder="••••••••"
            className="pl-10 pr-11 min-h-[46px]"
          />
          <Lock className="w-4 h-4 text-foreground-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-foreground-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        isLoading={isPending}
        disabled={isPending}
        className="w-full min-h-[48px] text-sm font-semibold"
      >
        <span>Entrar na Plataforma</span>
        {!isPending && <ArrowRight className="w-4 h-4" />}
      </Button>
    </form>
  );
}
