import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import { AuditService } from "@/core/audit/services/audit-service";
import { RATE_LIMIT_POLICIES, RateLimitService } from "@/core/security/rate-limit-service";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/core/errors/app-error";
import { XamppRetailOrderAdapter } from "@/infrastructure/xampp-test/retail-order-adapter";
import { OrderInvariants } from "../domain/order-invariants";
import { RetailPermissionService } from "../permissions/retail-permissions";
import {
  createPublicOrderSchema,
  updateOrderStatusSchema,
  type UpdateOrderStatusInput,
} from "../schemas/order.schema";
import type {
  PublicOrderTrackingView,
  RetailOrder,
  RetailOrderItem,
  RetailOrderStats,
  RetailOrderStatus,
  RetailOrderStatusHistoryEntry,
  RetailOrderWithDetails,
  RetailOrdersFilter,
  RetailOrdersListResult,
} from "../types/retail.types";
import {
  clearStoreCartToken,
  generateOpaqueToken,
  hashOpaqueToken,
  readStoreCartToken,
  verifyOpaqueTokenHash,
} from "./retail-cart-cookie";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;
type OrderRow = Database["public"]["Tables"]["retail_orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["retail_order_items"]["Row"];
type OrderHistoryRow = Database["public"]["Tables"]["retail_order_status_history"]["Row"];

function mapOrderRow(row: OrderRow, itemCount?: number): RetailOrder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    storeId: row.store_id,
    cartId: row.cart_id,
    orderNumber: row.order_number,
    status: row.status as RetailOrderStatus,
    stockDeducted: row.stock_deducted,
    channel: row.channel as RetailOrder["channel"],
    currency: row.currency,
    subtotalCents: row.subtotal_cents,
    totalCents: row.total_cents,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    deliveryMode: row.delivery_mode as RetailOrder["deliveryMode"],
    deliveryAddress: row.delivery_address,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    idempotencyKey: row.idempotency_key,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount,
  };
}

function mapOrderItemRow(row: OrderItemRow): RetailOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    tenantId: row.tenant_id,
    productId: row.product_id,
    variantId: row.variant_id,
    productNameSnapshot: row.product_name_snapshot,
    variantNameSnapshot: row.variant_name_snapshot,
    skuSnapshot: row.sku_snapshot,
    unitPriceCents: row.unit_price_cents,
    quantity: row.quantity,
    lineTotalCents: row.line_total_cents,
    imageUrlSnapshot: row.image_url_snapshot,
    createdAt: row.created_at,
  };
}

function mapHistoryRow(row: OrderHistoryRow): RetailOrderStatusHistoryEntry {
  return {
    id: row.id,
    orderId: row.order_id,
    tenantId: row.tenant_id,
    fromStatus: row.from_status as RetailOrderStatus | null,
    toStatus: row.to_status as RetailOrderStatus,
    changedByUserId: row.changed_by_user_id,
    changedByNameSnapshot: row.changed_by_name_snapshot,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function translateRpcError(err: { message?: string } | null): Error {
  const msg = err?.message || "";
  if (msg.includes("INSUFFICIENT_STOCK:")) {
    return new ConflictError(msg.replace(/^.*INSUFFICIENT_STOCK:\s*/i, ""));
  }
  if (msg.includes("VARIANT_UNAVAILABLE:")) {
    return new ConflictError(msg.replace(/^.*VARIANT_UNAVAILABLE:\s*/i, ""));
  }
  if (msg.includes("INVALID_TRANSITION:")) {
    return new ValidationError(msg.replace(/^.*INVALID_TRANSITION:\s*/i, ""));
  }
  if (msg.includes("CART_EMPTY:") || msg.includes("CART_EXPIRED:") || msg.includes("INVALID_QUANTITY:") || msg.includes("INVALID_PRICE:")) {
    return new ValidationError(msg.replace(/^.*?(CART_EMPTY|CART_EXPIRED|INVALID_QUANTITY|INVALID_PRICE):\s*/i, ""));
  }
  if (msg.includes("STORE_UNAVAILABLE:") || msg.includes("ORDER_NOT_FOUND:")) {
    return new NotFoundError(msg.replace(/^.*?(STORE_UNAVAILABLE|ORDER_NOT_FOUND):\s*/i, ""));
  }
  if (msg.includes("TENANT_SUSPENDED:")) {
    return new ConflictError(msg.replace(/^.*TENANT_SUSPENDED:\s*/i, ""));
  }
  if (msg.includes("FORBIDDEN:")) {
    return new ForbiddenError(msg.replace(/^.*FORBIDDEN:\s*/i, ""));
  }
  return new Error(msg || "Não foi possível processar a atualização do pedido.");
}

export class RetailOrderService {
  /**
   * Cria solicitação pública de pedido a partir do carrinho persistente da loja.
   * Nunca debita estoque neste momento (estado inicial: `requested`).
   * Nunca processa pagamento.
   */
  public static async createPublicOrder(params: {
    supabase: AppSupabaseClient;
    storeSlug: string;
    rawInput: unknown;
    rateLimitKey?: string;
  }): Promise<{
    order: RetailOrder;
    publicToken: string;
    storeName: string;
    storeSlug: string;
    contactPhone: string | null;
    deduplicated: boolean;
  }> {
    const parsed = createPublicOrderSchema.safeParse(params.rawInput);
    if (!parsed.success) {
      throw new ValidationError(
        "Revise os campos do formulário antes de enviar o pedido.",
        parsed.error.flatten().fieldErrors
      );
    }

    const rawToken = await readStoreCartToken(params.storeSlug);
    const limiterId = params.rateLimitKey || `${params.storeSlug}:${rawToken || parsed.data.customerPhone}`;
    await RateLimitService.assertNotBlocked(RATE_LIMIT_POLICIES.retailOrderCheckout, limiterId);
    await RateLimitService.consumeOrThrow(RATE_LIMIT_POLICIES.retailOrderCheckout, limiterId);

    if (isXamppTestMode()) {
      const res = await XamppRetailOrderAdapter.createPublicOrder({
        storeSlug: params.storeSlug,
        rawCartToken: rawToken,
        input: parsed.data,
      });

      if (!res.deduplicated) {
        await clearStoreCartToken(params.storeSlug);
        await AuditService.recordEvent({
          supabase: params.supabase,
          tenantId: res.order.tenantId,
          actorUserId: null,
          action: "retail.order_requested",
          resourceType: "retail_order",
          resourceId: res.order.id,
          metadata: {
            orderNumber: res.order.orderNumber,
            deliveryMode: res.order.deliveryMode,
            subtotalCents: res.order.subtotalCents,
          },
        });
      }
      return res;
    }

    if (!rawToken) {
      throw new ValidationError("Sua sacola está vazia. Adicione itens antes de finalizar o pedido.");
    }

    const adminClient = createAdminClient();
    const orderNumber = OrderInvariants.generateOrderNumber(randomBytes(8).toString("hex"));
    const publicToken = generateOpaqueToken(24);

    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "create_public_retail_order",
      {
        p_store_slug: params.storeSlug,
        p_cart_token_hash: hashOpaqueToken(rawToken),
        p_order_number: orderNumber,
        p_public_token_hash: hashOpaqueToken(publicToken),
        p_customer_name: parsed.data.customerName,
        p_customer_phone: parsed.data.customerPhone,
        p_customer_email: parsed.data.customerEmail || undefined,
        p_delivery_mode: parsed.data.deliveryMode,
        p_delivery_address:
          parsed.data.deliveryMode === "delivery" ? parsed.data.deliveryAddress || undefined : undefined,
        p_notes: parsed.data.notes || undefined,
        p_idempotency_key: parsed.data.idempotencyKey || undefined,
      }
    );

    if (rpcError || !rpcResult) {
      throw translateRpcError(rpcError);
    }

    const payload = rpcResult as unknown as {
      deduplicated: boolean;
      order: OrderRow;
      storeName: string;
      storeSlug: string;
      contactPhone: string | null;
      itemCount: number;
    };

    const mappedOrder = mapOrderRow(payload.order, payload.itemCount);

    if (!payload.deduplicated) {
      await clearStoreCartToken(params.storeSlug);

      await AuditService.recordEvent({
        supabase: adminClient,
        tenantId: mappedOrder.tenantId,
        actorUserId: null,
        action: "retail.order_requested",
        resourceType: "retail_order",
        resourceId: mappedOrder.id,
        metadata: {
          orderNumber: mappedOrder.orderNumber,
          deliveryMode: mappedOrder.deliveryMode,
          subtotalCents: mappedOrder.subtotalCents,
          itemCount: payload.itemCount,
        },
      });
    }

    return {
      order: mappedOrder,
      publicToken,
      storeName: payload.storeName,
      storeSlug: payload.storeSlug || params.storeSlug,
      contactPhone: payload.contactPhone,
      deduplicated: Boolean(payload.deduplicated),
    };
  }

  /**
   * Consulta pública segura da confirmação de pedido mediante posse do token opaco de acesso.
   */
  public static async getPublicOrderTracking(params: {
    storeSlug: string;
    orderNumber: string;
    publicToken: string;
  }): Promise<PublicOrderTrackingView | null> {
    if (!params.publicToken || params.publicToken.length < 16) {
      return null;
    }

    if (isXamppTestMode()) {
      return XamppRetailOrderAdapter.getPublicOrderTracking(params);
    }

    const adminClient = createAdminClient();
    const { data: store } = await adminClient
      .from("retail_stores")
      .select("id, tenant_id, store_name, slug, contact_email, contact_phone, is_active")
      .eq("slug", params.storeSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (!store) return null;

    const { data: tenant } = await adminClient
      .from("tenants")
      .select("status")
      .eq("id", store.tenant_id)
      .maybeSingle();
    if (!tenant || tenant.status !== "active") return null;

    const { data: order } = await adminClient
      .from("retail_orders")
      .select("*")
      .eq("tenant_id", store.tenant_id)
      .eq("store_id", store.id)
      .eq("order_number", params.orderNumber)
      .maybeSingle();

    if (!order || !verifyOpaqueTokenHash(params.publicToken, order.public_token_hash)) {
      return null;
    }

    const { data: items } = await adminClient
      .from("retail_order_items")
      .select("*")
      .eq("order_id", order.id)
      .eq("tenant_id", store.tenant_id)
      .order("created_at", { ascending: true });

    return {
      orderNumber: order.order_number,
      status: order.status as RetailOrderStatus,
      currency: order.currency,
      subtotalCents: order.subtotal_cents,
      totalCents: order.total_cents,
      customerName: order.customer_name,
      deliveryMode: order.delivery_mode as RetailOrder["deliveryMode"],
      hasDeliveryAddress: Boolean(order.delivery_address),
      notes: order.notes,
      createdAt: order.created_at,
      confirmedAt: order.confirmed_at,
      cancelledAt: order.cancelled_at,
      items: (items || []).map(mapOrderItemRow),
      storeName: store.store_name,
      storeSlug: store.slug || params.storeSlug,
      contactEmail: store.contact_email,
      contactPhone: store.contact_phone,
    };
  }

  public static async listOrders(
    supabase: AppSupabaseClient,
    context: TenantContext,
    filter: RetailOrdersFilter = {}
  ): Promise<RetailOrdersListResult> {
    RetailPermissionService.assertPermission(context.role, "view_retail_orders");

    if (isXamppTestMode()) {
      return XamppRetailOrderAdapter.listOrders(context, filter);
    }

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(50, Math.max(1, filter.pageSize || 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("retail_orders")
      .select("*", { count: "exact" })
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filter.status && filter.status !== "all") {
      query = query.eq("status", filter.status);
    }

    if (filter.search?.trim()) {
      const q = filter.search.trim().replace(/[%_,]/g, "");
      query = query.or(
        `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`
      );
    }

    const { data, error, count } = await query;
    if (error) {
      throw new Error("Não foi possível consultar a lista de pedidos.");
    }

    const rows = data || [];
    const orderIds = rows.map((r) => r.id);
    const itemCountMap = new Map<string, number>();

    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from("retail_order_items")
        .select("order_id, quantity")
        .eq("tenant_id", context.tenantId)
        .in("order_id", orderIds);

      for (const item of items || []) {
        itemCountMap.set(item.order_id, (itemCountMap.get(item.order_id) || 0) + item.quantity);
      }
    }

    const totalCount = count || 0;
    return {
      orders: rows.map((r) => mapOrderRow(r, itemCountMap.get(r.id) || 0)),
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }

  public static async getOrderStats(
    supabase: AppSupabaseClient,
    context: TenantContext
  ): Promise<RetailOrderStats> {
    RetailPermissionService.assertPermission(context.role, "view_retail_orders");

    if (isXamppTestMode()) {
      return XamppRetailOrderAdapter.getOrderStats(context);
    }

    const { data, error } = await supabase
      .from("retail_orders")
      .select("status, subtotal_cents, total_cents")
      .eq("tenant_id", context.tenantId);

    if (error) {
      throw new Error("Não foi possível consolidar métricas de pedidos.");
    }

    const stats: RetailOrderStats = {
      totalOrders: 0,
      requestedOrders: 0,
      inProgressOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      requestedSubtotalCents: 0,
      confirmedTotalCents: 0,
    };

    for (const row of data || []) {
      stats.totalOrders++;
      if (row.status === "requested") {
        stats.requestedOrders++;
        stats.requestedSubtotalCents += row.subtotal_cents;
      } else if (
        row.status === "confirmed" ||
        row.status === "preparing" ||
        row.status === "ready"
      ) {
        stats.inProgressOrders++;
        stats.confirmedTotalCents += row.total_cents;
      } else if (row.status === "completed") {
        stats.completedOrders++;
        stats.confirmedTotalCents += row.total_cents;
      } else if (row.status === "cancelled") {
        stats.cancelledOrders++;
      }
    }

    return stats;
  }

  public static async getOrderById(
    supabase: AppSupabaseClient,
    context: TenantContext,
    orderId: string
  ): Promise<RetailOrderWithDetails> {
    RetailPermissionService.assertPermission(context.role, "view_retail_orders");

    if (isXamppTestMode()) {
      return XamppRetailOrderAdapter.getOrderById(context, orderId);
    }

    const { data: order, error } = await supabase
      .from("retail_orders")
      .select("*")
      .eq("id", orderId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

    if (error || !order) {
      throw new NotFoundError("Pedido não encontrado neste estabelecimento.");
    }

    const [{ data: items }, { data: history }] = await Promise.all([
      supabase
        .from("retail_order_items")
        .select("*")
        .eq("order_id", order.id)
        .eq("tenant_id", context.tenantId)
        .order("created_at", { ascending: true }),
      supabase
        .from("retail_order_status_history")
        .select("*")
        .eq("order_id", order.id)
        .eq("tenant_id", context.tenantId)
        .order("created_at", { ascending: true }),
    ]);

    return {
      ...mapOrderRow(order),
      items: (items || []).map(mapOrderItemRow),
      history: (history || []).map(mapHistoryRow),
    };
  }

  public static async confirmOrder(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    orderId: string;
    actorName: string;
    reason?: string;
  }): Promise<RetailOrder> {
    RetailPermissionService.assertPermission(params.context.role, "manage_retail_orders");

    let updated: RetailOrder;
    if (isXamppTestMode()) {
      updated = await XamppRetailOrderAdapter.confirmOrder(params);
    } else {
      const { data, error } = await params.supabase.rpc("confirm_retail_order", {
        p_tenant_id: params.context.tenantId,
        p_order_id: params.orderId,
        p_actor_user_id: params.context.userId,
        p_actor_name: params.actorName,
        p_reason: params.reason,
      });
      if (error || !data) {
        throw translateRpcError(error);
      }
      updated = mapOrderRow(data);
    }

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      action: "retail.order_confirmed",
      resourceType: "retail_order",
      resourceId: updated.id,
      metadata: {
        orderNumber: updated.orderNumber,
        stockDeducted: updated.stockDeducted,
        totalCents: updated.totalCents,
      },
    });

    return updated;
  }

  public static async cancelOrder(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    orderId: string;
    actorName: string;
    reason?: string;
  }): Promise<RetailOrder> {
    RetailPermissionService.assertPermission(params.context.role, "manage_retail_orders");

    let updated: RetailOrder;
    if (isXamppTestMode()) {
      updated = await XamppRetailOrderAdapter.cancelOrder(params);
    } else {
      const { data, error } = await params.supabase.rpc("cancel_retail_order", {
        p_tenant_id: params.context.tenantId,
        p_order_id: params.orderId,
        p_actor_user_id: params.context.userId,
        p_actor_name: params.actorName,
        p_reason: params.reason || "Cancelado pela equipe da loja",
      });
      if (error || !data) {
        throw translateRpcError(error);
      }
      updated = mapOrderRow(data);
    }

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      action: "retail.order_cancelled",
      resourceType: "retail_order",
      resourceId: updated.id,
      metadata: {
        orderNumber: updated.orderNumber,
        reason: updated.cancellationReason,
      },
    });

    return updated;
  }

  public static async updateOrderStatus(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    orderId: string;
    actorName: string;
    rawInput: UpdateOrderStatusInput;
  }): Promise<RetailOrder> {
    RetailPermissionService.assertPermission(params.context.role, "manage_retail_orders");

    const parsed = updateOrderStatusSchema.safeParse(params.rawInput);
    if (!parsed.success) {
      throw new ValidationError("Dados inválidos para atualizar status.", parsed.error.flatten().fieldErrors);
    }

    if (parsed.data.nextStatus === "confirmed") {
      return this.confirmOrder({
        supabase: params.supabase,
        context: params.context,
        orderId: params.orderId,
        actorName: params.actorName,
        reason: parsed.data.reason,
      });
    }

    if (parsed.data.nextStatus === "cancelled") {
      return this.cancelOrder({
        supabase: params.supabase,
        context: params.context,
        orderId: params.orderId,
        actorName: params.actorName,
        reason: parsed.data.reason,
      });
    }

    let updated: RetailOrder;
    let previousStatus: RetailOrderStatus;

    if (isXamppTestMode()) {
      const before = await XamppRetailOrderAdapter.getOrderById(params.context, params.orderId);
      previousStatus = before.status;
      updated = await XamppRetailOrderAdapter.updateOrderStatus({
        context: params.context,
        orderId: params.orderId,
        nextStatus: parsed.data.nextStatus,
        actorName: params.actorName,
        reason: parsed.data.reason,
      });
    } else {
      const current = await this.getOrderById(params.supabase, params.context, params.orderId);
      previousStatus = current.status;
      OrderInvariants.assertValidTransition(current.status, parsed.data.nextStatus);

      const { data: updatedRow, error } = await params.supabase.rpc(
        "transition_retail_order_status",
        {
          p_tenant_id: params.context.tenantId,
          p_order_id: params.orderId,
          p_next_status: parsed.data.nextStatus,
          p_actor_user_id: params.context.userId,
          p_actor_name: params.actorName,
          p_reason: parsed.data.reason,
        }
      );

      if (error || !updatedRow) {
        throw translateRpcError(error);
      }

      updated = mapOrderRow(updatedRow);
    }

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      action: "retail.order_status_updated",
      resourceType: "retail_order",
      resourceId: updated.id,
      metadata: {
        orderNumber: updated.orderNumber,
        fromStatus: previousStatus,
        toStatus: updated.status,
      },
    });

    return updated;
  }
}
