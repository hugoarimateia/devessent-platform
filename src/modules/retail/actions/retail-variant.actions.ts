"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { RetailVariantService } from "../services/retail-variant-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import type { RetailActionState } from "./retail-store.actions";

export async function adjustStockAction(
  tenantId: string,
  variantId: string,
  newStockQuantity: number
): Promise<RetailActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    const updated = await RetailVariantService.adjustStock(supabase, context, {
      variantId,
      newStockQuantity,
    });

    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: `Estoque da variante '${updated.sku}' ajustado para ${updated.stockQuantity}.`,
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao ajustar estoque."),
    };
  }
}

export async function updatePriceAction(
  tenantId: string,
  variantId: string,
  priceCents: number,
  compareAtPriceCents: number | null = null
): Promise<RetailActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    const updated = await RetailVariantService.updatePrice(
      supabase,
      context,
      variantId,
      priceCents,
      compareAtPriceCents
    );

    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: `Preço da variante '${updated.sku}' atualizado.`,
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao alterar preço."),
    };
  }
}

