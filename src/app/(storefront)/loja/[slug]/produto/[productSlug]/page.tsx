import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RetailStorefrontService,
  StorefrontLayoutResolver,
  StorefrontProductResolver,
  resolveAuthorizedPreviewTemplate,
} from "@/modules/retail";

interface StorefrontProdutoPageProps {
  params: Promise<{
    slug: string;
    productSlug: string;
  }>;
  searchParams: Promise<{
    preview_template?: string;
  }>;
}

export async function generateMetadata({
  params,
}: StorefrontProdutoPageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const supabase = await createClient();
  const store = await RetailStorefrontService.getPublicStore(supabase, slug);

  if (!store) {
    return { title: "Produto Não Encontrado" };
  }

  const product = await RetailStorefrontService.getPublicProduct(
    supabase,
    store.tenantId,
    productSlug
  );

  if (!product) {
    return { title: `Produto Não Encontrado | ${store.storeName}` };
  }

  return {
    title: `${product.name} | ${store.storeName}`,
    description: product.description || `Peça autoral disponível em ${store.storeName}.`,
    openGraph: {
      title: product.name,
      description: product.description || undefined,
      images: product.primaryImage ? [product.primaryImage.publicUrl] : undefined,
    },
  };
}

export default async function StorefrontProdutoPage({
  params,
  searchParams,
}: StorefrontProdutoPageProps) {
  const { slug, productSlug } = await params;
  const { preview_template } = await searchParams;

  const supabase = await createClient();
  const [store, previewTemplate] = await Promise.all([
    RetailStorefrontService.getPublicStore(supabase, slug),
    resolveAuthorizedPreviewTemplate(supabase, preview_template),
  ]);

  if (!store || !store.isActive) {
    notFound();
  }

  const product = await RetailStorefrontService.getPublicProduct(
    supabase,
    store.tenantId,
    productSlug
  );

  if (!product) {
    notFound();
  }

  const [categories, relatedProducts] = await Promise.all([
    RetailStorefrontService.getPublicCategories(supabase, store.tenantId),
    RetailStorefrontService.getRelatedProducts(
      supabase,
      store.tenantId,
      product.id,
      product.categories.map((c) => c.id),
      4
    ),
  ]);

  return (
    <StorefrontLayoutResolver
      store={store}
      categories={categories}
      previewTemplate={previewTemplate}
    >
      <StorefrontProductResolver
        store={store}
        product={product}
        relatedProducts={relatedProducts}
        previewTemplate={previewTemplate}
      />
    </StorefrontLayoutResolver>
  );
}

