import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import type {
  PublicStorefront,
  RetailCategory,
  RetailProductWithDetails,
  StorefrontCatalogFilter,
  RetailProductRow,
  RetailCategoryRow,
  RetailVariantRow,
  RetailProductOptionRow,
  RetailProductImageRow,
  RetailProductImage,
  RetailVariant,
  RetailProductStatus,
  StorefrontTemplate,
} from "../types/retail.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

export class RetailStorefrontService {
  /**
   * Converte a linha de imagem do banco para o tipo da aplicação com URL pública.
   */
  public static mapImageRow(
    supabase: AppSupabaseClient,
    row: RetailProductImageRow
  ): RetailProductImage {
    const { data: publicUrlData } = supabase.storage
      .from("retail-media")
      .getPublicUrl(row.storage_path);

    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      storagePath: row.storage_path,
      altText: row.alt_text,
      sortOrder: row.sort_order,
      isPrimary: row.is_primary,
      variantId: row.variant_id,
      publicUrl: publicUrlData.publicUrl,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Monta o produto completo com variantes, opções, categorias e imagens.
   */
  private static assembleProduct(
    supabase: AppSupabaseClient,
    productRow: RetailProductRow,
    categoriesRows: RetailCategoryRow[] = [],
    variantsRows: RetailVariantRow[] = [],
    optionsRows: RetailProductOptionRow[] = [],
    imagesRows: RetailProductImageRow[] = []
  ): RetailProductWithDetails {
    const categories: RetailCategory[] = categoriesRows.map((c) => ({
      id: c.id,
      tenantId: c.tenant_id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sort_order,
      isActive: c.is_active,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    const variants: RetailVariant[] = variantsRows.map((v) => ({
      id: v.id,
      tenantId: v.tenant_id,
      productId: v.product_id,
      sku: v.sku,
      name: v.name,
      priceCents: v.price_cents,
      compareAtPriceCents: v.compare_at_price_cents,
      stockQuantity: v.stock_quantity,
      isAvailable: v.is_available,
      optionsSummary: (v.options_summary as Record<string, string>) || {},
      sortOrder: v.sort_order,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    }));

    const options = optionsRows.map((o) => ({
      id: o.id,
      tenantId: o.tenant_id,
      productId: o.product_id,
      name: o.name,
      position: o.position,
      values: o.values || [],
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    }));

    const images = imagesRows.map((img) => this.mapImageRow(supabase, img));
    const primaryImage = images.find((i) => i.isPrimary) || images[0] || null;

    let minPriceCents = 0;
    let maxPriceCents = 0;
    let totalStock = 0;

    if (variants.length > 0) {
      const prices = variants.map((v) => v.priceCents);
      minPriceCents = Math.min(...prices);
      maxPriceCents = Math.max(...prices);
      totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
    }

    return {
      id: productRow.id,
      tenantId: productRow.tenant_id,
      name: productRow.name,
      slug: productRow.slug,
      description: productRow.description,
      status: productRow.status as RetailProductStatus,
      publishedAt: productRow.published_at,
      createdAt: productRow.created_at,
      updatedAt: productRow.updated_at,
      categories,
      variants,
      options,
      images,
      primaryImage,
      minPriceCents,
      maxPriceCents,
      totalStock,
    };
  }

  /**
   * Resolve uma loja pública pelo slug de forma segura.
   * Retorna null se a loja não existir, for inativa ou pertencer a empresa suspensa.
   */
  public static async getPublicStore(
    supabase: AppSupabaseClient,
    slug: string
  ): Promise<PublicStorefront | null> {
    if (!slug) return null;

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.getPublicStore(slug);
    }

    // 1. Invocar a função RPC segura com validação de status de tenant
    const { data, error } = await supabase.rpc("get_public_storefront", {
      p_slug: slug,
    });

    if (error || !data || data.length === 0) {
      // Fallback: se a RPC não retornar ou o cliente anon não tiver permissão de RPC,
      // consulta direta via RLS na tabela retail_stores
      const { data: storeRow, error: storeErr } = await supabase
        .from("retail_stores")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (storeErr || !storeRow) return null;

      return {
        storeId: storeRow.id,
        tenantId: storeRow.tenant_id,
        slug: storeRow.slug || slug,
        storeName: storeRow.store_name,
        currency: storeRow.currency,
        template: (storeRow.template as StorefrontTemplate) || "editorial",
        brandHeadline: storeRow.brand_headline,
        brandSubheadline: storeRow.brand_subheadline,
        aboutText: storeRow.about_text,
        heroBadge: storeRow.hero_badge,
        heroImagePath: storeRow.hero_image_path,
        accentColor: storeRow.accent_color,
        secondaryColor: storeRow.secondary_color,
        announcementBar: storeRow.announcement_bar,
        contactEmail: storeRow.contact_email,
        contactPhone: storeRow.contact_phone,
        socialLinks: (storeRow.social_links as Record<string, string>) || {},
        isActive: storeRow.is_active,
      };
    }

    const row = data[0];
    return {
      storeId: row.store_id,
      tenantId: row.tenant_id,
      slug: row.slug,
      storeName: row.store_name,
      currency: row.currency,
      template: (row.template as StorefrontTemplate) || "editorial",
      brandHeadline: row.brand_headline,
      brandSubheadline: row.brand_subheadline,
      aboutText: row.about_text,
      heroBadge: row.hero_badge,
      heroImagePath: row.hero_image_path,
      accentColor: row.accent_color,
      secondaryColor: row.secondary_color,
      announcementBar: row.announcement_bar,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      socialLinks: (row.social_links as Record<string, string>) || {},
      isActive: row.is_active,
    };
  }

  /**
   * Obtém as categorias ativas da loja para exibição na vitrine e navegação.
   */
  public static async getPublicCategories(
    supabase: AppSupabaseClient,
    tenantId: string
  ): Promise<RetailCategory[]> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.listCategories(tenantId, true);
    }

    const { data, error } = await supabase
      .from("retail_categories")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error || !data) return [];

    return data.map((c) => ({
      id: c.id,
      tenantId: c.tenant_id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sort_order,
      isActive: c.is_active,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  /**
   * Obtém o catálogo público de produtos publicados da loja com suporte a busca,
   * filtro de categoria e paginação.
   */
  public static async getPublicCatalog(
    supabase: AppSupabaseClient,
    tenantId: string,
    filter: StorefrontCatalogFilter = {}
  ): Promise<{
    products: RetailProductWithDetails[];
    totalCount: number;
    page: number;
    totalPages: number;
  }> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.getPublicCatalog(tenantId, filter);
    }

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(50, Math.max(1, filter.pageSize || 12));
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("retail_products")
      .select(
        `
        *,
        retail_variants(*),
        retail_product_images(*),
        retail_product_options(*),
        retail_product_categories(
          retail_categories(*)
        )
      `,
        { count: "exact" }
      )
      .eq("tenant_id", tenantId)
      .eq("status", "published");

    if (filter.search && filter.search.trim()) {
      const term = `%${filter.search.trim()}%`;
      query = query.or(`name.ilike.${term},description.ilike.${term}`);
    }

    // Ordenação
    switch (filter.sort) {
      case "price_asc":
      case "price_desc":
      case "name_asc":
        query = query.order("name", { ascending: true });
        break;
      case "newest":
        query = query.order("published_at", { ascending: false, nullsFirst: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    const { data: rows, count, error } = await query;

    if (error || !rows) {
      return { products: [], totalCount: 0, page, totalPages: 0 };
    }

    let products = rows.map((row) => {
      const rowItem = row as unknown as RetailProductRow & {
        retail_variants?: RetailVariantRow[];
        retail_product_options?: RetailProductOptionRow[];
        retail_product_images?: RetailProductImageRow[];
        retail_product_categories?: Array<{ retail_categories: RetailCategoryRow }>;
      };

      const categories = (rowItem.retail_product_categories || [])
        .map((rpc) => rpc.retail_categories)
        .filter(Boolean);

      return this.assembleProduct(
        supabase,
        rowItem,
        categories,
        rowItem.retail_variants || [],
        rowItem.retail_product_options || [],
        rowItem.retail_product_images || []
      );
    });

    // Se houver filtro de categoria por slug, aplica em memória após recuperar relações
    if (filter.categorySlug) {
      products = products.filter((p) =>
        p.categories.some((c) => c.slug === filter.categorySlug)
      );
    }

    // Se ordenação de preço for requerida, aplica com base no menor preço de variante
    if (filter.sort === "price_asc") {
      products.sort((a, b) => a.minPriceCents - b.minPriceCents);
    } else if (filter.sort === "price_desc") {
      products.sort((a, b) => b.minPriceCents - a.minPriceCents);
    }

    const totalCount = filter.categorySlug ? products.length : count || products.length;
    const paginatedProducts = filter.categorySlug
      ? products.slice(offset, offset + pageSize)
      : products.slice(0, pageSize); // Se a query supabase já vier com range

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      products: paginatedProducts,
      totalCount,
      page,
      totalPages,
    };
  }

  /**
   * Obtém detalhes de um produto publicado específico pelo seu slug.
   */
  public static async getPublicProduct(
    supabase: AppSupabaseClient,
    tenantId: string,
    productSlug: string
  ): Promise<RetailProductWithDetails | null> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.getPublicProduct(tenantId, productSlug);
    }

    const { data: row, error } = await supabase
      .from("retail_products")
      .select(
        `
        *,
        retail_variants(*),
        retail_product_images(*),
        retail_product_options(*),
        retail_product_categories(
          retail_categories(*)
        )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("slug", productSlug)
      .eq("status", "published")
      .maybeSingle();

    if (error || !row) return null;

    const rowItem = row as unknown as RetailProductRow & {
      retail_variants?: RetailVariantRow[];
      retail_product_options?: RetailProductOptionRow[];
      retail_product_images?: RetailProductImageRow[];
      retail_product_categories?: Array<{ retail_categories: RetailCategoryRow }>;
    };

    const categories = (rowItem.retail_product_categories || [])
      .map((rpc) => rpc.retail_categories)
      .filter(Boolean);

    return this.assembleProduct(
      supabase,
      rowItem,
      categories,
      rowItem.retail_variants || [],
      rowItem.retail_product_options || [],
      rowItem.retail_product_images || []
    );
  }

  /**
   * Obtém produtos relacionados na mesma categoria.
   */
  public static async getRelatedProducts(
    supabase: AppSupabaseClient,
    tenantId: string,
    currentProductId: string,
    categoryIds: string[],
    limit = 4
  ): Promise<RetailProductWithDetails[]> {
    if (!categoryIds || categoryIds.length === 0) {
      // Fallback: outros produtos publicados da loja
      const { products } = await this.getPublicCatalog(supabase, tenantId, {
        pageSize: limit + 1,
      });
      return products.filter((p) => p.id !== currentProductId).slice(0, limit);
    }

    const { products } = await this.getPublicCatalog(supabase, tenantId, {
      pageSize: 20,
    });

    const related = products.filter(
      (p) =>
        p.id !== currentProductId &&
        p.categories.some((c) => categoryIds.includes(c.id))
    );

    if (related.length >= limit) {
      return related.slice(0, limit);
    }

    // Se faltarem, completa com outros publicados
    const others = products.filter(
      (p) => p.id !== currentProductId && !related.some((r) => r.id === p.id)
    );

    return [...related, ...others].slice(0, limit);
  }
}
