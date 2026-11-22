"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  HelpCircle,
  Lock,
  ShieldCheck,
} from "lucide-react";
import {
  authorizeOwnSubscriptionAction,
  updateOwnPaymentMethodAction,
} from "../actions/billing.actions";
import {
  BILLING_CYCLE_LABELS,
  BillingInvariants,
  CONTRACT_STATUS_META,
  INSTALLMENT_STATUS_META,
  INVOICE_STATUS_META,
  SUBSCRIPTION_STATUS_META,
} from "../domain/billing-invariants";
import type { TenantOwnerBillingView } from "../types/billing.types";

const TONE_BADGE: Record<string, string> = {
  neutral: "bg-surface-muted text-foreground-muted border-surface-border",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
  danger: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25",
};

function formatDateBr(iso: string | null): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export function TenantSubscriptionPanel({
  view,
  ownerEmail,
  ownerName,
}: {
  view: TenantOwnerBillingView;
  ownerEmail: string;
  ownerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [showCardForm, setShowCardForm] = React.useState(false);
  const [cardBrand, setCardBrand] = React.useState("Visa");
  const [cardLast4, setCardLast4] = React.useState("4242");
  const [acceptedByName, setAcceptedByName] = React.useState(ownerName);
  const [acceptTerms, setAcceptTerms] = React.useState(false);

  const sub = view.subscription;
  const subMeta = sub ? SUBSCRIPTION_STATUS_META[sub.status] : null;

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sub) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await authorizeOwnSubscriptionAction({
        subscriptionId: sub.id,
        paymentMethodType: "credit_card",
        cardBrand,
        cardLast4,
        payerEmail: ownerEmail,
        acceptRecurringTerms: true,
        acceptedByName,
      });
      if (!res.success) {
        setFeedback({ type: "error", text: res.error || "Não foi possível autorizar a assinatura." });
      } else {
        setFeedback({ type: "success", text: res.message || "Autorização registrada com sucesso." });
        setShowCardForm(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sub) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await updateOwnPaymentMethodAction({
        subscriptionId: sub.id,
        cardBrand,
        cardLast4,
      });
      if (!res.success) {
        setFeedback({ type: "error", text: res.error || "Falha ao atualizar forma de pagamento." });
      } else {
        setFeedback({
          type: "success",
          text: res.message || "Método de pagamento atualizado com segurança.",
        });
        setShowCardForm(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-accent/10 text-accent border border-accent/25">
            Contrato DevEssent Platform
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
            Ambiente {view.environmentLabel} · Sandbox
          </span>
        </div>
        <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
          Minha Assinatura
        </h1>
        <p className="text-xs sm:text-sm text-foreground-muted mt-0.5">
          Acompanhe o plano contratado por <strong>{view.tenantName}</strong> junto à DevEssent. Esta seção refere-se exclusivamente à mensalidade da plataforma e é independente das vendas da sua loja.
        </p>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedback.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Cartão Principal da Assinatura */}
      {!sub ? (
        <section className="p-6 rounded-2xl bg-surface border border-surface-border space-y-2">
          <h2 className="text-base font-bold font-display text-foreground">
            Nenhuma assinatura recorrente vinculada no momento
          </h2>
          <p className="text-xs text-foreground-muted">
            Quando sua empresa ativar um plano mensal de hospedagem e manutenção com a equipe comercial da DevEssent, os detalhes contratuais e faturas aparecerão aqui.
          </p>
        </section>
      ) : (
        <section className="p-6 rounded-2xl bg-surface border border-surface-border space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-border pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold font-display text-foreground">
                  {sub.planNameSnapshot}
                </h2>
                {subMeta && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${TONE_BADGE[subMeta.tone]}`}
                  >
                    {subMeta.label}
                  </span>
                )}
              </div>
              {view.plan?.description && (
                <p className="text-xs text-foreground-muted">{view.plan.description}</p>
              )}
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] font-mono uppercase text-foreground-muted block">
                Valor contratado ({BILLING_CYCLE_LABELS[sub.billingCycle]})
              </span>
              <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                {BillingInvariants.formatCentsToBrl(sub.contractedAmountCents)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-surface-muted/40 border border-surface-border">
              <span className="text-[11px] text-foreground-muted block">Data de ativação / início</span>
              <strong className="text-foreground font-mono">
                {formatDateBr(sub.activatedAt || sub.scheduledStartDate)}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-muted/40 border border-surface-border">
              <span className="text-[11px] text-foreground-muted block">Próxima cobrança</span>
              <strong className="text-foreground font-mono">
                {sub.status === "cancelled" ? "Encerrada" : formatDateBr(sub.nextBillingDate)}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-muted/40 border border-surface-border">
              <span className="text-[11px] text-foreground-muted block">Forma de pagamento</span>
              <strong className="text-foreground">
                {sub.paymentMethodLabel || "Aguardando autorização"}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-muted/40 border border-surface-border">
              <span className="text-[11px] text-foreground-muted block">Referência contratual</span>
              <strong className="text-foreground font-mono text-[11px]">{sub.externalReference}</strong>
            </div>
          </div>

          {view.plan && view.plan.includedServices.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">Serviços incluídos no plano</span>
              <div className="flex flex-wrap gap-1.5">
                {view.plan.includedServices.map((srv) => (
                  <span
                    key={srv}
                    className="px-2.5 py-1 rounded-lg bg-surface-muted border border-surface-border text-xs text-foreground-muted"
                  >
                    {srv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fluxo seguro de Autorização ou Atualização de Cartão (Sandbox Tokenizado) */}
          {sub.status !== "cancelled" && (
            <div className="pt-2 border-t border-surface-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-foreground-muted">
                  <Lock className="w-3.5 h-3.5 text-accent" />
                  <span>
                    Nenhum número completo de cartão ou CVV é armazenado na DevEssent Platform.
                  </span>
                </div>
                {view.providerStatus.mode === "official_sandbox_api" &&
                !sub.authorizedAt &&
                sub.authorizationUrl?.startsWith("https://") ? (
                  <a
                    href={sub.authorizationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="official-mp-authorize-link"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:brightness-105"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Autorizar no Mercado Pago (Sandbox)
                  </a>
                ) : (
                  <button
                    type="button"
                    data-testid="toggle-payment-method-btn"
                    onClick={() => setShowCardForm((v) => !v)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:brightness-105 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    {sub.authorizedAt
                      ? "Atualizar forma de pagamento"
                      : "Autorizar pagamento recorrente (Sandbox)"}
                  </button>
                )}
              </div>

              {showCardForm && (
                <form
                  onSubmit={sub.authorizedAt ? handleUpdatePaymentMethod : handleAuthorize}
                  className="p-4 rounded-xl bg-surface-muted/40 border border-surface-border space-y-3"
                >
                  <div className="text-xs font-semibold text-foreground">
                    {sub.authorizedAt
                      ? "Atualização tokenizada do cartão de crédito (Ambiente Sandbox)"
                      : "Autorização de cobrança recorrente por cartão de crédito (Ambiente Sandbox)"}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-foreground mb-1">
                        Bandeira (cartão de teste)
                      </label>
                      <select
                        value={cardBrand}
                        onChange={(e) => setCardBrand(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
                      >
                        <option value="Visa">Visa</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="Elo">Elo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-foreground mb-1">
                        Últimos 4 dígitos (token)
                      </label>
                      <input
                        required
                        maxLength={4}
                        pattern="[0-9]{4}"
                        value={cardLast4}
                        onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs font-mono text-foreground"
                      />
                    </div>
                    {!sub.authorizedAt && (
                      <div>
                        <label className="block text-[11px] font-semibold text-foreground mb-1">
                          Responsável pelo aceite
                        </label>
                        <input
                          required
                          value={acceptedByName}
                          onChange={(e) => setAcceptedByName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
                        />
                      </div>
                    )}
                  </div>
                  {!sub.authorizedAt && (
                    <label className="flex items-start gap-2 text-xs text-foreground-muted">
                      <input
                        type="checkbox"
                        required
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Confirmo a autorização de cobrança recorrente mensal em modo Sandbox para o plano{" "}
                        <strong>{sub.planNameSnapshot}</strong> ({BillingInvariants.formatCentsToBrl(sub.contractedAmountCents)}).
                      </span>
                    </label>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCardForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface text-xs text-foreground cursor-pointer"
                    >
                      Fechar
                    </button>
                    <button
                      type="submit"
                      disabled={busy || (!sub.authorizedAt && !acceptTerms)}
                      data-testid="confirm-billing-auth-btn"
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:brightness-105 disabled:opacity-50 cursor-pointer"
                    >
                      {sub.authorizedAt ? "Salvar método de pagamento" : "Confirmar autorização"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      {/* Histórico de Mensalidades */}
      <section className="rounded-2xl bg-surface border border-surface-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-sm font-bold font-display text-foreground">
            Histórico de Mensalidades ({view.invoices.length})
          </h2>
          <span className="text-[11px] font-mono text-foreground-muted">Somente leitura</span>
        </div>
        {view.invoices.length === 0 ? (
          <p className="p-5 text-xs text-foreground-muted">
            Nenhuma mensalidade faturada até o momento.
          </p>
        ) : (
          <div className="divide-y divide-surface-border">
            {view.invoices.map((inv) => {
              const meta = INVOICE_STATUS_META[inv.status];
              return (
                <div
                  key={inv.id}
                  className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-mono font-bold text-foreground">{inv.invoiceNumber}</div>
                    <div className="text-[11px] text-foreground-muted">
                      Ciclo {inv.billingCycleKey} · Vencimento {formatDateBr(inv.dueDate)}
                      {inv.paidAt ? ` · Pago em ${formatDateBr(inv.paidAt)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold tabular-nums text-foreground">
                      {BillingInvariants.formatCentsToBrl(inv.amountCents)}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${TONE_BADGE[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Contratos de Implantação 50/50 (transparência somente leitura) */}
      {view.implementationContracts.length > 0 && (
        <section className="rounded-2xl bg-surface border border-surface-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
            <h2 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-accent" />
              Contrato de Implantação do Projeto (50/50)
            </h2>
            <span className="text-[11px] font-mono text-foreground-muted">
              Negociação direta DevEssent
            </span>
          </div>
          <div className="divide-y divide-surface-border">
            {view.implementationContracts.map((ct) => {
              const cMeta = CONTRACT_STATUS_META[ct.status];
              return (
                <div key={ct.id} className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] text-accent font-bold mr-2">
                        {ct.contractCode}
                      </span>
                      <strong className="text-sm text-foreground">{ct.title}</strong>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${TONE_BADGE[cMeta.tone]}`}
                    >
                      {cMeta.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ct.installments.map((inst) => {
                      const iMeta = INSTALLMENT_STATUS_META[inst.status];
                      return (
                        <div
                          key={inst.id}
                          className="p-3 rounded-lg border border-surface-border bg-surface-muted/30 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-foreground">{inst.label}</div>
                            <div className="text-[11px] text-foreground-muted">
                              {inst.milestoneDescription}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold tabular-nums text-foreground">
                              {BillingInvariants.formatCentsToBrl(inst.amountCents)}
                            </div>
                            <span
                              className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TONE_BADGE[iMeta.tone]}`}
                            >
                              {iMeta.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Suporte & Condições de Cancelamento */}
      <section className="p-5 rounded-2xl bg-surface-muted/35 border border-surface-border grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-accent" />
            Suporte Comercial &amp; Financeiro DevEssent
          </div>
          <p className="text-foreground-muted">
            Para ajustes contratuais, segunda via de recibos ou alteração de plano, entre em contato com o atendimento da DevEssent informando a referência do seu estabelecimento.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-accent" />
            Condições de Cancelamento &amp; Continuidade
          </div>
          <p className="text-foreground-muted">
            O cancelamento pode ser solicitado junto à DevEssent com encerramento ao final do ciclo contratado. Falhas temporárias de cobrança geram aviso de regularização sem desligamento imediato da sua loja.
          </p>
        </div>
      </section>
    </div>
  );
}
