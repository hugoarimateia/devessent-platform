import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";
import { ProductInvariants } from "@/modules/retail/domain/product-invariants";
import { NotFoundError, ValidationError } from "@/core/errors/app-error";
import type {
  PublicStorefront,
  RetailCatalogFilter,
  RetailCatalogResult,
  RetailCatalogStats,
  RetailCategory,
  RetailDashboardSummary,
  RetailProductImage,
  RetailProductOption,
  RetailProductStatus,
  RetailProductWithDetails,
  RetailStore,
  RetailVariant,
  StorefrontCatalogFilter,
  StorefrontTemplate,
} from "@/modules/retail/types/retail.types";
import {
  STOREFRONT_DESIGN_FIELD_KEYS,
  type UpdateRetailOperationalSettingsInput,
  type UpdateRetailStoreInput,
} from "@/modules/retail/schemas/store.schema";
import type { StorefrontSettingsInput } from "@/modules/retail/schemas/storefront.schema";
import { assertXamppRuntimeAllowed, xamppQuery } from "./db";
import { XamppTenantAdapter } from "./tenant-adapter";

interface StoreRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  currency: string;
  template: StorefrontTemplate;
  brand_headline: string | null;
  brand_subheadline: string | null;
  about_text: string | null;
  hero_badge: string | null;
  accent_color: string | null;
  secondary_color: string | null;
  announcement_bar: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  social_links_json: string | Record<string, string> | null;
  is_active: number;
  inventory_mode: "track_quantity" | "untracked";
  created_at: Date | string;
  updated_at: Date | string;
}

interface CategoryRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ProductRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: RetailProductStatus;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function parseJson<T>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

export class XamppRetailAdapter {
  private static mapStore(r: StoreRow): RetailStore {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      storeName: r.store_name,
      slug: r.slug,
      currency: r.currency,
      template: r.template || "editorial",
      brandHeadline: r.brand_headline,
      brandSubheadline: r.brand_subheadline,
      aboutText: r.about_text,
      heroBadge: r.hero_badge,
      heroImagePath: null,
      accentColor: r.accent_color,
      secondaryColor: r.secondary_color,
      announcementBar: r.announcement_bar,
      contactEmail: r.contact_email,
      contactPhone: r.contact_phone,
      socialLinks: parseJson<Record<string, string>>(r.social_links_json, {}),
      isActive: Boolean(r.is_active),
      inventoryMode: r.inventory_mode,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }

  public static async getStore(tenantId: string): Promise<RetailStore | null> {
    assertXamppRuntimeAllowed();
    const rows = await xamppQuery<StoreRow[]>(
      "SELECT * FROM retail_stores WHERE tenant_id = ? LIMIT 1",
      [tenantId]
    );
    return rows[0] ? this.mapStore(rows[0]) : null;
  }

  public static async listAllStoresForAdmin(): Promise<
    Array<
      RetailStore & {
        tenantName: string;
        tenantSlug: string;
        tenantStatus: "active" | "suspended";
      }
    >
  > {
    assertXamppRuntimeAllowed();
    const rows = await xamppQuery<
      Array<
        StoreRow & {
          tenant_name: string;
          tenant_slug: string;
          tenant_status: "active" | "suspended";
        }
      >
    >(
      `SELECT rs.*, t.name AS tenant_name, t.slug AS tenant_slug, t.status AS tenant_status
       FROM retail_stores rs
       INNER JOIN tenants t ON t.id = rs.tenant_id
       ORDER BY rs.updated_at DESC`
    );

    return rows.map((r) => ({
      ...this.mapStore(r),
      tenantName: r.tenant_name,
      tenantSlug: r.tenant_slug,
      tenantStatus: r.tenant_status,
    }));
  }

  public static async ensureStore(
    tenantId: string,
    defaultStoreName: string
  ): Promise<RetailStore> {
    const existing = await this.getStore(tenantId);
    if (existing) return existing;

    const tenantRows = await xamppQuery<RowDataPacket[]>(
      "SELECT slug FROM tenants WHERE id = ? LIMIT 1",
      [tenantId]
    );
    const slug = (tenantRows[0]?.slug as string) || `loja-${tenantId.slice(0, 8)}`;
    const id = randomUUID();

    await xamppQuery(
      `INSERT INTO retail_stores (id, tenant_id, store_name, slug, currency, template, is_active, inventory_mode)
       VALUES (?, ?, ?, ?, 'BRL', 'editorial', 1, 'track_quantity')`,
      [id, tenantId, defaultStoreName || "Loja Teste", slug]
    );

    const created = await this.getStore(tenantId);
    if (!created) throw new Error("Falha ao inicializar loja Retail no MariaDB.");
    return created;
  }

  public static async updateOperationalSettings(
    context: TenantContext,
    input: UpdateRetailOperationalSettingsInput
  ): Promise<RetailStore> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "manage_retail_settings");

    await this.ensureStore(context.tenantId, input.storeName);

    await xamppQuery(
      `UPDATE retail_stores SET
        store_name = ?,
        currency = ?,
        is_active = ?,
        inventory_mode = ?,
        contact_email = ?,
        contact_phone = ?,
        social_links_json = ?
       WHERE tenant_id = ?`,
      [
        input.storeName,
        input.currency || "BRL",
        input.isActive !== false ? 1 : 0,
        input.inventoryMode || "track_quantity",
        input.contactEmail ?? null,
        input.contactPhone ?? null,
        JSON.stringify(input.socialLinks || {}),
        context.tenantId,
      ]
    );

    await XamppTenantAdapter.recordAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.store_updated",
      resourceType: "retail_store",
      resourceId: context.tenantId,
      metadata: {
        storeName: input.storeName,
        currency: input.currency || "BRL",
        isActive: input.isActive !== false,
      },
    });

    const updated = await this.getStore(context.tenantId);
    if (!updated) throw new Error("Erro ao recarregar loja.");
    return updated;
  }

  public static async updateStorefrontDesign(
    context: TenantContext,
    input: Partial<StorefrontSettingsInput>
  ): Promise<RetailStore> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "manage_storefront_design");

    await this.ensureStore(context.tenantId, context.tenantName);

    await xamppQuery(
      `UPDATE retail_stores SET
        template = ?,
        brand_headline = ?,
        brand_subheadline = ?,
        about_text = ?,
        hero_badge = ?,
        accent_color = ?,
        secondary_color = ?,
        announcement_bar = ?
       WHERE tenant_id = ?`,
      [
        input.template || "editorial",
        input.brandHeadline ?? null,
        input.brandSubheadline ?? null,
        input.aboutText ?? null,
        input.heroBadge ?? null,
        input.accentColor ?? "#111111",
        input.secondaryColor ?? "#f4f3f0",
        input.announcementBar ?? null,
        context.tenantId,
      ]
    );

    await XamppTenantAdapter.recordAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.storefront_design_updated",
      resourceType: "retail_store",
      resourceId: context.tenantId,
      metadata: { template: input.template || "editorial", accentColor: input.accentColor },
    });

    const updated = await this.getStore(context.tenantId);
    if (!updated) throw new Error("Erro ao recarregar loja.");
    return updated;
  }

  public static async updateStore(
    context: TenantContext,
    input: UpdateRetailStoreInput
  ): Promise<RetailStore> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "manage_retail_settings");

    const hasDesignFields = STOREFRONT_DESIGN_FIELD_KEYS.some(
      (key) => input[key] !== undefined
    );
    if (hasDesignFields) {
      RetailPermissionService.assertPermission(context.role, "manage_storefront_design");
    } else {
      return this.updateOperationalSettings(context, input);
    }

    await this.ensureStore(context.tenantId, input.storeName);

    await xamppQuery(
      `UPDATE retail_stores SET
        store_name = ?,
        currency = ?,
        is_active = ?,
        inventory_mode = ?,
        template = ?,
        brand_headline = ?,
        brand_subheadline = ?,
        about_text = ?,
        hero_badge = ?,
        accent_color = ?,
        secondary_color = ?,
        announcement_bar = ?,
        contact_email = ?,
        contact_phone = ?,
        social_links_json = ?
       WHERE tenant_id = ?`,
      [
        input.storeName,
        input.currency || "BRL",
        input.isActive !== false ? 1 : 0,
        input.inventoryMode || "track_quantity",
        input.template || "editorial",
        input.brandHeadline ?? null,
        input.brandSubheadline ?? null,
        input.aboutText ?? null,
        input.heroBadge ?? null,
        input.accentColor ?? "#111111",
        input.secondaryColor ?? "#f4f3f0",
        input.announcementBar ?? null,
        input.contactEmail ?? null,
        input.contactPhone ?? null,
        JSON.stringify(input.socialLinks || {}),
        context.tenantId,
      ]
    );

    await XamppTenantAdapter.recordAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.storefront_design_updated",
      resourceType: "retail_store",
      resourceId: context.tenantId,
      metadata: { storeName: input.storeName, template: input.template },
    });

    const updated = await this.getStore(context.tenantId);
    if (!updated) throw new Error("Erro ao recarregar loja.");
    return updated;
  }

  public static async listCategories(
    tenantId: string,
    onlyActive = false
  ): Promise<RetailCategory[]> {
    assertXamppRuntimeAllowed();
    const sql = onlyActive
      ? "SELECT * FROM retail_categories WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order ASC, name ASC"
      : "SELECT * FROM retail_categories WHERE tenant_id = ? ORDER BY sort_order ASC, name ASC";

    const rows = await xamppQuery<CategoryRow[]>(sql, [tenantId]);
    return rows.map((c) => ({
      id: c.id,
      tenantId: c.tenant_id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sort_order,
      isActive: Boolean(c.is_active),
      createdAt: new Date(c.created_at).toISOString(),
      updatedAt: new Date(c.updated_at).toISOString(),
    }));
  }

  public static async createCategory(
    context: TenantContext,
    input: { name: string; slug?: string; description?: string | null }
  ): Promise<RetailCategory> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "manage_categories");

    const slug = input.slug || ProductInvariants.slugify(input.name);
    if (!slug) throw new ValidationError("Slug inválido para categoria.");

    const id = randomUUID();
    await xamppQuery(
      `INSERT INTO retail_categories (id, tenant_id, name, slug, description, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, 0, 1)`,
      [id, context.tenantId, input.name.trim(), slug, input.description || null]
    );

    const rows = await xamppQuery<CategoryRow[]>(
      "SELECT * FROM retail_categories WHERE id = ? LIMIT 1",
      [id]
    );
    const c = rows[0];
    return {
      id: c.id,
      tenantId: c.tenant_id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sort_order,
      isActive: Boolean(c.is_active),
      createdAt: new Date(c.created_at).toISOString(),
      updatedAt: new Date(c.updated_at).toISOString(),
    };
  }

  private static async hydrateProducts(
    tenantId: string,
    productRows: ProductRow[]
  ): Promise<RetailProductWithDetails[]> {
    if (productRows.length === 0) return [];

    const productIds = productRows.map((p) => p.id);
    const placeholders = productIds.map(() => "?").join(",");

    const [variantsRows, optionsRows, imagesRows, catLinkRows] = await Promise.all([
      xamppQuery<RowDataPacket[]>(
        `SELECT * FROM retail_variants WHERE tenant_id = ? AND product_id IN (${placeholders}) ORDER BY sort_order ASC`,
        [tenantId, ...productIds]
      ),
      xamppQuery<RowDataPacket[]>(
        `SELECT * FROM retail_product_options WHERE tenant_id = ? AND product_id IN (${placeholders}) ORDER BY position ASC`,
        [tenantId, ...productIds]
      ),
      xamppQuery<RowDataPacket[]>(
        `SELECT * FROM retail_product_images WHERE tenant_id = ? AND product_id IN (${placeholders}) ORDER BY sort_order ASC`,
        [tenantId, ...productIds]
      ),
      xamppQuery<RowDataPacket[]>(
        `SELECT rpc.product_id, c.* FROM retail_product_categories rpc
         INNER JOIN retail_categories c ON c.id = rpc.category_id
         WHERE rpc.tenant_id = ? AND rpc.product_id IN (${placeholders})`,
        [tenantId, ...productIds]
      ),
    ]);

    return productRows.map((p) => {
      const variants: RetailVariant[] = variantsRows
        .filter((v) => v.product_id === p.id)
        .map((v) => ({
          id: v.id as string,
          tenantId: v.tenant_id as string,
          productId: v.product_id as string,
          sku: v.sku as string,
          name: v.name as string,
          priceCents: Number(v.price_cents),
          compareAtPriceCents: v.compare_at_price_cents ? Number(v.compare_at_price_cents) : null,
          stockQuantity: Number(v.stock_quantity),
          isAvailable: Boolean(v.is_available),
          optionsSummary: parseJson<Record<string, string>>(v.options_summary_json, {}),
          sortOrder: Number(v.sort_order),
          createdAt: new Date(v.created_at as string).toISOString(),
          updatedAt: new Date(v.updated_at as string).toISOString(),
        }));

      const options: RetailProductOption[] = optionsRows
        .filter((o) => o.product_id === p.id)
        .map((o) => ({
          id: o.id as string,
          tenantId: o.tenant_id as string,
          productId: o.product_id as string,
          name: o.name as string,
          position: Number(o.position),
          values: parseJson<string[]>(o.values_json, []),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

      const images: RetailProductImage[] = imagesRows
        .filter((i) => i.product_id === p.id)
        .map((i) => ({
          id: i.id as string,
          tenantId: i.tenant_id as string,
          productId: i.product_id as string,
          storagePath: i.storage_path as string,
          altText: i.alt_text as string | null,
          sortOrder: Number(i.sort_order),
          isPrimary: Boolean(i.is_primary),
          variantId: i.variant_id as string | null,
          publicUrl: `/api/xampp-media/${i.storage_path as string}`,
          createdAt: new Date(i.created_at as string).toISOString(),
          updatedAt: new Date(i.created_at as string).toISOString(),
        }));

      const categories: RetailCategory[] = catLinkRows
        .filter((c) => c.product_id === p.id)
        .map((c) => ({
          id: c.id as string,
          tenantId: c.tenant_id as string,
          name: c.name as string,
          slug: c.slug as string,
          description: c.description as string | null,
          sortOrder: Number(c.sort_order),
          isActive: Boolean(c.is_active),
          createdAt: new Date(c.created_at as string).toISOString(),
          updatedAt: new Date(c.updated_at as string).toISOString(),
        }));

      const prices = variants.map((v) => v.priceCents);
      const minPriceCents = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPriceCents = prices.length > 0 ? Math.max(...prices) : 0;
      const totalStock = variants.reduce((s, v) => s + v.stockQuantity, 0);

      return {
        id: p.id,
        tenantId: p.tenant_id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        status: p.status,
        publishedAt: p.published_at ? new Date(p.published_at).toISOString() : null,
        createdAt: new Date(p.created_at).toISOString(),
        updatedAt: new Date(p.updated_at).toISOString(),
        categories,
        variants,
        options,
        images,
        primaryImage: images.find((i) => i.isPrimary) || images[0] || null,
        minPriceCents,
        maxPriceCents,
        totalStock,
      };
    });
  }

  public static async listProducts(
    tenantId: string,
    filter: RetailCatalogFilter = {}
  ): Promise<RetailCatalogResult> {
    assertXamppRuntimeAllowed();
    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(50, Math.max(1, filter.pageSize || 12));

    const where: string[] = ["tenant_id = ?"];
    const params: unknown[] = [tenantId];

    if (filter.status && filter.status !== "all") {
      where.push("status = ?");
      params.push(filter.status);
    }

    if (filter.search && filter.search.trim()) {
      where.push("(name LIKE ? OR description LIKE ?)");
      const term = `%${filter.search.trim()}%`;
      params.push(term, term);
    }

    const rows = await xamppQuery<ProductRow[]>(
      `SELECT * FROM retail_products WHERE ${where.join(" AND ")} ORDER BY created_at DESC`,
      params
    );

    let hydrated = await this.hydrateProducts(tenantId, rows);
    if (filter.categoryId) {
      hydrated = hydrated.filter((p) => p.categories.some((c) => c.id === filter.categoryId));
    }

    const totalCount = hydrated.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;

    return {
      products: hydrated.slice(offset, offset + pageSize),
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  public static async getCatalogStats(tenantId: string): Promise<RetailCatalogStats> {
    assertXamppRuntimeAllowed();
    const [prodResult, catRows] = await Promise.all([
      this.listProducts(tenantId, { pageSize: 50 }),
      this.listCategories(tenantId),
    ]);

    const products = prodResult.products;
    return {
      totalProducts: products.length,
      publishedProducts: products.filter((p) => p.status === "published").length,
      draftProducts: products.filter((p) => p.status === "draft").length,
      archivedProducts: products.filter((p) => p.status === "archived").length,
      outOfStockProducts: products.filter((p) => p.totalStock === 0).length,
      totalCategories: catRows.length,
    };
  }

  public static async getDashboardSummary(tenantId: string): Promise<RetailDashboardSummary> {
    assertXamppRuntimeAllowed();
    const [prodResult, catRows] = await Promise.all([
      this.listProducts(tenantId, { pageSize: 100 }),
      this.listCategories(tenantId),
    ]);

    const categoryCountMap = new Map<
      string,
      { categoryId: string; name: string; productCount: number }
    >();
    for (const c of catRows) {
      if (c.isActive) {
        categoryCountMap.set(c.id, { categoryId: c.id, name: c.name, productCount: 0 });
      }
    }

    const products = prodResult.products;
    let lowStockProducts = 0;
    let totalStockUnits = 0;

    for (const p of products) {
      totalStockUnits += p.totalStock;
      if (p.totalStock > 0 && p.totalStock <= 5) {
        lowStockProducts++;
      }
      for (const c of p.categories) {
        const entry = categoryCountMap.get(c.id);
        if (entry) entry.productCount += 1;
      }
    }

    const categoryDistribution = Array.from(categoryCountMap.values()).sort(
      (a, b) => b.productCount - a.productCount
    );

    return {
      stats: {
        totalProducts: products.length,
        publishedProducts: products.filter((p) => p.status === "published").length,
        draftProducts: products.filter((p) => p.status === "draft").length,
        archivedProducts: products.filter((p) => p.status === "archived").length,
        outOfStockProducts: products.filter((p) => p.totalStock === 0).length,
        totalCategories: catRows.length,
      },
      lowStockProducts,
      totalStockUnits,
      categoryDistribution,
      recentProducts: products.slice(0, 5),
    };
  }

  public static async getProductById(
    tenantId: string,
    productId: string
  ): Promise<RetailProductWithDetails> {
    assertXamppRuntimeAllowed();
    const rows = await xamppQuery<ProductRow[]>(
      "SELECT * FROM retail_products WHERE id = ? AND tenant_id = ? LIMIT 1",
      [productId, tenantId]
    );
    if (!rows[0]) throw new NotFoundError("Produto não encontrado.");
    const hydrated = await this.hydrateProducts(tenantId, rows);
    return hydrated[0];
  }

  public static async getPublicStore(slug: string): Promise<PublicStorefront | null> {
    assertXamppRuntimeAllowed();
    const rows = await xamppQuery<StoreRow[]>(
      `SELECT rs.* FROM retail_stores rs
       INNER JOIN tenants t ON t.id = rs.tenant_id
       WHERE rs.slug = ? AND rs.is_active = 1 AND t.status = 'active'
       LIMIT 1`,
      [slug]
    );
    if (!rows[0]) return null;
    const s = this.mapStore(rows[0]);
    return {
      storeId: s.id,
      tenantId: s.tenantId,
      slug: s.slug,
      storeName: s.storeName,
      currency: s.currency,
      template: s.template,
      brandHeadline: s.brandHeadline,
      brandSubheadline: s.brandSubheadline,
      aboutText: s.aboutText,
      heroBadge: s.heroBadge,
      heroImagePath: s.heroImagePath,
      accentColor: s.accentColor,
      secondaryColor: s.secondaryColor,
      announcementBar: s.announcementBar,
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      socialLinks: s.socialLinks,
      isActive: s.isActive,
    };
  }

  public static async getPublicCatalog(
    tenantId: string,
    filter: StorefrontCatalogFilter = {}
  ) {
    assertXamppRuntimeAllowed();
    const result = await this.listProducts(tenantId, {
      status: "published",
      search: filter.search,
      page: filter.page,
      pageSize: filter.pageSize,
    });

    let products = result.products;
    if (filter.categorySlug) {
      products = products.filter((p) =>
        p.categories.some((c) => c.slug === filter.categorySlug)
      );
    }

    if (filter.sort === "price_asc") {
      products.sort((a, b) => a.minPriceCents - b.minPriceCents);
    } else if (filter.sort === "price_desc") {
      products.sort((a, b) => b.minPriceCents - a.minPriceCents);
    } else if (filter.sort === "name_asc") {
      products.sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      products,
      totalCount: products.length,
      page: result.page,
      totalPages: Math.ceil(products.length / (filter.pageSize || 12)),
    };
  }

  public static async getPublicProduct(
    tenantId: string,
    productSlug: string
  ): Promise<RetailProductWithDetails | null> {
    assertXamppRuntimeAllowed();
    const rows = await xamppQuery<ProductRow[]>(
      "SELECT * FROM retail_products WHERE tenant_id = ? AND slug = ? AND status = 'published' LIMIT 1",
      [tenantId, productSlug]
    );
    if (!rows[0]) return null;
    const hydrated = await this.hydrateProducts(tenantId, rows);
    return hydrated[0] || null;
  }
}

