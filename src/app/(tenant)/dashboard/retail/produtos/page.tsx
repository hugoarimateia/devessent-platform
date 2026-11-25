import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { RetailProductService } from "@/modules/retail/services/retail-product-service";
import { RetailCategoryService } from "@/modules/retail/services/retail-category-service";
import { RetailProductTable } from "@/modules/retail/components/retail-product-table";
import { RetailModuleInactive } from "@/modules/retail/components/retail-module-inactive";
import type { RetailProductStatus } from "@/modules/retail/types/retail.types";

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

export default async function RetailProdutosPage({
  searchParams,
}: ProdutosPageProps) {
  const [params, supabase] = await Promise.all([searchParams, createClient()]);

  const statusFilter = (params.status || "all") as RetailProductStatus | "all";
  const categoryIdFilter = params.categoryId || undefined;
  const searchFilter = params.search || "";
  const pageNum = Number(params.page || "1");

  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;

  const [workspace, prefetchedCategories, prefetchedCatalog] =
    await Promise.all([
      resolveWorkspaceSession(),
      hintTenantId
        ? RetailCategoryService.listCategories(supabase, hintTenantId, true).catch(
            () => null
          )
        : Promise.resolve(null),
      hintTenantId
        ? RetailProductService.listProducts(supabase, hintTenantId, {
            status: statusFilter,
            categoryId: categoryIdFilter,
            search: searchFilter,
            page: pageNum,
            pageSize: 10,
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/retail/produtos");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { activeContext, activeRetailStore: store } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
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

  const hintMatched = Boolean(
    hintTenantId && activeContext.tenantId === hintTenantId
  );

  const [categories, catalogResult] = await Promise.all([
    hintMatched && prefetchedCategories !== null
      ? Promise.resolve(prefetchedCategories)
      : RetailCategoryService.listCategories(supabase, activeContext.tenantId, true),
    hintMatched && prefetchedCatalog !== null
      ? Promise.resolve(prefetchedCatalog)
      : RetailProductService.listProducts(supabase, activeContext.tenantId, {
          status: statusFilter,
          categoryId: categoryIdFilter,
          search: searchFilter,
          page: pageNum,
          pageSize: 10,
        }),
  ]);

  return (
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
  );
}
