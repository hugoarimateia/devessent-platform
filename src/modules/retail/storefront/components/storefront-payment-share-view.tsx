"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  MapPin,
  PackageCheck,
  QrCode,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type {
  PublicOrderPaymentShareView,
  RetailPaymentMethod,
  StorefrontTemplate,
} from "../../types/retail.types";
import { ORDER_STATUS_PRESENTATION } from "../../domain/order-invariants";
import { PAYMENT_STATUS_PRESENTATION } from "../../domain/payment-invariants";
import { formatCurrency } from "./currency-formatter";
import {
  simulatePublicSandboxCheckoutOutcomeAction,
  startPublicPaymentByShareTokenAction,
} from "../../actions/retail-payment.actions";

interface StorefrontPaymentShareViewProps {
  shareView: PublicOrderPaymentShareView;
  shareToken: string;
  template: StorefrontTemplate;
  previewTemplate?: StorefrontTemplate;
  initialSandboxOpen?: boolean;
}

export function StorefrontPaymentShareView({
  shareView,
  shareToken,
  template,
  previewTemplate,
  initialSandboxOpen = false,
}: StorefrontPaymentShareViewProps) {
  const router = useRouter();
  const isExperimental = template === "experimental";
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";

  const [isPending, startTransition] = React.useTransition();
  const [sandboxModalOpen, setSandboxModalOpen] = React.useState(
    initialSandboxOpen || Boolean(shareView.activeCheckoutUrl)
  );
  const [selectedMethod, setSelectedMethod] = React.useState<RetailPaymentMethod>("pix");
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const orderStatusInfo = ORDER_STATUS_PRESENTATION[shareView.operationalStatus];
  const paymentStatusInfo = PAYMENT_STATUS_PRESENTATION[shareView.paymentStatus];
  const totalFormatted = formatCurrency(shareView.totalCents, shareView.currency);
  const receiverLabel = shareView.receiverAccountLabel || shareView.storeName;

  function handleStartCheckout() {
    setFeedback(null);
    startTransition(async () => {
      const idempotencyKey = `pay_share_${shareView.orderNumber}_${Date.now()}`;
      const res = await startPublicPaymentByShareTokenAction(
        shareView.storeSlug,
        shareToken,
        idempotencyKey
      );

      if (!res.success || !res.data) {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível iniciar a sessão de pagamento.",
        });
        return;
      }

      setSandboxModalOpen(true);
      setFeedback({
        type: "info",
        text: "Sessão segura de Checkout Pro Sandbox iniciada. Conclua o pagamento no painel abaixo.",
      });
      router.refresh();
    });
  }

  function handleSimulateOutcome(
    outcome: "approved" | "pending" | "rejected" | "expired"
  ) {
    setFeedback(null);
    startTransition(async () => {
      if (!shareView.activeCheckoutUrl && shareView.paymentStatus === "not_started") {
        const startRes = await startPublicPaymentByShareTokenAction(
          shareView.storeSlug,
          shareToken,
          `pay_share_${shareView.orderNumber}_${Date.now()}`
        );
        if (!startRes.success) {
          setFeedback({
            type: "error",
            text: startRes.error || "Não foi possível preparar a sessão de pagamento.",
          });
          return;
        }
      }

      const simRes = await simulatePublicSandboxCheckoutOutcomeAction({
        storeSlug: shareView.storeSlug,
        shareToken,
        outcome,
        paymentMethod: selectedMethod,
      });

      if (!simRes.success || !simRes.data) {
        setFeedback({
          type: "error",
          text: simRes.error || "Falha ao processar retorno do gateway Sandbox.",
        });
        return;
      }

      if (outcome === "approved") {
        setSandboxModalOpen(false);
        setFeedback({
          type: "success",
          text: `Pagamento confirmado pelo provedor (ID: ${simRes.data.externalPaymentId})!`,
        });
      } else if (outcome === "pending") {
        setFeedback({
          type: "info",
          text: "Pagamento registrado como em processamento. Aguardando compensação do gateway.",
        });
      } else {
        setFeedback({
          type: "error",
          text:
            outcome === "rejected"
              ? "Pagamento recusado pelo emissor. Você pode iniciar uma nova tentativa."
              : "Sessão de pagamento expirada. Inicie uma nova tentativa para pagar.",
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
          className={`p-6 sm:p-8 rounded-[2px] border space-y-6 ${
            isExperimental
              ? "bg-[#111115] border-neutral-800"
              : "bg-white border-stone-200 shadow-xs"
          }`}
        >
          {/* Cabeçalho com identificação clara da loja recebedora */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-current/10">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-[2px] border ${
                    isExperimental
                      ? "bg-[#d4ff00]/10 border-[#d4ff00]/40 text-[#d4ff00]"
                      : "bg-stone-100 border-stone-300 text-stone-800"
                  }`}
                >
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  <span>Checkout Financeiro · {shareView.storeName}</span>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] text-[10px] font-mono font-bold uppercase tracking-wider bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/30">
                  Modo Sandbox (Sem cobrança real)
                </span>
              </div>

              <h1
                className={`text-2xl sm:text-3xl font-black uppercase tracking-tight ${
                  isExperimental ? "font-mono text-white" : "font-display text-stone-950"
                }`}
              >
                Pagamento do Pedido {shareView.orderNumber}
              </h1>
              <p
                className={`text-xs sm:text-sm ${
                  isExperimental ? "text-neutral-400" : "text-stone-600"
                }`}
              >
                Olá, <strong>{shareView.customerFirstName}</strong>. Recebedor identificado:{" "}
                <strong>{receiverLabel}</strong>.
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span
                className={`text-[10px] font-mono uppercase tracking-wider block ${
                  isExperimental ? "text-neutral-400" : "text-stone-500"
                }`}
              >
                Status do Pagamento
              </span>
              <span
                data-testid="public-payment-status-label"
                className={`inline-flex items-center gap-1.5 text-xs font-bold mt-1 px-2.5 py-1 rounded-[2px] border ${
                  shareView.paymentStatus === "paid"
                    ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-300"
                    : shareView.paymentStatus === "failed" ||
                      shareView.paymentStatus === "expired"
                    ? "bg-rose-500/15 border-rose-500/35 text-rose-600 dark:text-rose-300"
                    : isExperimental
                    ? "bg-[#d4ff00]/10 border-[#d4ff00]/30 text-[#d4ff00] font-mono"
                    : "bg-amber-50 border-amber-300 text-amber-900"
                }`}
              >
                {shareView.paymentStatus === "paid" ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : shareView.paymentStatus === "failed" ||
                  shareView.paymentStatus === "expired" ? (
                  <XCircle className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                <span>{paymentStatusInfo.label}</span>
              </span>
            </div>
          </div>

          {feedback && (
            <div
              role="status"
              data-testid="public-payment-feedback"
              className={`p-4 rounded-[2px] border text-xs flex items-start gap-2.5 ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-700 dark:text-emerald-300"
                  : feedback.type === "error"
                  ? "bg-rose-500/10 border-rose-500/35 text-rose-700 dark:text-rose-300"
                  : isExperimental
                  ? "bg-[#16161d] border-neutral-700 text-neutral-200"
                  : "bg-stone-100 border-stone-300 text-stone-800"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Banner de Pagamento Confirmado */}
          {shareView.paymentStatus === "paid" && (
            <div
              data-testid="payment-confirmed-banner"
              className="p-5 rounded-[2px] border border-emerald-500/35 bg-emerald-500/10 space-y-2"
            >
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Pagamento Confirmado pelo Gateway!</span>
              </div>
              <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90 leading-relaxed">
                O valor de{" "}
                <strong>{formatCurrency(shareView.paidAmountCents, shareView.currency)}</strong>{" "}
                foi aprovado em favor de <strong>{receiverLabel}</strong>. Status operacional do pedido: <strong>{orderStatusInfo.label}</strong>.
              </p>
            </div>
          )}

          {/* Resumo dos Itens e Valores */}
          <div className="space-y-3">
            <h2
              className={`text-xs font-mono uppercase tracking-widest ${
                isExperimental ? "text-neutral-400" : "text-stone-500"
              }`}
            >
              Itens Confirmados no Pedido
            </h2>
            <ul className="divide-y divide-current/10">
              {shareView.items.map((item, idx) => (
                <li
                  key={`${item.productName}-${idx}`}
                  className="py-3 flex items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <p
                      className={`font-semibold ${
                        isExperimental ? "text-white font-mono" : "text-stone-950"
                      }`}
                    >
                      {item.productName}
                    </p>
                    <p className={isExperimental ? "text-neutral-400" : "text-stone-500"}>
                      {item.variantName} · Qtd {item.quantity}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      isExperimental ? "text-[#d4ff00]" : "text-stone-950"
                    }`}
                  >
                    {formatCurrency(item.lineTotalCents, shareView.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Composição do Total Financeiro */}
          <div
            className={`pt-4 border-t space-y-2 text-xs ${
              isExperimental ? "border-neutral-800" : "border-stone-200"
            }`}
          >
            <div className="flex justify-between">
              <span className={isExperimental ? "text-neutral-400" : "text-stone-600"}>
                Subtotal dos itens
              </span>
              <span className="font-mono">
                {formatCurrency(shareView.subtotalCents, shareView.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isExperimental ? "text-neutral-400" : "text-stone-600"}>
                Modalidade ({shareView.deliveryMode === "pickup" ? "Retirada na loja" : "Entrega"})
              </span>
              <span className="font-mono">
                {shareView.shippingFeeCents === null
                  ? "Aguardando definição pela loja"
                  : formatCurrency(shareView.shippingFeeCents, shareView.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-current/10">
              <div>
                <span
                  className={`font-mono uppercase tracking-wider text-[10px] block ${
                    isExperimental ? "text-neutral-400" : "text-stone-500"
                  }`}
                >
                  Total a Pagar para {receiverLabel}
                </span>
                <span className="text-[11px] opacity-75 flex items-center gap-1 mt-0.5">
                  {shareView.deliveryMode === "delivery" ? (
                    <>
                      <MapPin className="w-3 h-3" /> Entrega / Envio
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-3 h-3" /> Retirada na loja
                    </>
                  )}
                </span>
              </div>
              <span
                className={`text-2xl font-mono font-bold tabular-nums ${
                  isExperimental ? "text-[#d4ff00]" : "text-stone-950"
                }`}
              >
                {totalFormatted}
              </span>
            </div>
          </div>

          {/* Botão Principal de Checkout ou Motivo de Bloqueio */}
          {shareView.paymentStatus !== "paid" && (
            <div className="pt-2 space-y-4">
              {shareView.canInitiatePayment ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={isPending}
                    data-testid="start-online-payment-btn"
                    onClick={handleStartCheckout}
                    className={`w-full py-3.5 px-6 text-xs font-bold uppercase tracking-wider rounded-[2px] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                      isExperimental
                        ? "bg-[#d4ff00] text-black hover:bg-[#c5ee00] font-mono"
                        : "bg-stone-950 text-white hover:bg-stone-800"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {isPending
                        ? "Preparando Checkout Seguro..."
                        : shareView.paymentStatus === "failed" ||
                          shareView.paymentStatus === "expired"
                        ? "Tentar Novamente no Checkout Seguro (Sandbox)"
                        : "Pagar Online no Checkout Seguro (Sandbox)"}
                    </span>
                  </button>

                  {/* Painel Simulador do Hosted Checkout Pro Sandbox */}
                  {sandboxModalOpen && (
                    <div
                      data-testid="sandbox-checkout-simulator"
                      className={`p-5 rounded-[2px] border space-y-4 ${
                        isExperimental
                          ? "bg-[#15151c] border-[#d4ff00]/40"
                          : "bg-stone-50 border-stone-300"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-current/10">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            Mercado Pago Checkout Pro · Ambiente Sandbox
                          </span>
                        </div>
                        <span className="text-[11px] font-mono opacity-75">
                          Recebedor: {receiverLabel}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed opacity-85">
                        Em produção, o comprador conclui o pagamento no ambiente hospedado do Mercado Pago. Neste ambiente de homologação Sandbox, selecione o meio de pagamento e simule o evento de retorno autenticado (Webhook HMAC-SHA256 + Consulta Autoritativa):
                      </p>

                      {/* Seleção do Meio de Pagamento */}
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: "pix", label: "Pix Instantâneo", icon: QrCode },
                            { id: "credit_card", label: "Cartão de Crédito", icon: CreditCard },
                            { id: "boleto", label: "Boleto Bancário", icon: Clock },
                          ] as const
                        ).map((m) => {
                          const Icon = m.icon;
                          const active = selectedMethod === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setSelectedMethod(m.id)}
                              className={`p-2.5 rounded-[2px] border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                                active
                                  ? isExperimental
                                    ? "border-[#d4ff00] bg-[#d4ff00]/15 text-[#d4ff00]"
                                    : "border-stone-950 bg-stone-950 text-white"
                                  : "border-current/20 opacity-75 hover:opacity-100"
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{m.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Botões de Simulação de Resultado */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        <button
                          type="button"
                          disabled={isPending}
                          data-testid="simulate-payment-approved-btn"
                          onClick={() => handleSimulateOutcome("approved")}
                          className="py-2.5 px-4 rounded-[2px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Simular Pagamento Aprovado</span>
                        </button>

                        <button
                          type="button"
                          disabled={isPending}
                          data-testid="simulate-payment-pending-btn"
                          onClick={() => handleSimulateOutcome("pending")}
                          className="py-2.5 px-4 rounded-[2px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Simular Em Processamento</span>
                        </button>

                        <button
                          type="button"
                          disabled={isPending}
                          data-testid="simulate-payment-rejected-btn"
                          onClick={() => handleSimulateOutcome("rejected")}
                          className="py-2.5 px-4 rounded-[2px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Simular Pagamento Recusado</span>
                        </button>

                        <button
                          type="button"
                          disabled={isPending}
                          data-testid="simulate-payment-expired-btn"
                          onClick={() => handleSimulateOutcome("expired")}
                          className="py-2.5 px-4 rounded-[2px] border border-current/25 hover:bg-current/5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Clock className="w-4 h-4" />
                          <span>Simular Sessão Expirada</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  data-testid="payment-blocked-reason-box"
                  className={`p-4 rounded-[2px] border text-xs leading-relaxed ${
                    isExperimental
                      ? "bg-[#141418] border-neutral-800 text-neutral-300"
                      : "bg-stone-100 border-stone-200 text-stone-700"
                  }`}
                >
                  <strong>Pagamento online indisponível:</strong>{" "}
                  {shareView.blockedReason ||
                    "Aguarde a confirmação da loja para liberar o pagamento."}
                </div>
              )}
            </div>
          )}

          {/* Ações Auxiliares */}
          <div className="pt-4 border-t border-current/10 flex flex-wrap items-center justify-end gap-3">
            <Link
              href={`/loja/${shareView.storeSlug}/produtos${queryParam}`}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-[2px] border transition-colors ${
                isExperimental
                  ? "border-neutral-700 text-neutral-200 hover:border-white font-mono"
                  : "border-stone-300 text-stone-800 hover:border-stone-950"
              }`}
            >
              <span>Voltar para a Loja</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
