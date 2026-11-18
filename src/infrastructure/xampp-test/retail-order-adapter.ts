import { randomBytes, randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import { ConflictError, NotFoundError, ValidationError } from "@/core/errors/app-error";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";
import { OrderInvariants } from "@/modules/retail/domain/order-invariants";
import type {
  PublicOrderTrackingView,
  RetailCart,
  RetailCartItem,
  RetailDeliveryMode,
  RetailInventoryMode,
  RetailOrder,
  RetailOrderItem,
  RetailOrderStats,
  RetailOrderStatus,
  RetailOrderStatusHistoryEntry,
  RetailOrderWithDetails,
  RetailOrdersFilter,
  RetailOrdersListResult,
} from "@/modules/retail/types/retail.types";
import type { CreatePublicOrderInput } from "@/modules/retail/schemas/order.schema";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  verifyOpaqueTokenHash,
} from "@/modules/retail/services/retail-cart-cookie";
import { assertXamppRuntimeAllowed, withXamppTransaction, xamppQuery } from "./db";

interface StoreActiveRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  currency: string;
  inventory_mode: RetailInventoryMode;
  is_active: number | boolean;
  contact_email: string | null;
  contact_phone: string | null;
}

interface CartRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  store_id: string;
  cart_token_hash: string;
  status: "active" | "converted" | "expired" | "abandoned";
  expires_at: string | Date;
}

interface CartItemJoinedRow extends RowDataPacket {
  id: string;
  cart_id: string;
  tenant_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  product_slug: string;
  product_name: string;
  product_status: string;
  variant_name: string;
  sku: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number;
  is_available: number | boolean;
  image_path: string | null;
}

interface OrderRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  store_id: string;
  cart_id: string | null;
  order_number: string;
  public_token_hash: string;
  status: RetailOrderStatus;
  stock_deducted: number | boolean;
  channel: "storefront" | "manual";
  currency: string;
  subtotal_cents: number;
  total_cents: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_mode: RetailDeliveryMode;
  delivery_address: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  idempotency_key: string | null;
  confirmed_at: string | Date | null;
  cancelled_at: string | Date | null;
  completed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  item_count?: number;
}

interface OrderItemRow extends RowDataPacket {
  id: string;
  order_id: string;
  tenant_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  sku_snapshot: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  image_url_snapshot: string | null;
  created_at: string | Date;
}

interface OrderHistoryRow extends RowDataPacket {
  id: string;
  order_id: string;
  tenant_id: string;
  from_status: RetailOrderStatus | null;
  to_status: RetailOrderStatus;
  changed_by_user_id: string | null;
  changed_by_name_snapshot: string | null;
  reason: string | null;
  created_at: string | Date;
}

interface VariantCheckRow extends RowDataPacket {
  id: string;
  product_id: string;
  product_name: string;
  product_status: string;
  variant_name: string;
  sku: string;
  price_cents: number;
  stock_quantity: number;
  is_available: number | boolean;
}

function toIsoString(val: string | Date | null | undefined): string | null {
  if (!val) return null;
  return new Date(val).toISOString();
}

function buildPublicImageUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  if (storagePath.startsWith("http") || storagePath.startsWith("/")) {
    return storagePath;
  }
  return `/${storagePath}`;
}

export class XamppRetailOrderAdapter {
  private static mapOrder(row: OrderRow): RetailOrder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      storeId: row.store_id,
      cartId: row.cart_id,
      orderNumber: row.order_number,
      status: row.status,
      stockDeducted: Boolean(row.stock_deducted),
      channel: row.channel,
      currency: row.currency,
      subtotalCents: Number(row.subtotal_cents || 0),
      totalCents: Number(row.total_cents || 0),
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      deliveryMode: row.delivery_mode,
      deliveryAddress: row.delivery_address,
      notes: row.notes,
      cancellationReason: row.cancellation_reason,
      idempotencyKey: row.idempotency_key,
      confirmedAt: toIsoString(row.confirmed_at),
      cancelledAt: toIsoString(row.cancelled_at),
      completedAt: toIsoString(row.completed_at),
      createdAt: toIsoString(row.created_at) || new Date().toISOString(),
      updatedAt: toIsoString(row.updated_at) || new Date().toISOString(),
      itemCount: row.item_count !== undefined ? Number(row.item_count) : undefined,
    };
  }

  private static mapOrderItem(row: OrderItemRow): RetailOrderItem {
    return {
      id: row.id,
      orderId: row.order_id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      variantId: row.variant_id,
      productNameSnapshot: row.product_name_snapshot,
      variantNameSnapshot: row.variant_name_snapshot,
      skuSnapshot: row.sku_snapshot,
      unitPriceCents: Number(row.unit_price_cents),
      quantity: Number(row.quantity),
      lineTotalCents: Number(row.line_total_cents),
      imageUrlSnapshot: row.image_url_snapshot,
      createdAt: toIsoString(row.created_at) || new Date().toISOString(),
    };
  }

  private static mapOrderHistory(row: OrderHistoryRow): RetailOrderStatusHistoryEntry {
    return {
      id: row.id,
      orderId: row.order_id,
      tenantId: row.tenant_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      changedByUserId: row.changed_by_user_id,
      changedByNameSnapshot: row.changed_by_name_snapshot,
      reason: row.reason,
      createdAt: toIsoString(row.created_at) || new Date().toISOString(),
    };
  }

  private static async getActiveStoreBySlug(slug: string): Promise<StoreActiveRow | null> {
    assertXamppRuntimeAllowed();
    const rows = await xamppQuery<StoreActiveRow[]>(
      `SELECT rs.id, rs.tenant_id, rs.store_name, rs.slug, rs.currency, rs.inventory_mode, rs.is_active, rs.contact_email, rs.contact_phone
         FROM retail_stores rs
         INNER JOIN tenants t ON t.id = rs.tenant_id
        WHERE rs.slug = ? AND rs.is_active = 1 AND t.status = 'active'
        LIMIT 1`,
      [slug]
    );
    return rows[0] || null;
  }

  private static async hydrateCart(
    store: StoreActiveRow,
    cartRow: CartRow | null
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

    const rows = await xamppQuery<CartItemJoinedRow[]>(
      `SELECT rci.id, rci.cart_id, rci.tenant_id, rci.product_id, rci.variant_id, rci.quantity,
              rp.slug AS product_slug, rp.name AS product_name, rp.status AS product_status,
              rv.name AS variant_name, rv.sku, rv.price_cents, rv.compare_at_price_cents,
              rv.stock_quantity, rv.is_available,
              (
                SELECT rpi.storage_path
                  FROM retail_product_images rpi
                 WHERE rpi.product_id = rp.id AND rpi.tenant_id = rci.tenant_id
                 ORDER BY (rpi.variant_id = rv.id) DESC, rpi.is_primary DESC, rpi.sort_order ASC
                 LIMIT 1
              ) AS image_path
         FROM retail_cart_items rci
         INNER JOIN retail_products rp ON rp.id = rci.product_id AND rp.tenant_id = rci.tenant_id
         INNER JOIN retail_variants rv ON rv.id = rci.variant_id AND rv.tenant_id = rci.tenant_id
        WHERE rci.cart_id = ? AND rci.tenant_id = ?
        ORDER BY rci.created_at ASC`,
      [cartRow.id, store.tenant_id]
    );

    let hasUnavailableItems = false;
    const items: RetailCartItem[] = rows.map((row) => {
      const unitPriceCents = Number(row.price_cents || 0);
      const quantity = Number(row.quantity || 1);
      const availableStock = Number(row.stock_quantity || 0);
      const isProductPublished = row.product_status === "published";
      const isVariantAvailable = Boolean(row.is_available);

      let availabilityIssue: string | null = null;
      if (!isProductPublished || !isVariantAvailable) {
        availabilityIssue = "Este item não está mais disponível no catálogo.";
      } else if (store.inventory_mode === "track_quantity" && availableStock <= 0) {
        availabilityIssue = "Item esgotado no momento.";
      } else if (store.inventory_mode === "track_quantity" && quantity > availableStock) {
        availabilityIssue = `Apenas ${availableStock} unidade(s) disponível(is) em estoque.`;
      }

      if (availabilityIssue) {
        hasUnavailableItems = true;
      }

      return {
        id: row.id,
        cartId: row.cart_id,
        tenantId: row.tenant_id,
        productId: row.product_id,
        productSlug: row.product_slug,
        productName: row.product_name,
        variantId: row.variant_id,
        variantName: row.variant_name,
        sku: row.sku,
        unitPriceCents,
        compareAtPriceCents: row.compare_at_price_cents !== null ? Number(row.compare_at_price_cents) : null,
        quantity,
        lineTotalCents: unitPriceCents * quantity,
        availableStock,
        isAvailable: isVariantAvailable,
        isProductPublished,
        imageUrl: buildPublicImageUrl(row.image_path),
        availabilityIssue,
      };
    });

    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);

    return {
      id: cartRow.id,
      tenantId: store.tenant_id,
      storeId: store.id,
      storeSlug: store.slug,
      currency: store.currency,
      inventoryMode: store.inventory_mode,
      status: cartRow.status,
      items,
      itemCount,
      subtotalCents,
      hasUnavailableItems,
      expiresAt: toIsoString(cartRow.expires_at),
    };
  }

  public static async getCart(storeSlug: string, rawCartToken: string | null): Promise<RetailCart | null> {
    assertXamppRuntimeAllowed();
    const store = await this.getActiveStoreBySlug(storeSlug);
    if (!store) return null;

    if (!rawCartToken) {
      return this.hydrateCart(store, null);
    }

    const tokenHash = hashOpaqueToken(rawCartToken);
    const rows = await xamppQuery<CartRow[]>(
      `SELECT * FROM retail_carts
        WHERE tenant_id = ? AND store_id = ? AND cart_token_hash = ? AND status = 'active' AND expires_at > NOW()
        LIMIT 1`,
      [store.tenant_id, store.id, tokenHash]
    );

    return this.hydrateCart(store, rows[0] || null);
  }

  private static async ensureCart(
    store: StoreActiveRow,
    rawCartToken: string | null
  ): Promise<{ cartRow: CartRow; rawToken: string; createdNewToken: boolean }> {
    if (rawCartToken) {
      const tokenHash = hashOpaqueToken(rawCartToken);
      const existing = await xamppQuery<CartRow[]>(
        `SELECT * FROM retail_carts
          WHERE tenant_id = ? AND store_id = ? AND cart_token_hash = ? AND status = 'active' AND expires_at > NOW()
          LIMIT 1`,
        [store.tenant_id, store.id, tokenHash]
      );
      if (existing[0]) {
        await xamppQuery(
          `UPDATE retail_carts SET expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE id = ?`,
          [existing[0].id]
        );
        return { cartRow: existing[0], rawToken: rawCartToken, createdNewToken: false };
      }
    }

    const newRawToken = generateOpaqueToken(24);
    const newHash = hashOpaqueToken(newRawToken);
    const cartId = randomUUID();
    await xamppQuery(
      `INSERT INTO retail_carts (id, tenant_id, store_id, cart_token_hash, status, expires_at)
       VALUES (?, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [cartId, store.tenant_id, store.id, newHash]
    );
    const created = await xamppQuery<CartRow[]>(
      `SELECT * FROM retail_carts WHERE id = ? LIMIT 1`,
      [cartId]
    );
    return { cartRow: created[0], rawToken: newRawToken, createdNewToken: true };
  }

  public static async addOrIncrementCartItem(params: {
    storeSlug: string;
    rawCartToken: string | null;
    productId: string;
    variantId: string;
    quantity: number;
  }): Promise<{ cart: RetailCart; rawToken: string; createdNewToken: boolean }> {
    assertXamppRuntimeAllowed();
    const store = await this.getActiveStoreBySlug(params.storeSlug);
    if (!store) {
      throw new NotFoundError("Loja indisponível ou suspensa no momento.");
    }

    const variants = await xamppQuery<VariantCheckRow[]>(
      `SELECT rv.id, rv.product_id, rp.name AS product_name, rp.status AS product_status,
              rv.name AS variant_name, rv.sku, rv.price_cents, rv.stock_quantity, rv.is_available
         FROM retail_variants rv
         INNER JOIN retail_products rp ON rp.id = rv.product_id AND rp.tenant_id = rv.tenant_id
        WHERE rv.id = ? AND rv.product_id = ? AND rv.tenant_id = ?
        LIMIT 1`,
      [params.variantId, params.productId, store.tenant_id]
    );

    const variant = variants[0];
    if (!variant || variant.product_status !== "published" || !Boolean(variant.is_available)) {
      throw new ValidationError("Este produto ou variante não está disponível no momento.");
    }

    const { cartRow, rawToken, createdNewToken } = await this.ensureCart(store, params.rawCartToken);

    const existingItems = await xamppQuery<RowDataPacket[]>(
      `SELECT id, quantity FROM retail_cart_items WHERE cart_id = ? AND variant_id = ? LIMIT 1`,
      [cartRow.id, variant.id]
    );

    const currentQty = existingItems[0] ? Number(existingItems[0].quantity) : 0;
    const nextQty = currentQty + params.quantity;

    if (nextQty > 99) {
      throw new ValidationError("Quantidade máxima permitida por variante no carrinho é 99 unidades.");
    }

    if (store.inventory_mode === "track_quantity" && nextQty > Number(variant.stock_quantity)) {
      throw new ValidationError(
        `Estoque disponível insuficiente para "${variant.product_name}" (${variant.variant_name}). Disponível: ${variant.stock_quantity}.`
      );
    }

    if (existingItems[0]) {
      await xamppQuery(
        `UPDATE retail_cart_items SET quantity = ? WHERE id = ? AND tenant_id = ?`,
        [nextQty, existingItems[0].id, store.tenant_id]
      );
    } else {
      await xamppQuery(
        `INSERT INTO retail_cart_items (id, cart_id, tenant_id, product_id, variant_id, quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), cartRow.id, store.tenant_id, variant.product_id, variant.id, nextQty]
      );
    }

    const cart = await this.hydrateCart(store, cartRow);
    return { cart, rawToken, createdNewToken };
  }

  public static async updateCartItemQuantity(params: {
    storeSlug: string;
    rawCartToken: string | null;
    variantId: string;
    quantity: number;
  }): Promise<RetailCart> {
    assertXamppRuntimeAllowed();
    const store = await this.getActiveStoreBySlug(params.storeSlug);
    if (!store) {
      throw new NotFoundError("Loja indisponível ou suspensa.");
    }

    if (!params.rawCartToken) {
      return this.hydrateCart(store, null);
    }

    const tokenHash = hashOpaqueToken(params.rawCartToken);
    const carts = await xamppQuery<CartRow[]>(
      `SELECT * FROM retail_carts
        WHERE tenant_id = ? AND store_id = ? AND cart_token_hash = ? AND status = 'active' AND expires_at > NOW()
        LIMIT 1`,
      [store.tenant_id, store.id, tokenHash]
    );

    const cartRow = carts[0];
    if (!cartRow) {
      return this.hydrateCart(store, null);
    }

    if (params.quantity <= 0) {
      await xamppQuery(
        `DELETE FROM retail_cart_items WHERE cart_id = ? AND variant_id = ? AND tenant_id = ?`,
        [cartRow.id, params.variantId, store.tenant_id]
      );
    } else {
      const variants = await xamppQuery<VariantCheckRow[]>(
        `SELECT rv.id, rv.product_id, rp.name AS product_name, rp.status AS product_status,
                rv.name AS variant_name, rv.sku, rv.price_cents, rv.stock_quantity, rv.is_available
           FROM retail_variants rv
           INNER JOIN retail_products rp ON rp.id = rv.product_id AND rp.tenant_id = rv.tenant_id
          WHERE rv.id = ? AND rv.tenant_id = ?
          LIMIT 1`,
        [params.variantId, store.tenant_id]
      );
      const variant = variants[0];
      if (!variant || variant.product_status !== "published" || !Boolean(variant.is_available)) {
        throw new ValidationError("Esta variante não está mais disponível.");
      }
      if (store.inventory_mode === "track_quantity" && params.quantity > Number(variant.stock_quantity)) {
        throw new ValidationError(
          `Quantidade solicitada excede o estoque disponível (${variant.stock_quantity}).`
        );
      }

      await xamppQuery(
        `UPDATE retail_cart_items SET quantity = ? WHERE cart_id = ? AND variant_id = ? AND tenant_id = ?`,
        [params.quantity, cartRow.id, params.variantId, store.tenant_id]
      );
    }

    await xamppQuery(
      `UPDATE retail_carts SET expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE id = ?`,
      [cartRow.id]
    );

    return this.hydrateCart(store, cartRow);
  }

  public static async clearCart(storeSlug: string, rawCartToken: string | null): Promise<RetailCart | null> {
    assertXamppRuntimeAllowed();
    const store = await this.getActiveStoreBySlug(storeSlug);
    if (!store) return null;

    if (rawCartToken) {
      const tokenHash = hashOpaqueToken(rawCartToken);
      const carts = await xamppQuery<CartRow[]>(
        `SELECT * FROM retail_carts WHERE tenant_id = ? AND store_id = ? AND cart_token_hash = ? AND status = 'active' LIMIT 1`,
        [store.tenant_id, store.id, tokenHash]
      );
      if (carts[0]) {
        await xamppQuery(`DELETE FROM retail_cart_items WHERE cart_id = ? AND tenant_id = ?`, [
          carts[0].id,
          store.tenant_id,
        ]);
      }
    }

    return this.hydrateCart(store, null);
  }

  public static async createPublicOrder(params: {
    storeSlug: string;
    rawCartToken: string | null;
    input: CreatePublicOrderInput;
  }): Promise<{
    order: RetailOrder;
    publicToken: string;
    storeName: string;
    storeSlug: string;
    contactPhone: string | null;
    deduplicated: boolean;
  }> {
    assertXamppRuntimeAllowed();

    const store = await this.getActiveStoreBySlug(params.storeSlug);
    if (!store) {
      throw new NotFoundError("Esta loja está indisponível ou suspensa e não recebe pedidos no momento.");
    }

    if (!params.rawCartToken) {
      throw new ValidationError("Sua sacola está vazia. Adicione itens antes de finalizar o pedido.");
    }

    const tokenHash = hashOpaqueToken(params.rawCartToken);

    return withXamppTransaction(async (conn) => {
      const [cartRows] = await conn.execute<CartRow[]>(
        `SELECT * FROM retail_carts
          WHERE tenant_id = ? AND store_id = ? AND cart_token_hash = ?
          LIMIT 1
          FOR UPDATE`,
        [store.tenant_id, store.id, tokenHash]
      );

      const cartRow = cartRows[0];
      if (!cartRow) {
        throw new ValidationError("Sua sacola está vazia ou não foi localizada.");
      }

      // Idempotência estritamente amarrada ao mesmo tenant + cart_id
      if (params.input.idempotencyKey) {
        const [existingOrders] = await conn.execute<OrderRow[]>(
          `SELECT * FROM retail_orders WHERE tenant_id = ? AND cart_id = ? AND idempotency_key = ? LIMIT 1`,
          [store.tenant_id, cartRow.id, params.input.idempotencyKey]
        );
        if (existingOrders[0]) {
          const freshPublicToken = generateOpaqueToken(24);
          await conn.execute(
            `UPDATE retail_orders SET public_token_hash = ? WHERE id = ?`,
            [hashOpaqueToken(freshPublicToken), existingOrders[0].id]
          );
          return {
            order: this.mapOrder(existingOrders[0]),
            publicToken: freshPublicToken,
            storeName: store.store_name,
            storeSlug: store.slug,
            contactPhone: store.contact_phone,
            deduplicated: true,
          };
        }
      }

      if (cartRow.status !== "active" || new Date(cartRow.expires_at).getTime() <= Date.now()) {
        throw new ValidationError("Sua sacola expirou ou já foi enviada. Adicione os itens novamente.");
      }

      const [itemRows] = await conn.execute<CartItemJoinedRow[]>(
        `SELECT rci.id, rci.cart_id, rci.tenant_id, rci.product_id, rci.variant_id, rci.quantity,
                rp.slug AS product_slug, rp.name AS product_name, rp.status AS product_status,
                rv.name AS variant_name, rv.sku, rv.price_cents, rv.compare_at_price_cents,
                rv.stock_quantity, rv.is_available,
                (
                  SELECT rpi.storage_path
                    FROM retail_product_images rpi
                   WHERE rpi.product_id = rp.id AND rpi.tenant_id = rci.tenant_id
                   ORDER BY (rpi.variant_id = rv.id) DESC, rpi.is_primary DESC, rpi.sort_order ASC
                   LIMIT 1
                ) AS image_path
           FROM retail_cart_items rci
           INNER JOIN retail_products rp ON rp.id = rci.product_id AND rp.tenant_id = rci.tenant_id
           INNER JOIN retail_variants rv ON rv.id = rci.variant_id AND rv.tenant_id = rci.tenant_id
          WHERE rci.cart_id = ? AND rci.tenant_id = ?
          ORDER BY rci.created_at ASC`,
        [cartRow.id, store.tenant_id]
      );

      if (!itemRows || itemRows.length === 0) {
        throw new ValidationError("Sua sacola está vazia. Adicione pelo menos um item para continuar.");
      }

      const snapshots: Array<{
        productId: string;
        variantId: string;
        productName: string;
        variantName: string;
        sku: string;
        unitPriceCents: number;
        quantity: number;
        lineTotalCents: number;
        imageUrl: string | null;
      }> = [];

      for (const row of itemRows) {
        if (row.product_status !== "published" || !Boolean(row.is_available)) {
          throw new ValidationError(
            `O item "${row.product_name}" (${row.variant_name}) não está mais disponível no catálogo.`
          );
        }
        const qty = Number(row.quantity);
        if (store.inventory_mode === "track_quantity" && Number(row.stock_quantity) < qty) {
          throw new ValidationError(
            `Estoque insuficiente para "${row.product_name}" (${row.variant_name}): disponível ${row.stock_quantity}, solicitado ${qty}.`
          );
        }
        const unitPriceCents = Number(row.price_cents);
        const lineTotalCents = OrderInvariants.computeLineTotalCents(unitPriceCents, qty);
        snapshots.push({
          productId: row.product_id,
          variantId: row.variant_id,
          productName: row.product_name,
          variantName: row.variant_name,
          sku: row.sku,
          unitPriceCents,
          quantity: qty,
          lineTotalCents,
          imageUrl: buildPublicImageUrl(row.image_path),
        });
      }

      const subtotalCents = OrderInvariants.computeSubtotalCents(snapshots);
      const totalCents = subtotalCents;
      const orderId = randomUUID();
      const orderNumber = OrderInvariants.generateOrderNumber(randomBytes(8).toString("hex"));
      const publicToken = generateOpaqueToken(24);
      const publicTokenHash = hashOpaqueToken(publicToken);

      await conn.execute(
        `INSERT INTO retail_orders (
          id, tenant_id, store_id, cart_id, order_number, public_token_hash, status,
          stock_deducted, channel, currency, subtotal_cents, total_cents,
          customer_name, customer_phone, customer_email, delivery_mode, delivery_address,
          notes, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, 'requested', 0, 'storefront', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          store.tenant_id,
          store.id,
          cartRow.id,
          orderNumber,
          publicTokenHash,
          store.currency,
          subtotalCents,
          totalCents,
          params.input.customerName,
          params.input.customerPhone,
          params.input.customerEmail || null,
          params.input.deliveryMode,
          params.input.deliveryMode === "delivery" ? params.input.deliveryAddress || null : null,
          params.input.notes || null,
          params.input.idempotencyKey || null,
        ]
      );

      for (const snap of snapshots) {
        await conn.execute(
          `INSERT INTO retail_order_items (
            id, order_id, tenant_id, product_id, variant_id, product_name_snapshot,
            variant_name_snapshot, sku_snapshot, unit_price_cents, quantity,
            line_total_cents, image_url_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            orderId,
            store.tenant_id,
            snap.productId,
            snap.variantId,
            snap.productName,
            snap.variantName,
            snap.sku,
            snap.unitPriceCents,
            snap.quantity,
            snap.lineTotalCents,
            snap.imageUrl,
          ]
        );
      }

      await conn.execute(
        `INSERT INTO retail_order_status_history (
          id, order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
        ) VALUES (?, ?, ?, NULL, 'requested', NULL, ?, 'Solicitação enviada pela vitrine pública')`,
        [randomUUID(), orderId, store.tenant_id, params.input.customerName]
      );

      await conn.execute(`UPDATE retail_carts SET status = 'converted' WHERE id = ?`, [cartRow.id]);

      const [createdOrders] = await conn.execute<OrderRow[]>(
        `SELECT * FROM retail_orders WHERE id = ? LIMIT 1`,
        [orderId]
      );

      return {
        order: this.mapOrder(createdOrders[0]),
        publicToken,
        storeName: store.store_name,
        storeSlug: store.slug,
        contactPhone: store.contact_phone,
        deduplicated: false,
      };
    });
  }

  public static async getPublicOrderTracking(params: {
    storeSlug: string;
    orderNumber: string;
    publicToken: string;
  }): Promise<PublicOrderTrackingView | null> {
    assertXamppRuntimeAllowed();
    const store = await this.getActiveStoreBySlug(params.storeSlug);
    if (!store) return null;

    const orders = await xamppQuery<OrderRow[]>(
      `SELECT * FROM retail_orders
        WHERE tenant_id = ? AND store_id = ? AND order_number = ?
        LIMIT 1`,
      [store.tenant_id, store.id, params.orderNumber]
    );
    const order = orders[0];
    if (!order || !verifyOpaqueTokenHash(params.publicToken, order.public_token_hash)) {
      return null;
    }

    const itemRows = await xamppQuery<OrderItemRow[]>(
      `SELECT * FROM retail_order_items WHERE order_id = ? AND tenant_id = ? ORDER BY created_at ASC`,
      [order.id, store.tenant_id]
    );

    return {
      orderNumber: order.order_number,
      status: order.status,
      currency: order.currency,
      subtotalCents: Number(order.subtotal_cents),
      totalCents: Number(order.total_cents),
      customerName: order.customer_name,
      deliveryMode: order.delivery_mode,
      hasDeliveryAddress: Boolean(order.delivery_address),
      notes: order.notes,
      createdAt: toIsoString(order.created_at) || new Date().toISOString(),
      confirmedAt: toIsoString(order.confirmed_at),
      cancelledAt: toIsoString(order.cancelled_at),
      items: itemRows.map((r) => this.mapOrderItem(r)),
      storeName: store.store_name,
      storeSlug: store.slug,
      contactEmail: store.contact_email,
      contactPhone: store.contact_phone,
    };
  }

  public static async listOrders(
    context: TenantContext,
    filter: RetailOrdersFilter = {}
  ): Promise<RetailOrdersListResult> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "view_retail_orders");

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(50, Math.max(1, filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const whereParts: string[] = ["ro.tenant_id = ?"];
    const params: unknown[] = [context.tenantId];

    if (filter.status && filter.status !== "all") {
      whereParts.push("ro.status = ?");
      params.push(filter.status);
    }

    if (filter.search?.trim()) {
      const q = `%${filter.search.trim()}%`;
      whereParts.push("(ro.order_number LIKE ? OR ro.customer_name LIKE ? OR ro.customer_phone LIKE ?)");
      params.push(q, q, q);
    }

    const whereSql = whereParts.join(" AND ");

    const countRows = await xamppQuery<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM retail_orders ro WHERE ${whereSql}`,
      params
    );
    const totalCount = Number(countRows[0]?.total || 0);

    const rows = await xamppQuery<OrderRow[]>(
      `SELECT ro.*,
              (SELECT COALESCE(SUM(roi.quantity), 0) FROM retail_order_items roi WHERE roi.order_id = ro.id) AS item_count
         FROM retail_orders ro
        WHERE ${whereSql}
        ORDER BY ro.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return {
      orders: rows.map((r) => this.mapOrder(r)),
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }

  public static async getOrderStats(context: TenantContext): Promise<RetailOrderStats> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "view_retail_orders");

    const rows = await xamppQuery<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) AS requested_orders,
         SUM(CASE WHEN status IN ('confirmed', 'preparing', 'ready') THEN 1 ELSE 0 END) AS in_progress_orders,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
         COALESCE(SUM(CASE WHEN status = 'requested' THEN subtotal_cents ELSE 0 END), 0) AS requested_subtotal_cents,
         COALESCE(SUM(CASE WHEN status IN ('confirmed', 'preparing', 'ready', 'completed') THEN total_cents ELSE 0 END), 0) AS confirmed_total_cents
       FROM retail_orders
      WHERE tenant_id = ?`,
      [context.tenantId]
    );

    const row = rows[0] || {};
    return {
      totalOrders: Number(row.total_orders || 0),
      requestedOrders: Number(row.requested_orders || 0),
      inProgressOrders: Number(row.in_progress_orders || 0),
      completedOrders: Number(row.completed_orders || 0),
      cancelledOrders: Number(row.cancelled_orders || 0),
      requestedSubtotalCents: Number(row.requested_subtotal_cents || 0),
      confirmedTotalCents: Number(row.confirmed_total_cents || 0),
    };
  }

  public static async getOrderById(
    context: TenantContext,
    orderId: string
  ): Promise<RetailOrderWithDetails> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "view_retail_orders");

    const orders = await xamppQuery<OrderRow[]>(
      `SELECT * FROM retail_orders WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [orderId, context.tenantId]
    );
    if (!orders[0]) {
      throw new NotFoundError("Pedido não encontrado para este estabelecimento.");
    }

    const [items, history] = await Promise.all([
      xamppQuery<OrderItemRow[]>(
        `SELECT * FROM retail_order_items WHERE order_id = ? AND tenant_id = ? ORDER BY created_at ASC`,
        [orderId, context.tenantId]
      ),
      xamppQuery<OrderHistoryRow[]>(
        `SELECT * FROM retail_order_status_history WHERE order_id = ? AND tenant_id = ? ORDER BY created_at ASC`,
        [orderId, context.tenantId]
      ),
    ]);

    return {
      ...this.mapOrder(orders[0]),
      items: items.map((i) => this.mapOrderItem(i)),
      history: history.map((h) => this.mapOrderHistory(h)),
    };
  }

  public static async confirmOrder(params: {
    context: TenantContext;
    orderId: string;
    actorName: string;
    reason?: string;
  }): Promise<RetailOrder> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(params.context.role, "manage_retail_orders");

    return withXamppTransaction(async (conn) => {
      const [orderRows] = await conn.execute<OrderRow[]>(
        `SELECT * FROM retail_orders WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [params.orderId, params.context.tenantId]
      );
      const order = orderRows[0];
      if (!order) {
        throw new NotFoundError("Pedido não encontrado.");
      }

      OrderInvariants.assertValidTransition(order.status, "confirmed");

      const [storeRows] = await conn.execute<StoreActiveRow[]>(
        `SELECT id, inventory_mode FROM retail_stores WHERE id = ? AND tenant_id = ? LIMIT 1`,
        [order.store_id, params.context.tenantId]
      );
      const shouldDeduct = (storeRows[0]?.inventory_mode || "track_quantity") === "track_quantity";

      if (shouldDeduct && !Boolean(order.stock_deducted)) {
        const [items] = await conn.execute<OrderItemRow[]>(
          `SELECT * FROM retail_order_items WHERE order_id = ? AND tenant_id = ? ORDER BY variant_id ASC`,
          [order.id, params.context.tenantId]
        );

        for (const item of items) {
          if (!item.variant_id) {
            throw new ConflictError(
              `A variante do item "${item.product_name_snapshot}" (${item.sku_snapshot}) não existe mais.`
            );
          }

          const [variantRows] = await conn.execute<VariantCheckRow[]>(
            `SELECT rv.id, rv.product_id, rp.name AS product_name, rp.status AS product_status,
                    rv.name AS variant_name, rv.sku, rv.price_cents, rv.stock_quantity, rv.is_available
               FROM retail_variants rv
               INNER JOIN retail_products rp ON rp.id = rv.product_id AND rp.tenant_id = rv.tenant_id
              WHERE rv.id = ? AND rv.tenant_id = ?
              LIMIT 1
              FOR UPDATE`,
            [item.variant_id, params.context.tenantId]
          );

          const variant = variantRows[0];
          if (!variant || variant.product_status !== "published" || !Boolean(variant.is_available)) {
            throw new ConflictError(
              `O produto "${item.product_name_snapshot}" (${item.variant_name_snapshot}) encontra-se indisponível para confirmação.`
            );
          }

          if (Number(variant.stock_quantity) < Number(item.quantity)) {
            throw new ConflictError(
              `Estoque insuficiente para confirmar "${item.product_name_snapshot}" (${item.variant_name_snapshot}): disponível ${variant.stock_quantity}, necessário ${item.quantity}.`
            );
          }

          await conn.execute(
            `UPDATE retail_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND tenant_id = ?`,
            [item.quantity, variant.id, params.context.tenantId]
          );
        }
      }

      await conn.execute(
        `UPDATE retail_orders
            SET status = 'confirmed',
                stock_deducted = ?,
                confirmed_at = NOW()
          WHERE id = ? AND tenant_id = ?`,
        [shouldDeduct ? 1 : Number(order.stock_deducted), order.id, params.context.tenantId]
      );

      await conn.execute(
        `INSERT INTO retail_order_status_history (
          id, order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
        ) VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
        [
          randomUUID(),
          order.id,
          params.context.tenantId,
          order.status,
          params.context.userId,
          params.actorName,
          params.reason || "Pedido confirmado pela loja",
        ]
      );

      const [updatedRows] = await conn.execute<OrderRow[]>(
        `SELECT * FROM retail_orders WHERE id = ? LIMIT 1`,
        [order.id]
      );
      return this.mapOrder(updatedRows[0]);
    });
  }

  public static async cancelOrder(params: {
    context: TenantContext;
    orderId: string;
    actorName: string;
    reason?: string;
  }): Promise<RetailOrder> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(params.context.role, "manage_retail_orders");

    return withXamppTransaction(async (conn) => {
      const [orderRows] = await conn.execute<OrderRow[]>(
        `SELECT * FROM retail_orders WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [params.orderId, params.context.tenantId]
      );
      const order = orderRows[0];
      if (!order) {
        throw new NotFoundError("Pedido não encontrado.");
      }

      OrderInvariants.assertValidTransition(order.status, "cancelled");

      if (Boolean(order.stock_deducted)) {
        const [items] = await conn.execute<OrderItemRow[]>(
          `SELECT * FROM retail_order_items WHERE order_id = ? AND tenant_id = ? ORDER BY variant_id ASC`,
          [order.id, params.context.tenantId]
        );

        for (const item of items) {
          if (!item.variant_id) continue;
          await conn.execute(
            `UPDATE retail_variants SET stock_quantity = stock_quantity + ? WHERE id = ? AND tenant_id = ?`,
            [item.quantity, item.variant_id, params.context.tenantId]
          );
        }
      }

      const finalReason = params.reason?.trim() || "Cancelado pela equipe da loja";

      await conn.execute(
        `UPDATE retail_orders
            SET status = 'cancelled',
                stock_deducted = 0,
                cancelled_at = NOW(),
                cancellation_reason = ?
          WHERE id = ? AND tenant_id = ?`,
        [finalReason, order.id, params.context.tenantId]
      );

      await conn.execute(
        `INSERT INTO retail_order_status_history (
          id, order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
        ) VALUES (?, ?, ?, ?, 'cancelled', ?, ?, ?)`,
        [
          randomUUID(),
          order.id,
          params.context.tenantId,
          order.status,
          params.context.userId,
          params.actorName,
          finalReason,
        ]
      );

      const [updatedRows] = await conn.execute<OrderRow[]>(
        `SELECT * FROM retail_orders WHERE id = ? LIMIT 1`,
        [order.id]
      );
      return this.mapOrder(updatedRows[0]);
    });
  }

  public static async updateOrderStatus(params: {
    context: TenantContext;
    orderId: string;
    nextStatus: RetailOrderStatus;
    actorName: string;
    reason?: string;
  }): Promise<RetailOrder> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(params.context.role, "manage_retail_orders");

    if (params.nextStatus === "confirmed") {
      return this.confirmOrder(params);
    }
    if (params.nextStatus === "cancelled") {
      return this.cancelOrder(params);
    }

    return withXamppTransaction(async (conn) => {
      const [orderRows] = await conn.execute<OrderRow[]>(
        `SELECT * FROM retail_orders WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [params.orderId, params.context.tenantId]
      );
      const order = orderRows[0];
      if (!order) {
        throw new NotFoundError("Pedido não encontrado.");
      }

      OrderInvariants.assertValidTransition(order.status, params.nextStatus);

      await conn.execute(
        `UPDATE retail_orders
            SET status = ?,
                completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE completed_at END
          WHERE id = ? AND tenant_id = ?`,
        [params.nextStatus, params.nextStatus, order.id, params.context.tenantId]
      );

      await conn.execute(
        `INSERT INTO retail_order_status_history (
          id, order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          order.id,
          params.context.tenantId,
          order.status,
          params.nextStatus,
          params.context.userId,
          params.actorName,
          params.reason?.trim() || null,
        ]
      );

      const [updatedRows] = await conn.execute<OrderRow[]>(
        `SELECT * FROM retail_orders WHERE id = ? LIMIT 1`,
        [order.id]
      );
      return this.mapOrder(updatedRows[0]);
    });
  }
}
