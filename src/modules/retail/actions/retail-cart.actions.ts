"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toPublicErrorMessage, getFieldErrorsFromError } from "@/core/errors/public-error";
import { RetailCartService } from "../services/retail-cart-service";
import { RetailOrderService } from "../services/retail-order-service";
import { writeStoreOrderReceiptToken } from "../services/retail-cart-cookie";
import type { RetailCart } from "../types/retail.types";

export interface CartActionResult {
  success: boolean;
  cart?: RetailCart | null;
  error?: string;
}

export interface CreatePublicOrderActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  redirectUrl?: string;
  orderNumber?: string;
}

export async function getStorefrontCartAction(storeSlug: string): Promise<CartActionResult> {
  try {
    const cart = await RetailCartService.getCartForStore(storeSlug);
    return { success: true, cart };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível carregar sua sacola."),
    };
  }
}

export async function addToStorefrontCartAction(
  storeSlug: string,
  payload: { productId: string; variantId: string; quantity: number }
): Promise<CartActionResult> {
  try {
    const cart = await RetailCartService.addItem(storeSlug, payload);
    return { success: true, cart };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível adicionar o item à sacola."),
    };
  }
}

export async function updateStorefrontCartItemAction(
  storeSlug: string,
  payload: { variantId: string; quantity: number }
): Promise<CartActionResult> {
  try {
    const cart = await RetailCartService.updateItemQuantity(storeSlug, payload);
    return { success: true, cart };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível atualizar a quantidade do item."),
    };
  }
}

export async function clearStorefrontCartAction(storeSlug: string): Promise<CartActionResult> {
  try {
    const cart = await RetailCartService.clearCart(storeSlug);
    return { success: true, cart };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível limpar a sacola."),
    };
  }
}

export async function submitPublicOrderAction(
  storeSlug: string,
  previewTemplate: string | undefined,
  formInput: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryMode: "pickup" | "delivery";
    deliveryAddress?: string;
    notes?: string;
    idempotencyKey?: string;
  }
): Promise<CreatePublicOrderActionResult> {
  try {
    const supabase = await createClient();
    const result = await RetailOrderService.createPublicOrder({
      supabase,
      storeSlug,
      rawInput: formInput,
    });

    revalidatePath(`/loja/${storeSlug}`);
    revalidatePath(`/loja/${storeSlug}/finalizar`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/pedidos");

    // Armazena o token opaco em cookie HttpOnly dedicado (nunca na URL/query string)
    await writeStoreOrderReceiptToken(result.storeSlug, result.order.orderNumber, result.publicToken);

    const params = new URLSearchParams();
    if (previewTemplate) {
      params.set("preview_template", previewTemplate);
    }
    const qs = params.toString();

    return {
      success: true,
      orderNumber: result.order.orderNumber,
      redirectUrl: qs
        ? `/loja/${storeSlug}/pedido/${encodeURIComponent(result.order.orderNumber)}?${qs}`
        : `/loja/${storeSlug}/pedido/${encodeURIComponent(result.order.orderNumber)}`,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível enviar sua solicitação de pedido."),
      fieldErrors: getFieldErrorsFromError(err),
    };
  }
}
