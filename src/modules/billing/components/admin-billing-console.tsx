"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileText,
  Layers,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
  Webhook,
  XCircle,
} from "lucide-react";
import {
  attachInstallmentReceiptAction,
  cancelBillingSubscriptionAction,
  confirmImplementationInstallmentAction,
  confirmSubscriptionActivationAction,
  createBillingPlanAction,
  createBillingSubscriptionAction,
  createImplementationContractAction,
  runOfficialProviderDiagnosticAction,
  simulateSandboxChargeAction,
  syncSubscriptionFromProviderAction,
  updateBillingPlanAction,
  updateImplementationContractAction,
  updateSubscriptionContractAction,
} from "../actions/billing.actions";
import {
  BILLING_CYCLE_LABELS,
  BillingInvariants,
  CONTRACT_STATUS_META,
  INSTALLMENT_STATUS_META,
  INVOICE_STATUS_META,
  MANUAL_PAYMENT_METHOD_LABELS,
  SUBSCRIPTION_STATUS_META,
} from "../domain/billing-invariants";
import type {
  BillingCycle,
  GlobalBillingOverview,
  ManualPaymentMethod,
} from "../types/billing.types";

type AdminTab = "overview" | "plans" | "subscriptions" | "contracts";

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

export function AdminBillingConsole({ overview }: { overview: GlobalBillingOverview }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<AdminTab>("overview");
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Formulário Novo Plano
  const [planCode, setPlanCode] = React.useState("");
  const [planName, setPlanName] = React.useState("");
  const [planDesc, setPlanDesc] = React.useState("");
  const [planReais, setPlanReais] = React.useState("149,90");
  const [planCycle, setPlanCycle] = React.useState<BillingCycle>("monthly");
  const [planServices, setPlanServices] = React.useState(
    "Hospedagem gerenciada\nManutenção e atualizações\nSuporte comercial DevEssent"
  );
  const [planIsDemo, setPlanIsDemo] = React.useState(true);

  // Formulário Nova Assinatura
  const [subTenantId, setSubTenantId] = React.useState(overview.tenantsDirectory[0]?.id ?? "");
  const [subPlanId, setSubPlanId] = React.useState(
    overview.plans.find((p) => p.isActive)?.id ?? ""
  );
  const [subCustomReais, setSubCustomReais] = React.useState("");
  const [subStartDate, setSubStartDate] = React.useState(
    new Date().toISOString().slice(0, 10)
  );
  const [subGraceDays, setSubGraceDays] = React.useState("7");
  const [subAcceptedBy, setSubAcceptedBy] = React.useState("");
  const [subSandboxPayerEmail, setSubSandboxPayerEmail] = React.useState("");
  const [subNotes, setSubNotes] = React.useState("");

  // Formulário Novo Contrato 50/50
  const [ctTenantId, setCtTenantId] = React.useState(overview.tenantsDirectory[0]?.id ?? "");
  const [ctTitle, setCtTitle] = React.useState("");
  const [ctScope, setCtScope] = React.useState("");
  const [ctTotalReais, setCtTotalReais] = React.useState("2500,00");
  const [ctEntryPct, setCtEntryPct] = React.useState("50");
  const [ctCustomTerms, setCtCustomTerms] = React.useState("");
  const [ctAcceptedBy, setCtAcceptedBy] = React.useState("");

  // Modal inline simples para confirmar parcela manual
  const [confirmingInstId, setConfirmingInstId] = React.useState<string | null>(null);
  const [confirmMethod, setConfirmMethod] = React.useState<ManualPaymentMethod>("pix_manual");
  const [confirmNote, setConfirmNote] = React.useState("");

  const runAction = async (fn: () => Promise<{ success: boolean; message?: string; error?: string }>) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fn();
      if (!res.success) {
        setFeedback({ type: "error", text: res.error || "Operação não concluída." });
      } else {
        setFeedback({ type: "success", text: res.message || "Operação realizada com sucesso." });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amountCents = BillingInvariants.parseReaisToCents(planReais);
      const services = planServices
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      await runAction(() =>
        createBillingPlanAction({
          code: planCode,
          name: planName,
          description: planDesc || null,
          amountCents,
          billingCycle: planCycle,
          includedServices: services,
          isDemo: planIsDemo,
        })
      );
      setPlanCode("");
      setPlanName("");
      setPlanDesc("");
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Valor inválido." });
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const contractedAmountCents = subCustomReais.trim()
        ? BillingInvariants.parseReaisToCents(subCustomReais)
        : undefined;
      await runAction(() =>
        createBillingSubscriptionAction({
          tenantId: subTenantId,
          planId: subPlanId,
          contractedAmountCents,
          scheduledStartDate: subStartDate,
          gracePeriodDays: Number(subGraceDays || 7),
          contractAcceptedByName: subAcceptedBy || null,
          sandboxPayerEmail: subSandboxPayerEmail.trim() || null,
          adminNotes: subNotes || null,
        })
      );
      setSubCustomReais("");
      setSubSandboxPayerEmail("");
      setSubNotes("");
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Dados inválidos." });
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalAmountCents = BillingInvariants.parseReaisToCents(ctTotalReais);
      await runAction(() =>
        createImplementationContractAction({
          tenantId: ctTenantId,
          title: ctTitle,
          scopeSummary: ctScope,
          totalAmountCents,
          entryPercent: Number(ctEntryPct || 50),
          entryMilestone: `${ctEntryPct || 50}% antes do início do desenvolvimento`,
          balanceMilestone: `${100 - Number(ctEntryPct || 50)}% na entrega e aceite do projeto`,
          customTermsNote: ctCustomTerms || null,
          acceptedByName: ctAcceptedBy || null,
        })
      );
      setCtTitle("");
      setCtScope("");
      setCtCustomTerms("");
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Dados inválidos." });
    }
  };

  const handleUploadReceipt = async (installmentId: string, file: File | null) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("installmentId", installmentId);
    fd.append("reportedPaymentMethod", "pix_manual");
    fd.append("file", file);
    await runAction(() => attachInstallmentReceiptAction(fd));
  };

  const previewSplit = React.useMemo(() => {
    try {
      const cents = BillingInvariants.parseReaisToCents(ctTotalReais);
      return BillingInvariants.calculateImplementationSplit(cents, Number(ctEntryPct || 50));
    } catch {
      return null;
    }
  }, [ctTotalReais, ctEntryPct]);

  const { metrics, providerStatus } = overview;

  return (
    <div className="space-y-6">
      {/* Cabeçalho + Separação explícita Staging/Sandbox */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase">
              Ambiente {overview.environmentLabel} · Sandbox
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-surface-muted text-foreground-muted border border-surface-border">
              {providerStatus.mode === "official_sandbox_api"
                ? "Mercado Pago Assinaturas (API Sandbox)"
                : "Simulador Interno Sandbox (credenciais MP pendentes)"}
            </span>
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
            Comercial &amp; Billing SaaS — DevEssent
          </h1>
          <p className="text-xs sm:text-sm text-foreground-muted mt-0.5">
            Receitas próprias da software house: mensalidades recorrentes (Fluxo B) e contratos de implantação 50/50 (Fluxo C). Isolado das vendas Retail dos clientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            disabled={busy}
            data-testid="billing-provider-diagnostic-btn"
            onClick={() => runAction(() => runOfficialProviderDiagnosticAction())}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-surface-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            Diagnosticar Provedor MP
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-surface-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar indicadores
          </button>
        </div>
      </div>

      {/* Aviso transparente do adaptador, validade da configuração e política de não suspensão */}
      <div
        className={`rounded-xl border px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
          providerStatus.configValid
            ? "border-surface-border bg-surface-muted/40 text-foreground-muted"
            : "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300"
        }`}
      >
        <div className="flex items-start sm:items-center gap-2">
          {providerStatus.configValid ? (
            <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 sm:mt-0" />
          )}
          <span>
            <strong className="text-foreground">
              {providerStatus.configValid ? "Governança ativa:" : "Atenção (fail-closed):"}
            </strong>{" "}
            {providerStatus.statusNote} Cobranças reais estão bloqueadas (fail-closed) e nenhuma loja é suspensa automaticamente em caso de atraso.
          </span>
        </div>
        <span className="font-mono text-[11px] shrink-0 text-foreground">
          Webhook: {providerStatus.webhookEndpointPath} ({providerStatus.webhookAuthMode})
        </span>
      </div>

      {/* Feedback de ação */}
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
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Abas */}
      <div className="flex flex-wrap gap-2 border-b border-surface-border pb-3">
        {(
          [
            { id: "overview", label: "Visão Geral", icon: Layers },
            { id: "plans", label: `Planos (${overview.plans.length})`, icon: FileText },
            {
              id: "subscriptions",
              label: `Assinaturas (${overview.subscriptions.length})`,
              icon: CreditCard,
            },
            {
              id: "contracts",
              label: `Contratos 50/50 (${overview.implementationContracts.length})`,
              icon: FileCheck2,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`billing-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? "bg-accent text-white shadow-xs"
                  : "bg-surface border border-surface-border text-foreground-muted hover:text-foreground hover:bg-surface-muted"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== ABA 1: VISÃO GERAL ==================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-surface border border-surface-border space-y-1">
              <span className="text-[11px] font-mono uppercase text-foreground-muted">
                MRR Ativo (Mensalidades)
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                {BillingInvariants.formatCentsToBrl(metrics.mrrActiveCents)}
              </div>
              <p className="text-[11px] text-foreground-muted">
                {metrics.activeSubscriptionsCount} assinatura(s) ativa(s) · {metrics.contractedCompaniesCount} empresa(s) contratante(s)
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-surface-border space-y-1">
              <span className="text-[11px] font-mono uppercase text-foreground-muted">
                Mensalidades Recebidas (Pagas)
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {BillingInvariants.formatCentsToBrl(metrics.paidInvoicesPeriodCents)}
              </div>
              <p className="text-[11px] text-foreground-muted">
                Pendentes: {BillingInvariants.formatCentsToBrl(metrics.pendingInvoicesCents)} (não somadas à receita)
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-surface-border space-y-1">
              <span className="text-[11px] font-mono uppercase text-foreground-muted">
                Inadimplência &amp; Atenção
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {metrics.delinquentSubscriptionsCount}
              </div>
              <p className="text-[11px] text-foreground-muted">
                Em atraso: {BillingInvariants.formatCentsToBrl(metrics.overdueInvoicesCents)} · Pend. ativação: {metrics.pendingSetupSubscriptionsCount}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-surface-border space-y-1">
              <span className="text-[11px] font-mono uppercase text-foreground-muted">
                Implantação 50/50 (Fluxo C)
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                {BillingInvariants.formatCentsToBrl(metrics.confirmedImplementationCents)}
              </div>
              <p className="text-[11px] text-foreground-muted">
                Confirmado · A receber: {BillingInvariants.formatCentsToBrl(metrics.pendingImplementationCents)} ({metrics.activeImplementationContractsCount} contrato(s))
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Faturas recentes */}
            <section className="rounded-xl bg-surface border border-surface-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
                <h2 className="text-sm font-bold font-display text-foreground">
                  Cobranças Recorrentes Recentes ({overview.recentInvoices.length})
                </h2>
                <span className="text-[11px] font-mono text-foreground-muted">Fluxo B · SaaS</span>
              </div>
              {overview.recentInvoices.length === 0 ? (
                <p className="p-5 text-xs text-foreground-muted">
                  Nenhuma fatura recorrente registrada até o momento.
                </p>
              ) : (
                <div className="divide-y divide-surface-border">
                  {overview.recentInvoices.slice(0, 8).map((inv) => {
                    const meta = INVOICE_STATUS_META[inv.status];
                    return (
                      <div
                        key={inv.id}
                        className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">
                            {inv.tenantName || inv.tenantId} ·{" "}
                            <span className="font-mono">{inv.invoiceNumber}</span>
                          </div>
                          <div className="text-[11px] text-foreground-muted">
                            Ciclo {inv.billingCycleKey} · Venc. {formatDateBr(inv.dueDate)} ·{" "}
                            {inv.attemptCount} tentativa(s)
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <div className="font-mono font-bold tabular-nums text-foreground">
                            {BillingInvariants.formatCentsToBrl(inv.amountCents)}
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TONE_BADGE[meta.tone]}`}
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

            {/* Webhooks exclusivos do Billing SaaS */}
            <section className="rounded-xl bg-surface border border-surface-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
                <h2 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-accent" />
                  Webhooks Billing SaaS ({overview.recentWebhooks.length})
                </h2>
                <span className="text-[11px] font-mono text-foreground-muted">HMAC-SHA256</span>
              </div>
              {overview.recentWebhooks.length === 0 ? (
                <p className="p-5 text-xs text-foreground-muted">
                  Nenhum evento de webhook Billing recebido ainda.
                </p>
              ) : (
                <div className="divide-y divide-surface-border">
                  {overview.recentWebhooks.slice(0, 8).map((wh) => (
                    <div
                      key={wh.id}
                      className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-semibold text-foreground truncate">
                          {wh.eventType} ({wh.resourceType})
                        </div>
                        <div className="text-[11px] text-foreground-muted truncate">
                          {wh.externalEventId} · {formatDateBr(wh.receivedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            wh.signatureVerified ? TONE_BADGE.success : TONE_BADGE.danger
                          }`}
                        >
                          {wh.signatureVerified ? "HMAC OK" : "Assinatura Inválida"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-muted border border-surface-border text-foreground-muted">
                          {wh.processingStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ==================== ABA 2: PLANOS SAAS ==================== */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-7 space-y-3">
            {overview.plans.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface border border-surface-border text-xs text-foreground-muted">
                Nenhum plano comercial cadastrado ainda. Crie planos de demonstração no formulário ao lado.
              </div>
            ) : (
              overview.plans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-5 rounded-xl bg-surface border border-surface-border space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold font-display text-foreground">
                          {plan.name}
                        </h3>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-muted border border-surface-border text-foreground-muted">
                          {plan.code} · v{plan.version}
                        </span>
                        {plan.isDemo && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-semibold">
                            Demo Staging
                          </span>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-xs text-foreground-muted mt-1">{plan.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono tabular-nums text-foreground">
                        {BillingInvariants.formatCentsToBrl(plan.amountCents)}
                      </div>
                      <div className="text-[11px] text-foreground-muted">
                        {BILLING_CYCLE_LABELS[plan.billingCycle]} · {plan.linkedSubscriptionsCount ?? 0}{" "}
                        assinatura(s)
                      </div>
                    </div>
                  </div>

                  {plan.includedServices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {plan.includedServices.map((srv) => (
                        <span
                          key={srv}
                          className="text-[11px] px-2.5 py-0.5 rounded-full bg-surface-muted border border-surface-border text-foreground-muted"
                        >
                          {srv}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-surface-border flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        plan.isActive ? TONE_BADGE.success : TONE_BADGE.neutral
                      }`}
                    >
                      {plan.isActive ? "Ativo para novas contratações" : "Desativado"}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(() =>
                          updateBillingPlanAction({
                            planId: plan.id,
                            isActive: !plan.isActive,
                            reason: plan.isActive
                              ? "Desativação administrativa do plano para novas contratações"
                              : "Reativação administrativa do plano",
                          })
                        )
                      }
                      className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground cursor-pointer disabled:opacity-50"
                    >
                      {plan.isActive ? "Desativar plano" : "Reativar plano"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleCreatePlan}
            className="xl:col-span-5 p-5 rounded-xl bg-surface border border-surface-border space-y-4"
          >
            <h2 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-accent" />
              Criar Plano Comercial SaaS
            </h2>
            <p className="text-[11px] text-foreground-muted">
              Alterações futuras de preço em planos não modificam o valor contratado das assinaturas existentes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Código único
                </label>
                <input
                  required
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value)}
                  placeholder="ex: essencial-demo"
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Nome do plano
                </label>
                <input
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Ex.: Plano Essencial Demo"
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Valor (R$)
                </label>
                <input
                  required
                  value={planReais}
                  onChange={(e) => setPlanReais(e.target.value)}
                  placeholder="149,90"
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs font-mono text-foreground"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Periodicidade
                </label>
                <select
                  value={planCycle}
                  onChange={(e) => setPlanCycle(e.target.value as BillingCycle)}
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
                >
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="semiannual">Semestral</option>
                  <option value="annual">Anual</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                Descrição comercial
              </label>
              <input
                value={planDesc}
                onChange={(e) => setPlanDesc(e.target.value)}
                placeholder="Hospedagem, manutenção e suporte contínuo"
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                Serviços incluídos (1 por linha)
              </label>
              <textarea
                rows={3}
                value={planServices}
                onChange={(e) => setPlanServices(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground-muted">
              <input
                type="checkbox"
                checked={planIsDemo}
                onChange={(e) => setPlanIsDemo(e.target.checked)}
              />
              Marcar como plano de demonstração (Staging)
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-xl bg-accent text-white text-xs font-semibold hover:brightness-105 disabled:opacity-50 cursor-pointer"
            >
              Cadastrar Plano Comercial
            </button>
          </form>
        </div>
      )}

      {/* ==================== ABA 3: ASSINATURAS ==================== */}
      {activeTab === "subscriptions" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-4">
            {overview.subscriptions.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface border border-surface-border text-xs text-foreground-muted">
                Nenhuma assinatura vinculada ainda. Utilize o formulário ao lado para vincular uma empresa a um plano.
              </div>
            ) : (
              overview.subscriptions.map((sub) => {
                const statusMeta = SUBSCRIPTION_STATUS_META[sub.status];
                const readiness = BillingInvariants.evaluateBillingStartReadiness({
                  status: sub.status,
                  authorizedAt: sub.authorizedAt,
                  activationConfirmedAt: sub.activationConfirmedAt,
                  scheduledStartDate: sub.scheduledStartDate,
                });

                return (
                  <div
                    key={sub.id}
                    className="p-5 rounded-xl bg-surface border border-surface-border space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Building2 className="w-4 h-4 text-accent" />
                          <h3 className="text-sm font-bold font-display text-foreground">
                            {sub.tenantName || sub.tenantId}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TONE_BADGE[statusMeta.tone]}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="text-xs text-foreground-muted mt-1">
                          Plano <strong>{sub.planNameSnapshot}</strong> (v{sub.planVersionSnapshot}) ·{" "}
                          {BILLING_CYCLE_LABELS[sub.billingCycle]} · Início agendado:{" "}
                          <span className="font-mono">{formatDateBr(sub.scheduledStartDate)}</span> ·
                          Próx. vencimento:{" "}
                          <span className="font-mono">{formatDateBr(sub.nextBillingDate)}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold font-mono tabular-nums text-foreground">
                          {BillingInvariants.formatCentsToBrl(sub.contractedAmountCents)}
                        </div>
                        <div className="text-[11px] text-foreground-muted">
                          {sub.paymentMethodLabel || "Pagamento ainda não autorizado"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] bg-surface-muted/40 p-3 rounded-lg border border-surface-border">
                      <div>
                        <span className="text-foreground-muted block">Autorização do empresário</span>
                        <strong className="text-foreground">
                          {sub.authorizedAt ? `Autorizada (${formatDateBr(sub.authorizedAt)})` : "Pendente"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-foreground-muted block">Marco de ativação DevEssent</span>
                        <strong className="text-foreground">
                          {sub.activationConfirmedAt
                            ? `Confirmado (${formatDateBr(sub.activationConfirmedAt)})`
                            : "Aguardando confirmação"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-foreground-muted block">Tolerância / Falhas</span>
                        <strong className="text-foreground">
                          {sub.gracePeriodDays} dia(s) · {sub.consecutiveFailedCharges} recusa(s)
                        </strong>
                      </div>
                    </div>

                    {sub.status === "past_due" && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          Alerta administrativo de inadimplência desde {formatDateBr(sub.delinquentSince)}. A loja pública do cliente permanece ativa (sem suspensão automática).
                        </span>
                      </div>
                    )}

                    {/* Controles operacionais */}
                    {sub.status !== "cancelled" && (
                      <div className="pt-2 border-t border-surface-border flex flex-wrap gap-2">
                        {!sub.activationConfirmedAt && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(() =>
                                confirmSubscriptionActivationAction(
                                  sub.id,
                                  "Marco contratual de ativação confirmado pelo administrador DevEssent."
                                )
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:brightness-105 cursor-pointer disabled:opacity-50"
                          >
                            Confirmar Marco de Ativação
                          </button>
                        )}

                        {readiness.canCharge &&
                          providerStatus.mode === "internal_sandbox_simulator" &&
                          overview.environmentLabel !== "production" && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(() =>
                                  simulateSandboxChargeAction({
                                    subscriptionId: sub.id,
                                    outcome: "paid",
                                  })
                                )
                              }
                              className="px-3 py-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 cursor-pointer disabled:opacity-50"
                            >
                              Simular Cobrança Paga (Sandbox)
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(() =>
                                  simulateSandboxChargeAction({
                                    subscriptionId: sub.id,
                                    outcome: "failed",
                                    failureReason: "Recusa simulada por limite insuficiente (Sandbox)",
                                  })
                                )
                              }
                              className="px-3 py-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/20 cursor-pointer disabled:opacity-50"
                            >
                              Simular Recusa (Sandbox)
                            </button>
                          </>
                        )}

                        {providerStatus.mode === "official_sandbox_api" &&
                          sub.externalSubscriptionId && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(() => syncSubscriptionFromProviderAction(sub.id))
                              }
                              className="px-3 py-1.5 rounded-lg border border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300 text-xs font-semibold hover:bg-sky-500/20 cursor-pointer disabled:opacity-50"
                            >
                              Sincronizar Mercado Pago
                            </button>
                          )}

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(() =>
                              updateSubscriptionContractAction({
                                subscriptionId: sub.id,
                                adminNotes: `Exceção/revisão registrada em ${new Date().toISOString().slice(0, 10)}`,
                                reason: "Registro de revisão administrativa na assinatura",
                              })
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted text-xs font-medium text-foreground cursor-pointer disabled:opacity-50"
                        >
                          Registrar Revisão
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(() =>
                              cancelBillingSubscriptionAction({
                                subscriptionId: sub.id,
                                mode: "at_period_end",
                                reason: "Cancelamento agendado ao fim do período vigente",
                              })
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-500/20 cursor-pointer disabled:opacity-50"
                        >
                          Agendar Cancelamento
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          data-testid="billing-cancel-immediate-btn"
                          onClick={() =>
                            runAction(() =>
                              cancelBillingSubscriptionAction({
                                subscriptionId: sub.id,
                                mode: "immediate",
                                reason: "Cancelamento imediato solicitado pelo administrador DevEssent",
                              })
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-rose-600/40 bg-rose-600 text-white text-xs font-semibold hover:brightness-105 cursor-pointer disabled:opacity-50"
                        >
                          Cancelar Imediatamente
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Formulário vincular empresa */}
          <form
            onSubmit={handleCreateSubscription}
            className="xl:col-span-4 p-5 rounded-xl bg-surface border border-surface-border space-y-4"
          >
            <h2 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-accent" />
              Vincular Empresa a Plano
            </h2>
            <p className="text-[11px] text-foreground-muted">
              A assinatura inicia em <strong>Aguardando autorização financeira</strong> e só cobra após autorização do empresário e marco contratual.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Empresa</label>
              <select
                required
                value={subTenantId}
                onChange={(e) => setSubTenantId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
              >
                {overview.tenantsDirectory.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Plano</label>
              <select
                required
                value={subPlanId}
                onChange={(e) => setSubPlanId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
              >
                <option value="">Selecione um plano ativo...</option>
                {overview.plans
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {BillingInvariants.formatCentsToBrl(p.amountCents)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Valor acordado (opcional)
                </label>
                <input
                  value={subCustomReais}
                  onChange={(e) => setSubCustomReais(e.target.value)}
                  placeholder="Usa valor do plano"
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs font-mono text-foreground"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Início cobranças
                </label>
                <input
                  type="date"
                  required
                  value={subStartDate}
                  onChange={(e) => setSubStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Tolerância (dias)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={subGraceDays}
                  onChange={(e) => setSubGraceDays(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs font-mono text-foreground"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Responsável aceite
                </label>
                <input
                  value={subAcceptedBy}
                  onChange={(e) => setSubAcceptedBy(e.target.value)}
                  placeholder="Nome do empresário"
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                E-mail pagador Sandbox (opcional — Test Buyer MP)
              </label>
              <input
                type="email"
                value={subSandboxPayerEmail}
                onChange={(e) => setSubSandboxPayerEmail(e.target.value)}
                placeholder="ex: test_user_...@testuser.com"
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs font-mono text-foreground"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                Observações contratuais
              </label>
              <textarea
                rows={2}
                value={subNotes}
                onChange={(e) => setSubNotes(e.target.value)}
                placeholder="Condições acordadas em contrato..."
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !subPlanId || !subTenantId}
              className="w-full py-2.5 px-4 rounded-xl bg-accent text-white text-xs font-semibold hover:brightness-105 disabled:opacity-50 cursor-pointer"
            >
              Criar Assinatura Contratual
            </button>
          </form>
        </div>
      )}

      {/* ==================== ABA 4: CONTRATOS 50/50 (FLUXO C) ==================== */}
      {activeTab === "contracts" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-4">
            {overview.implementationContracts.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface border border-surface-border text-xs text-foreground-muted">
                Nenhum contrato de implantação 50/50 registrado. Crie um contrato no formulário ao lado.
              </div>
            ) : (
              overview.implementationContracts.map((ct) => {
                const cMeta = CONTRACT_STATUS_META[ct.status];
                return (
                  <div
                    key={ct.id}
                    className="p-5 rounded-xl bg-surface border border-surface-border space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-accent">
                            {ct.contractCode}
                          </span>
                          <h3 className="text-sm font-bold font-display text-foreground">
                            {ct.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TONE_BADGE[cMeta.tone]}`}
                          >
                            {cMeta.label}
                          </span>
                        </div>
                        <p className="text-xs text-foreground-muted mt-1">
                          Cliente: <strong>{ct.tenantName || ct.tenantId}</strong> · Divisão{" "}
                          {ct.entryPercent}% / {ct.balancePercent}% · {ct.scopeSummary}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold font-mono tabular-nums text-foreground">
                          {BillingInvariants.formatCentsToBrl(ct.totalAmountCents)}
                        </div>
                        <div className="text-[11px] text-foreground-muted">
                          Recebimento manual (sem checkout)
                        </div>
                      </div>
                    </div>

                    {/* Parcelas 50% + 50% */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ct.installments.map((inst) => {
                        const iMeta = INSTALLMENT_STATUS_META[inst.status];
                        const isConfirmOpen = confirmingInstId === inst.id;
                        return (
                          <div
                            key={inst.id}
                            className="p-3.5 rounded-lg border border-surface-border bg-surface-muted/30 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-bold text-foreground">{inst.label}</div>
                                <div className="text-[11px] text-foreground-muted">
                                  {inst.milestoneDescription}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-mono font-bold tabular-nums text-foreground">
                                  {BillingInvariants.formatCentsToBrl(inst.amountCents)}
                                </div>
                                <span
                                  className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TONE_BADGE[iMeta.tone]}`}
                                >
                                  {iMeta.label}
                                </span>
                              </div>
                            </div>

                            {inst.receiptFileName && (
                              <div className="text-[11px] text-foreground-muted">
                                Comprovante: <span className="font-mono text-foreground">{inst.receiptFileName}</span>
                              </div>
                            )}
                            {inst.confirmedAt && (
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                Confirmado em {formatDateBr(inst.confirmedAt)} ·{" "}
                                {inst.reportedPaymentMethod
                                  ? MANUAL_PAYMENT_METHOD_LABELS[inst.reportedPaymentMethod]
                                  : "Manual"}
                              </div>
                            )}

                            {inst.status !== "confirmed" && inst.status !== "cancelled" && (
                              <div className="pt-2 border-t border-surface-border space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted text-[11px] font-medium text-foreground cursor-pointer">
                                    <Upload className="w-3 h-3" />
                                    <span>Anexar comprovante</span>
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                                      className="hidden"
                                      onChange={(e) =>
                                        handleUploadReceipt(inst.id, e.target.files?.[0] ?? null)
                                      }
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setConfirmingInstId(isConfirmOpen ? null : inst.id);
                                      setConfirmNote(`Recebimento conferido — ${inst.label}`);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:brightness-105 cursor-pointer disabled:opacity-50"
                                  >
                                    Confirmar recebimento
                                  </button>
                                </div>

                                {isConfirmOpen && (
                                  <div className="p-2.5 rounded-lg bg-surface border border-surface-border space-y-2">
                                    <select
                                      value={confirmMethod}
                                      onChange={(e) =>
                                        setConfirmMethod(e.target.value as ManualPaymentMethod)
                                      }
                                      className="w-full px-2.5 py-1.5 rounded border border-surface-border bg-background text-xs text-foreground"
                                    >
                                      {Object.entries(MANUAL_PAYMENT_METHOD_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>
                                          {v}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      value={confirmNote}
                                      onChange={(e) => setConfirmNote(e.target.value)}
                                      placeholder="Observação / referência bancária..."
                                      className="w-full px-2.5 py-1.5 rounded border border-surface-border bg-background text-xs text-foreground"
                                    />
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={async () => {
                                        await runAction(() =>
                                          confirmImplementationInstallmentAction({
                                            installmentId: inst.id,
                                            reportedPaymentMethod: confirmMethod,
                                            confirmationNote: confirmNote,
                                          })
                                        );
                                        setConfirmingInstId(null);
                                      }}
                                      className="w-full py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                                    >
                                      Registrar Confirmação Definitiva
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Ações de marco do contrato */}
                    {ct.status !== "cancelled" && ct.status !== "completed" && (
                      <div className="pt-2 border-t border-surface-border flex flex-wrap gap-2">
                        {!ct.deliveryConfirmedAt && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(() =>
                                updateImplementationContractAction({
                                  contractId: ct.id,
                                  action: "confirm_delivery",
                                  note: "Entrega e aceite do projeto registrados pela DevEssent.",
                                })
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:brightness-105 cursor-pointer disabled:opacity-50"
                          >
                            Confirmar Entrega do Projeto
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(() =>
                              updateImplementationContractAction({
                                contractId: ct.id,
                                action: "cancel",
                                note: "Cancelamento contratual registrado administrativamente.",
                              })
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-500/20 cursor-pointer disabled:opacity-50"
                        >
                          Cancelar Contrato
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Formulário Novo Contrato 50/50 */}
          <form
            onSubmit={handleCreateContract}
            className="xl:col-span-4 p-5 rounded-xl bg-surface border border-surface-border space-y-4"
          >
            <h2 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-accent" />
              Novo Contrato de Implantação (50/50)
            </h2>
            <p className="text-[11px] text-foreground-muted">
              Controle manual e auditado de entrada + saldo na entrega. Não cria assinatura recorrente nem checkout automático.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Empresa</label>
              <select
                required
                value={ctTenantId}
                onChange={(e) => setCtTenantId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
              >
                {overview.tenantsDirectory.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                Título do projeto
              </label>
              <input
                required
                value={ctTitle}
                onChange={(e) => setCtTitle(e.target.value)}
                placeholder="Ex.: Implantação Loja Virtual + Identidade"
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                Escopo contratado
              </label>
              <textarea
                required
                rows={2}
                value={ctScope}
                onChange={(e) => setCtScope(e.target.value)}
                placeholder="Desenvolvimento personalizado, vitrine, cadastro inicial e treinamento..."
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Valor total (R$)
                </label>
                <input
                  required
                  value={ctTotalReais}
                  onChange={(e) => setCtTotalReais(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs font-mono text-foreground"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Entrada (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={ctEntryPct}
                  onChange={(e) => setCtEntryPct(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs font-mono text-foreground"
                />
              </div>
            </div>
            {previewSplit && (
              <div className="p-3 rounded-lg bg-surface-muted/50 border border-surface-border text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Entrada ({previewSplit.entryPercent}%):</span>
                  <strong className="text-foreground">
                    {BillingInvariants.formatCentsToBrl(previewSplit.entryCents)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Saldo entrega ({previewSplit.balancePercent}%):</span>
                  <strong className="text-foreground">
                    {BillingInvariants.formatCentsToBrl(previewSplit.balanceCents)}
                  </strong>
                </div>
              </div>
            )}
            {Number(ctEntryPct) !== 50 && (
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Justificativa condição excepcional (obrigatório)
                </label>
                <input
                  required
                  value={ctCustomTerms}
                  onChange={(e) => setCtCustomTerms(e.target.value)}
                  placeholder="Condição negociada em contrato..."
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                Aceite registrado por (opcional)
              </label>
              <input
                value={ctAcceptedBy}
                onChange={(e) => setCtAcceptedBy(e.target.value)}
                placeholder="Nome do responsável contratante"
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-xs text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !ctTenantId}
              className="w-full py-2.5 px-4 rounded-xl bg-accent text-white text-xs font-semibold hover:brightness-105 disabled:opacity-50 cursor-pointer"
            >
              Registrar Contrato 50/50
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
