"use client";

import * as React from "react";
import type { RetailCart, StorefrontTemplate } from "../../types/retail.types";
import {
  addToStorefrontCartAction,
  clearStorefrontCartAction,
  getStorefrontCartAction,
  updateStorefrontCartItemAction,
} from "../../actions/retail-cart.actions";

interface StorefrontCartContextValue {
  storeSlug: string;
  cart: RetailCart | null;
  itemCount: number;
  isDrawerOpen: boolean;
  isMutating: boolean;
  error: string | null;
  activeTemplate: StorefrontTemplate;
  previewTemplate?: StorefrontTemplate;
  openDrawer: () => void;
  closeDrawer: () => void;
  clearError: () => void;
  refreshCart: () => Promise<void>;
  addItem: (params: {
    productId: string;
    variantId: string;
    quantity: number;
    openDrawerOnSuccess?: boolean;
  }) => Promise<boolean>;
  updateItemQuantity: (variantId: string, quantity: number) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  registerTemplateContext: (template: StorefrontTemplate, previewTemplate?: StorefrontTemplate) => void;
}

const StorefrontCartContext = React.createContext<StorefrontCartContextValue | null>(null);

export function StorefrontCartProvider({
  storeSlug,
  initialTemplate,
  initialCart,
  children,
}: {
  storeSlug: string;
  initialTemplate: StorefrontTemplate;
  initialCart: RetailCart | null;
  children: React.ReactNode;
}) {
  const [cart, setCart] = React.useState<RetailCart | null>(initialCart);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = React.useState<StorefrontTemplate>(initialTemplate);
  const [previewTemplate, setPreviewTemplate] = React.useState<StorefrontTemplate | undefined>(undefined);

  React.useEffect(() => {
    setCart(initialCart);
  }, [initialCart]);

  const refreshCart = React.useCallback(async () => {
    const res = await getStorefrontCartAction(storeSlug);
    if (res.success && res.cart !== undefined) {
      setCart(res.cart);
    }
  }, [storeSlug]);

  const addItem = React.useCallback(
    async ({
      productId,
      variantId,
      quantity,
      openDrawerOnSuccess = true,
    }: {
      productId: string;
      variantId: string;
      quantity: number;
      openDrawerOnSuccess?: boolean;
    }) => {
      setIsMutating(true);
      setError(null);
      try {
        const res = await addToStorefrontCartAction(storeSlug, {
          productId,
          variantId,
          quantity,
        });
        if (!res.success) {
          setError(res.error || "Não foi possível adicionar o item.");
          return false;
        }
        if (res.cart !== undefined) {
          setCart(res.cart);
        }
        if (openDrawerOnSuccess) {
          setIsDrawerOpen(true);
        }
        return true;
      } finally {
        setIsMutating(false);
      }
    },
    [storeSlug]
  );

  const updateItemQuantity = React.useCallback(
    async (variantId: string, quantity: number) => {
      setIsMutating(true);
      setError(null);
      try {
        const res = await updateStorefrontCartItemAction(storeSlug, {
          variantId,
          quantity,
        });
        if (!res.success) {
          setError(res.error || "Não foi possível atualizar a quantidade.");
          return false;
        }
        if (res.cart !== undefined) {
          setCart(res.cart);
        }
        return true;
      } finally {
        setIsMutating(false);
      }
    },
    [storeSlug]
  );

  const clearCart = React.useCallback(async () => {
    setIsMutating(true);
    setError(null);
    try {
      const res = await clearStorefrontCartAction(storeSlug);
      if (!res.success) {
        setError(res.error || "Não foi possível limpar a sacola.");
        return false;
      }
      if (res.cart !== undefined) {
        setCart(res.cart);
      }
      return true;
    } finally {
      setIsMutating(false);
    }
  }, [storeSlug]);

  const registerTemplateContext = React.useCallback(
    (template: StorefrontTemplate, preview?: StorefrontTemplate) => {
      setActiveTemplate(template);
      setPreviewTemplate(preview);
    },
    []
  );

  const itemCount = cart?.itemCount ?? 0;

  return (
    <StorefrontCartContext.Provider
      value={{
        storeSlug,
        cart,
        itemCount,
        isDrawerOpen,
        isMutating,
        error,
        activeTemplate,
        previewTemplate,
        openDrawer: () => setIsDrawerOpen(true),
        closeDrawer: () => setIsDrawerOpen(false),
        clearError: () => setError(null),
        refreshCart,
        addItem,
        updateItemQuantity,
        clearCart,
        registerTemplateContext,
      }}
    >
      {children}
    </StorefrontCartContext.Provider>
  );
}

export function useStorefrontCart() {
  const ctx = React.useContext(StorefrontCartContext);
  if (!ctx) {
    throw new Error("useStorefrontCart deve ser usado dentro de StorefrontCartProvider.");
  }
  return ctx;
}
