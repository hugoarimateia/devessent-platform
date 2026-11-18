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
} from "lucide-react";
import type {
  RetailInventoryMode,
  RetailOrderStatus,
  RetailOrderWithDetails,
} from "../types/retail.types";
import {
  ORDER_STATUS_PRESENTATION,
  ORDER_STATUS_TRANSITIONS,
  OrderInvariants,
} from "../domain/order-invariants";
import { ProductInvariants } from "../domain/product-invariants";
import { updateRetailOrderStatusAction } from "../actions/retail-order.actions";
import { DataTable } from "@/components/ui/data-table";
import { RetailOrderStatusBadge } from "./retail-order-status-badge";

interface RetailOrderDetailProps {
  tenantId: string;
  storeName: string;
  inventoryMode: RetailInventoryMode;
  order: RetailOrderWithDetails;
  canManageOrders: boolean;
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
}: RetailOrderDetailProps) {
  const router = useRouter();
  const [order, setOrder] = React.useState<RetailOrderWithDetails>(initialOrder);
  const [reason, setReason] = React.useState("");
  const [isMutating, setIsMutating] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  React.useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  const statusMeta = ORDER_STATUS_PRESENTATION[order.status];
  const allowedNext = ORDER_STATUS_TRANSITIONS[order.status] || [];
  const nextWorkflowStatuses = allowedNext.filter((s) => s !== "cancelled");
  const canCancel = allowedNext.includes("cancelled");

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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
              Pedido <span className="font-mono">{order.orderNumber}</span>
            </h1>
            <RetailOrderStatusBadge status={order.status} />
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
            Total do Pedido
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

            <div className="px-5 py-4 bg-surface-muted/30 border-t border-surface-border flex items-center justify-between text-sm font-bold">
              <span>Total do Pedido (sem cobrança online)</span>
              <span className="font-mono tabular-nums">
                {ProductInvariants.formatCentsToCurrency(order.totalCents, order.currency)}
              </span>
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

        {/* Coluna Direita: Ações + Cliente */}
        <div className="xl:col-span-4 space-y-6">
          {/* Painel de Transição */}
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
