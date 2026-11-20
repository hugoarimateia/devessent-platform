import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import { NotFoundError, ValidationError } from "@/core/errors/app-error";
import type {
  RetailCart,
  RetailCartItem,
  RetailInventoryMode,
} from "../types/retail.types";

async function loadXamppRetailOrderAdapter() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("VIOLAÇÃO DE AMBIENTE: Adaptador XAMPP proibido em produção.");
  }
  const { XamppRetailOrderAdapter } = await import(
    "@/infrastructure/xampp-test/retail-order-adapter"
  );
  return XamppRetailOrderAdapter;
}
import { cartItemInputSchema, cartUpdateQuantitySchema } from "../schemas/order.schema";
import {
  clearStoreCartToken,
  generateOpaqueToken,
  hashOpaqueToken,
  readStoreCartToken,
  writeStoreCartToken,
} from "./retail-cart-cookie";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

interface ActiveStoreContext {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  currency: string;
  inventory_mode: RetailInventoryMode;
  is_active: boolean;
  contact_email: string | null;
  contact_phone: string | null;
}

function resolveImageUrl(client: AppSupabaseClient, storagePath: string | null): string | null {
  if (!storagePath) return null;
  if (storagePath.startsWith("http") || storagePath.startsWith("/")) {
    return storagePath;
  }
  const { data } = client.storage.from("retail-media").getPublicUrl(storagePath);
  return data.publicUrl;
}

export class RetailCartService {
  private static async getActiveStoreSupabase(
    adminClient: AppSupabaseClient,
    storeSlug: string
  ): Promise<ActiveStoreContext | null> {
    const { data: store } = await adminClient
      .from("retail_stores")
      .select(
        "id, tenant_id, store_name, slug, currency, inventory_mode, is_active, contact_email, contact_phone"
      )
      .eq("slug", storeSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (!store) return null;

    const { data: tenant } = await adminClient
      .from("tenants")
      .select("status")
      .eq("id", store.tenant_id)
      .maybeSingle();

    if (!tenant || tenant.status !== "active") {
      return null;
    }

    return {
      ...store,
      slug: store.slug || storeSlug,
      inventory_mode: (store.inventory_mode as RetailInventoryMode) || "track_quantity",
    };
  }

  private static async hydrateCartSupabase(
    adminClient: AppSupabaseClient,
    store: ActiveStoreContext,
    cartRow: Database["public"]["Tables"]["retail_carts"]["Row"] | null
  ): Promise<RetailCart> {
    if (!cartRow) {
      return {
        id: null,
        tenantId: store.tenant_id,
        storeId: store.id,
        storeSlug: store.slug,
        currency: store.currency,
        inventoryMode: store.inventory_mode,
        status: "active",
        items: [],
        itemCount: 0,
        subtotalCents: 0,
        hasUnavailableItems: false,
        expiresAt: null,
      };
    }

    const { data: cartItems } = await adminClient
      .from("retail_cart_items")
      .select("*")
      .eq("cart_id", cartRow.id)
      .eq("tenant_id", store.tenant_id)
      .order("created_at", { ascending: true });

    const rows = cartItems || [];
    if (rows.length === 0) {
      return {
        id: cartRow.id,
        tenantId: store.tenant_id,
        storeId: store.id,
        storeSlug: store.slug,
        currency: store.currency,
        inventoryMode: store.inventory_mode,
        status: cartRow.status as RetailCart["status"],
        items: [],
        itemCount: 0,
        subtotalCents: 0,
        hasUnavailableItems: false,
        expiresAt: cartRow.expires_at,
      };
    }

    const productIds = [...new Set(rows.map((r) => r.product_id))];
    const variantIds = [...new Set(rows.map((r) => r.variant_id))];

    const [{ data: products }, { data: variants }, { data: images }] = await Promise.all([
      adminClient
        .from("retail_products")
        .select("id, slug, name, status")
        .eq("tenant_id", store.tenant_id)
        .in("id", productIds),
      adminClient
        .from("retail_variants")
        .select("id, name, sku, price_cents, compare_at_price_cents, stock_quantity, is_available")
        .eq("tenant_id", store.tenant_id)
        .in("id", variantIds),
      adminClient
        .from("retail_product_images")
        .select("product_id, variant_id, storage_path, is_primary, sort_order")
        .eq("tenant_id", store.tenant_id)
        .in("product_id", productIds)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);

    const productMap = new Map((products || []).map((p) => [p.id, p]));
    const variantMap = new Map((variants || []).map((v) => [v.id, v]));

    let hasUnavailableItems = false;
    const items: RetailCartItem[] = [];

    for (const row of rows) {
      const product = productMap.get(row.product_id);
      const variant = variantMap.get(row.variant_id);
      if (!product || !variant) {
        hasUnavailableItems = true;
        continue;
      }

      const productImages = (images || []).filter((img) => img.product_id === product.id);
      const pickedImage =
        productImages.find((img) => img.variant_id === variant.id) || productImages[0] || null;

      const isProductPublished = product.status === "published";
      const isVariantAvailable = Boolean(variant.is_available);
      const availableStock = Number(variant.stock_quantity || 0);

      let availabilityIssue: string | null = null;
      if (!isProductPublished || !isVariantAvailable) {
        availabilityIssue = "Este item não está mais disponível no catálogo.";
      } else if (store.inventory_mode === "track_quantity" && availableStock <= 0) {
        availabilityIssue = "Item esgotado no momento.";
      } else if (store.inventory_mode === "track_quantity" && row.quantity > availableStock) {
        availabilityIssue = `Apenas ${availableStock} unidade(s) disponível(is) em estoque.`;
      }

      if (availabilityIssue) {
        hasUnavailableItems = true;
      }

      items.push({
        id: row.id,
        cartId: row.cart_id,
        tenantId: row.tenant_id,
        productId: row.product_id,
        productSlug: product.slug,
        productName: product.name,
        variantId: row.variant_id,
        variantName: variant.name,
        sku: variant.sku,
        unitPriceCents: variant.price_cents,
        compareAtPriceCents: variant.compare_at_price_cents,
        quantity: row.quantity,
        lineTotalCents: variant.price_cents * row.quantity,
        availableStock,
        isAvailable: isVariantAvailable,
        isProductPublished,
        imageUrl: pickedImage ? resolveImageUrl(adminClient, pickedImage.storage_path) : null,
        availabilityIssue,
      });
    }

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);

    return {
      id: cartRow.id,
      tenantId: store.tenant_id,
      storeId: store.id,
      storeSlug: store.slug,
      currency: store.currency,
      inventoryMode: store.inventory_mode,
      status: cartRow.status as RetailCart["status"],
      items,
      itemCount,
      subtotalCents,
      hasUnavailableItems,
      expiresAt: cartRow.expires_at,
    };
  }

  public static async getCartForStore(storeSlug: string): Promise<RetailCart | null> {
    const rawToken = await readStoreCartToken(storeSlug);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailOrderAdapter = await loadXamppRetailOrderAdapter();
      return XamppRetailOrderAdapter.getCart(storeSlug, rawToken);
    }

    const adminClient = createAdminClient();
    const store = await this.getActiveStoreSupabase(adminClient, storeSlug);
    if (!store) return null;

    if (!rawToken) {
      return this.hydrateCartSupabase(adminClient, store, null);
    }

    const { data: cartRow } = await adminClient
      .from("retail_carts")
      .select("*")
      .eq("tenant_id", store.tenant_id)
      .eq("store_id", store.id)
      .eq("cart_token_hash", hashOpaqueToken(rawToken))
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    return this.hydrateCartSupabase(adminClient, store, cartRow);
  }

  public static async addItem(
    storeSlug: string,
    rawInput: unknown
  ): Promise<RetailCart> {
    const parsed = cartItemInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError("Dados inválidos para adicionar ao carrinho.", parsed.error.flatten().fieldErrors);
    }

    const rawToken = await readStoreCartToken(storeSlug);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailOrderAdapter = await loadXamppRetailOrderAdapter();
      const result = await XamppRetailOrderAdapter.addOrIncrementCartItem({
        storeSlug,
        rawCartToken: rawToken,
        productId: parsed.data.productId,
        variantId: parsed.data.variantId,
        quantity: parsed.data.quantity,
      });
      await writeStoreCartToken(storeSlug, result.rawToken);
      return result.cart;
    }

    const adminClient = createAdminClient();
    const store = await this.getActiveStoreSupabase(adminClient, storeSlug);
    if (!store) {
      throw new NotFoundError("Loja indisponível ou suspensa.");
    }

    const [{ data: product }, { data: variant }] = await Promise.all([
      adminClient
        .from("retail_products")
        .select("id, name, status")
        .eq("id", parsed.data.productId)
        .eq("tenant_id", store.tenant_id)
        .maybeSingle(),
      adminClient
        .from("retail_variants")
        .select("id, name, sku, stock_quantity, is_available, product_id")
        .eq("id", parsed.data.variantId)
        .eq("product_id", parsed.data.productId)
        .eq("tenant_id", store.tenant_id)
        .maybeSingle(),
    ]);

    if (!product || !variant || product.status !== "published" || !variant.is_available) {
      throw new ValidationError("Este produto ou variante não está disponível no momento.");
    }

    let activeToken = rawToken;
    let cartRow: Database["public"]["Tables"]["retail_carts"]["Row"] | null = null;
    const nextExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (activeToken) {
      const { data } = await adminClient
        .from("retail_carts")
        .select("*")
        .eq("tenant_id", store.tenant_id)
        .eq("store_id", store.id)
        .eq("cart_token_hash", hashOpaqueToken(activeToken))
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      cartRow = data;
    }

    if (!cartRow) {
      activeToken = generateOpaqueToken(24);
      const { data: created, error: createErr } = await adminClient
        .from("retail_carts")
        .insert({
          tenant_id: store.tenant_id,
          store_id: store.id,
          cart_token_hash: hashOpaqueToken(activeToken),
          status: "active",
          expires_at: nextExpiry,
        })
        .select("*")
        .single();
      if (createErr || !created) {
        throw new Error("Não foi possível inicializar a sacola.");
      }
      cartRow = created;
    }

    const { data: existingItem } = await adminClient
      .from("retail_cart_items")
      .select("id, quantity")
      .eq("cart_id", cartRow.id)
      .eq("variant_id", variant.id)
      .maybeSingle();

    const nextQty = (existingItem?.quantity || 0) + parsed.data.quantity;
    if (nextQty > 99) {
      throw new ValidationError("Quantidade máxima por item no carrinho é 99.");
    }

    if (store.inventory_mode === "track_quantity" && nextQty > variant.stock_quantity) {
      throw new ValidationError(
        `Estoque disponível insuficiente para "${product.name}" (${variant.name}). Disponível: ${variant.stock_quantity}.`
      );
    }

    if (existingItem) {
      await adminClient
        .from("retail_cart_items")
        .update({ quantity: nextQty })
        .eq("id", existingItem.id);
    } else {
      await adminClient.from("retail_cart_items").insert({
        cart_id: cartRow.id,
        tenant_id: store.tenant_id,
        product_id: product.id,
        variant_id: variant.id,
        quantity: nextQty,
      });
    }

    await adminClient
      .from("retail_carts")
      .update({ expires_at: nextExpiry })
      .eq("id", cartRow.id);

    await writeStoreCartToken(storeSlug, activeToken!);
    return this.hydrateCartSupabase(adminClient, store, cartRow);
  }

  public static async updateItemQuantity(
    storeSlug: string,
    rawInput: unknown
  ): Promise<RetailCart> {
    const parsed = cartUpdateQuantitySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError("Dados inválidos para atualizar quantidade.", parsed.error.flatten().fieldErrors);
    }

    const rawToken = await readStoreCartToken(storeSlug);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailOrderAdapter = await loadXamppRetailOrderAdapter();
      const cart = await XamppRetailOrderAdapter.updateCartItemQuantity({
        storeSlug,
        rawCartToken: rawToken,
        variantId: parsed.data.variantId,
        quantity: parsed.data.quantity,
      });
      if (rawToken) {
        await writeStoreCartToken(storeSlug, rawToken);
      }
      return cart;
    }

    const adminClient = createAdminClient();
    const store = await this.getActiveStoreSupabase(adminClient, storeSlug);
    if (!store) {
      throw new NotFoundError("Loja indisponível ou suspensa.");
    }

    if (!rawToken) {
      return this.hydrateCartSupabase(adminClient, store, null);
    }

    const { data: cartRow } = await adminClient
      .from("retail_carts")
      .select("*")
      .eq("tenant_id", store.tenant_id)
      .eq("store_id", store.id)
      .eq("cart_token_hash", hashOpaqueToken(rawToken))
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!cartRow) {
      return this.hydrateCartSupabase(adminClient, store, null);
    }

    if (parsed.data.quantity <= 0) {
      await adminClient
        .from("retail_cart_items")
        .delete()
        .eq("cart_id", cartRow.id)
        .eq("variant_id", parsed.data.variantId)
        .eq("tenant_id", store.tenant_id);
    } else {
      const { data: variant } = await adminClient
        .from("retail_variants")
        .select("id, stock_quantity, is_available, retail_products!inner(status)")
        .eq("id", parsed.data.variantId)
        .eq("tenant_id", store.tenant_id)
        .maybeSingle();

      const productStatus = (variant?.retail_products as unknown as { status?: string } | null)?.status;
      if (!variant || !variant.is_available || productStatus !== "published") {
        throw new ValidationError("Esta variante não está mais disponível.");
      }

      if (store.inventory_mode === "track_quantity" && parsed.data.quantity > variant.stock_quantity) {
        throw new ValidationError(
          `Quantidade solicitada excede o estoque disponível (${variant.stock_quantity}).`
        );
      }

      await adminClient
        .from("retail_cart_items")
        .update({ quantity: parsed.data.quantity })
        .eq("cart_id", cartRow.id)
        .eq("variant_id", parsed.data.variantId)
        .eq("tenant_id", store.tenant_id);
    }

    await writeStoreCartToken(storeSlug, rawToken);
    return this.hydrateCartSupabase(adminClient, store, cartRow);
  }

  public static async clearCart(storeSlug: string): Promise<RetailCart | null> {
    const rawToken = await readStoreCartToken(storeSlug);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailOrderAdapter = await loadXamppRetailOrderAdapter();
      const result = await XamppRetailOrderAdapter.clearCart(storeSlug, rawToken);
      await clearStoreCartToken(storeSlug);
      return result;
    }

    const adminClient = createAdminClient();
    const store = await this.getActiveStoreSupabase(adminClient, storeSlug);
    if (!store) return null;

    if (rawToken) {
      const { data: cartRow } = await adminClient
        .from("retail_carts")
        .select("id")
        .eq("tenant_id", store.tenant_id)
        .eq("store_id", store.id)
        .eq("cart_token_hash", hashOpaqueToken(rawToken))
        .eq("status", "active")
        .maybeSingle();

      if (cartRow) {
        await adminClient
          .from("retail_cart_items")
          .delete()
          .eq("cart_id", cartRow.id)
          .eq("tenant_id", store.tenant_id);
      }
    }

    await clearStoreCartToken(storeSlug);
    return this.hydrateCartSupabase(adminClient, store, null);
  }
}
