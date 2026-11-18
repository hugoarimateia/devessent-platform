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
  RetailCategoryService,
  RetailProductTable,
  RetailModuleInactive,
  type RetailProductStatus,
} from "@/modules/retail";

export const metadata: Metadata = {
  title: "Catálogo de Produtos | DevEssent Retail",
  description: "Gerenciamento completo de produtos, variantes e precificação.",
};

interface ProdutosPageProps {
  searchParams: Promise<{
    status?: string;
    categoryId?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function RetailProdutosPage({ searchParams }: ProdutosPageProps) {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/retail/produtos");
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

  const params = await searchParams;
  const statusFilter = (params.status || "all") as RetailProductStatus | "all";
  const categoryIdFilter = params.categoryId || undefined;
  const searchFilter = params.search || "";
  const pageNum = Number(params.page || "1");

  const [categories, catalogResult] = await Promise.all([
    RetailCategoryService.listCategories(supabase, activeContext.tenantId, true),
    RetailProductService.listProducts(supabase, activeContext.tenantId, {
      status: statusFilter,
      categoryId: categoryIdFilter,
      search: searchFilter,
      page: pageNum,
      pageSize: 10,
    }),
  ]);

  return (
    <AppShell
      user={sessionUser}
      contextMode="tenant"
      tenants={userTenants}
      activeTenantId={activeContext.tenantId}
      activeRole={activeContext.role}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
            Catálogo Comercial
          </h1>
          <p className="text-xs sm:text-sm text-foreground-muted mt-0.5">
            Gerencie os produtos da sua loja, ajuste preços, controle o estoque e publique novidades
          </p>
        </div>

        <RetailProductTable
          tenantId={activeContext.tenantId}
          currency={store.currency}
          products={catalogResult.products}
          categories={categories}
          totalCount={catalogResult.totalCount}
          page={catalogResult.page}
          pageSize={catalogResult.pageSize}
          totalPages={catalogResult.totalPages}
          currentStatus={statusFilter}
          currentCategory={categoryIdFilter || "all"}
          currentSearch={searchFilter}
          userRole={activeContext.role}
        />
      </div>
    </AppShell>
  );
}

