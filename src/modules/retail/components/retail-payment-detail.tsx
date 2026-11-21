"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { RetailPaymentWithDetails } from "../types/retail.types";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_PRESENTATION } from "../domain/payment-invariants";
import { ProductInvariants } from "../domain/product-invariants";
import { RetailPaymentStatusBadge } from "./retail-payment-status-badge";
import { RetailOrderStatusBadge } from "./retail-order-status-badge";
import {
  cancelPendingRetailPaymentAction,
  reconcileRetailPaymentAction,
  requestRetailPaymentRefundAction,
} from "../actions/retail-payment.actions";

interface RetailPaymentDetailProps {
  tenantId: string;
  payment: RetailPaymentWithDetails;
  canManagePayments: boolean;
}

export function RetailPaymentDetail({
  tenantId,
  payment: initialPayment,
  canManagePayments,
}: RetailPaymentDetailProps) {
  const router = useRouter();
  const [payment, setPayment] = React.useState(initialPayment);
  const [isPending, startTransition] = React.useTransition();
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isApprovedOrRefunded =
    payment.status === "paid" ||
    payment.status === "partially_refunded" ||
    payment.status === "refunded";
  const approvedCents = isApprovedOrRefunded ? payment.amountCents : 0;
  const remainingRefundableCents = Math.max(
    0,
    approvedCents - payment.refundedAmountCents
  );

  const [refundAmountReais, setRefundAmountReais] = React.useState(
    (remainingRefundableCents / 100).toFixed(2)
  );
  const [refundReason, setRefundReason] = React.useState("");
  const [showRefundBox, setShowRefundBox] = React.useState(false);

  React.useEffect(() => {
    setPayment(initialPayment);
    const app =
      initialPayment.status === "paid" ||
      initialPayment.status === "partially_refunded" ||
      initialPayment.status === "refunded"
        ? initialPayment.amountCents
        : 0;
    const rem = Math.max(0, app - initialPayment.refundedAmountCents);
    setRefundAmountReais((rem / 100).toFixed(2));
  }, [initialPayment]);

  function handleReconcile() {
    setFeedback(null);
    startTransition(async () => {
      const res = await reconcileRetailPaymentAction(tenantId, payment.id);
      if (!res.success || !res.data) {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível reconciliar a transação.",
        });
        return;
      }
      setPayment(res.data);
      setFeedback({
        type: "success",
        text: res.message || "Reconciliação concluída com sucesso.",
      });
      router.refresh();
    });
  }

  function handleCancelPending() {
    setFeedback(null);
    startTransition(async () => {
      const res = await cancelPendingRetailPaymentAction(
        tenantId,
        payment.id,
        "cancelled"
      );
      if (!res.success || !res.data) {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível cancelar a sessão pendente.",
        });
        return;
      }
      setPayment(res.data);
      setFeedback({
        type: "success",
        text: res.message || "Sessão pendente cancelada.",
      });
      router.refresh();
    });
  }

  function handleRefundSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const parsedReais = Number(refundAmountReais.replace(",", "."));
    const amountCents = Math.round(parsedReais * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setFeedback({
        type: "error",
        text: "Informe um valor válido em reais para o estorno.",
      });
      return;
    }

    if (refundReason.trim().length < 3) {
      setFeedback({
        type: "error",
        text: "Informe o motivo comercial do estorno (mínimo de 3 caracteres).",
      });
      return;
    }

    startTransition(async () => {
      const idempotencyKey = `refund_${payment.id}_${amountCents}_${Date.now()}`;
      const res = await requestRetailPaymentRefundAction(
        tenantId,
        payment.id,
        amountCents,
        refundReason.trim(),
        idempotencyKey
      );
      if (!res.success || !res.data) {
        setFeedback({
          type: "error",
          text: res.error || "Falha ao processar estorno junto ao provedor.",
        });
        return;
      }
      setPayment(res.data);
      setShowRefundBox(false);
      setRefundReason("");
      setFeedback({
        type: "success",
        text: res.message || "Estorno confirmado e registrado com sucesso.",
      });
      router.refresh();
    });
  }

  const methodLabel = payment.paymentMethod
    ? PAYMENT_METHOD_LABELS[payment.paymentMethod]
    : payment.paymentMethodLabel || "Checkout Pro (Hospedado)";
  const statusMeta = PAYMENT_STATUS_PRESENTATION[payment.status];
  const orderNumber = payment.order.orderNumber;

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Navegação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/retail/pagamentos"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para Recebimentos & Pagamentos
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-foreground">
              Transação do Pedido {orderNumber}
            </h1>
            <RetailPaymentStatusBadge status={payment.status} showFullLabel />
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
              Sandbox
            </span>
          </div>
          <p className="text-xs text-foreground-muted mt-1">
            {statusMeta?.description} · Referência:{" "}
            <span className="font-mono">{payment.externalReference}</span>
          </p>
        </div>

        {canManagePayments && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isPending}
              onClick={handleReconcile}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-muted text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
              Verificar no Provedor
            </button>

            {payment.status === "pending" && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleCancelPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancelar Sessão Pendente
              </button>
            )}

            {(payment.status === "paid" || payment.status === "partially_refunded") &&
              remainingRefundableCents > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setShowRefundBox((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Solicitar Estorno
                </button>
              )}
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Alerta de Divergência */}
      {payment.divergenceAlert && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-200">
              Baixa Automática Bloqueada por Divergência Financeira
            </h2>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
              Motivo detectado na conciliação:{" "}
              <strong className="font-mono">{payment.divergenceAlert}</strong>
            </p>
            <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-1">
              Por segurança transacional, o pedido não foi marcado como pago automaticamente. Verifique os eventos de webhook abaixo.
            </p>
          </div>
        </div>
      )}

      {/* Formulário de Estorno Confirmado */}
      {showRefundBox && canManagePayments && (
        <form
          onSubmit={handleRefundSubmit}
          className="rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Solicitar Estorno ao Provedor (Sandbox)
              </h3>
              <p className="text-xs text-foreground-muted">
                O status só será atualizado após confirmação autoritativa do estorno pelo gateway. Saldo disponível:{" "}
                <strong>
                  {ProductInvariants.formatCentsToCurrency(
                    remainingRefundableCents,
                    payment.currency
                  )}
                </strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="refund-amount-input"
                className="block text-xs font-medium text-foreground mb-1"
              >
                Valor a estornar (R$)
              </label>
              <input
                id="refund-amount-input"
                type="text"
                value={refundAmountReais}
                onChange={(e) => setRefundAmountReais(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-surface-border bg-surface text-xs text-foreground font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="refund-reason-input"
                className="block text-xs font-medium text-foreground mb-1"
              >
                Motivo do estorno
              </label>
              <input
                id="refund-reason-input"
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Ex.: Solicitação de desistência do comprador antes do envio"
                className="w-full h-9 px-3 rounded-lg border border-surface-border bg-surface text-xs text-foreground"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRefundBox(false)}
              className="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-medium text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "Processando estorno..." : "Confirmar Estorno no Gateway"}
            </button>
          </div>
        </form>
      )}

      {/* Resumo Financeiro e Conta Recebedora */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-surface-border bg-surface-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            Resumo Financeiro da Transação
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-surface-muted/60 border border-surface-border">
              <span className="text-[11px] text-foreground-muted block">
                Valor do Pedido
              </span>
              <span className="text-base font-bold text-foreground">
                {ProductInvariants.formatCentsToCurrency(payment.amountCents, payment.currency)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface-muted/60 border border-surface-border">
              <span className="text-[11px] text-foreground-muted block">
                Valor Aprovado
              </span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {ProductInvariants.formatCentsToCurrency(approvedCents, payment.currency)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface-muted/60 border border-surface-border">
              <span className="text-[11px] text-foreground-muted block">
                Valor Estornado
              </span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                {ProductInvariants.formatCentsToCurrency(
                  payment.refundedAmountCents,
                  payment.currency
                )}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface-muted/60 border border-surface-border">
              <span className="text-[11px] text-foreground-muted block">
                Saldo Líquido
              </span>
              <span className="text-base font-bold text-foreground">
                {ProductInvariants.formatCentsToCurrency(
                  Math.max(0, approvedCents - payment.refundedAmountCents),
                  payment.currency
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-surface-border text-xs">
            <div>
              <span className="text-foreground-muted">Pedido Comercial: </span>
              <Link
                href={`/dashboard/retail/pedidos/${payment.orderId}`}
                className="font-mono font-bold text-brand-primary hover:underline inline-flex items-center gap-1"
              >
                {orderNumber}
                <ExternalLink className="w-3 h-3" />
              </Link>{" "}
              <span className="ml-1.5">
                <RetailOrderStatusBadge status={payment.order.status} />
              </span>
            </div>

            <div>
              <span className="text-foreground-muted">Comprador (Minimizado LGPD): </span>
              <strong className="text-foreground">
                {payment.customerNameMinimized || "Cliente"}
              </strong>
              {payment.payerEmailMasked && (
                <span className="ml-1.5 font-mono text-foreground-muted">
                  ({payment.payerEmailMasked})
                </span>
              )}
            </div>

            <div>
              <span className="text-foreground-muted">Meio de Pagamento: </span>
              <strong className="text-foreground">{methodLabel}</strong>
            </div>

            <div>
              <span className="text-foreground-muted">ID Externo no Provedor: </span>
              <span className="font-mono text-foreground">
                {payment.externalPaymentId || "Aguardando captura"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">
              Destino do Recebimento
            </h2>
          </div>
          <p className="text-xs text-foreground-muted">
            Transação processada diretamente para a conta vinculada ao estabelecimento.
          </p>
          <div className="space-y-2 text-xs pt-2 border-t border-surface-border">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Provedor:</span>
              <span className="font-semibold text-foreground">
                Mercado Pago Checkout Pro
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Ambiente:</span>
              <span className="font-mono font-semibold text-violet-600 dark:text-violet-400 uppercase">
                {payment.environment}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Seller Account ID:</span>
              <span className="font-mono font-semibold text-foreground">
                {payment.sellerAccountId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Moeda:</span>
              <span className="font-mono font-semibold text-foreground">
                {payment.currency}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Tentativas de Checkout */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Tentativas de Sessão de Checkout ({payment.attempts.length})
        </h2>

        {payment.attempts.length === 0 ? (
          <p className="text-xs text-foreground-muted">
            Nenhuma tentativa registrada.
          </p>
        ) : (
          <div className="space-y-2">
            {payment.attempts.map((att) => (
              <div
                key={att.id}
                className="p-3 rounded-lg border border-surface-border bg-surface-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      Tentativa #{att.attemptNumber}
                    </span>
                    <RetailPaymentStatusBadge status={att.status} />
                    <span className="font-mono text-[11px] text-foreground-muted">
                      Pref: {att.externalAttemptId || "—"}
                    </span>
                  </div>
                  <div className="text-[11px] text-foreground-muted">
                    Idempotency Key:{" "}
                    <span className="font-mono">{att.idempotencyKey}</span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-foreground-muted">
                  <div className="font-semibold text-foreground">
                    {ProductInvariants.formatCentsToCurrency(att.amountCents, att.currency)}
                  </div>
                  <div>
                    {new Date(att.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trilha de Eventos e Webhooks Autenticados */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Eventos & Webhooks Recebidos ({payment.events.length})
        </h2>

        {payment.events.length === 0 ? (
          <p className="text-xs text-foreground-muted">
            Nenhum webhook recebido do provedor até o momento.
          </p>
        ) : (
          <div className="space-y-2.5">
            {payment.events.map((evt) => (
              <div
                key={evt.id}
                className="p-3.5 rounded-lg border border-surface-border bg-surface-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">
                      {evt.eventType}
                    </span>
                    {evt.signatureVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                        <CheckCircle2 className="w-3 h-3" />
                        HMAC Verificado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                        Assinatura Não Verificada
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-muted border border-surface-border text-foreground-muted">
                      {evt.processingStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-foreground-muted font-mono">
                    Event ID: {evt.externalEventId}
                  </div>
                  {evt.errorMessage && (
                    <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      Detalhe: {evt.errorMessage}
                    </div>
                  )}
                </div>

                <div className="text-right text-[11px] text-foreground-muted shrink-0">
                  <div className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(evt.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
