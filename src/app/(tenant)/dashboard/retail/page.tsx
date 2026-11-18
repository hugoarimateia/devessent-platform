import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants";
import { TenantSuspendedError } from "@/core/errors/app-error";
import { AppShell } from "@/components/layout/app-shell";
import { SuspendedTenantState } from "@/components/ui/suspended-tenant-state";
import {
  RetailStoreService,
  RetailProductService,
  RetailOrderService,
  RetailPermissionService,
  RetailDashboard,
  RetailModuleInactive,
} from "@/modules/retail";

export const metadata: Metadata = {
  title: "Painel Retail | DevEssent Platform",
  description: "Catálogo e administração comercial de produtos, variantes e estoque.",
};

export default async function RetailDashboardPage() {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/retail");
  }

  const userTenants = await TenantService.listUserTenants(supabase, sessionUser.id);
  const cookieStore = await cookies();
  const activeTenantCookie = cookieStore.get(getActiveTenantCookieName())?.value;

  let selectedTenant = userTenants.find(
    (t) => t.tenantId === activeTenantCookie || t.slug === activeTenantCookie
  );

  if (!selectedTenant && userTenants.length > 0) {
    selectedTenant = userTenants[0];
  }

  if (!selectedTenant) {
    redirect("/dashboard");
  }

  let activeContext;
  try {
    activeContext = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      selectedTenant.tenantId
    );
  } catch (err: unknown) {
    if (err instanceof TenantSuspendedError) {
      return (
        <AppShell
          user={sessionUser}
          contextMode="tenant"
          tenants={userTenants}
          activeTenantId={selectedTenant.tenantId}
          activeRole="staff"
        >
          <SuspendedTenantState
            tenantName={selectedTenant.name}
          />
        </AppShell>
      );
    }
    throw err;
  }

  // Verifica se a loja Retail existe e está ativa
  let store = await RetailStoreService.getStore(supabase, activeContext.tenantId);

  // Se não existir loja para o tenant, tenta inicializar se for owner/manager
  if (!store && (activeContext.role === "owner" || activeContext.role === "manager" || activeContext.role === "platform_admin")) {
    store = await RetailStoreService.ensureStore(
      supabase,
      activeContext.tenantId,
      `Loja ${activeContext.tenantName}`
    );
  }

  if (!store || !store.isActive) {
    return (
      <AppShell
        user={sessionUser}
        contextMode="tenant"
        tenants={userTenants}
        activeTenantId={activeContext.tenantId}
        activeRole={activeContext.role}
      >
        <RetailModuleInactive
          tenantId={activeContext.tenantId}
          tenantName={activeContext.tenantName}
          userRole={activeContext.role}
        />
      </AppShell>
    );
  }

  const canViewOrders = RetailPermissionService.hasPermission(
    activeContext.role,
    "view_retail_orders"
  );

  const [stats, recentResult, orderStats] = await Promise.all([
    RetailProductService.getCatalogStats(supabase, activeContext.tenantId),
    RetailProductService.listProducts(supabase, activeContext.tenantId, {
      pageSize: 5,
    }),
    canViewOrders
      ? RetailOrderService.getOrderStats(supabase, activeContext).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <AppShell
      user={sessionUser}
      contextMode="tenant"
      tenants={userTenants}
      activeTenantId={activeContext.tenantId}
      activeRole={activeContext.role}
    >
      <RetailDashboard
        tenantSlug={activeContext.slug}
        store={store}
        stats={stats}
        orderStats={orderStats}
        recentProducts={recentResult.products}
        userRole={activeContext.role}
      />
    </AppShell>
  );
}

