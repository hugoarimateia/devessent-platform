import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { NotFoundError } from "@/core/errors/app-error";
import { RetailProductService } from "@/modules/retail/services/retail-product-service";
import { RetailCategoryService } from "@/modules/retail/services/retail-category-service";
import { RetailProductForm } from "@/modules/retail/components/retail-product-form";
import { RetailModuleInactive } from "@/modules/retail/components/retail-module-inactive";

export const metadata: Metadata = {
  title: "Editar Produto | DevEssent Retail",
  description: "Gerenciamento de produto, imagens, variantes e publicação.",
};

interface ProdutoDetalhePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProdutoDetalhePage({
  params,
}: ProdutoDetalhePageProps) {
  const [{ id: productId }, supabase] = await Promise.all([
    params,
    createClient(),
  ]);

  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;

  const [workspace, prefetchedProduct, prefetchedCategories] =
    await Promise.all([
      resolveWorkspaceSession(),
      hintTenantId
        ? RetailProductService.getProductById(
            supabase,
            hintTenantId,
            productId
          ).catch(() => null)
        : Promise.resolve(null),
      hintTenantId
        ? RetailCategoryService.listCategories(supabase, hintTenantId, true).catch(
            () => null
          )
        : Promise.resolve(null),
    ]);

  if (!workspace.sessionUser) {
    redirect(`/login?redirect=/dashboard/retail/produtos/${productId}`);
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

  let product = hintMatched ? prefetchedProduct : null;
  let categories = hintMatched ? prefetchedCategories : null;

  if (!product || !categories) {
    try {
      const [fetchedProduct, fetchedCategories] = await Promise.all([
        product
          ? Promise.resolve(product)
          : RetailProductService.getProductById(
              supabase,
              activeContext.tenantId,
              productId
            ),
        categories
          ? Promise.resolve(categories)
          : RetailCategoryService.listCategories(
              supabase,
              activeContext.tenantId,
              true
            ),
      ]);
      product = fetchedProduct;
      categories = fetchedCategories;
    } catch (err) {
      if (err instanceof NotFoundError) {
        notFound();
      }
      throw err;
    }
  }

  return (
    <RetailProductForm
      tenantId={activeContext.tenantId}
      currency={store.currency}
      categories={categories}
      initialProduct={product}
      userRole={activeContext.role}
    />
  );
}
