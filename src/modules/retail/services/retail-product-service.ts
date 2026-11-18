import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import { RetailPermissionService } from "../permissions/retail-permissions";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "../schemas/product.schema";
import { ProductInvariants } from "../domain/product-invariants";
import { VariantInvariants } from "../domain/variant-invariants";
import type {
  RetailProductWithDetails,
  RetailCatalogFilter,
  RetailCatalogResult,
  RetailCatalogStats,
  RetailDashboardSummary,
  RetailCategory,
  RetailProductStatus,
  RetailVariant,
  RetailProductOption,
  RetailProductImage,
  RetailProductRow,
  RetailCategoryRow,
  RetailVariantRow,
  RetailProductOptionRow,
  RetailProductImageRow,
} from "../types/retail.types";
import { AuditService } from "@/core/audit/services/audit-service";
import { NotFoundError, ValidationError } from "@/core/errors/app-error";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

export class RetailProductService {
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
   * Converte o produto e suas relações agregadas para RetailProductWithDetails.
   */
  private static assembleProductWithDetails(
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

    const options: RetailProductOption[] = optionsRows.map((o) => ({
      id: o.id,
      tenantId: o.tenant_id,
      productId: o.product_id,
      name: o.name,
      position: o.position,
      values: o.values || [],
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    }));

    const images: RetailProductImage[] = imagesRows.map((img) =>
      this.mapImageRow(supabase, img)
    );

    const primaryImage =
      images.find((img) => img.isPrimary) || (images.length > 0 ? images[0] : null);

    const prices = variants.map((v) => v.priceCents);
    const minPriceCents = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPriceCents = prices.length > 0 ? Math.max(...prices) : 0;
    const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);

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
   * Lista produtos com paginação, filtros e busca.
   */
  public static async listProducts(
    supabase: AppSupabaseClient,
    tenantId: string,
    filter: RetailCatalogFilter = {}
  ): Promise<RetailCatalogResult> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.listProducts(tenantId, filter);
    }

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(50, Math.max(5, filter.pageSize || 10));
    const offset = (page - 1) * pageSize;

    let categoryProductIds: string[] | null = null;
    if (filter.categoryId) {
      const { data: prodCatRows } = await supabase
        .from("retail_product_categories")
        .select("product_id")
        .eq("category_id", filter.categoryId)
        .eq("tenant_id", tenantId);

      categoryProductIds = (prodCatRows || []).map((r) => r.product_id);
      if (categoryProductIds.length === 0) {
        return {
          products: [],
          totalCount: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }
    }

    // Consulta os produtos com dados completos e contagem exata em uma única chamada
    let productsQuery = supabase
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
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (filter.status && filter.status !== "all") {
      productsQuery = productsQuery.eq("status", filter.status);
    }

    if (filter.search && filter.search.trim().length > 0) {
      const s = filter.search.trim();
      productsQuery = productsQuery.or(`name.ilike.%${s}%,slug.ilike.%${s}%`);
    }

    if (categoryProductIds !== null) {
      productsQuery = productsQuery.in("id", categoryProductIds);
    }

    const { data: rows, count, error } = await productsQuery;
    if (error) {
      throw new Error(`Erro ao consultar catálogo: ${error.message}`);
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const products: RetailProductWithDetails[] = (rows || []).map((row) => {
      const rowItem = row as unknown as RetailProductRow & {
        retail_variants?: RetailVariantRow[];
        retail_product_options?: RetailProductOptionRow[];
        retail_product_images?: RetailProductImageRow[];
        retail_product_categories?: Array<{ retail_categories: RetailCategoryRow }>;
      };

      const categories = (rowItem.retail_product_categories || [])
        .map((rpc) => rpc.retail_categories)
        .filter(Boolean);

      return this.assembleProductWithDetails(
        supabase,
        rowItem,
        categories,
        rowItem.retail_variants || [],
        rowItem.retail_product_options || [],
        rowItem.retail_product_images || []
      );
    });

    return {
      products,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Busca um produto por ID no escopo da empresa.
   */
  public static async getProductById(
    supabase: AppSupabaseClient,
    tenantId: string,
    productId: string
  ): Promise<RetailProductWithDetails> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.getProductById(tenantId, productId);
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
      .eq("id", productId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !row) {
      throw new NotFoundError("Produto não encontrado no catálogo desta empresa.");
    }

    const rowItem = row as unknown as RetailProductRow & {
      retail_variants?: RetailVariantRow[];
      retail_product_options?: RetailProductOptionRow[];
      retail_product_images?: RetailProductImageRow[];
      retail_product_categories?: Array<{ retail_categories: RetailCategoryRow }>;
    };

    const categories = (rowItem.retail_product_categories || [])
      .map((rpc) => rpc.retail_categories)
      .filter(Boolean);

    return this.assembleProductWithDetails(
      supabase,
      rowItem,
      categories,
      rowItem.retail_variants || [],
      rowItem.retail_product_options || [],
      rowItem.retail_product_images || []
    );
  }

  /**
   * Busca um produto por slug no escopo da empresa.
   */
  public static async getProductBySlug(
    supabase: AppSupabaseClient,
    tenantId: string,
    slug: string
  ): Promise<RetailProductWithDetails> {
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
      .eq("slug", slug)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !row) {
      throw new NotFoundError("Produto não encontrado.");
    }

    const rowItem = row as unknown as RetailProductRow & {
      retail_variants?: RetailVariantRow[];
      retail_product_options?: RetailProductOptionRow[];
      retail_product_images?: RetailProductImageRow[];
      retail_product_categories?: Array<{ retail_categories: RetailCategoryRow }>;
    };

    const categories = (rowItem.retail_product_categories || [])
      .map((rpc) => rpc.retail_categories)
      .filter(Boolean);

    return this.assembleProductWithDetails(
      supabase,
      rowItem,
      categories,
      rowItem.retail_variants || [],
      rowItem.retail_product_options || [],
      rowItem.retail_product_images || []
    );
  }

  /**
   * Estatísticas operacionais do catálogo Retail.
   */
  public static async getCatalogStats(
    supabase: AppSupabaseClient,
    tenantId: string
  ): Promise<RetailCatalogStats> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.getCatalogStats(tenantId);
    }

    const [productsRes, catRes] = await Promise.all([
      supabase
        .from("retail_products")
        .select("id, status, retail_variants(stock_quantity)")
        .eq("tenant_id", tenantId),
      supabase
        .from("retail_categories")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
    ]);

    const products = productsRes.data;
    const catCount = catRes.count;

    const list = products || [];
    const totalProducts = list.length;
    let publishedProducts = 0;
    let draftProducts = 0;
    let archivedProducts = 0;
    let outOfStockProducts = 0;

    for (const p of list) {
      if (p.status === "published") publishedProducts++;
      if (p.status === "draft") draftProducts++;
      if (p.status === "archived") archivedProducts++;

      const variants = (p.retail_variants as Array<{ stock_quantity: number }>) || [];
      const totalStock = variants.reduce((s, v) => s + (v.stock_quantity || 0), 0);
      if (variants.length === 0 || totalStock === 0) {
        outOfStockProducts++;
      }
    }

    return {
      totalProducts,
      publishedProducts,
      draftProducts,
      archivedProducts,
      outOfStockProducts,
      totalCategories: catCount || 0,
    };
  }

  /**
   * Resumo consolidado real do catálogo Retail para o Dashboard Principal e Painel Retail.
   * Executa no máximo 2 consultas paralelas e nunca inventa métricas.
   */
  public static async getDashboardSummary(
    supabase: AppSupabaseClient,
    tenantId: string
  ): Promise<RetailDashboardSummary> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.getDashboardSummary(tenantId);
    }

    const [productsRes, categoriesRes] = await Promise.all([
      supabase
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
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("retail_categories")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    const categoryRows = (categoriesRes.data || []) as RetailCategoryRow[];
    const categoryCountMap = new Map<string, { categoryId: string; name: string; productCount: number }>();
    for (const c of categoryRows) {
      if (c.is_active) {
        categoryCountMap.set(c.id, { categoryId: c.id, name: c.name, productCount: 0 });
      }
    }

    const assembledProducts = ((productsRes.data || []) as Array<
      RetailProductRow & {
        retail_variants?: RetailVariantRow[];
        retail_product_options?: RetailProductOptionRow[];
        retail_product_images?: RetailProductImageRow[];
        retail_product_categories?: Array<{ retail_categories: RetailCategoryRow }>;
      }
    >).map((rowItem) => {
      const categories = (rowItem.retail_product_categories || [])
        .map((rpc) => rpc.retail_categories)
        .filter(Boolean);

      for (const c of categories) {
        const entry = categoryCountMap.get(c.id);
        if (entry) entry.productCount += 1;
      }

      return this.assembleProductWithDetails(
        supabase,
        rowItem,
        categories,
        rowItem.retail_variants || [],
        rowItem.retail_product_options || [],
        rowItem.retail_product_images || []
      );
    });

    let publishedProducts = 0;
    let draftProducts = 0;
    let archivedProducts = 0;
    let outOfStockProducts = 0;
    let lowStockProducts = 0;
    let totalStockUnits = 0;

    for (const p of assembledProducts) {
      if (p.status === "published") publishedProducts++;
      if (p.status === "draft") draftProducts++;
      if (p.status === "archived") archivedProducts++;

      totalStockUnits += p.totalStock;
      if (p.variants.length === 0 || p.totalStock === 0) {
        outOfStockProducts++;
      } else if (p.totalStock > 0 && p.totalStock <= 5) {
        lowStockProducts++;
      }
    }

    const categoryDistribution = Array.from(categoryCountMap.values()).sort(
      (a, b) => b.productCount - a.productCount
    );

    return {
      stats: {
        totalProducts: assembledProducts.length,
        publishedProducts,
        draftProducts,
        archivedProducts,
        outOfStockProducts,
        totalCategories: categoryRows.length,
      },
      lowStockProducts,
      totalStockUnits,
      categoryDistribution,
      recentProducts: assembledProducts.slice(0, 5),
    };
  }

  /**
   * Cadastra novo produto com suas variantes e opções.
   */
  public static async createProduct(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: CreateProductInput
  ): Promise<RetailProductWithDetails> {
    RetailPermissionService.assertPermission(context.role, "manage_products");

    const validated = createProductSchema.parse(input);
    const slug = validated.slug || ProductInvariants.slugify(validated.name);

    if (!slug) {
      throw new ValidationError("Slug inválido para o produto.");
    }

    // Se estiver solicitando status 'published' de imediato, valida critérios de publicação
    if (validated.status === "published") {
      RetailPermissionService.assertPermission(context.role, "publish_products");
      ProductInvariants.assertCanPublish({
        name: validated.name,
        variants: validated.variants,
      });
    }

    // 1. Inserir produto
    const { data: productRow, error: prodErr } = await supabase
      .from("retail_products")
      .insert({
        tenant_id: context.tenantId,
        name: validated.name,
        slug,
        description: validated.description || null,
        status: validated.status,
        published_at: validated.status === "published" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (prodErr || !productRow) {
      if (prodErr?.code === "23505") {
        throw new ValidationError("Já existe um produto com este slug nesta empresa.");
      }
      throw new Error(`Erro ao cadastrar produto: ${prodErr?.message}`);
    }

    const productId = productRow.id;

    // 2. Associar categorias
    if (validated.categoryIds && validated.categoryIds.length > 0) {
      const catInserts = validated.categoryIds.map((catId) => ({
        product_id: productId,
        category_id: catId,
        tenant_id: context.tenantId,
      }));
      await supabase.from("retail_product_categories").insert(catInserts);
    }

    // 3. Inserir opções (se houver)
    if (validated.options && validated.options.length > 0) {
      const optInserts = validated.options.map((opt, idx) => ({
        product_id: productId,
        tenant_id: context.tenantId,
        name: opt.name,
        position: opt.position ?? idx,
        values: opt.values,
      }));
      await supabase.from("retail_product_options").insert(optInserts);
    }

    // 4. Inserir variantes
    const variantInserts = validated.variants.map((v, idx) => ({
      product_id: productId,
      tenant_id: context.tenantId,
      sku: VariantInvariants.normalizeSku(v.sku),
      name: v.name,
      price_cents: v.priceCents,
      compare_at_price_cents: v.compareAtPriceCents ?? null,
      stock_quantity: v.stockQuantity ?? 0,
      is_available: v.isAvailable ?? true,
      options_summary: v.optionsSummary || {},
      sort_order: v.sortOrder ?? idx,
    }));

    const { error: varErr } = await supabase
      .from("retail_variants")
      .insert(variantInserts);

    if (varErr) {
      // Se houver colisão de SKU, remove o produto inserido para manter consistência
      await supabase.from("retail_products").delete().eq("id", productId);
      if (varErr.code === "23505") {
        throw new ValidationError("SKU duplicado detectado. Cada variante deve possuir um SKU exclusivo no estabelecimento.");
      }
      throw new Error(`Erro ao cadastrar variantes: ${varErr.message}`);
    }

    // 5. Auditoria
    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.product_created",
      resourceType: "retail_product",
      resourceId: productId,
      metadata: {
        name: productRow.name,
        slug: productRow.slug,
        status: productRow.status,
        variantsCount: variantInserts.length,
      },
    });

    if (validated.status === "published") {
      await AuditService.recordEvent({
        supabase,
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: "retail.product_published",
        resourceType: "retail_product",
        resourceId: productId,
        metadata: {
          name: productRow.name,
          slug: productRow.slug,
        },
      });
    }

    return this.getProductById(supabase, context.tenantId, productId);
  }

  /**
   * Atualiza um produto existente.
   */
  public static async updateProduct(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: UpdateProductInput
  ): Promise<RetailProductWithDetails> {
    RetailPermissionService.assertPermission(context.role, "manage_products");

    const validated = updateProductSchema.parse(input);
    const existing = await this.getProductById(supabase, context.tenantId, validated.id);

    // Se estiver alterando preços, valida permissão
    if (validated.variants) {
      const priceChanged = validated.variants.some((v) => {
        const prev = existing.variants.find((ev) => ev.id === v.id || ev.sku === v.sku);
        return prev && prev.priceCents !== v.priceCents;
      });
      if (priceChanged) {
        RetailPermissionService.assertPermission(context.role, "manage_prices");
      }
    }

    // Se estiver alterando para published, valida critérios
    if (validated.status === "published" && existing.status !== "published") {
      RetailPermissionService.assertPermission(context.role, "publish_products");
      const variantsToCheck = validated.variants || existing.variants;
      ProductInvariants.assertCanPublish({
        name: validated.name || existing.name,
        variants: variantsToCheck,
      });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validated.name !== undefined) updatePayload.name = validated.name;
    if (validated.slug !== undefined) updatePayload.slug = validated.slug;
    if (validated.description !== undefined) updatePayload.description = validated.description;
    if (validated.status !== undefined) {
      updatePayload.status = validated.status;
      if (validated.status === "published" && !existing.publishedAt) {
        updatePayload.published_at = new Date().toISOString();
      }
    }

    const { error: prodErr } = await supabase
      .from("retail_products")
      .update(updatePayload)
      .eq("id", existing.id)
      .eq("tenant_id", context.tenantId);

    if (prodErr) {
      if (prodErr.code === "23505") {
        throw new ValidationError("Já existe um produto com este slug nesta empresa.");
      }
      throw new Error(`Erro ao atualizar produto: ${prodErr.message}`);
    }

    // Atualiza categorias vinculadas
    if (validated.categoryIds !== undefined) {
      await supabase
        .from("retail_product_categories")
        .delete()
        .eq("product_id", existing.id)
        .eq("tenant_id", context.tenantId);

      if (validated.categoryIds.length > 0) {
        const catInserts = validated.categoryIds.map((cId) => ({
          product_id: existing.id,
          category_id: cId,
          tenant_id: context.tenantId,
        }));
        await supabase.from("retail_product_categories").insert(catInserts);
      }
    }

    // Atualiza opções (se enviadas)
    if (validated.options !== undefined) {
      await supabase
        .from("retail_product_options")
        .delete()
        .eq("product_id", existing.id)
        .eq("tenant_id", context.tenantId);

      if (validated.options.length > 0) {
        const optInserts = validated.options.map((opt, idx) => ({
          product_id: existing.id,
          tenant_id: context.tenantId,
          name: opt.name,
          position: opt.position ?? idx,
          values: opt.values,
        }));
        await supabase.from("retail_product_options").insert(optInserts);
      }
    }

    // Atualiza variantes (se enviadas)
    if (validated.variants !== undefined) {
      for (const v of validated.variants) {
        if (v.id) {
          await supabase
            .from("retail_variants")
            .update({
              sku: VariantInvariants.normalizeSku(v.sku),
              name: v.name,
              price_cents: v.priceCents,
              compare_at_price_cents: v.compareAtPriceCents ?? null,
              stock_quantity: v.stockQuantity ?? 0,
              is_available: v.isAvailable ?? true,
              options_summary: v.optionsSummary || {},
              sort_order: v.sortOrder ?? 0,
              updated_at: new Date().toISOString(),
            })
            .eq("id", v.id)
            .eq("product_id", existing.id)
            .eq("tenant_id", context.tenantId);
        } else {
          await supabase.from("retail_variants").insert({
            product_id: existing.id,
            tenant_id: context.tenantId,
            sku: VariantInvariants.normalizeSku(v.sku),
            name: v.name,
            price_cents: v.priceCents,
            compare_at_price_cents: v.compareAtPriceCents ?? null,
            stock_quantity: v.stockQuantity ?? 0,
            is_available: v.isAvailable ?? true,
            options_summary: v.optionsSummary || {},
            sort_order: v.sortOrder ?? 0,
          });
        }
      }
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.product_updated",
      resourceType: "retail_product",
      resourceId: existing.id,
      metadata: {
        name: validated.name || existing.name,
        changes: updatePayload,
      },
    });

    return this.getProductById(supabase, context.tenantId, existing.id);
  }

  /**
   * Publica o produto no catálogo.
   */
  public static async publishProduct(
    supabase: AppSupabaseClient,
    context: TenantContext,
    productId: string
  ): Promise<RetailProductWithDetails> {
    RetailPermissionService.assertPermission(context.role, "publish_products");

    const product = await this.getProductById(supabase, context.tenantId, productId);
    ProductInvariants.assertCanPublish({
      name: product.name,
      variants: product.variants,
      images: product.images,
    });

    const { error } = await supabase
      .from("retail_products")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("tenant_id", context.tenantId);

    if (error) {
      throw new Error(`Erro ao publicar produto: ${error.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.product_published",
      resourceType: "retail_product",
      resourceId: productId,
      metadata: {
        name: product.name,
        slug: product.slug,
      },
    });

    return this.getProductById(supabase, context.tenantId, productId);
  }

  /**
   * Arquiva o produto do catálogo.
   */
  public static async archiveProduct(
    supabase: AppSupabaseClient,
    context: TenantContext,
    productId: string
  ): Promise<RetailProductWithDetails> {
    RetailPermissionService.assertPermission(context.role, "manage_products");

    const product = await this.getProductById(supabase, context.tenantId, productId);

    const { error } = await supabase
      .from("retail_products")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("tenant_id", context.tenantId);

    if (error) {
      throw new Error(`Erro ao arquivar produto: ${error.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.product_archived",
      resourceType: "retail_product",
      resourceId: productId,
      metadata: {
        name: product.name,
        slug: product.slug,
      },
    });

    return this.getProductById(supabase, context.tenantId, productId);
  }

  /**
   * Remove o produto permanentemente.
   */
  public static async deleteProduct(
    supabase: AppSupabaseClient,
    context: TenantContext,
    productId: string
  ): Promise<void> {
    RetailPermissionService.assertPermission(context.role, "manage_products");

    const product = await this.getProductById(supabase, context.tenantId, productId);

    const { error } = await supabase
      .from("retail_products")
      .delete()
      .eq("id", productId)
      .eq("tenant_id", context.tenantId);

    if (error) {
      throw new Error(`Erro ao excluir produto: ${error.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.product_deleted",
      resourceType: "retail_product",
      resourceId: productId,
      metadata: {
        name: product.name,
        slug: product.slug,
      },
    });
  }
}

