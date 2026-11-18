import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants";
import { NotFoundError, TenantSuspendedError } from "@/core/errors/app-error";
import { AppShell } from "@/components/layout/app-shell";
import { SuspendedTenantState } from "@/components/ui/suspended-tenant-state";
import {
  RetailOrderDetail,
  RetailOrderService,
  RetailPermissionService,
  RetailStoreService,
} from "@/modules/retail";

export const metadata: Metadata = {
  title: "Detalhes do Pedido | DevEssent Platform",
  description: "Auditoria de itens, histórico de transições e confirmação transacional de pedido.",
};

interface RetailOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RetailOrderDetailPage({ params }: RetailOrderDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/retail/pedidos/${id}`);
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
          activeRole={selectedTenant.role}
        >
          <SuspendedTenantState tenantName={selectedTenant.name} />
        </AppShell>
      );
    }
    throw err;
  }

  if (!RetailPermissionService.hasPermission(activeContext.role, "view_retail_orders")) {
    redirect("/forbidden");
  }

  const store = await RetailStoreService.getStore(supabase, activeContext.tenantId);
  if (!store) {
    notFound();
  }

  let order;
  try {
    order = await RetailOrderService.getOrderById(supabase, activeContext, id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  const canManageOrders = RetailPermissionService.hasPermission(
    activeContext.role,
    "manage_retail_orders"
  );

  return (
    <AppShell
      user={sessionUser}
      contextMode="tenant"
      tenants={userTenants}
      activeTenantId={activeContext.tenantId}
      activeRole={activeContext.role}
    >
      <RetailOrderDetail
        tenantId={activeContext.tenantId}
        storeName={store.storeName}
        inventoryMode={store.inventoryMode}
        order={order}
        canManageOrders={canManageOrders}
      />
    </AppShell>
  );
}
