import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants";
import { TenantSuspendedError, NotFoundError } from "@/core/errors/app-error";
import { AppShell } from "@/components/layout/app-shell";
import { SuspendedTenantState } from "@/components/ui/suspended-tenant-state";
import {
  RetailStoreService,
  RetailProductService,
  RetailCategoryService,
  RetailProductForm,
  RetailModuleInactive,
} from "@/modules/retail";

export const metadata: Metadata = {
  title: "Editar Produto | DevEssent Retail",
  description: "Gerenciamento de produto, imagens, variantes e publicação.",
};

interface ProdutoDetalhePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProdutoDetalhePage({ params }: ProdutoDetalhePageProps) {
  const { id: productId } = await params;
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/retail/produtos/${productId}`);
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

  const store = await RetailStoreService.getStore(supabase, activeContext.tenantId);
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

  let product;
  try {
    product = await RetailProductService.getProductById(
      supabase,
      activeContext.tenantId,
      productId
    );
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  const categories = await RetailCategoryService.listCategories(
    supabase,
    activeContext.tenantId,
    true
  );

  return (
    <AppShell
      user={sessionUser}
      contextMode="tenant"
      tenants={userTenants}
      activeTenantId={activeContext.tenantId}
      activeRole={activeContext.role}
    >
      <RetailProductForm
        tenantId={activeContext.tenantId}
        currency={store.currency}
        categories={categories}
        initialProduct={product}
        userRole={activeContext.role}
      />
    </AppShell>
  );
}

