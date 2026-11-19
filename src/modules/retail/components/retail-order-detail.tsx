"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Package,
  MapPin,
  PackageCheck,
  Phone,
  Mail,
  Clock,
  AlertCircle,
  MessageCircle,
  CreditCard,
  Copy,
  ExternalLink,
  Truck,
} from "lucide-react";
import type {
  RetailInventoryMode,
  RetailOrderStatus,
  RetailOrderWithDetails,
  RetailPayment,
  RetailPaymentConnectionSummary,
} from "../types/retail.types";
import {
  ORDER_STATUS_PRESENTATION,
  ORDER_STATUS_TRANSITIONS,
  OrderInvariants,
} from "../domain/order-invariants";
import { PaymentInvariants, PAYMENT_STATUS_PRESENTATION } from "../domain/payment-invariants";
import { ProductInvariants } from "../domain/product-invariants";
import { updateRetailOrderStatusAction } from "../actions/retail-order.actions";
import {
  generateOrderPaymentShareLinkAction,
  setRetailOrderShippingFeeAction,
} from "../actions/retail-payment.actions";
import { DataTable } from "@/components/ui/data-table";
import { RetailOrderStatusBadge } from "./retail-order-status-badge";
import { RetailPaymentStatusBadge } from "./retail-payment-status-badge";

interface RetailOrderDetailProps {
  tenantId: string;
  storeName: string;
  inventoryMode: RetailInventoryMode;
  order: RetailOrderWithDetails;
  canManageOrders: boolean;
  paymentConnection?: RetailPaymentConnectionSummary;
  linkedPayment?: RetailPayment | null;
}

const ACTION_LABELS: Partial<Record<RetailOrderStatus, string>> = {
  confirmed: "Confirmar Pedido & Baixar Estoque",
  preparing: "Iniciar Separação / Preparo",
  ready: "Marcar como Pronto",
  completed: "Concluir Pedido",
  cancelled: "Cancelar Pedido",
};

export function RetailOrderDetail({
  tenantId,
  storeName,
  inventoryMode,
  order: initialOrder,
  canManageOrders,
  paymentConnection,
  linkedPayment,
}: RetailOrderDetailProps) {
  const router = useRouter();
  const [order, setOrder] = React.useState<RetailOrderWithDetails>(initialOrder);
  const [reason, setReason] = React.useState("");
  const [isMutating, setIsMutating] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [shippingReaisInput, setShippingReaisInput] = React.useState(
    initialOrder.shippingFeeCents !== null && initialOrder.shippingFeeCents !== undefined
      ? (initialOrder.shippingFeeCents / 100).toFixed(2)
      : "0.00"
  );
  const [generatedShareLink, setGeneratedShareLink] = React.useState<{
    sharePath: string;
    fullShareUrl: string;
    expiresAt: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);

  React.useEffect(() => {
    setOrder(initialOrder);
    setShippingReaisInput(
      initialOrder.shippingFeeCents !== null && initialOrder.shippingFeeCents !== undefined
        ? (initialOrder.shippingFeeCents / 100).toFixed(2)
        : "0.00"
    );
  }, [initialOrder]);

  const currentPaymentStatus = order.paymentStatus || "not_started";
  const statusMeta = ORDER_STATUS_PRESENTATION[order.status];
  const paymentMeta = PAYMENT_STATUS_PRESENTATION[currentPaymentStatus];
  const allowedNext = ORDER_STATUS_TRANSITIONS[order.status] || [];
  const nextWorkflowStatuses = allowedNext.filter((s) => s !== "cancelled");
  const canCancel = allowedNext.includes("cancelled");

  const paymentEligibility = PaymentInvariants.evaluateOrderPaymentEligibility(
    order,
    paymentConnection ?? null
  );

  const customerDigits = OrderInvariants.normalizePhoneDigits(order.customerPhone);
  const customerWhatsAppUrl =
    customerDigits.length >= 10
      ? `https://wa.me/${
          customerDigits.length <= 11 ? `55${customerDigits}` : customerDigits
        }?text=${encodeURIComponent(
          `Olá ${order.customerName}, somos da equipe ${storeName} sobre seu pedido ${order.orderNumber}.`
        )}`
      : null;

  const handleTransition = async (nextStatus: RetailOrderStatus) => {
    if (isMutating || !canManageOrders) return;
    setIsMutating(true);
    setFeedback(null);

    try {
      const res = await updateRetailOrderStatusAction(
        tenantId,
        order.id,
        nextStatus,
        reason.trim() || undefined
      );
      if (!res.success) {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível atualizar o status do pedido.",
        });
        setIsMutating(false);
        return;
      }

      setReason("");
      setFeedback({
        type: "success",
        text: res.message || "Status atualizado com sucesso.",
      });
      router.refresh();
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveShippingFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMutating || !canManageOrders) return;

    const numReais = Number(shippingReaisInput.replace(",", "."));
    const feeCents = Math.round(numReais * 100);
    if (!Number.isFinite(feeCents) || feeCents < 0) {
      setFeedback({
        type: "error",
        text: "Informe um valor válido de frete (maior ou igual a R$ 0,00).",
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const res = await setRetailOrderShippingFeeAction(tenantId, order.id, feeCents);
      if (!res.success || !res.data) {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível atualizar o frete do pedido.",
        });
        return;
      }
      setFeedback({
        type: "success",
        text: res.message || "Frete definido com sucesso.",
      });
      router.refresh();
    } finally {
      setIsMutating(false);
    }
  };

  const handleGenerateShareLink = async () => {
    if (isMutating || !canManageOrders) return;
    setIsMutating(true);
    setFeedback(null);
    try {
      const res = await generateOrderPaymentShareLinkAction(tenantId, order.id);
      if (!res.success || !res.data) {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível gerar o link de pagamento.",
        });
        return;
      }
      setGeneratedShareLink({
        sharePath: res.data.sharePath,
        fullShareUrl: res.data.fullShareUrl,
        expiresAt: res.data.expiresAt,
      });
      setFeedback({
        type: "success",
        text: res.message || "Link de pagamento emitido com sucesso.",
      });
      router.refresh();
    } finally {
      setIsMutating(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!generatedShareLink) return;
    try {
      await navigator.clipboard.writeText(generatedShareLink.fullShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const paidAmountCents = order.paidAmountCents ?? 0;
  const refundedAmountCents = order.refundedAmountCents ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/retail/pedidos"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Voltar para Pedidos</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
              Pedido <span className="font-mono">{order.orderNumber}</span>
            </h1>
            <RetailOrderStatusBadge status={order.status} />
            <RetailPaymentStatusBadge status={currentPaymentStatus} showFullLabel />
            {order.stockDeducted && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                Estoque baixado
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-muted">
            Registrado em {new Date(order.createdAt).toLocaleString("pt-BR")} · Canal{" "}
            {order.channel === "storefront" ? "Vitrine Pública" : "Operação Manual"}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted block">
            Total Financeiro do Pedido
          </span>
          <span className="text-2xl font-mono font-bold text-foreground tabular-nums">
            {ProductInvariants.formatCentsToCurrency(order.totalCents, order.currency)}
          </span>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 ${
            feedback.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Itens + Histórico */}
        <div className="xl:col-span-8 space-y-6">
          <section className="rounded-2xl bg-surface border border-surface-border overflow-hidden shadow-[var(--shadow-card)]">
            <div className="p-5 border-b border-surface-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold font-display text-foreground">
                  Itens Solicitados ({order.items.length})
                </h2>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Snapshot comercial registrado no momento da solicitação
                </p>
              </div>
              <span className="text-xs font-mono text-foreground-muted">
                Modo de estoque: {inventoryMode === "track_quantity" ? "Controlado" : "Livre"}
              </span>
            </div>

            <DataTable embedded ariaLabel="Itens deste pedido">
              <thead className="bg-surface-muted/50 text-foreground-muted font-mono uppercase text-[10px] tracking-wider border-b border-surface-border">
                <tr>
                  <th className="py-3 px-5">Produto / Variante</th>
                  <th className="py-3 px-4">Preço Unit.</th>
                  <th className="py-3 px-4">Qtd</th>
                  <th className="py-3 px-5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-xs">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Produto" className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        {item.imageUrlSnapshot ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.imageUrlSnapshot}
                            alt={item.productNameSnapshot}
                            className="w-10 h-10 rounded-lg object-cover border border-surface-border shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-surface-muted flex items-center justify-center border border-surface-border shrink-0">
                            <Package className="w-4 h-4 text-foreground-muted opacity-50" />
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-foreground block">
                            {item.productNameSnapshot}
                          </span>
                          <span className="text-[11px] font-mono text-foreground-muted">
                            {item.variantNameSnapshot} · SKU {item.skuSnapshot}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Preço Unit." className="py-3.5 px-4 font-mono tabular-nums">
                      {ProductInvariants.formatCentsToCurrency(item.unitPriceCents, order.currency)}
                    </td>
                    <td data-label="Qtd" className="py-3.5 px-4 font-mono font-bold tabular-nums">
                      {item.quantity}
                    </td>
                    <td
                      data-label="Subtotal"
                      className="py-3.5 px-5 text-right font-mono font-bold text-foreground tabular-nums"
                    >
                      {ProductInvariants.formatCentsToCurrency(item.lineTotalCents, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            <div className="px-5 py-4 bg-surface-muted/30 border-t border-surface-border space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-foreground-muted">
                <span>Subtotal dos itens</span>
                <span className="font-mono tabular-nums">
                  {ProductInvariants.formatCentsToCurrency(order.subtotalCents, order.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-foreground-muted">
                <span>
                  Frete ({order.deliveryMode === "pickup" ? "Retirada na loja" : "Entrega"})
                </span>
                <span className="font-mono tabular-nums">
                  {order.shippingFeeCents === null || order.shippingFeeCents === undefined
                    ? "A combinar (defina ao lado)"
                    : ProductInvariants.formatCentsToCurrency(order.shippingFeeCents, order.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-foreground pt-1.5 border-t border-surface-border">
                <span>Total Financeiro do Pedido</span>
                <span className="font-mono tabular-nums">
                  {ProductInvariants.formatCentsToCurrency(order.totalCents, order.currency)}
                </span>
              </div>
            </div>
          </section>

          {/* Linha do Tempo / Histórico */}
          <section className="rounded-2xl bg-surface border border-surface-border p-5 space-y-4 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Histórico de Transições</span>
            </h2>

            {order.history.length === 0 ? (
              <p className="text-xs text-foreground-muted">Nenhum registro de transição disponível.</p>
            ) : (
              <ol className="space-y-3">
                {order.history.map((entry) => {
                  const targetMeta = ORDER_STATUS_PRESENTATION[entry.toStatus];
                  return (
                    <li
                      key={entry.id}
                      className="p-3.5 rounded-xl bg-surface-muted/40 border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <RetailOrderStatusBadge status={entry.toStatus} />
                          <span className="font-semibold text-foreground">{targetMeta.label}</span>
                        </div>
                        {entry.reason && (
                          <p className="text-foreground-muted">{entry.reason}</p>
                        )}
                      </div>
                      <div className="text-left sm:text-right text-[11px] text-foreground-muted shrink-0">
                        <span className="block font-medium text-foreground">
                          {entry.changedByNameSnapshot || "Sistema"}
                        </span>
                        <span>
                          {new Date(entry.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* Coluna Direita: Financeiro + Ações Operacionais + Cliente */}
        <div className="xl:col-span-4 space-y-6">
          {/* Painel Financeiro & Pagamento Online (Fase 6D) */}
          <section className="rounded-2xl bg-surface border border-surface-border p-5 space-y-4 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-accent" />
                  <h2 className="text-base font-bold font-display text-foreground">
                    Financeiro & Pagamento
                  </h2>
                </div>
                <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                  {paymentMeta?.description}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
                Sandbox
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-muted/50 border border-surface-border space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Status Financeiro:</span>
                <RetailPaymentStatusBadge status={currentPaymentStatus} showFullLabel />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Conta Recebedora:</span>
                <span className="font-semibold text-foreground">
                  {paymentConnection?.sellerAccountLabel || storeName}
                </span>
              </div>
              {paidAmountCents > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Valor Pago Confirmado:</span>
                  <span className="font-mono">
                    {ProductInvariants.formatCentsToCurrency(paidAmountCents, order.currency)}
                  </span>
                </div>
              )}
              {refundedAmountCents > 0 && (
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-semibold">
                  <span>Valor Estornado:</span>
                  <span className="font-mono">
                    {ProductInvariants.formatCentsToCurrency(refundedAmountCents, order.currency)}
                  </span>
                </div>
              )}
            </div>

            {/* Definição de Frete Determinístico para Delivery */}
            {canManageOrders &&
              order.deliveryMode === "delivery" &&
              order.status !== "completed" &&
              order.status !== "cancelled" &&
              currentPaymentStatus !== "paid" &&
              currentPaymentStatus !== "processing" && (
                <form
                  onSubmit={handleSaveShippingFee}
                  className="p-3.5 rounded-xl border border-surface-border bg-surface-muted/30 space-y-2.5"
                >
                  <label
                    htmlFor="order-shipping-fee-input"
                    className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
                  >
                    <Truck className="w-3.5 h-3.5 text-accent" />
                    <span>Definir Frete Determinístico (R$)</span>
                  </label>
                  <p className="text-[11px] text-foreground-muted leading-snug">
                    Pedidos com entrega exigem frete definido (&ge; R$ 0,00) antes de liberar o checkout online.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      id="order-shipping-fee-input"
                      type="text"
                      value={shippingReaisInput}
                      onChange={(e) => setShippingReaisInput(e.target.value)}
                      className="flex-1 h-9 px-3 rounded-lg border border-surface-border bg-surface text-xs font-mono text-foreground"
                    />
                    <button
                      type="submit"
                      disabled={isMutating}
                      className="h-9 px-3.5 rounded-lg bg-surface-card hover:bg-surface-muted border border-surface-border text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
                    >
                      Salvar Frete
                    </button>
                  </div>
                </form>
              )}

            {/* Geração de Link Opaco de Pagamento */}
            {canManageOrders && (
              <div className="space-y-3 pt-2 border-t border-surface-border">
                {paymentEligibility.eligible ? (
                  <button
                    type="button"
                    disabled={isMutating}
                    data-testid="generate-payment-share-link-btn"
                    onClick={handleGenerateShareLink}
                    className="w-full min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#6C4EF2] to-[#5638DC] text-white shadow-sm hover:brightness-105 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Emitir Link Seguro de Pagamento (72h)</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                    <strong>Pagamento online indisponível no momento:</strong>{" "}
                    {paymentEligibility.reason}
                  </div>
                )}

                {generatedShareLink && (
                  <div
                    data-testid="generated-payment-share-box"
                    className="p-3.5 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.06] space-y-2.5 text-xs"
                  >
                    <div className="font-semibold text-emerald-800 dark:text-emerald-200">
                      Link Público Opaco de Pagamento (Zero PII)
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={generatedShareLink.fullShareUrl}
                      className="w-full h-8 px-2.5 rounded-lg border border-surface-border bg-surface font-mono text-[11px] text-foreground"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="flex-1 h-8 px-3 rounded-lg bg-surface hover:bg-surface-muted border border-surface-border text-xs font-semibold text-foreground inline-flex items-center justify-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedLink ? "Copiado!" : "Copiar Link"}</span>
                      </button>
                      <Link
                        href={generatedShareLink.sharePath}
                        target="_blank"
                        className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5"
                      >
                        <span>Abrir Checkout</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}

                {linkedPayment && (
                  <Link
                    href={`/dashboard/retail/pagamentos/${linkedPayment.id}`}
                    className="w-full min-h-[38px] px-3.5 py-2 rounded-xl border border-surface-border bg-surface-muted/50 hover:bg-surface-muted text-xs font-semibold text-foreground flex items-center justify-between transition-colors"
                  >
                    <span>Auditar Transação & Webhooks</span>
                    <ExternalLink className="w-3.5 h-3.5 text-accent" />
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* Painel de Transição Operacional */}
          <section className="rounded-2xl bg-surface border border-surface-border p-5 space-y-4 shadow-[var(--shadow-card)]">
            <div>
              <h2 className="text-base font-bold font-display text-foreground">
                Gestão Operacional
              </h2>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                {statusMeta.description}
              </p>
            </div>

            {canManageOrders && (nextWorkflowStatuses.length > 0 || canCancel) ? (
              <div className="space-y-3 pt-2 border-t border-surface-border">
                <div>
                  <label
                    htmlFor="order-transition-reason"
                    className="block text-xs font-medium text-foreground mb-1"
                  >
                    Observação / Motivo (opcional)
                  </label>
                  <input
                    id="order-transition-reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex.: Confirmado com cliente / Estoque conferido..."
                    className="w-full h-9 px-3 rounded-lg text-xs bg-surface-muted/60 border border-surface-border text-foreground focus:outline-none focus:border-accent"
                  />
                </div>

                {order.status === "requested" && inventoryMode === "track_quantity" && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5 leading-relaxed">
                    Ao <strong>Confirmar Pedido</strong>, o sistema validará o saldo atual e realizará a baixa transacional do estoque.
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {nextWorkflowStatuses.map((statusOption) => (
                    <button
                      key={statusOption}
                      type="button"
                      disabled={isMutating}
                      data-testid={`transition-to-${statusOption}`}
                      onClick={() => handleTransition(statusOption)}
                      className={`w-full min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                        statusOption === "confirmed" || statusOption === "completed"
                          ? "bg-gradient-to-r from-[#6C4EF2] to-[#5638DC] text-white shadow-sm hover:brightness-105"
                          : "bg-surface-muted border border-surface-border text-foreground hover:bg-surface-border/60"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>{ACTION_LABELS[statusOption] || statusOption}</span>
                    </button>
                  ))}

                  {canCancel && (
                    <button
                      type="button"
                      disabled={isMutating}
                      data-testid="transition-to-cancelled"
                      onClick={() => handleTransition("cancelled")}
                      className="w-full min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold border border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {order.stockDeducted
                          ? "Cancelar Pedido & Estornar Estoque"
                          : "Cancelar Pedido"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-foreground-muted pt-2 border-t border-surface-border">
                {allowedNext.length === 0
                  ? "Este pedido encontra-se em estado terminal."
                  : "Seu perfil possui acesso somente leitura a este pedido."}
              </p>
            )}
          </section>

          {/* Dados do Cliente e Entrega */}
          <section className="rounded-2xl bg-surface border border-surface-border p-5 space-y-4 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold font-display text-foreground">
              Cliente & Recebimento
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-mono uppercase text-foreground-muted block">
                  Solicitante
                </span>
                <span className="font-semibold text-foreground text-sm block mt-0.5">
                  {order.customerName}
                </span>
              </div>

              <div className="flex items-center gap-2 text-foreground-muted">
                <Phone className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                <span className="font-mono text-foreground">{order.customerPhone}</span>
              </div>

              {order.customerEmail && (
                <div className="flex items-center gap-2 text-foreground-muted">
                  <Mail className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                  <span className="text-foreground break-all">{order.customerEmail}</span>
                </div>
              )}

              <div className="pt-2 border-t border-surface-border">
                <span className="text-[11px] font-mono uppercase text-foreground-muted block mb-1">
                  Modalidade
                </span>
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  {order.deliveryMode === "delivery" ? (
                    <>
                      <MapPin className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                      <span>Entrega / Envio</span>
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <span>Retirada na loja</span>
                    </>
                  )}
                </p>
                {order.deliveryAddress && (
                  <p className="text-foreground-muted mt-1 leading-relaxed">
                    {order.deliveryAddress}
                  </p>
                )}
              </div>

              {order.notes && (
                <div className="pt-2 border-t border-surface-border">
                  <span className="text-[11px] font-mono uppercase text-foreground-muted block mb-1">
                    Observações do Cliente
                  </span>
                  <p className="text-foreground-muted leading-relaxed whitespace-pre-line">
                    {order.notes}
                  </p>
                </div>
              )}

              {customerWhatsAppUrl && (
                <a
                  href={customerWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 w-full min-h-[38px] px-3.5 py-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Contatar cliente via WhatsApp</span>
                </a>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
