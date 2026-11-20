import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  buildSpeculativeRlsTenantContext,
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { RetailStoreService } from "@/modules/retail/services/retail-store-service";
import { RetailProductService } from "@/modules/retail/services/retail-product-service";
import { RetailOrderService } from "@/modules/retail/services/retail-order-service";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";
import { RetailDashboard } from "@/modules/retail/components/retail-dashboard";
import { RetailModuleInactive } from "@/modules/retail/components/retail-module-inactive";

export const metadata: Metadata = {
  title: "Painel Retail | DevEssent Platform",
  description: "Catálogo e administração comercial de produtos, variantes e estoque.",
};

export default async function RetailDashboardPage() {
  const supabase = await createClient();
  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;
  const speculativeCtx = hintTenantId
    ? buildSpeculativeRlsTenantContext(hintTenantId)
    : null;

  const [workspace, prefetchedStats, prefetchedRecent, prefetchedOrderStats] =
    await Promise.all([
      resolveWorkspaceSession(),
      hintTenantId
        ? RetailProductService.getCatalogStats(supabase, hintTenantId).catch(
            () => null
          )
        : Promise.resolve(null),
      hintTenantId
        ? RetailProductService.listProducts(supabase, hintTenantId, {
            pageSize: 5,
          }).catch(() => null)
        : Promise.resolve(null),
      speculativeCtx
        ? RetailOrderService.getOrderStats(supabase, speculativeCtx).catch(
            () => null
          )
        : Promise.resolve(null),
    ]);

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/retail");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { activeContext } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
  }

  // Reutiliza loja já obtida no bootstrap consolidado
  let store = workspace.activeRetailStore;

  // Se não existir loja para o tenant, tenta inicializar se for owner/manager/platform_admin
  if (
    !store &&
    (activeContext.role === "owner" ||
      activeContext.role === "manager" ||
      activeContext.role === "platform_admin")
  ) {
    store = await RetailStoreService.ensureStore(
      supabase,
      activeContext.tenantId,
      `Loja ${activeContext.tenantName}`
    );
  }

  if (!store || !store.isActive) {
    return (
      <RetailModuleInactive
        tenantId={activeContext.tenantId}
        tenantName={activeContext.tenantName}
        userRole={activeContext.role}
      />
    );
  }

  const canViewOrders = RetailPermissionService.hasPermission(
    activeContext.role,
    "view_retail_orders"
  );
  const hintMatched = Boolean(
    hintTenantId && activeContext.tenantId === hintTenantId
  );

  const [stats, recentResult, orderStats] = await Promise.all([
    hintMatched && prefetchedStats !== null
      ? Promise.resolve(prefetchedStats)
      : RetailProductService.getCatalogStats(supabase, activeContext.tenantId),
    hintMatched && prefetchedRecent !== null
      ? Promise.resolve(prefetchedRecent)
      : RetailProductService.listProducts(supabase, activeContext.tenantId, {
          pageSize: 5,
        }),
    canViewOrders
      ? hintMatched && prefetchedOrderStats !== null
        ? Promise.resolve(prefetchedOrderStats)
        : RetailOrderService.getOrderStats(supabase, activeContext).catch(
            () => null
          )
      : Promise.resolve(null),
  ]);

  return (
    <RetailDashboard
      tenantSlug={activeContext.slug}
      store={store}
      stats={stats}
      orderStats={orderStats}
      recentProducts={recentResult.products}
      userRole={activeContext.role}
    />
  );
}
