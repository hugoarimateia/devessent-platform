import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RetailStorefrontService,
  StorefrontLayoutResolver,
  StorefrontHomeResolver,
  resolveAuthorizedPreviewTemplate,
} from "@/modules/retail";

interface StorefrontHomePageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    preview_template?: string;
  }>;
}

export default async function StorefrontHomePage({
  params,
  searchParams,
}: StorefrontHomePageProps) {
  const { slug } = await params;
  const { preview_template } = await searchParams;

  const supabase = await createClient();
  const [store, previewTemplate] = await Promise.all([
    RetailStorefrontService.getPublicStore(supabase, slug),
    resolveAuthorizedPreviewTemplate(supabase, preview_template),
  ]);

  if (!store || !store.isActive) {
    notFound();
  }

  // Obter categorias públicas e produtos publicados da loja
  const [categories, catalogRes] = await Promise.all([
    RetailStorefrontService.getPublicCategories(supabase, store.tenantId),
    RetailStorefrontService.getPublicCatalog(supabase, store.tenantId, {
      pageSize: 8,
    }),
  ]);

  return (
    <StorefrontLayoutResolver
      store={store}
      categories={categories}
      previewTemplate={previewTemplate}
    >
      <StorefrontHomeResolver
        store={store}
        categories={categories}
        featuredProducts={catalogRes.products}
        previewTemplate={previewTemplate}
      />
    </StorefrontLayoutResolver>
  );
}

