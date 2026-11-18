"use client";

import * as React from "react";
import { Minus, Plus, ShoppingBag, Check } from "lucide-react";
import type { RetailVariant, StorefrontTemplate } from "../../types/retail.types";
import { useStorefrontCart } from "./storefront-cart-provider";

interface StorefrontAddToCartPanelProps {
  productId: string;
  selectedVariant: RetailVariant | null;
  template: StorefrontTemplate;
}

export function StorefrontAddToCartPanel({
  productId,
  selectedVariant,
  template,
}: StorefrontAddToCartPanelProps) {
  const { addItem, isMutating, openDrawer, error } = useStorefrontCart();
  const [quantity, setQuantity] = React.useState(1);
  const [addedRecently, setAddedRecently] = React.useState(false);

  const isExperimental = template === "experimental";
  const maxStock = selectedVariant ? Math.min(99, Math.max(0, selectedVariant.stockQuantity)) : 0;
  const canAdd = Boolean(selectedVariant && selectedVariant.isAvailable && maxStock > 0);

  React.useEffect(() => {
    setQuantity((prev) => {
      if (maxStock <= 0) return 1;
      return Math.min(prev, maxStock);
    });
  }, [selectedVariant?.id, maxStock]);

  const handleAdd = async () => {
    if (!selectedVariant || !canAdd || isMutating) return;
    const ok = await addItem({
      productId,
      variantId: selectedVariant.id,
      quantity,
      openDrawerOnSuccess: true,
    });
    if (ok) {
      setAddedRecently(true);
      setTimeout(() => setAddedRecently(false), 2500);
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-stretch gap-3">
        {/* Stepper de quantidade */}
        <div
          className={`inline-flex items-center rounded-[2px] border min-h-[48px] ${
            isExperimental
              ? "border-neutral-700 bg-[#141418] text-white"
              : "border-stone-300 bg-white text-stone-950"
          }`}
        >
          <button
            type="button"
            disabled={!canAdd || quantity <= 1 || isMutating}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Diminuir quantidade"
            className="w-11 h-full flex items-center justify-center hover:opacity-75 disabled:opacity-40"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span
            data-testid="product-quantity-value"
            className="w-10 text-center text-xs font-mono font-bold tabular-nums"
          >
            {quantity}
          </span>
          <button
            type="button"
            disabled={!canAdd || quantity >= maxStock || isMutating}
            onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
            aria-label="Aumentar quantidade"
            className="w-11 h-full flex items-center justify-center hover:opacity-75 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Botão Adicionar à Sacola */}
        <button
          type="button"
          disabled={!canAdd || isMutating}
          onClick={handleAdd}
          data-testid="add-to-cart-button"
          className={`flex-1 min-w-[200px] min-h-[48px] px-6 py-3 rounded-[2px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-45 disabled:cursor-not-allowed ${
            isExperimental
              ? "bg-[#d4ff00] text-black hover:bg-[#c5ee00] font-mono shadow-[0_0_18px_rgba(212,255,0,0.22)]"
              : "bg-stone-950 text-white hover:bg-stone-800"
          }`}
        >
          {addedRecently ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Adicionado à Sacola</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              <span>
                {!canAdd
                  ? "Indisponível no momento"
                  : isMutating
                    ? "Adicionando..."
                    : "Adicionar à Sacola"}
              </span>
            </>
          )}
        </button>
      </div>

      {error && (
        <p role="status" className="text-xs text-rose-500 font-medium">
          {error}
        </p>
      )}

      {addedRecently && (
        <button
          type="button"
          onClick={openDrawer}
          className={`text-xs underline underline-offset-4 ${
            isExperimental ? "text-[#d4ff00] font-mono" : "text-stone-800"
          }`}
        >
          Ver sacola e enviar solicitação de pedido
        </button>
      )}
    </div>
  );
}
