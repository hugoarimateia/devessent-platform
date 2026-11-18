import * as React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface SuspendedTenantStateProps {
  tenantName?: string;
}

export function SuspendedTenantState({ tenantName }: SuspendedTenantStateProps) {
  return (
    <div
      role="alert"
      className="p-6 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200 space-y-3 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 font-bold text-sm sm:text-base text-red-700 dark:text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          Estabelecimento Suspenso
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300">
          <ShieldAlert className="w-3 h-3" />
          Bloqueio RLS Ativo
        </span>
      </div>
      <p className="text-xs sm:text-sm text-red-700/90 dark:text-red-200/85 leading-relaxed">
        O acesso operacional {tenantName ? `a "${tenantName}"` : "a este estabelecimento"} foi
        suspenso temporariamente pela administração da DevEssent. Todas as operações de escrita,
        convites e alterações administrativas estão bloqueadas no banco de dados por políticas
        Row-Level Security.
      </p>
    </div>
  );
}

