import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  buildSpeculativeRlsTenantContext,
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { NotFoundError } from "@/core/errors/app-error";
import { RetailOrderDetail } from "@/modules/retail/components/retail-order-detail";
import { RetailOrderService } from "@/modules/retail/services/retail-order-service";
import { RetailPaymentService } from "@/modules/retail/services/retail-payment-service";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";

export const metadata: Metadata = {
  title: "Detalhes do Pedido | DevEssent Platform",
  description: "Auditoria de itens, histórico de transições e confirmação transacional de pedido.",
};

interface RetailOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RetailOrderDetailPage({
  params,
}: RetailOrderDetailPageProps) {
  const [{ id }, supabase] = await Promise.all([params, createClient()]);

  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;
  const speculativeCtx = hintTenantId
    ? buildSpeculativeRlsTenantContext(hintTenantId)
    : null;

  const [workspace, prefetchedOrder, prefetchedConn, prefetchedPayment] =
    await Promise.all([
      resolveWorkspaceSession(),
      speculativeCtx
        ? RetailOrderService.getOrderById(supabase, speculativeCtx, id).catch(
            () => null
          )
        : Promise.resolve(null),
      speculativeCtx
        ? RetailPaymentService.getConnectionSummary({
            supabase,
            context: speculativeCtx,
          }).catch(() => null)
        : Promise.resolve(null),
      speculativeCtx
        ? RetailPaymentService.getPaymentByOrderId({
            supabase,
            context: speculativeCtx,
            orderId: id,
          }).catch(() => undefined)
        : Promise.resolve(undefined),
    ]);

  if (!workspace.sessionUser) {
    redirect(`/login?redirect=/dashboard/retail/pedidos/${id}`);
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { activeContext, activeRetailStore: store } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
  }

  if (
    !RetailPermissionService.hasPermission(
      activeContext.role,
      "view_retail_orders"
    )
  ) {
    redirect("/forbidden");
  }

  if (!store) {
    notFound();
  }

  const hintMatched = Boolean(
    hintTenantId && activeContext.tenantId === hintTenantId
  );

  let order = hintMatched ? prefetchedOrder : null;
  if (!order) {
    try {
      order = await RetailOrderService.getOrderById(supabase, activeContext, id);
    } catch (err) {
      if (err instanceof NotFoundError) {
        notFound();
      }
      throw err;
    }
  }

  const canManageOrders = RetailPermissionService.hasPermission(
    activeContext.role,
    "manage_retail_orders"
  );

  const [paymentConnection, linkedPayment] = await Promise.all([
    hintMatched && prefetchedConn !== null
      ? Promise.resolve(prefetchedConn)
      : RetailPaymentService.getConnectionSummary({
          supabase,
          context: activeContext,
        }),
    hintMatched && prefetchedPayment !== undefined
      ? Promise.resolve(prefetchedPayment)
      : RetailPaymentService.getPaymentByOrderId({
          supabase,
          context: activeContext,
          orderId: order.id,
        }),
  ]);

  return (
    <RetailOrderDetail
      tenantId={activeContext.tenantId}
      storeName={store.storeName}
      inventoryMode={store.inventoryMode}
      order={order}
      canManageOrders={canManageOrders}
      paymentConnection={paymentConnection}
      linkedPayment={linkedPayment}
    />
  );
}
