"use client";

import * as React from "react";
import { ShoppingBag } from "lucide-react";
import type { StorefrontTemplate } from "../../types/retail.types";
import { useStorefrontCart } from "./storefront-cart-provider";

export function StorefrontCartTrigger({ template }: { template: StorefrontTemplate }) {
  const { itemCount, isDrawerOpen, openDrawer } = useStorefrontCart();
  const isExperimental = template === "experimental";

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={`Abrir sacola de compras (${itemCount} ${itemCount === 1 ? "item" : "itens"})`}
      aria-controls="storefront-cart-drawer"
      aria-expanded={isDrawerOpen}
      data-testid="storefront-cart-trigger"
      className={`flex items-center gap-1.5 p-1 transition-colors ${
        isExperimental
          ? "text-neutral-300 hover:text-[#d4ff00]"
          : "text-stone-800 hover:text-stone-950"
      }`}
    >
      <ShoppingBag className="w-4 h-4" aria-hidden="true" />
      {isExperimental ? (
        <span
          data-testid="storefront-cart-count"
          className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#d4ff00] text-black font-bold tabular-nums"
        >
          {itemCount}
        </span>
      ) : (
        <span data-testid="storefront-cart-count" className="text-[11px] font-mono tabular-nums">
          ({itemCount})
        </span>
      )}
    </button>
  );
}
