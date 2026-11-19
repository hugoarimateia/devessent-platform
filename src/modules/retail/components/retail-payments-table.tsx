"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  RotateCcw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import type {
  RetailPayment,
  RetailPaymentConnectionSummary,
  RetailPaymentStats,
} from "../types/retail.types";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_PRESENTATION } from "../domain/payment-invariants";
import { ProductInvariants } from "../domain/product-invariants";
import { RetailPaymentStatusBadge } from "./retail-payment-status-badge";

interface RetailPaymentsTableProps {
  items: RetailPayment[];
  totalCount: number;
  page: number;
  totalPages: number;
  stats: RetailPaymentStats;
  connection: RetailPaymentConnectionSummary;
  initialStatusFilter: string;
  initialMethodFilter: string;
  initialPeriodDays: string;
  initialSearch: string;
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "paid", label: "Pagos" },
  { value: "pending", label: "Aguardando pagamento" },
  { value: "processing", label: "Em processamento" },
  { value: "failed", label: "Recusados" },
  { value: "expired", label: "Expirados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "partially_refunded", label: "Reembolsados parcialmente" },
  { value: "refunded", label: "Reembolsados" },
  { value: "disputed", label: "Em contestação" },
];

const METHOD_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os meios" },
  { value: "pix", label: "Pix" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "account_money", label: "Saldo Mercado Pago" },
  { value: "hosted_checkout", label: "Checkout Pro" },
];

const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o histórico" },
];

export function RetailPaymentsTable({
  items,
  totalCount,
  page,
  totalPages,
  stats,
  connection,
  initialStatusFilter,
  initialMethodFilter,
  initialPeriodDays,
  initialSearch,
}: RetailPaymentsTableProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState(initialStatusFilter || "all");
  const [methodFilter, setMethodFilter] = React.useState(initialMethodFilter || "all");
  const [periodDays, setPeriodDays] = React.useState(initialPeriodDays || "30");
  const [search, setSearch] = React.useState(initialSearch || "");

  function applyFilters(next: {
    status?: string;
    method?: string;
    period?: string;
    q?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();
    const s = next.status ?? statusFilter;
    const m = next.method ?? methodFilter;
    const p = next.period ?? periodDays;
    const q = (next.q ?? search).trim();
    const pg = next.page ?? 1;

    if (s && s !== "all") params.set("status", s);
    if (m && m !== "all") params.set("method", m);
    if (p && p !== "30") params.set("period", p);
    if (q) params.set("q", q);
    if (pg > 1) params.set("page", String(pg));

    const qs = params.toString();
    router.push(qs ? `/dashboard/retail/pagamentos?${qs}` : "/dashboard/retail/pagamentos");
  }

  const maxDailyCents = Math.max(
    100,
    ...stats.periodEvolution.map((d) => Math.max(d.confirmedCents, d.refundedCents))
  );

  return (
    <div className="space-y-6">
      {/* Status da Conexão com o Provedor (Por Estabelecimento) */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                connection.status === "connected"
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400"
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Conta Recebedora do Estabelecimento
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
                  Modo Sandbox · Sem Cobrança Real
                </span>
                {connection.status === "connected" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Conectada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                    Aguardando Ativação Técnica
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground-muted mt-1">
                {connection.status === "connected" ? (
                  <>
                    Provedor:{" "}
                    <strong className="text-foreground">
                      {connection.provider === "xampp_sandbox"
                        ? "Mercado Pago Checkout Pro (Simulador Local Sandbox)"
                        : "Mercado Pago Checkout Pro"}
                    </strong>{" "}
                    · Titular recebedor:{" "}
                    <strong className="text-foreground">
                      {connection.sellerAccountLabel || connection.sellerAccountId}
                    </strong>{" "}
                    <span className="font-mono text-[11px] opacity-80">
                      ({connection.sellerAccountId})
                    </span>
                  </>
                ) : (
                  "O recebimento pertence integralmente à sua loja. Solicite à equipe técnica da DevEssent a vinculação da sua conta recebedora."
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted border-t lg:border-t-0 pt-3 lg:pt-0 border-surface-border">
            <div className="px-3 py-1.5 rounded-lg bg-surface-muted/70 border border-surface-border">
              <span className="block text-[10px] uppercase tracking-wider text-foreground-muted">
                Governança de Credenciais
              </span>
              <span className="font-medium text-foreground">
                Criptografia AES-256-GCM gerida pela DevEssent
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Indicadores Financeiros (Apenas valores confirmados na receita) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-muted">
              Recebido Líquido Confirmado
            </span>
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1.5">
            {ProductInvariants.formatCentsToCurrency(stats.netReceivedCents, "BRL")}
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">
            Bruto aprovado: {ProductInvariants.formatCentsToCurrency(stats.grossConfirmedCents, "BRL")}
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-muted">
              Pedidos Pagos
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1.5">
            {stats.paidOrdersCount}
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">
            Confirmados pelo gateway
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-muted">
              Total Pendente
            </span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1.5">
            {ProductInvariants.formatCentsToCurrency(stats.pendingCents, "BRL")}
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">
            {stats.pendingPaymentsCount}{" "}
            {stats.pendingPaymentsCount === 1 ? "sessão aberta" : "sessões abertas"}
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-muted">
              Recusado / Expirado
            </span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1.5">
            {ProductInvariants.formatCentsToCurrency(stats.rejectedOrExpiredCents, "BRL")}
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">
            {stats.rejectedPaymentsCount} tentativas sem captura
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-muted">
              Total Estornado
            </span>
            <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1.5">
            {ProductInvariants.formatCentsToCurrency(stats.refundedCents, "BRL")}
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">
            {stats.refundedPaymentsCount}{" "}
            {stats.refundedPaymentsCount === 1 ? "estorno confirmado" : "estornos confirmados"}
          </p>
        </div>
      </div>

      {stats.divergenceAlertsCount > 0 && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                Alerta de Governança Financeira: {stats.divergenceAlertsCount}{" "}
                {stats.divergenceAlertsCount === 1
                  ? "transação apresentou divergência"
                  : "transações apresentaram divergência"}{" "}
                e teve baixa automática bloqueada.
              </p>
              <p className="text-[11px] text-rose-700/90 dark:text-rose-300/90">
                Verifique o detalhe das transações com alerta de divergência para auditoria.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Evolução de Recebimentos */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Evolução de Recebimentos Confirmados
            </h3>
            <p className="text-xs text-foreground-muted">
              Contabiliza exclusivamente pagamentos aprovados pelo gateway, deduzidos de estornos confirmados.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-foreground-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
              Confirmado líquido
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
              Estornado
            </span>
          </div>
        </div>

        {stats.periodEvolution.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-xs text-foreground-muted border border-dashed border-surface-border rounded-lg">
            Ainda não há recebimentos confirmados no período selecionado.
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2.5 items-end h-32 pt-4 px-2 border-b border-surface-border">
            {stats.periodEvolution.map((day) => {
              const confirmedPct = Math.min(
                100,
                Math.round((day.netConfirmedCents / maxDailyCents) * 100)
              );
              const refundedPct = Math.min(
                100,
                Math.round((day.refundedCents / maxDailyCents) * 100)
              );
              return (
                <div
                  key={day.periodLabel}
                  className="flex flex-col items-center justify-end h-full gap-1.5 group"
                >
                  <div className="w-full flex items-end justify-center gap-1 h-20">
                    <div
                      className="w-3 sm:w-5 rounded-t-md bg-emerald-500/85 group-hover:bg-emerald-500 transition-all"
                      style={{
                        height: `${Math.max(confirmedPct, day.netConfirmedCents > 0 ? 12 : 4)}%`,
                      }}
                      title={`Recebido em ${day.periodLabel}: ${ProductInvariants.formatCentsToCurrency(day.netConfirmedCents, "BRL")}`}
                    />
                    {day.refundedCents > 0 && (
                      <div
                        className="w-2 sm:w-3 rounded-t-md bg-amber-500/85"
                        style={{ height: `${Math.max(refundedPct, 12)}%` }}
                        title={`Estornado em ${day.periodLabel}: ${ProductInvariants.formatCentsToCurrency(day.refundedCents, "BRL")}`}
                      />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-foreground-muted pb-1.5">
                    {day.periodLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyFilters({ q: search, page: 1 });
                }
              }}
              placeholder="Buscar por ID externo ou referência..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-surface-border bg-surface text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>

          <select
            aria-label="Filtrar por status do pagamento"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              applyFilters({ status: e.target.value, page: 1 });
            }}
            className="h-9 px-3 rounded-lg border border-surface-border bg-surface text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por meio de pagamento"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              applyFilters({ method: e.target.value, page: 1 });
            }}
            className="h-9 px-3 rounded-lg border border-surface-border bg-surface text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          >
            {METHOD_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por período"
            value={periodDays}
            onChange={(e) => {
              setPeriodDays(e.target.value);
              applyFilters({ period: e.target.value, page: 1 });
            }}
            className="h-9 px-3 rounded-lg border border-surface-border bg-surface text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista / Tabela de Transações */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-surface-border bg-surface-card p-10 text-center">
          <div className="w-11 h-11 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center mx-auto mb-3 text-foreground-muted">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Nenhuma transação financeira encontrada
          </h3>
          <p className="text-xs text-foreground-muted mt-1 max-w-md mx-auto">
            Quando seus compradores iniciarem pagamentos online para pedidos confirmados, as sessões, aprovações e conciliações aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="payments-table-caption"
            className="overflow-x-auto max-w-full"
          >
            <table className="w-full text-left border-separate border-spacing-0">
              <caption id="payments-table-caption" className="sr-only">
                Transações financeiras e recebimentos da loja
              </caption>
              <thead className="sticky top-0 z-10 bg-surface-muted/95 backdrop-blur-xs">
                <tr>
                  <th
                    scope="col"
                    className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted border-b border-surface-border"
                  >
                    Pedido
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted border-b border-surface-border"
                  >
                    Comprador
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted border-b border-surface-border"
                  >
                    Status Financeiro
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted border-b border-surface-border"
                  >
                    Meio / Provedor
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted border-b border-surface-border"
                  >
                    Valor / Recebido
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted border-b border-surface-border"
                  >
                    ID Externo
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted border-b border-surface-border text-right"
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-xs">
                {items.map((item) => {
                  const methodLabel = item.paymentMethod
                    ? PAYMENT_METHOD_LABELS[item.paymentMethod]
                    : item.paymentMethodLabel || "Checkout Pro";
                  const statusMeta = PAYMENT_STATUS_PRESENTATION[item.status];
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-muted/40 transition-colors"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-[1] bg-surface-card py-3.5 px-4 font-semibold text-foreground whitespace-nowrap border-b border-surface-border"
                      >
                        <Link
                          href={`/dashboard/retail/pedidos/${item.orderId}`}
                          className="font-mono text-xs font-bold text-brand-primary hover:underline"
                        >
                          {item.orderNumber || item.orderId.slice(0, 8)}
                        </Link>
                      </th>
                      <td className="py-3.5 px-4 text-foreground border-b border-surface-border">
                        <div className="font-medium">
                          {item.customerNameMinimized || "Cliente"}
                        </div>
                        {item.payerEmailMasked && (
                          <div className="text-[11px] text-foreground-muted font-mono">
                            {item.payerEmailMasked}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 border-b border-surface-border">
                        <div className="flex flex-col items-start gap-1">
                          <RetailPaymentStatusBadge status={item.status} />
                          <span className="text-[11px] text-foreground-muted">
                            {statusMeta?.description}
                          </span>
                          {item.divergenceAlert && (
                            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              {item.divergenceAlert}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-foreground border-b border-surface-border whitespace-nowrap">
                        <div className="font-medium">{methodLabel}</div>
                        <div className="text-[11px] text-foreground-muted">
                          Mercado Pago · Sandbox
                        </div>
                      </td>
                      <td className="py-3.5 px-4 border-b border-surface-border whitespace-nowrap">
                        <div className="font-semibold text-foreground">
                          {ProductInvariants.formatCentsToCurrency(
                            item.amountCents,
                            item.currency
                          )}
                        </div>
                        {(item.status === "paid" || item.status === "partially_refunded") && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            Líquido:{" "}
                            {ProductInvariants.formatCentsToCurrency(
                              Math.max(0, item.amountCents - item.refundedAmountCents),
                              item.currency
                            )}
                          </div>
                        )}
                        {item.refundedAmountCents > 0 && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            Estornado:{" "}
                            {ProductInvariants.formatCentsToCurrency(
                              item.refundedAmountCents,
                              item.currency
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-foreground-muted border-b border-surface-border whitespace-nowrap">
                        <div>{item.externalPaymentId || item.externalPreferenceId || "—"}</div>
                        <div className="text-[10px] opacity-75">
                          {new Date(item.updatedAt).toLocaleString("pt-BR")}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right border-b border-surface-border whitespace-nowrap">
                        <Link
                          href={`/dashboard/retail/pagamentos/${item.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted text-xs font-medium text-foreground transition-colors"
                        >
                          Detalhes
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-surface-border flex items-center justify-between text-xs text-foreground-muted">
              <span>
                Página {page} de {totalPages} ({totalCount} transações)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => applyFilters({ page: page - 1 })}
                  className="px-2.5 py-1 rounded-md border border-surface-border disabled:opacity-40 hover:bg-surface-muted"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => applyFilters({ page: page + 1 })}
                  className="px-2.5 py-1 rounded-md border border-surface-border disabled:opacity-40 hover:bg-surface-muted"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
