import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { RetailCategoryService } from "@/modules/retail/services/retail-category-service";
import { RetailProductForm } from "@/modules/retail/components/retail-product-form";
import { RetailModuleInactive } from "@/modules/retail/components/retail-module-inactive";

export const metadata: Metadata = {
  title: "Novo Produto | DevEssent Retail",
  description: "Cadastro de produto, variantes e preços no catálogo comercial.",
};

export default async function NovoProdutoPage() {
  const supabase = await createClient();
  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;

  const [workspace, prefetchedCategories] = await Promise.all([
    resolveWorkspaceSession(),
    hintTenantId
      ? RetailCategoryService.listCategories(supabase, hintTenantId, true).catch(
          () => null
        )
      : Promise.resolve(null),
  ]);

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/retail/produtos/novo");
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

  const categories =
    hintTenantId &&
    activeContext.tenantId === hintTenantId &&
    prefetchedCategories !== null
      ? prefetchedCategories
      : await RetailCategoryService.listCategories(
          supabase,
          activeContext.tenantId,
          true
        );

  return (
    <RetailProductForm
      tenantId={activeContext.tenantId}
      currency={store.currency}
      categories={categories}
      initialProduct={null}
      userRole={activeContext.role}
    />
  );
}
