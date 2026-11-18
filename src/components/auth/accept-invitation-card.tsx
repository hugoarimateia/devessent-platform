"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, CheckCircle2, AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import {
  acceptInvitationAction,
  type MembershipActionState,
} from "@/app/actions/membership.actions";

interface AcceptInvitationCardProps {
  token: string;
  tenantName: string;
  tenantStatus?: string;
  role: string;
  email: string;
  status: string;
  isExpired: boolean;
  currentUserEmail?: string;
  isLoggedIn: boolean;
}

export function AcceptInvitationCard({
  token,
  tenantName,
  tenantStatus = "active",
  role,
  email,
  status,
  isExpired,
  currentUserEmail,
  isLoggedIn,
}: AcceptInvitationCardProps) {
  const [isPending, startTransition] = React.useTransition();
  const [feedback, setFeedback] = React.useState<MembershipActionState | null>(null);

  const isTenantSuspended = tenantStatus === "suspended";
  const isPendingStatus = status === "pending" && !isExpired && !isTenantSuspended;
  const emailMatches =
    isLoggedIn &&
    currentUserEmail &&
    currentUserEmail.toLowerCase() === email.toLowerCase();

  const handleAccept = () => {
    if (isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await acceptInvitationAction(token);
      if (result && !result.success) {
        setFeedback(result);
      }
    });
  };

  return (
    <div className="max-w-lg w-full mx-auto rounded-xl border border-surface-border bg-surface overflow-hidden">
      <div className="h-[3px] w-full bg-accent" />
      <div className="p-7 sm:p-8 space-y-6">
        <div className="space-y-2 border-b border-surface-border pb-5">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            <Building2 className="w-3.5 h-3.5" />
            <span>Vinculação de Estabelecimento</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-foreground">
            Convite de Estabelecimento
          </h1>
          <p className="text-sm text-foreground-muted">
            Você foi convidado para integrar a equipe operacional de{" "}
            <strong className="text-foreground font-semibold">{tenantName}</strong>.
          </p>
        </div>

        {/* Ficha do convite */}
        <dl className="divide-y divide-surface-border border-b border-surface-border text-sm">
          <div className="py-3 flex items-center justify-between gap-4">
            <dt className="text-xs font-medium text-foreground-muted">Estabelecimento</dt>
            <dd className="font-semibold text-foreground text-right">{tenantName}</dd>
          </div>
          <div className="py-3 flex items-center justify-between gap-4">
            <dt className="text-xs font-medium text-foreground-muted">Papel Concedido</dt>
            <dd>
              <RoleBadge role={role} />
            </dd>
          </div>
          <div className="py-3 flex items-center justify-between gap-4">
            <dt className="text-xs font-medium text-foreground-muted">Destinatário</dt>
            <dd className="font-mono text-xs text-foreground truncate">{email}</dd>
          </div>
        </dl>

        {/* Feedback de Erro */}
        {feedback && !feedback.success && (
          <div
            role="alert"
            className="p-3.5 rounded-[10px] border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{feedback.error}</span>
          </div>
        )}

        {/* Convite Indisponível ou Estabelecimento Suspenso */}
        {!isPendingStatus && (
          <div className="p-4 rounded-[10px] border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs space-y-1">
            <p className="font-bold">
              {isTenantSuspended ? "Estabelecimento Suspenso" : "Convite Indisponível"}
            </p>
            <p>
              {isTenantSuspended
                ? "Este estabelecimento encontra-se temporariamente suspenso. Não é possível aceitar o convite no momento."
                : isExpired || status === "expired"
                  ? "Este convite expirou o período de validade de 7 dias."
                  : status === "accepted"
                    ? "Este convite já foi aceito anteriormente."
                    : "Este convite foi revogado pela administração do estabelecimento."}
            </p>
          </div>
        )}

        {/* Não Autenticado */}
        {isPendingStatus && !isLoggedIn && (
          <div className="space-y-4">
            <p className="text-xs text-foreground-muted leading-relaxed">
              Para aceitar o convite, entre na plataforma utilizando a conta associada ao e-mail{" "}
              <strong className="text-foreground">{email}</strong>.
            </p>
            <Link
              href={`/login?redirect=/convite/${token}`}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[10px] bg-[#10131C] text-white dark:bg-accent text-sm font-semibold hover:bg-[#1E2436] dark:hover:bg-accent-secondary transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Entrar com {email}
            </Link>
          </div>
        )}

        {/* Autenticado com e-mail divergente */}
        {isPendingStatus && isLoggedIn && !emailMatches && (
          <div className="space-y-4">
            <div className="p-4 rounded-[10px] border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Identidade Divergente
              </p>
              <p className="leading-relaxed">
                Você está autenticado como <strong>{currentUserEmail}</strong>, mas este convite é exclusivo para <strong>{email}</strong>.
              </p>
            </div>
            <Link
              href={`/auth/logout?redirect=${encodeURIComponent(`/convite/${token}`)}`}
              className="w-full flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-[10px] border border-surface-border bg-surface text-foreground hover:bg-surface-muted text-xs font-semibold transition-colors"
            >
              Trocar de Conta
            </Link>
          </div>
        )}

        {/* Autenticado com e-mail correto */}
        {isPendingStatus && isLoggedIn && emailMatches && (
          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleAccept}
              isLoading={isPending}
              className="w-full"
              size="lg"
            >
              <CheckCircle2 className="w-4 h-4" />
              Aceitar Convite e Acessar
            </Button>
            <p className="text-xs text-foreground-muted">
              Ao confirmar, o estabelecimento será vinculado imediatamente à sua conta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
