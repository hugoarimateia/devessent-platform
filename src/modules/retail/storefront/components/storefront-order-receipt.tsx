import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Clock, MapPin, MessageCircle, PackageCheck, ArrowRight } from "lucide-react";
import type { PublicOrderTrackingView, StorefrontTemplate } from "../../types/retail.types";
import { OrderInvariants, ORDER_STATUS_PRESENTATION } from "../../domain/order-invariants";
import { formatCurrency } from "./currency-formatter";

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
  const isExperimental = template === "experimental";
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const statusInfo = ORDER_STATUS_PRESENTATION[order.status];
  const totalFormatted = formatCurrency(order.totalCents, order.currency);

  const whatsappUrl = OrderInvariants.buildOrderWhatsAppUrl({
    storePhone: order.contactPhone,
    storeName: order.storeName,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    totalFormatted,
    deliveryMode: order.deliveryMode,
  });

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

            <div className="text-left sm:text-right">
              <span
                className={`text-[10px] font-mono uppercase tracking-wider block ${
                  isExperimental ? "text-neutral-400" : "text-stone-500"
                }`}
              >
                Situação atual
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold mt-1 ${
                  isExperimental ? "text-[#d4ff00] font-mono" : "text-stone-950"
                }`}
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{statusInfo.label}</span>
              </span>
            </div>
          </div>

          <div
            className={`p-4 rounded-[2px] border text-xs leading-relaxed ${
              isExperimental
                ? "bg-[#141418] border-neutral-800 text-neutral-300"
                : "bg-stone-50 border-stone-200 text-stone-700"
            }`}
          >
            {statusInfo.description} Nenhuma cobrança online foi realizada. Nossa equipe confirmará os itens e entrará em contato para alinhar pagamento e entrega.
          </div>

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
                    <span>Entrega / Envio</span>
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
                Total Solicitado
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
