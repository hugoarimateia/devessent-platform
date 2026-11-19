"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  PackageCheck,
  ArrowRight,
  CreditCard,
  ShieldCheck,
  XCircle,
  RefreshCw,
} from "lucide-react";
import type { PublicOrderTrackingView, StorefrontTemplate } from "../../types/retail.types";
import { OrderInvariants, ORDER_STATUS_PRESENTATION } from "../../domain/order-invariants";
import { PAYMENT_STATUS_PRESENTATION } from "../../domain/payment-invariants";
import { formatCurrency } from "./currency-formatter";
import {
  simulatePublicSandboxCheckoutOutcomeAction,
  startPublicPaymentByReceiptAction,
} from "../../actions/retail-payment.actions";

interface StorefrontOrderReceiptProps {
  order: PublicOrderTrackingView;
  template: StorefrontTemplate;
  previewTemplate?: StorefrontTemplate;
}

export function StorefrontOrderReceipt({
  order,
  template,
  previewTemplate,
}: StorefrontOrderReceiptProps) {
  const router = useRouter();
  const isExperimental = template === "experimental";
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const statusInfo = ORDER_STATUS_PRESENTATION[order.status];
  const currentPaymentStatus = order.paymentStatus || "not_started";
  const paymentStatusInfo = PAYMENT_STATUS_PRESENTATION[currentPaymentStatus];
  const totalFormatted = formatCurrency(order.totalCents, order.currency);
  const paidAmountCents = order.paidAmountCents ?? 0;

  const [isPending, startTransition] = React.useTransition();
  const [sandboxOpen, setSandboxOpen] = React.useState(Boolean(order.activeCheckoutUrl));
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const whatsappUrl = OrderInvariants.buildOrderWhatsAppUrl({
    storePhone: order.contactPhone,
    storeName: order.storeName,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    totalFormatted,
    deliveryMode: order.deliveryMode,
  });

  function handleStartOnlinePayment() {
    setFeedback(null);
    startTransition(async () => {
      const res = await startPublicPaymentByReceiptAction(
        order.storeSlug,
        order.orderNumber,
        `pay_receipt_${order.orderNumber}_${Date.now()}`
      );
      if (!res.success) {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível iniciar o pagamento online.",
        });
        return;
      }
      setSandboxOpen(true);
      setFeedback({
        type: "info",
        text: "Sessão segura de pagamento Sandbox iniciada.",
      });
      router.refresh();
    });
  }

  function handleSimulateOutcome(
    outcome: "approved" | "pending" | "rejected" | "expired"
  ) {
    setFeedback(null);
    startTransition(async () => {
      const simRes = await simulatePublicSandboxCheckoutOutcomeAction({
        storeSlug: order.storeSlug,
        orderNumber: order.orderNumber,
        outcome,
        paymentMethod: "pix",
      });
      if (!simRes.success) {
        setFeedback({
          type: "error",
          text: simRes.error || "Falha ao simular retorno do gateway Sandbox.",
        });
        return;
      }
      if (outcome === "approved") {
        setSandboxOpen(false);
        setFeedback({
          type: "success",
          text: "Pagamento confirmado pelo gateway!",
        });
      } else {
        setFeedback({
          type: outcome === "pending" ? "info" : "error",
          text:
            outcome === "pending"
              ? "Pagamento registrado como em processamento."
              : "Pagamento não aprovado. Você pode tentar novamente.",
        });
      }
      router.refresh();
    });
  }

  return (
    <div
      className={`py-12 px-4 sm:px-6 ${
        isExperimental ? "bg-[#0a0a0c] text-neutral-100" : "bg-[#faf9f6] text-stone-900"
      }`}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <div
          className={`p-6 sm:p-8 rounded-[2px] border space-y-5 ${
            isExperimental
              ? "bg-[#111115] border-neutral-800"
              : "bg-white border-stone-200 shadow-xs"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-current/10">
            <div className="space-y-1.5">
              <div
                className={`inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-[2px] border ${
                  isExperimental
                    ? "bg-[#d4ff00]/10 border-[#d4ff00]/40 text-[#d4ff00]"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Solicitação Registrada</span>
              </div>
              <h1
                className={`text-2xl sm:text-3xl font-black uppercase tracking-tight ${
                  isExperimental ? "font-mono text-white" : "font-display text-stone-950"
                }`}
              >
                Pedido {order.orderNumber}
              </h1>
              <p className={`text-xs sm:text-sm ${isExperimental ? "text-neutral-400" : "text-stone-600"}`}>
                Recebido por <strong>{order.storeName}</strong> em{" "}
                {new Date(order.createdAt).toLocaleString("pt-BR")}.
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <div>
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider block ${
                    isExperimental ? "text-neutral-400" : "text-stone-500"
                  }`}
                >
                  Situação Operacional
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold mt-0.5 ${
                    isExperimental ? "text-[#d4ff00] font-mono" : "text-stone-950"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{statusInfo.label}</span>
                </span>
              </div>
              <div>
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider block ${
                    isExperimental ? "text-neutral-400" : "text-stone-500"
                  }`}
                >
                  Status Financeiro
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    currentPaymentStatus === "paid"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isExperimental
                      ? "text-neutral-300"
                      : "text-stone-700"
                  }`}
                >
                  {paymentStatusInfo.label}
                </span>
              </div>
            </div>
          </div>

          <div
            className={`p-4 rounded-[2px] border text-xs leading-relaxed ${
              isExperimental
                ? "bg-[#141418] border-neutral-800 text-neutral-300"
                : "bg-stone-50 border-stone-200 text-stone-700"
            }`}
          >
            {currentPaymentStatus === "paid" ? (
              <>
                <strong>Pagamento confirmado!</strong> O valor de{" "}
                <strong>{formatCurrency(paidAmountCents, order.currency)}</strong> foi aprovado em favor de{" "}
                <strong>{order.receiverAccountLabel || order.storeName}</strong>.
              </>
            ) : order.canStartOnlinePayment ? (
              <>
                {statusInfo.description} Seu pedido já foi confirmado pela loja e está liberado para pagamento online seguro em favor de{" "}
                <strong>{order.receiverAccountLabel || order.storeName}</strong>.
              </>
            ) : (
              <>
                {statusInfo.description} Nenhuma cobrança online foi realizada no envio da solicitação.{" "}
                {order.paymentBlockedReason}
              </>
            )}
          </div>

          {feedback && (
            <div
              role="status"
              className={`p-3.5 rounded-[2px] border text-xs ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-700 dark:text-emerald-300"
                  : feedback.type === "error"
                  ? "bg-rose-500/10 border-rose-500/35 text-rose-700 dark:text-rose-300"
                  : "bg-stone-100 border-stone-300 text-stone-800"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Itens */}
          <div className="space-y-3">
            <h2
              className={`text-xs font-mono uppercase tracking-widest ${
                isExperimental ? "text-neutral-400" : "text-stone-500"
              }`}
            >
              Itens da Solicitação
            </h2>
            <ul className="divide-y divide-current/10">
              {order.items.map((item) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p
                      className={`font-semibold ${
                        isExperimental ? "text-white font-mono" : "text-stone-950"
                      }`}
                    >
                      {item.productNameSnapshot}
                    </p>
                    <p className={isExperimental ? "text-neutral-400" : "text-stone-500"}>
                      {item.variantNameSnapshot} · SKU {item.skuSnapshot} · Qtd {item.quantity}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      isExperimental ? "text-[#d4ff00]" : "text-stone-950"
                    }`}
                  >
                    {formatCurrency(item.lineTotalCents, order.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Totais e Entrega */}
          <div
            className={`pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs ${
              isExperimental ? "border-neutral-800" : "border-stone-200"
            }`}
          >
            <div className="space-y-1">
              <span
                className={`font-mono uppercase tracking-wider text-[10px] block ${
                  isExperimental ? "text-neutral-400" : "text-stone-500"
                }`}
              >
                Recebimento
              </span>
              <p className="font-semibold flex items-center gap-1.5">
                {order.deliveryMode === "delivery" ? (
                  <>
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      Entrega / Envio (Frete:{" "}
                      {order.shippingFeeCents === null || order.shippingFeeCents === undefined
                        ? "a combinar"
                        : formatCurrency(order.shippingFeeCents, order.currency)}
                      )
                    </span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Retirada na loja</span>
                  </>
                )}
              </p>
              {order.hasDeliveryAddress && (
                <p className={isExperimental ? "text-neutral-400" : "text-stone-600"}>
                  Endereço de entrega registrado na solicitação (confirmado diretamente com a loja).
                </p>
              )}
            </div>

            <div className="sm:text-right space-y-1">
              <span
                className={`font-mono uppercase tracking-wider text-[10px] block ${
                  isExperimental ? "text-neutral-400" : "text-stone-500"
                }`}
              >
                Total do Pedido
              </span>
              <p
                className={`text-2xl font-mono font-bold tabular-nums ${
                  isExperimental ? "text-[#d4ff00]" : "text-stone-950"
                }`}
              >
                {totalFormatted}
              </p>
            </div>
          </div>

          {/* Pagamento Online (quando confirmado e elegível) */}
          {order.canStartOnlinePayment && currentPaymentStatus !== "paid" && (
            <div className="pt-3 border-t border-current/10 space-y-3">
              <button
                type="button"
                disabled={isPending}
                onClick={handleStartOnlinePayment}
                className={`w-full py-3.5 px-6 text-xs font-bold uppercase tracking-wider rounded-[2px] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                  isExperimental
                    ? "bg-[#d4ff00] text-black hover:bg-[#c5ee00] font-mono"
                    : "bg-emerald-700 text-white hover:bg-emerald-800"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isPending
                    ? "Preparando Checkout..."
                    : `Pagar Online (${totalFormatted}) · Checkout Seguro Sandbox`}
                </span>
              </button>

              {sandboxOpen && (
                <div
                  className={`p-4 rounded-[2px] border space-y-3 ${
                    isExperimental
                      ? "bg-[#15151c] border-[#d4ff00]/40"
                      : "bg-stone-50 border-stone-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      Mercado Pago Checkout Pro (Sandbox)
                    </span>
                    <span className="font-mono text-[11px] opacity-80">
                      Recebedor: {order.receiverAccountLabel || order.storeName}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSimulateOutcome("approved")}
                      className="py-2 px-3 rounded-[2px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Simular Aprovação</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSimulateOutcome("pending")}
                      className="py-2 px-3 rounded-[2px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Em Processamento</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSimulateOutcome("rejected")}
                      className="py-2 px-3 rounded-[2px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Simular Recusa</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="pt-4 flex flex-wrap items-center gap-3">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className={`inline-flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider rounded-[2px] transition-all ${
                  isExperimental
                    ? "bg-[#d4ff00] text-black hover:bg-[#c5ee00] font-mono"
                    : "bg-stone-950 text-white hover:bg-stone-800"
                }`}
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Enviar resumo pelo WhatsApp</span>
              </a>
            )}

            <Link
              href={`/loja/${order.storeSlug}/produtos${queryParam}`}
              className={`inline-flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider rounded-[2px] border transition-colors ${
                isExperimental
                  ? "border-neutral-700 text-neutral-200 hover:border-white font-mono"
                  : "border-stone-300 text-stone-800 hover:border-stone-950"
              }`}
            >
              <span>Continuar na Loja</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
