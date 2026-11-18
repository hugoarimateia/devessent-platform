"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import { RetailOrderService } from "../services/retail-order-service";
import { RetailStoreService } from "../services/retail-store-service";
import type { RetailOrder, RetailOrderStatus } from "../types/retail.types";

export interface OrderMutationResult {
  success: boolean;
  error?: string;
  message?: string;
  order?: RetailOrder;
}

async function revalidateOrderRelatedPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  orderId: string
) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/atividades");
  revalidatePath("/dashboard/retail");
  revalidatePath("/dashboard/retail/produtos");
  revalidatePath("/dashboard/retail/pedidos");
  revalidatePath(`/dashboard/retail/pedidos/${orderId}`);

  const store = await RetailStoreService.getStore(supabase, tenantId);
  if (store?.slug) {
    revalidatePath(`/loja/${store.slug}`);
    revalidatePath(`/loja/${store.slug}/produtos`);
  }
}

export async function updateRetailOrderStatusAction(
  tenantId: string,
  orderId: string,
  nextStatus: RetailOrderStatus,
  reason?: string
): Promise<OrderMutationResult> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    const updated = await RetailOrderService.updateOrderStatus({
      supabase,
      context,
      orderId,
      actorName: sessionUser.fullName || sessionUser.email,
      rawInput: {
        nextStatus,
        reason: reason?.trim() || undefined,
      },
    });

    await revalidateOrderRelatedPaths(supabase, context.tenantId, orderId);

    const messages: Record<RetailOrderStatus, string> = {
      requested: "Pedido mantido em solicitação.",
      confirmed: "Pedido confirmado e estoque atualizado com sucesso.",
      preparing: "Pedido marcado como em separação / preparo.",
      ready: "Pedido marcado como pronto para entrega / retirada.",
      completed: "Pedido concluído com sucesso.",
      cancelled: "Pedido cancelado.",
    };

    return {
      success: true,
      message: messages[nextStatus],
      order: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível atualizar o status do pedido."),
    };
  }
}
