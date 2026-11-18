import * as React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

interface AccessDeniedStateProps {
  title?: string;
  description?: string;
  returnHref?: string;
  returnLabel?: string;
}

export function AccessDeniedState({
  title = "Acesso Restrito",
  description = "Você não possui autorização para acessar o recurso solicitado. Se você acredita que isto é um erro, contate o administrador do seu estabelecimento.",
  returnHref = "/dashboard",
  returnLabel = "Retornar ao início",
}: AccessDeniedStateProps) {
  return (
    <div className="max-w-lg w-full rounded-xl border border-surface-border bg-surface overflow-hidden">
      <div className="h-[3px] w-full bg-red-600 dark:bg-red-500" />
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-surface-border pb-4">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.12em] text-red-700 dark:text-red-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Governança RBAC · Bloqueio no Servidor</span>
          </div>
          <span className="font-mono text-lg font-bold text-red-700 dark:text-red-400 tabular-nums">
            403
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-foreground">
            {title}
          </h1>
          <p className="text-sm text-foreground-muted leading-relaxed">
            {description}
          </p>
        </div>

        <div className="pt-2">
          <Link
            href={returnHref}
            className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-[10px] bg-[#10131C] text-white dark:bg-accent dark:text-white hover:bg-[#1E2436] dark:hover:bg-accent-secondary text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {returnLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
