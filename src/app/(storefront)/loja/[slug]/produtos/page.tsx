import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RetailStorefrontService,
  StorefrontLayoutResolver,
  StorefrontCatalogResolver,
  resolveAuthorizedPreviewTemplate,
  type StorefrontSortOption,
} from "@/modules/retail";

interface StorefrontProdutosPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    search?: string;
    sort?: string;
    page?: string;
    preview_template?: string;
  }>;
}

export default async function StorefrontProdutosPage({
  params,
  searchParams,
}: StorefrontProdutosPageProps) {
  const { slug } = await params;
  const { search, sort, page, preview_template } = await searchParams;
  const currentPage = page ? parseInt(page, 10) : 1;

  const supabase = await createClient();
  const [store, previewTemplate] = await Promise.all([
    RetailStorefrontService.getPublicStore(supabase, slug),
    resolveAuthorizedPreviewTemplate(supabase, preview_template),
  ]);

  if (!store || !store.isActive) {
    notFound();
  }

  const [categories, catalogRes] = await Promise.all([
    RetailStorefrontService.getPublicCategories(supabase, store.tenantId),
    RetailStorefrontService.getPublicCatalog(supabase, store.tenantId, {
      search,
      sort: sort as StorefrontSortOption,
      page: currentPage,
      pageSize: 12,
    }),
  ]);

  return (
    <StorefrontLayoutResolver
      store={store}
      categories={categories}
      previewTemplate={previewTemplate}
    >
      <StorefrontCatalogResolver
        store={store}
        categories={categories}
        products={catalogRes.products}
        totalCount={catalogRes.totalCount}
        page={catalogRes.page}
        totalPages={catalogRes.totalPages}
        search={search}
        sort={sort as StorefrontSortOption}
        previewTemplate={previewTemplate}
      />
    </StorefrontLayoutResolver>
  );
}

