"use client";

import * as React from "react";
import Link from "next/link";
import { X, ShoppingBag, Minus, Plus, Trash2, AlertCircle, ArrowRight } from "lucide-react";
import type { PublicStorefront, StorefrontTemplate } from "../../types/retail.types";
import { formatCurrency } from "./currency-formatter";
import { ProductImageFallback } from "./product-image-fallback";
import { useStorefrontCart } from "./storefront-cart-provider";

interface StorefrontCartDrawerProps {
  store: PublicStorefront;
  template: StorefrontTemplate;
  previewTemplate?: StorefrontTemplate;
}

export function StorefrontCartDrawer({
  store,
  template,
  previewTemplate,
}: StorefrontCartDrawerProps) {
  const {
    cart,
    isDrawerOpen,
    isMutating,
    error,
    closeDrawer,
    clearError,
    updateItemQuantity,
    clearCart,
    registerTemplateContext,
  } = useStorefrontCart();

  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";

  React.useEffect(() => {
    registerTemplateContext(template, previewTemplate);
  }, [template, previewTemplate, registerTemplateContext]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isDrawerOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isDrawerOpen]);

  const handleDialogClose = () => {
    if (isDrawerOpen) {
      closeDrawer();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();
    const clickedOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (clickedOutside) {
      closeDrawer();
    }
  };

  const isExperimental = template === "experimental";
  const items = cart?.items || [];
  const itemCount = cart?.itemCount || 0;
  const subtotalCents = cart?.subtotalCents || 0;
  const hasUnavailable = cart?.hasUnavailableItems || false;

  return (
    <dialog
      ref={dialogRef}
      id="storefront-cart-drawer"
      aria-labelledby="cart-drawer-title"
      onClose={handleDialogClose}
      onClick={handleBackdropClick}
      style={{ backgroundColor: "transparent" }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-md border-0 bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      <div
        ref={sheetRef}
        className={`flex h-full w-full flex-col shadow-2xl ${
          isExperimental
            ? "bg-[#0e0e12] text-neutral-100 border-l border-neutral-800"
            : "bg-[#faf9f6] text-stone-900 border-l border-stone-200"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isExperimental ? "border-neutral-800 bg-[#0a0a0c]" : "border-stone-200 bg-[#f4f3ef]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShoppingBag
              className={`w-4 h-4 ${isExperimental ? "text-[#d4ff00]" : "text-stone-900"}`}
              aria-hidden="true"
            />
            <h2
              id="cart-drawer-title"
              className={`text-sm font-bold uppercase tracking-wider ${
                isExperimental ? "font-mono text-white" : "font-display text-stone-950"
              }`}
            >
              Sacola ({itemCount})
            </h2>
          </div>

          <button
            type="button"
            onClick={closeDrawer}
            autoFocus
            aria-label="Fechar sacola"
            className={`p-2 rounded-[2px] transition-colors ${
              isExperimental
                ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
                : "text-stone-500 hover:text-stone-950 hover:bg-stone-200/70"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="status"
            aria-live="polite"
            className={`mx-5 mt-4 p-3 rounded-[2px] border text-xs flex items-start justify-between gap-2 ${
              isExperimental
                ? "bg-rose-950/50 border-rose-800 text-rose-200"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dispensar aviso"
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Items Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
              <ShoppingBag
                className={`w-10 h-10 mb-3 opacity-30 ${
                  isExperimental ? "text-[#d4ff00]" : "text-stone-700"
                }`}
                aria-hidden="true"
              />
              <p
                className={`text-sm font-semibold ${
                  isExperimental ? "font-mono text-white" : "text-stone-900"
                }`}
              >
                Sua sacola está vazia
              </p>
              <p
                className={`text-xs mt-1.5 max-w-xs leading-relaxed ${
                  isExperimental ? "text-neutral-400" : "text-stone-500"
                }`}
              >
                Explore as peças disponíveis em {store.storeName} para montar sua solicitação de pedido.
              </p>
              <Link
                href={`/loja/${store.slug}/produtos${queryParam}`}
                onClick={closeDrawer}
                className={`mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-[2px] transition-colors ${
                  isExperimental
                    ? "bg-[#d4ff00] text-black hover:bg-[#c5ee00] font-mono"
                    : "bg-stone-950 text-white hover:bg-stone-800"
                }`}
              >
                <span>Explorar Catálogo</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex gap-3.5 pb-4 border-b last:border-b-0 ${
                    isExperimental ? "border-neutral-800" : "border-stone-200"
                  }`}
                >
                  <Link
                    href={`/loja/${store.slug}/produto/${item.productSlug}${queryParam}`}
                    onClick={closeDrawer}
                    className={`w-20 h-24 shrink-0 overflow-hidden rounded-[2px] border ${
                      isExperimental
                        ? "border-neutral-800 bg-[#141418]"
                        : "border-stone-200 bg-[#f1efe9]"
                    }`}
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ProductImageFallback
                        name={item.productName}
                        template={template}
                        className="w-full h-full"
                      />
                    )}
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/loja/${store.slug}/produto/${item.productSlug}${queryParam}`}
                          onClick={closeDrawer}
                          className={`text-xs font-bold leading-snug hover:underline truncate ${
                            isExperimental ? "text-white font-mono uppercase" : "text-stone-950"
                          }`}
                        >
                          {item.productName}
                        </Link>
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => updateItemQuantity(item.variantId, 0)}
                          aria-label={`Remover ${item.productName}`}
                          className={`p-1 rounded-[2px] transition-colors disabled:opacity-40 ${
                            isExperimental
                              ? "text-neutral-500 hover:text-rose-400"
                              : "text-stone-400 hover:text-rose-600"
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          isExperimental ? "text-neutral-400 font-mono" : "text-stone-500"
                        }`}
                      >
                        {item.variantName} · SKU {item.sku}
                      </p>
                      {item.availabilityIssue && (
                        <p className="text-[11px] text-rose-500 font-medium mt-1">
                          {item.availabilityIssue}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-3">
                      <div
                        className={`inline-flex items-center border rounded-[2px] ${
                          isExperimental
                            ? "border-neutral-700 bg-[#141418]"
                            : "border-stone-300 bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => updateItemQuantity(item.variantId, item.quantity - 1)}
                          aria-label={`Diminuir quantidade de ${item.productName}`}
                          className="w-7 h-7 flex items-center justify-center hover:opacity-75 disabled:opacity-40"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-mono font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={
                            isMutating ||
                            (cart?.inventoryMode === "track_quantity" &&
                              item.quantity >= item.availableStock)
                          }
                          onClick={() => updateItemQuantity(item.variantId, item.quantity + 1)}
                          aria-label={`Aumentar quantidade de ${item.productName}`}
                          className="w-7 h-7 flex items-center justify-center hover:opacity-75 disabled:opacity-40"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span
                        className={`text-xs font-mono font-bold tabular-nums ${
                          isExperimental ? "text-[#d4ff00]" : "text-stone-950"
                        }`}
                      >
                        {formatCurrency(item.lineTotalCents, store.currency)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div
            className={`px-5 py-4 border-t space-y-3 ${
              isExperimental ? "border-neutral-800 bg-[#0a0a0c]" : "border-stone-200 bg-[#f4f3ef]"
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className={isExperimental ? "text-neutral-400 font-mono" : "text-stone-600"}>
                Subtotal estimado
              </span>
              <span
                className={`text-base font-mono font-bold tabular-nums ${
                  isExperimental ? "text-[#d4ff00]" : "text-stone-950"
                }`}
              >
                {formatCurrency(subtotalCents, store.currency)}
              </span>
            </div>

            <p
              className={`text-[11px] leading-relaxed ${
                isExperimental ? "text-neutral-500" : "text-stone-500"
              }`}
            >
              Nenhuma cobrança online é feita agora. O envio registra seu pedido para confirmação da loja.
            </p>

            <div className="flex flex-col gap-2">
              {hasUnavailable ? (
                <div className="p-2.5 text-[11px] text-rose-500 border border-rose-500/30 rounded-[2px] text-center">
                  Ajuste os itens indisponíveis acima para continuar.
                </div>
              ) : (
                <Link
                  href={`/loja/${store.slug}/finalizar${queryParam}`}
                  onClick={closeDrawer}
                  className={`w-full py-3 px-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider rounded-[2px] transition-all ${
                    isExperimental
                      ? "bg-[#d4ff00] text-black hover:bg-[#c5ee00] font-mono shadow-[0_0_16px_rgba(212,255,0,0.25)]"
                      : "bg-stone-950 text-white hover:bg-stone-800"
                  }`}
                >
                  <span>Finalizar Solicitação</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              )}

              <button
                type="button"
                disabled={isMutating}
                onClick={clearCart}
                className={`text-[11px] py-1.5 underline underline-offset-4 transition-opacity hover:opacity-80 disabled:opacity-40 ${
                  isExperimental ? "text-neutral-400 font-mono" : "text-stone-500"
                }`}
              >
                Esvaziar sacola
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
