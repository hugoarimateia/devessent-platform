import { createHash, randomBytes } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import type { RoleOrAdmin } from "@/core/permissions/policies/role-matrix";
import { AuditService } from "@/core/audit/services/audit-service";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors/app-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import { RetailPermissionService } from "../permissions/retail-permissions";
import {
  computeStatsFromPayments,
  PaymentInvariants,
} from "../domain/payment-invariants";
import {
  connectPaymentAccountSchema,
  initiatePaymentSessionSchema,
  requestPaymentRefundSchema,
  setOrderShippingFeeSchema,
  type ConnectPaymentAccountInput,
  type InitiatePaymentSessionInput,
  type RequestPaymentRefundInput,
  type SetOrderShippingFeeInput,
} from "../schemas/payment.schema";
import {
  decryptPaymentSecret,
  encryptPaymentSecret,
  MercadoPagoSandboxProvider,
  XamppSandboxPaymentProvider,
  buildMercadoPagoWebhookSignature,
  type RetailPaymentProvider,
} from "../payments";
import type {
  PublicOrderPaymentShareView,
  PublicOrderTrackingView,
  RetailOrder,
  RetailPayment,
  RetailPaymentAttempt,
  RetailPaymentConnectionStatus,
  RetailPaymentConnectionSummary,
  RetailPaymentEnvironment,
  RetailPaymentEvent,
  RetailPaymentMethod,
  RetailPaymentProviderName,
  RetailPaymentStats,
  RetailPaymentStatus,
  RetailPaymentWithDetails,
  RetailPaymentsFilter,
  RetailPaymentsListResult,
} from "../types/retail.types";
import { RetailOrderService } from "./retail-order-service";

async function loadXamppRetailPaymentAdapter() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("VIOLAÇÃO DE AMBIENTE: Adaptador XAMPP proibido em produção.");
  }
  const { XamppRetailPaymentAdapter } = await import(
    "@/infrastructure/xampp-test/retail-payment-adapter"
  );
  return XamppRetailPaymentAdapter;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

type PaymentRow = Database["public"]["Tables"]["retail_payments"]["Row"];
type AttemptRow = Database["public"]["Tables"]["retail_payment_attempts"]["Row"];
type EventRow = Database["public"]["Tables"]["retail_payment_events"]["Row"];

const mpProviderInstance = new MercadoPagoSandboxProvider();
const xamppProviderInstance = new XamppSandboxPaymentProvider();

function getProviderImplementation(provider: RetailPaymentProviderName): RetailPaymentProvider {
  if (provider === "xampp_sandbox") {
    return xamppProviderInstance;
  }
  return mpProviderInstance;
}

function hashOpaqueToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim()).digest("hex");
}

function generateOpaqueShareToken(): string {
  return randomBytes(32).toString("base64url");
}

function mapPaymentRow(
  row: PaymentRow,
  extra?: { orderNumber?: string; customerName?: string }
): RetailPayment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    storeId: row.store_id,
    orderId: row.order_id,
    orderNumber: extra?.orderNumber,
    customerNameMinimized: extra?.customerName
      ? PaymentInvariants.minimizeCustomerName(extra.customerName)
      : undefined,
    connectionId: row.connection_id,
    provider: row.provider as RetailPaymentProviderName,
    environment: row.environment as RetailPaymentEnvironment,
    externalPaymentId: row.external_payment_id,
    externalPreferenceId: row.external_preference_id,
    externalReference: row.external_reference,
    sellerAccountId: row.seller_account_id,
    currency: row.currency,
    amountCents: row.amount_cents,
    refundedAmountCents: row.refunded_amount_cents,
    status: row.status as RetailPaymentStatus,
    paymentMethod: (row.payment_method as RetailPaymentMethod | null) ?? null,
    paymentMethodLabel: row.payment_method_label,
    checkoutUrl: row.checkout_url,
    idempotencyKey: row.idempotency_key,
    payerEmailMasked: row.payer_email_masked,
    divergenceAlert: row.divergence_alert,
    approvedAt: row.approved_at,
    failedAt: row.failed_at,
    expiredAt: row.expired_at,
    cancelledAt: row.cancelled_at,
    refundedAt: row.refunded_at,
    lastReconciledAt: row.last_reconciled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttemptRow(row: AttemptRow): RetailPaymentAttempt {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    storeId: row.store_id,
    orderId: row.order_id,
    paymentId: row.payment_id,
    attemptNumber: row.attempt_number,
    provider: row.provider as RetailPaymentProviderName,
    externalAttemptId: row.external_attempt_id,
    externalPaymentId: row.external_payment_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status as RetailPaymentAttempt["status"],
    paymentMethod: row.payment_method,
    checkoutUrl: row.checkout_url,
    idempotencyKey: row.idempotency_key,
    failureCode: row.failure_code,
    failureReason: row.failure_reason,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEventRow(row: EventRow): RetailPaymentEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    storeId: row.store_id,
    orderId: row.order_id,
    paymentId: row.payment_id,
    provider: row.provider as RetailPaymentProviderName,
    externalEventId: row.external_event_id,
    eventType: row.event_type,
    signatureVerified: row.signature_verified,
    processingStatus: row.processing_status as RetailPaymentEvent["processingStatus"],
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    amountCents: row.amount_cents,
    currency: row.currency,
    payloadSummary:
      row.payload_summary &&
      typeof row.payload_summary === "object" &&
      !Array.isArray(row.payload_summary)
        ? (row.payload_summary as Record<string, unknown>)
        : {},
    errorMessage: row.error_message,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}

function translatePaymentRpcError(message: string): never {
  if (message.includes("FORBIDDEN")) {
    throw new ForbiddenError("Você não possui permissão para realizar esta operação financeira.");
  }
  if (message.includes("ORDER_NOT_FOUND")) {
    throw new NotFoundError("Pedido comercial não localizado.");
  }
  if (message.includes("PAYMENT_NOT_FOUND")) {
    throw new NotFoundError("Registro de pagamento não localizado.");
  }
  if (message.includes("GATEWAY_NOT_CONNECTED")) {
    throw new ValidationError(
      "A loja não possui conta de recebimento sandbox ativa configurada pela DevEssent."
    );
  }
  if (message.includes("SELLER_ACCOUNT_MISMATCH")) {
    throw new ForbiddenError("A conta recebedora informada diverge da conta vinculada à loja.");
  }
  if (message.includes("ORDER_NOT_CONFIRMED")) {
    throw new ConflictError(
      "O pedido precisa estar confirmado pela loja antes de iniciar o pagamento online."
    );
  }
  if (message.includes("ORDER_ALREADY_PAID")) {
    throw new ConflictError("Este pedido já possui pagamento confirmado.");
  }
  if (message.includes("UNDETERMINED_SHIPPING")) {
    throw new ValidationError(
      "O valor do frete para entrega ainda não foi definido pela loja. Defina o frete antes de liberar o pagamento."
    );
  }
  if (message.includes("INVALID_ORDER_TOTAL") || message.includes("INVALID_TOTAL")) {
    throw new ValidationError("O total financeiro do pedido é inválido ou inconsistente.");
  }
  if (message.includes("PAYMENT_LOCKED")) {
    throw new ConflictError(
      "Não é possível alterar o frete de um pedido com pagamento em processamento ou já pago."
    );
  }
  if (message.includes("INVALID_TRANSITION")) {
    throw new ConflictError("Transição inválida para o estado atual do pedido.");
  }
  if (message.includes("INVALID_REFUND_STATE")) {
    throw new ConflictError("Apenas pagamentos confirmados podem receber estorno.");
  }
  if (message.includes("INVALID_REFUND_AMOUNT")) {
    throw new ValidationError("O valor solicitado para estorno excede o saldo pago disponível.");
  }
  throw new ValidationError(`Falha na transação financeira: ${message}`);
}

interface InternalDecryptedConnection {
  id: string;
  tenantId: string;
  storeId: string;
  provider: RetailPaymentProviderName;
  environment: RetailPaymentEnvironment;
  status: RetailPaymentConnectionStatus;
  sellerAccountId: string;
  sellerAccountLabel: string;
  accessToken: string;
  webhookSecret: string;
}

export class RetailPaymentService {
  /**
   * 1. Resumo seguro da conexão de pagamento do tenant (sem expor tokens/secrets)
   */
  public static async getConnectionSummary(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
  }): Promise<RetailPaymentConnectionSummary> {
    if (!RetailPermissionService.hasPermission(params.context.role, "view_retail_payments")) {
      throw new ForbiddenError("Seu papel não possui acesso ao módulo financeiro.");
    }

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      return XamppRetailPaymentAdapter.getConnectionSummary(params.context);
    }

    const { data, error } = await params.supabase.rpc(
      "get_retail_payment_connection_summary",
      {
        p_tenant_id: params.context.tenantId,
      }
    );

    if (error) {
      translatePaymentRpcError(error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        id: null,
        tenantId: params.context.tenantId,
        storeId: "",
        provider: "mercado_pago",
        environment: "sandbox",
        status: "disconnected",
        sellerAccountId: null,
        sellerAccountLabel: null,
        publicKey: null,
        tokenExpiresAt: null,
        connectedAt: null,
        disconnectedAt: null,
        lastVerifiedAt: null,
      };
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      storeId: row.store_id ?? "",
      provider: row.provider as RetailPaymentProviderName,
      environment: row.environment as RetailPaymentEnvironment,
      status: row.status as RetailPaymentConnectionStatus,
      sellerAccountId: row.seller_account_id,
      sellerAccountLabel: row.seller_account_label,
      publicKey: row.public_key,
      tokenExpiresAt: row.token_expires_at,
      connectedAt: row.connected_at,
      disconnectedAt: row.disconnected_at,
      lastVerifiedAt: row.last_verified_at,
    };
  }

  /**
   * 2. Conectar conta de pagamento sandbox do lojista (Exclusivo Platform Admin / DevEssent)
   */
  public static async connectSellerAccount(params: {
    supabase: AppSupabaseClient;
    actorUserId: string;
    actorRole: RoleOrAdmin;
    rawInput: ConnectPaymentAccountInput;
  }): Promise<RetailPaymentConnectionSummary> {
    if (!RetailPermissionService.hasPermission(params.actorRole, "manage_payment_connections")) {
      throw new ForbiddenError(
        "Apenas a equipe técnica da DevEssent (Platform Admin) pode configurar credenciais de gateway."
      );
    }

    const parsed = connectPaymentAccountSchema.parse(params.rawInput);
    PaymentInvariants.assertSandboxOnlyMode(parsed.environment, parsed.accessToken);
    PaymentInvariants.assertSandboxOnlyMode(parsed.environment, parsed.webhookSecret);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      const summary = await XamppRetailPaymentAdapter.connectSellerAccount({
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        input: parsed,
      });

      await AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: parsed.tenantId,
        actorUserId: params.actorUserId,
        action: "retail.payment_account_connected",
        resourceType: "retail_payment_connection",
        resourceId: parsed.tenantId,
        metadata: {
          provider: parsed.provider,
          environment: "sandbox",
          sellerAccountId: parsed.sellerAccountId,
          sellerAccountLabel: parsed.sellerAccountLabel,
        },
      });

      return summary;
    }

    const encryptedAccessToken = encryptPaymentSecret(parsed.accessToken, parsed.tenantId);
    const encryptedWebhookSecret = encryptPaymentSecret(
      parsed.webhookSecret,
      parsed.tenantId
    );
    const encryptedRefreshToken = parsed.refreshToken
      ? encryptPaymentSecret(parsed.refreshToken, parsed.tenantId)
      : null;

    const admin = createAdminClient();
    const { data: storeRow, error: storeErr } = await admin
      .from("retail_stores")
      .select("id")
      .eq("tenant_id", parsed.tenantId)
      .maybeSingle();

    if (storeErr || !storeRow) {
      throw new NotFoundError(
        "Loja Retail não encontrada para este estabelecimento. Inicialize o módulo Retail antes de conectar pagamentos."
      );
    }

    const nowIso = new Date().toISOString();
    const { data: upsertedRow, error: upsertErr } = await admin
      .from("retail_payment_connections")
      .upsert(
        {
          tenant_id: parsed.tenantId,
          store_id: storeRow.id,
          provider: parsed.provider,
          environment: "sandbox",
          status: "connected",
          seller_account_id: parsed.sellerAccountId,
          seller_account_label: parsed.sellerAccountLabel,
          public_key: parsed.publicKey ?? null,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          webhook_secret_encrypted: encryptedWebhookSecret,
          connected_by_user_id: params.actorUserId,
          connected_at: nowIso,
          disconnected_at: null,
          last_verified_at: nowIso,
        },
        { onConflict: "tenant_id" }
      )
      .select("id")
      .single();

    if (upsertErr) {
      throw new ValidationError(`Falha ao salvar conexão de pagamento: ${upsertErr.message}`);
    }

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: parsed.tenantId,
      actorUserId: params.actorUserId,
      action: "retail.payment_account_connected",
      resourceType: "retail_payment_connection",
      resourceId: parsed.tenantId,
      metadata: {
        provider: parsed.provider,
        environment: "sandbox",
        sellerAccountId: parsed.sellerAccountId,
        sellerAccountLabel: parsed.sellerAccountLabel,
      },
    });

    return {
      id: upsertedRow?.id ?? null,
      tenantId: parsed.tenantId,
      storeId: storeRow.id,
      provider: parsed.provider,
      environment: "sandbox",
      status: "connected",
      sellerAccountId: parsed.sellerAccountId,
      sellerAccountLabel: parsed.sellerAccountLabel,
      publicKey: parsed.publicKey ?? null,
      tokenExpiresAt: null,
      connectedAt: nowIso,
      disconnectedAt: null,
      lastVerifiedAt: nowIso,
    };
  }

  /**
   * 3. Desconectar conta de pagamento sandbox do lojista (Exclusivo Platform Admin)
   */
  public static async disconnectSellerAccount(params: {
    supabase: AppSupabaseClient;
    actorUserId: string;
    actorRole: RoleOrAdmin;
    tenantId: string;
  }): Promise<void> {
    if (!RetailPermissionService.hasPermission(params.actorRole, "manage_payment_connections")) {
      throw new ForbiddenError(
        "Apenas a equipe técnica da DevEssent (Platform Admin) pode desconectar credenciais de gateway."
      );
    }

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      await XamppRetailPaymentAdapter.disconnectSellerAccount({
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        tenantId: params.tenantId,
      });
      await AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: "retail.payment_account_disconnected",
        resourceType: "retail_payment_connection",
        resourceId: params.tenantId,
        metadata: { environment: "sandbox" },
      });
      return;
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("retail_payment_connections")
      .update({
        status: "disconnected",
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        webhook_secret_encrypted: null,
        disconnected_at: new Date().toISOString(),
      })
      .eq("tenant_id", params.tenantId);

    if (error) {
      throw new ValidationError(`Falha ao desconectar conta de pagamento: ${error.message}`);
    }

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: "retail.payment_account_disconnected",
      resourceType: "retail_payment_connection",
      resourceId: params.tenantId,
      metadata: { environment: "sandbox" },
    });
  }

  /**
   * 4. Definir frete determinístico de um pedido (obrigatório para delivery antes de pagar)
   */
  public static async setOrderShippingFee(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    actorName: string;
    rawInput: SetOrderShippingFeeInput;
  }): Promise<RetailOrder> {
    if (!RetailPermissionService.hasPermission(params.context.role, "manage_retail_payments")) {
      throw new ForbiddenError(
        "Seu papel não possui permissão para definir valores financeiros de pedidos."
      );
    }

    const parsed = setOrderShippingFeeSchema.parse(params.rawInput);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      const updated = await XamppRetailPaymentAdapter.setOrderShippingFee({
        context: params.context,
        orderId: parsed.orderId,
        shippingFeeCents: parsed.shippingFeeCents,
      });

      await AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: params.context.tenantId,
        actorUserId: params.context.userId,
        action: "retail.order_shipping_updated",
        resourceType: "retail_order",
        resourceId: parsed.orderId,
        metadata: {
          orderNumber: updated.orderNumber,
          shippingFeeCents: parsed.shippingFeeCents,
          totalCents: updated.totalCents,
        },
      });

      return updated;
    }

    const { error } = await params.supabase.rpc("set_retail_order_shipping_fee", {
      p_tenant_id: params.context.tenantId,
      p_order_id: parsed.orderId,
      p_shipping_fee_cents: parsed.shippingFeeCents,
      p_actor_user_id: params.context.userId,
      p_actor_name: params.actorName,
    });

    if (error) {
      translatePaymentRpcError(error.message);
    }

    const orderWithItems = await RetailOrderService.getOrderById(
      params.supabase,
      params.context,
      parsed.orderId
    );

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      action: "retail.order_shipping_updated",
      resourceType: "retail_order",
      resourceId: parsed.orderId,
      metadata: {
        orderNumber: orderWithItems.orderNumber,
        shippingFeeCents: parsed.shippingFeeCents,
        totalCents: orderWithItems.totalCents,
      },
    });

    return orderWithItems;
  }

  /**
   * 5. Gerar link público opaco de pagamento para o comprador (/loja/[slug]/pagamento/[shareToken])
   */
  public static async generateOrderPaymentShareLink(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    orderId: string;
  }): Promise<{ shareToken: string; sharePath: string; expiresAt: string }> {
    if (!RetailPermissionService.hasPermission(params.context.role, "manage_retail_payments")) {
      throw new ForbiddenError("Seu papel não possui permissão para emitir links de pagamento.");
    }

    const [order, connSummary] = await Promise.all([
      RetailOrderService.getOrderById(params.supabase, params.context, params.orderId),
      RetailPaymentService.getConnectionSummary({
        supabase: params.supabase,
        context: params.context,
      }),
    ]);

    const eligibility = PaymentInvariants.evaluateOrderPaymentEligibility(order, connSummary);
    if (!eligibility.eligible) {
      throw new ValidationError(
        eligibility.reason ?? "Este pedido não está elegível para pagamento online."
      );
    }

    const shareToken = generateOpaqueShareToken();
    const tokenHash = hashOpaqueToken(shareToken);
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      await XamppRetailPaymentAdapter.saveOrderPaymentShareToken({
        context: params.context,
        orderId: order.id,
        tokenHash,
        expiresAt,
      });

      const sharePath = `/loja/${params.context.slug}/pagamento/${shareToken}`;
      await AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: params.context.tenantId,
        actorUserId: params.context.userId,
        action: "retail.payment_share_link_generated",
        resourceType: "retail_order",
        resourceId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          expiresAt,
        },
      });

      return { shareToken, sharePath, expiresAt };
    }

    const admin = createAdminClient();
    const { data: storeRow } = await admin
      .from("retail_stores")
      .select("slug")
      .eq("id", order.storeId)
      .maybeSingle();

    const storeSlug = storeRow?.slug ?? params.context.slug;

    const { error: updateErr } = await admin
      .from("retail_orders")
      .update({
        payment_share_token_hash: tokenHash,
        payment_share_expires_at: expiresAt,
      })
      .eq("id", order.id)
      .eq("tenant_id", params.context.tenantId);

    if (updateErr) {
      throw new ValidationError(`Falha ao emitir link de pagamento: ${updateErr.message}`);
    }

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      action: "retail.payment_share_link_generated",
      resourceType: "retail_order",
      resourceId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        expiresAt,
      },
    });

    return {
      shareToken,
      sharePath: `/loja/${storeSlug}/pagamento/${shareToken}`,
      expiresAt,
    };
  }

  /**
   * 6. Consultar visão pública de link opaco de pagamento (escopo mínimo, zero PII sensível)
   */
  public static async getPublicPaymentShareView(params: {
    storeSlug: string;
    shareToken: string;
  }): Promise<PublicOrderPaymentShareView | null> {
    const cleanToken = params.shareToken.trim();
    if (cleanToken.length < 16) {
      return null;
    }

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      return XamppRetailPaymentAdapter.getPublicPaymentShareView({
        storeSlug: params.storeSlug,
        shareToken: cleanToken,
      });
    }

    const tokenHash = hashOpaqueToken(cleanToken);
    const admin = createAdminClient();

    const { data: storeRow } = await admin
      .from("retail_stores")
      .select("id, tenant_id, slug, store_name, is_active")
      .eq("slug", params.storeSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (!storeRow) {
      return null;
    }

    const { data: orderRow } = await admin
      .from("retail_orders")
      .select(
        "id, order_number, status, payment_status, delivery_mode, currency, subtotal_cents, shipping_fee_cents, discount_cents, total_cents, paid_amount_cents, refunded_amount_cents, customer_name, payment_share_expires_at"
      )
      .eq("store_id", storeRow.id)
      .eq("tenant_id", storeRow.tenant_id)
      .eq("payment_share_token_hash", tokenHash)
      .maybeSingle();

    if (!orderRow || !orderRow.payment_share_expires_at) {
      return null;
    }

    if (new Date(orderRow.payment_share_expires_at).getTime() <= Date.now()) {
      return null;
    }

    const [{ data: itemRows }, { data: connRow }, { data: paymentRow }] = await Promise.all([
      admin
        .from("retail_order_items")
        .select(
          "product_name_snapshot, variant_name_snapshot, quantity, unit_price_cents, line_total_cents"
        )
        .eq("order_id", orderRow.id)
        .eq("tenant_id", storeRow.tenant_id),
      admin
        .from("retail_payment_connections")
        .select("provider, environment, status, seller_account_id, seller_account_label")
        .eq("tenant_id", storeRow.tenant_id)
        .maybeSingle(),
      admin
        .from("retail_payments")
        .select("id, status, checkout_url")
        .eq("order_id", orderRow.id)
        .eq("tenant_id", storeRow.tenant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const eligibility = PaymentInvariants.evaluateOrderPaymentEligibility(
      {
        status: orderRow.status as RetailOrder["status"],
        paymentStatus: orderRow.payment_status as RetailPaymentStatus,
        deliveryMode: orderRow.delivery_mode as RetailOrder["deliveryMode"],
        subtotalCents: orderRow.subtotal_cents,
        shippingFeeCents: orderRow.shipping_fee_cents,
        discountCents: orderRow.discount_cents,
        totalCents: orderRow.total_cents,
        currency: orderRow.currency,
      },
      connRow
        ? {
            status: connRow.status as RetailPaymentConnectionStatus,
            environment: connRow.environment as RetailPaymentEnvironment,
            sellerAccountId: connRow.seller_account_id,
          }
        : null
    );

    return {
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      operationalStatus: orderRow.status as RetailOrder["status"],
      paymentStatus: orderRow.payment_status as RetailPaymentStatus,
      currency: orderRow.currency,
      subtotalCents: orderRow.subtotal_cents,
      shippingFeeCents: orderRow.shipping_fee_cents,
      discountCents: orderRow.discount_cents,
      totalCents: orderRow.total_cents,
      paidAmountCents: orderRow.paid_amount_cents,
      refundedAmountCents: orderRow.refunded_amount_cents,
      customerFirstName: PaymentInvariants.minimizeCustomerName(orderRow.customer_name),
      deliveryMode: orderRow.delivery_mode as RetailOrder["deliveryMode"],
      storeName: storeRow.store_name,
      storeSlug: storeRow.slug ?? params.storeSlug,
      receiverAccountLabel: connRow?.seller_account_label ?? storeRow.store_name,
      provider:
        connRow?.status === "connected"
          ? (connRow.provider as RetailPaymentProviderName)
          : null,
      canInitiatePayment: eligibility.eligible,
      blockedReason: eligibility.reason,
      activeCheckoutUrl:
        paymentRow && paymentRow.status === "pending" ? paymentRow.checkout_url : null,
      activePaymentId: paymentRow ? paymentRow.id : null,
      shareExpiresAt: orderRow.payment_share_expires_at,
      items: (itemRows ?? []).map((item) => ({
        productName: item.product_name_snapshot,
        variantName: item.variant_name_snapshot,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
        lineTotalCents: item.line_total_cents,
      })),
    };
  }

  /**
   * 7. Enriquecer página pública de acompanhamento do pedido com informações de elegibilidade financeira
   */
  public static async enrichPublicOrderTrackingWithPayment(
    tracking: PublicOrderTrackingView
  ): Promise<PublicOrderTrackingView> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { xamppQuery } = await import("@/infrastructure/xampp-test/db");
      const storeRows = await xamppQuery<
        Array<RowDataPacket & { id: string; tenant_id: string; store_name: string }>
      >(
        `SELECT id, tenant_id, store_name FROM retail_stores WHERE slug = ? LIMIT 1`,
        [tracking.storeSlug]
      );
      const store = storeRows[0];
      if (!store) return tracking;

      const connRows = await xamppQuery<
        Array<
          RowDataPacket & {
            status: RetailPaymentConnectionStatus;
            environment: RetailPaymentEnvironment;
            seller_account_id: string | null;
            seller_account_label: string | null;
          }
        >
      >(
        `SELECT status, environment, seller_account_id, seller_account_label FROM retail_payment_connections WHERE tenant_id = ? LIMIT 1`,
        [store.tenant_id]
      );
      const conn = connRows[0];

      const payRows = await xamppQuery<
        Array<RowDataPacket & { status: string; checkout_url: string | null }>
      >(
        `SELECT p.status, p.checkout_url
           FROM retail_payments p
           INNER JOIN retail_orders o ON o.id = p.order_id
          WHERE o.store_id = ? AND o.order_number = ?
          ORDER BY p.created_at DESC LIMIT 1`,
        [store.id, tracking.orderNumber]
      );
      const pay = payRows[0];

      const eligibility = PaymentInvariants.evaluateOrderPaymentEligibility(
        {
          status: tracking.status,
          paymentStatus: tracking.paymentStatus,
          deliveryMode: tracking.deliveryMode,
          subtotalCents: tracking.subtotalCents,
          shippingFeeCents: tracking.shippingFeeCents,
          discountCents: tracking.discountCents,
          totalCents: tracking.totalCents,
          currency: tracking.currency,
        },
        conn
          ? {
              status: conn.status,
              environment: conn.environment,
              sellerAccountId: conn.seller_account_id,
            }
          : null
      );

      return {
        ...tracking,
        canStartOnlinePayment: eligibility.eligible,
        paymentBlockedReason: eligibility.reason,
        receiverAccountLabel: conn?.seller_account_label ?? store.store_name,
        activeCheckoutUrl: pay && pay.status === "pending" ? pay.checkout_url : null,
      };
    }

    const admin = createAdminClient();
    const { data: storeRow } = await admin
      .from("retail_stores")
      .select("id, tenant_id, store_name")
      .eq("slug", tracking.storeSlug)
      .maybeSingle();

    if (!storeRow) {
      return tracking;
    }

    const [{ data: connRow }, { data: orderRow }] = await Promise.all([
      admin
        .from("retail_payment_connections")
        .select("status, environment, seller_account_id, seller_account_label")
        .eq("tenant_id", storeRow.tenant_id)
        .maybeSingle(),
      admin
        .from("retail_orders")
        .select("id")
        .eq("store_id", storeRow.id)
        .eq("order_number", tracking.orderNumber)
        .maybeSingle(),
    ]);

    let activeCheckoutUrl: string | null = null;
    if (orderRow) {
      const { data: paymentRow } = await admin
        .from("retail_payments")
        .select("status, checkout_url")
        .eq("order_id", orderRow.id)
        .eq("tenant_id", storeRow.tenant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentRow && paymentRow.status === "pending" && paymentRow.checkout_url) {
        activeCheckoutUrl = paymentRow.checkout_url;
      }
    }

    const eligibility = PaymentInvariants.evaluateOrderPaymentEligibility(
      {
        status: tracking.status,
        paymentStatus: tracking.paymentStatus,
        deliveryMode: tracking.deliveryMode,
        subtotalCents: tracking.subtotalCents,
        shippingFeeCents: tracking.shippingFeeCents,
        discountCents: tracking.discountCents,
        totalCents: tracking.totalCents,
        currency: tracking.currency,
      },
      connRow
        ? {
            status: connRow.status as RetailPaymentConnectionStatus,
            environment: connRow.environment as RetailPaymentEnvironment,
            sellerAccountId: connRow.seller_account_id,
          }
        : null
    );

    return {
      ...tracking,
      canStartOnlinePayment: eligibility.eligible,
      paymentBlockedReason: eligibility.reason,
      receiverAccountLabel: connRow?.seller_account_label ?? storeRow.store_name,
      activeCheckoutUrl,
    };
  }

  /**
   * 8. Iniciar sessão de pagamento via link público opaco (/loja/[slug]/pagamento/[shareToken])
   */
  public static async initiatePaymentSessionByShareToken(params: {
    storeSlug: string;
    shareToken: string;
    idempotencyKey: string;
    appBaseUrl: string;
  }): Promise<{ paymentId: string; checkoutUrl: string; expiresAt: string }> {
    const cleanToken = params.shareToken.trim();
    if (cleanToken.length < 16) {
      throw new NotFoundError("Link de pagamento inválido ou expirado.");
    }
    const tokenHash = hashOpaqueToken(cleanToken);
    const returnUrl = `${params.appBaseUrl.replace(/\/$/, "")}/loja/${params.storeSlug}/pagamento/${cleanToken}`;

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { xamppQuery } = await import("@/infrastructure/xampp-test/db");
      const rows = await xamppQuery<Array<RowDataPacket & { id: string; tenant_id: string }>>(
        `SELECT o.id, o.tenant_id
           FROM retail_orders o
           INNER JOIN retail_stores s ON s.id = o.store_id
          WHERE s.slug = ? AND o.payment_share_token_hash = ?
          LIMIT 1`,
        [params.storeSlug, tokenHash]
      );
      const found = rows[0];
      if (!found) {
        throw new NotFoundError("Link de pagamento inválido ou expirado.");
      }

      return RetailPaymentService.createCheckoutSessionInternal({
        tenantId: found.tenant_id,
        orderId: found.id,
        idempotencyKey: params.idempotencyKey,
        returnUrl,
        appBaseUrl: params.appBaseUrl,
        actorUserId: null,
      });
    }

    const admin = createAdminClient();
    const { data: storeRow } = await admin
      .from("retail_stores")
      .select("id, tenant_id")
      .eq("slug", params.storeSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (!storeRow) {
      throw new NotFoundError("Loja não localizada.");
    }

    const { data: orderRow } = await admin
      .from("retail_orders")
      .select("id, payment_share_expires_at")
      .eq("store_id", storeRow.id)
      .eq("tenant_id", storeRow.tenant_id)
      .eq("payment_share_token_hash", tokenHash)
      .maybeSingle();

    if (
      !orderRow ||
      !orderRow.payment_share_expires_at ||
      new Date(orderRow.payment_share_expires_at).getTime() <= Date.now()
    ) {
      throw new NotFoundError("Link de pagamento inválido ou expirado.");
    }

    return RetailPaymentService.createCheckoutSessionInternal({
      tenantId: storeRow.tenant_id,
      orderId: orderRow.id,
      idempotencyKey: params.idempotencyKey,
      returnUrl,
      appBaseUrl: params.appBaseUrl,
      actorUserId: null,
    });
  }

  /**
   * 9. Iniciar sessão de pagamento via comprovante público (/loja/[slug]/pedido/[orderNumber])
   */
  public static async initiatePaymentSessionByReceiptToken(params: {
    storeSlug: string;
    orderNumber: string;
    publicToken: string;
    idempotencyKey: string;
    appBaseUrl: string;
  }): Promise<{ paymentId: string; checkoutUrl: string; expiresAt: string }> {
    const cleanToken = params.publicToken.trim();
    if (cleanToken.length < 16) {
      throw new UnauthorizedError("Token de comprovante inválido.");
    }
    const tokenHash = hashOpaqueToken(cleanToken);
    const returnUrl = `${params.appBaseUrl.replace(/\/$/, "")}/loja/${params.storeSlug}/pedido/${encodeURIComponent(params.orderNumber)}`;

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { xamppQuery } = await import("@/infrastructure/xampp-test/db");
      const rows = await xamppQuery<Array<RowDataPacket & { id: string; tenant_id: string }>>(
        `SELECT o.id, o.tenant_id
           FROM retail_orders o
           INNER JOIN retail_stores s ON s.id = o.store_id
          WHERE s.slug = ? AND o.order_number = ? AND o.public_token_hash = ?
          LIMIT 1`,
        [params.storeSlug, params.orderNumber.toUpperCase(), tokenHash]
      );
      const found = rows[0];
      if (!found) {
        throw new NotFoundError("Pedido não localizado ou token inválido.");
      }

      return RetailPaymentService.createCheckoutSessionInternal({
        tenantId: found.tenant_id,
        orderId: found.id,
        idempotencyKey: params.idempotencyKey,
        returnUrl,
        appBaseUrl: params.appBaseUrl,
        actorUserId: null,
      });
    }

    const admin = createAdminClient();
    const { data: storeRow } = await admin
      .from("retail_stores")
      .select("id, tenant_id")
      .eq("slug", params.storeSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (!storeRow) {
      throw new NotFoundError("Loja não localizada.");
    }

    const { data: orderRow } = await admin
      .from("retail_orders")
      .select("id")
      .eq("store_id", storeRow.id)
      .eq("tenant_id", storeRow.tenant_id)
      .eq("order_number", params.orderNumber.trim().toUpperCase())
      .eq("public_token_hash", tokenHash)
      .maybeSingle();

    if (!orderRow) {
      throw new NotFoundError("Pedido não localizado ou token inválido.");
    }

    return RetailPaymentService.createCheckoutSessionInternal({
      tenantId: storeRow.tenant_id,
      orderId: orderRow.id,
      idempotencyKey: params.idempotencyKey,
      returnUrl,
      appBaseUrl: params.appBaseUrl,
      actorUserId: null,
    });
  }

  /**
   * 10. Iniciar sessão de pagamento pelo lojista no painel administrativo
   */
  public static async initiatePaymentSessionAsMerchant(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    rawInput: InitiatePaymentSessionInput;
    appBaseUrl: string;
  }): Promise<{ paymentId: string; checkoutUrl: string; expiresAt: string }> {
    if (!RetailPermissionService.hasPermission(params.context.role, "manage_retail_payments")) {
      throw new ForbiddenError("Seu papel não possui permissão para iniciar sessões de pagamento.");
    }

    const parsed = initiatePaymentSessionSchema.parse(params.rawInput);
    const returnUrl = `${params.appBaseUrl.replace(/\/$/, "")}/dashboard/retail/pedidos/${parsed.orderId}`;

    return RetailPaymentService.createCheckoutSessionInternal({
      tenantId: params.context.tenantId,
      orderId: parsed.orderId,
      idempotencyKey: parsed.idempotencyKey,
      returnUrl,
      appBaseUrl: params.appBaseUrl,
      actorUserId: params.context.userId,
    });
  }

  /**
   * Método interno unificado para criar sessão de checkout vinculada à conta do lojista
   */
  private static async createCheckoutSessionInternal(params: {
    tenantId: string;
    orderId: string;
    idempotencyKey: string;
    returnUrl: string;
    appBaseUrl: string;
    actorUserId: string | null;
  }): Promise<{ paymentId: string; checkoutUrl: string; expiresAt: string }> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { xamppQuery } = await import("@/infrastructure/xampp-test/db");
      const orderRows = await xamppQuery<
        Array<
          RowDataPacket & {
            id: string;
            store_id: string;
            order_number: string;
            status: RetailOrder["status"];
            payment_status: RetailPaymentStatus;
            delivery_mode: RetailOrder["deliveryMode"];
            currency: string;
            subtotal_cents: number;
            shipping_fee_cents: number | null;
            discount_cents: number;
            total_cents: number;
            customer_name: string;
            customer_email: string | null;
            store_slug: string;
            store_name: string;
          }
        >
      >(
        `SELECT o.*, s.slug AS store_slug, s.store_name
           FROM retail_orders o
           INNER JOIN retail_stores s ON s.id = o.store_id
          WHERE o.id = ? AND o.tenant_id = ? LIMIT 1`,
        [params.orderId, params.tenantId]
      );
      const orderRow = orderRows[0];
      if (!orderRow) {
        throw new NotFoundError("Pedido comercial não localizado.");
      }

      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      const secrets = await XamppRetailPaymentAdapter.getDecryptedConnectionSecrets(
        params.tenantId
      );

      const eligibility = PaymentInvariants.evaluateOrderPaymentEligibility(
        {
          status: orderRow.status,
          paymentStatus: orderRow.payment_status,
          deliveryMode: orderRow.delivery_mode,
          subtotalCents: Number(orderRow.subtotal_cents),
          shippingFeeCents:
            orderRow.shipping_fee_cents !== null ? Number(orderRow.shipping_fee_cents) : null,
          discountCents: Number(orderRow.discount_cents || 0),
          totalCents: Number(orderRow.total_cents),
          currency: orderRow.currency,
        },
        secrets.connection
      );

      if (!eligibility.eligible) {
        throw new ValidationError(
          eligibility.reason ?? "Pedido não elegível para pagamento."
        );
      }

      const externalReference = PaymentInvariants.buildCanonicalExternalReference({
        tenantId: params.tenantId,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
      });

      const expiresAtIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const session = await xamppProviderInstance.createPaymentSession({
        tenantId: params.tenantId,
        storeId: orderRow.store_id,
        storeSlug: orderRow.store_slug,
        storeName: orderRow.store_name,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        externalReference,
        sellerAccountId: secrets.connection.sellerAccountId ?? "MP-SELLER-SANDBOX",
        sellerAccessToken: secrets.accessToken,
        currency: orderRow.currency,
        amountCents: Number(orderRow.total_cents),
        shippingFeeCents: Number(orderRow.shipping_fee_cents || 0),
        items: [
          {
            id: orderRow.id,
            title: `Pedido ${orderRow.order_number}`,
            quantity: 1,
            unitPriceCents: Number(orderRow.subtotal_cents),
            currency: orderRow.currency,
          },
        ],
        payerName: PaymentInvariants.minimizeCustomerName(orderRow.customer_name),
        payerEmail: orderRow.customer_email,
        returnUrl: params.returnUrl,
        webhookUrl: `${params.appBaseUrl.replace(/\/$/, "")}/api/webhooks/retail/payments/xampp_sandbox?tenant_id=${params.tenantId}&order_id=${orderRow.id}`,
        expiresAt: expiresAtIso,
        idempotencyKey: params.idempotencyKey,
      });

      const txRes = await XamppRetailPaymentAdapter.createPaymentSessionTx({
        tenantId: params.tenantId,
        orderId: orderRow.id,
        provider: "xampp_sandbox",
        sellerAccountId: secrets.connection.sellerAccountId ?? "MP-SELLER-SANDBOX",
        externalPreferenceId: session.externalPreferenceId,
        externalReference: session.externalReference,
        checkoutUrl: session.checkoutUrl,
        idempotencyKey: params.idempotencyKey,
        expiresAt: session.expiresAt,
        payerEmailMasked: PaymentInvariants.maskEmail(orderRow.customer_email),
        metadata: session.rawMetadata,
      });

      return {
        paymentId: txRes.payment.id,
        checkoutUrl: txRes.payment.checkoutUrl ?? session.checkoutUrl,
        expiresAt: session.expiresAt,
      };
    }

    const admin = createAdminClient();
    const decryptedConn = await RetailPaymentService.loadDecryptedActiveConnection(
      admin,
      params.tenantId
    );

    const { data: orderRow, error: orderErr } = await admin
      .from("retail_orders")
      .select(
        "id, store_id, order_number, status, payment_status, delivery_mode, currency, subtotal_cents, shipping_fee_cents, discount_cents, total_cents, customer_name, customer_email"
      )
      .eq("id", params.orderId)
      .eq("tenant_id", params.tenantId)
      .maybeSingle();

    if (orderErr || !orderRow) {
      throw new NotFoundError("Pedido comercial não localizado.");
    }

    const eligibility = PaymentInvariants.evaluateOrderPaymentEligibility(
      {
        status: orderRow.status as RetailOrder["status"],
        paymentStatus: orderRow.payment_status as RetailPaymentStatus,
        deliveryMode: orderRow.delivery_mode as RetailOrder["deliveryMode"],
        subtotalCents: orderRow.subtotal_cents,
        shippingFeeCents: orderRow.shipping_fee_cents,
        discountCents: orderRow.discount_cents,
        totalCents: orderRow.total_cents,
        currency: orderRow.currency,
      },
      {
        status: decryptedConn.status,
        environment: decryptedConn.environment,
        sellerAccountId: decryptedConn.sellerAccountId,
      }
    );

    if (!eligibility.eligible) {
      throw new ValidationError(
        eligibility.reason ?? "Pedido não elegível para pagamento."
      );
    }

    const [{ data: storeRow }, { data: itemRows }] = await Promise.all([
      admin
        .from("retail_stores")
        .select("slug, store_name")
        .eq("id", orderRow.store_id)
        .maybeSingle(),
      admin
        .from("retail_order_items")
        .select("id, product_name_snapshot, variant_name_snapshot, quantity, unit_price_cents")
        .eq("order_id", orderRow.id)
        .eq("tenant_id", params.tenantId),
    ]);

    const storeSlug = storeRow?.slug ?? "loja";
    const storeName = storeRow?.store_name ?? "Loja Retail";
    const externalReference = PaymentInvariants.buildCanonicalExternalReference({
      tenantId: params.tenantId,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
    });

    const expiresAtIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const provider = getProviderImplementation(decryptedConn.provider);

    const items =
      (itemRows ?? []).length > 0
        ? (itemRows ?? []).map((item) => ({
            id: item.id,
            title: item.variant_name_snapshot
              ? `${item.product_name_snapshot} (${item.variant_name_snapshot})`
              : item.product_name_snapshot,
            quantity: item.quantity,
            unitPriceCents: item.unit_price_cents,
            currency: orderRow.currency,
          }))
        : [
            {
              id: orderRow.id,
              title: `Pedido ${orderRow.order_number}`,
              quantity: 1,
              unitPriceCents: orderRow.subtotal_cents,
              currency: orderRow.currency,
            },
          ];

    const session = await provider.createPaymentSession({
      tenantId: params.tenantId,
      storeId: orderRow.store_id,
      storeSlug,
      storeName,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      externalReference,
      sellerAccountId: decryptedConn.sellerAccountId,
      sellerAccessToken: decryptedConn.accessToken,
      currency: orderRow.currency,
      amountCents: orderRow.total_cents,
      shippingFeeCents: orderRow.shipping_fee_cents ?? 0,
      items,
      payerName: PaymentInvariants.minimizeCustomerName(orderRow.customer_name),
      payerEmail: orderRow.customer_email,
      returnUrl: params.returnUrl,
      webhookUrl: `${params.appBaseUrl.replace(/\/$/, "")}/api/webhooks/retail/payments/${decryptedConn.provider}?tenant_id=${params.tenantId}&order_id=${orderRow.id}`,
      expiresAt: expiresAtIso,
      idempotencyKey: params.idempotencyKey,
    });

    const { data: rpcData, error: rpcErr } = await admin.rpc(
      "create_retail_payment_session_tx",
      {
        p_tenant_id: params.tenantId,
        p_order_id: orderRow.id,
        p_provider: decryptedConn.provider,
        p_seller_account_id: decryptedConn.sellerAccountId,
        p_external_preference_id: session.externalPreferenceId,
        p_external_reference: session.externalReference,
        p_checkout_url: session.checkoutUrl,
        p_idempotency_key: params.idempotencyKey,
        p_expires_at: session.expiresAt,
        p_payer_email_masked: PaymentInvariants.maskEmail(orderRow.customer_email) ?? undefined,
        p_metadata: session.rawMetadata as Json,
      }
    );

    if (rpcErr) {
      translatePaymentRpcError(rpcErr.message);
    }

    const resObj = (rpcData ?? {}) as {
      deduplicated?: boolean;
      payment?: { id?: string; checkout_url?: string };
    };
    const paymentId = resObj.payment?.id;
    const checkoutUrl = resObj.payment?.checkout_url ?? session.checkoutUrl;

    if (!paymentId) {
      throw new ValidationError("Falha ao registrar sessão de pagamento.");
    }

    await AuditService.recordEvent({
      supabase: admin,
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: "retail.payment_session_created",
      resourceType: "retail_payment",
      resourceId: paymentId,
      metadata: {
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        amountCents: orderRow.total_cents,
        provider: decryptedConn.provider,
        environment: "sandbox",
      },
    });

    return {
      paymentId,
      checkoutUrl,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * 11. Processar webhook autenticado do provedor (com validação HMAC-SHA256 + consulta autoritativa)
   */
  public static async processWebhookNotification(params: {
    providerName: RetailPaymentProviderName;
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
    rawBody: string;
  }): Promise<{
    paymentId: string;
    orderId: string;
    paymentStatus: RetailPaymentStatus;
    processingResult: string;
  }> {
    let parsedBody: Record<string, unknown> = {};
    try {
      parsedBody = params.rawBody
        ? (JSON.parse(params.rawBody) as Record<string, unknown>)
        : {};
    } catch {
      throw new ValidationError("Payload JSON de webhook malformado.");
    }

    if (parsedBody.live_mode === true) {
      throw new ForbiddenError(
        "FAIL-CLOSED: Notificações de produção (live_mode=true) são proibidas em ambiente Sandbox."
      );
    }

    const dataObj = parsedBody.data as { id?: string | number } | undefined;
    const externalPaymentId =
      params.query["data.id"] ||
      params.query["id"] ||
      (dataObj?.id !== undefined ? String(dataObj.id) : "");

    if (!externalPaymentId) {
      throw new ValidationError("Identificador externo de pagamento ausente na notificação.");
    }

    const hintTenantId =
      params.query["tenant_id"] ||
      (typeof parsedBody.tenant_id === "string" ? parsedBody.tenant_id : undefined);
    const hintOrderId =
      params.query["order_id"] ||
      (typeof parsedBody.order_id === "string" ? parsedBody.order_id : undefined);

    const provider = getProviderImplementation(params.providerName);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { xamppQuery } = await import("@/infrastructure/xampp-test/db");
      interface TargetPaymentLookup extends RowDataPacket {
        id: string;
        tenant_id: string;
        order_id: string;
        external_reference: string;
      }
      let targetPayment: TargetPaymentLookup | null = null;

      if (hintTenantId && hintOrderId) {
        const rows = await xamppQuery<TargetPaymentLookup[]>(
          `SELECT id, tenant_id, order_id, external_reference
             FROM retail_payments
            WHERE tenant_id = ? AND order_id = ?
            ORDER BY created_at DESC LIMIT 1`,
          [hintTenantId, hintOrderId]
        );
        targetPayment = rows[0] ?? null;
      }

      if (!targetPayment) {
        const rows = await xamppQuery<TargetPaymentLookup[]>(
          `SELECT id, tenant_id, order_id, external_reference
             FROM retail_payments
            WHERE external_payment_id = ?
            ORDER BY created_at DESC LIMIT 1`,
          [externalPaymentId]
        );
        targetPayment = rows[0] ?? null;
      }

      if (!targetPayment) {
        throw new NotFoundError("Transação correspondente ao webhook não localizada.");
      }

      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      const secrets = await XamppRetailPaymentAdapter.getDecryptedConnectionSecrets(
        targetPayment.tenant_id
      );

      let validatedEvent;
      try {
        validatedEvent = provider.validateWebhookNotification({
          headers: params.headers,
          query: params.query,
          rawBody: params.rawBody,
          webhookSecret: secrets.webhookSecret,
        });
      } catch (err) {
        throw new UnauthorizedError(
          err instanceof Error ? err.message : "Assinatura de webhook inválida."
        );
      }

      const authoritativeTx = await provider.getTransaction({
        externalPaymentId: validatedEvent.externalPaymentId,
        sellerAccessToken: secrets.accessToken,
        expectedSellerAccountId: secrets.connection.sellerAccountId ?? "",
      });

      const txRes = await XamppRetailPaymentAdapter.reconcilePaymentTx({
        tenantId: targetPayment.tenant_id,
        paymentId: targetPayment.id,
        provider: params.providerName,
        externalEventId: validatedEvent.externalEventId,
        eventType: validatedEvent.eventType,
        signatureVerified: true,
        externalPaymentId: authoritativeTx.externalPaymentId,
        externalReference: authoritativeTx.externalReference,
        sellerAccountId: authoritativeTx.sellerAccountId,
        authoritativeStatus: authoritativeTx.status,
        authoritativeAmountCents: authoritativeTx.amountCents,
        authoritativeCurrency: authoritativeTx.currency,
        paymentMethod: authoritativeTx.paymentMethod,
        paymentMethodLabel: authoritativeTx.paymentMethodLabel,
        failureCode: authoritativeTx.failureCode,
        failureReason: authoritativeTx.failureReason,
        payloadSummary: authoritativeTx.rawSummary,
      });

      return {
        paymentId: txRes.payment.id,
        orderId: txRes.payment.orderId,
        paymentStatus: txRes.payment.status,
        processingResult: txRes.outcome,
      };
    }

    const admin = createAdminClient();
    const targetPayment = await RetailPaymentService.locateTargetPaymentForWebhook(admin, {
      externalPaymentId,
      hintTenantId,
      hintOrderId,
    });

    const decryptedConn = await RetailPaymentService.loadDecryptedActiveConnection(
      admin,
      targetPayment.tenant_id
    );

    let validatedEvent;
    try {
      validatedEvent = provider.validateWebhookNotification({
        headers: params.headers,
        query: params.query,
        rawBody: params.rawBody,
        webhookSecret: decryptedConn.webhookSecret,
      });
    } catch (err) {
      throw new UnauthorizedError(
        err instanceof Error ? err.message : "Assinatura de webhook inválida."
      );
    }

    const authoritativeTx = await provider.getTransaction({
      externalPaymentId: validatedEvent.externalPaymentId,
      sellerAccessToken: decryptedConn.accessToken,
      expectedSellerAccountId: decryptedConn.sellerAccountId,
    });

    const { data: rpcData, error: rpcErr } = await admin.rpc(
      "reconcile_retail_payment_tx",
      {
        p_tenant_id: targetPayment.tenant_id,
        p_payment_id: targetPayment.id,
        p_provider: decryptedConn.provider,
        p_external_event_id: validatedEvent.externalEventId,
        p_event_type: validatedEvent.eventType,
        p_signature_verified: true,
        p_external_payment_id: authoritativeTx.externalPaymentId,
        p_external_reference: authoritativeTx.externalReference,
        p_seller_account_id: authoritativeTx.sellerAccountId,
        p_authoritative_status: authoritativeTx.status,
        p_authoritative_amount_cents: authoritativeTx.amountCents,
        p_authoritative_currency: authoritativeTx.currency,
        p_payment_method: authoritativeTx.paymentMethod,
        p_payment_method_label: authoritativeTx.paymentMethodLabel,
        p_failure_code: authoritativeTx.failureCode ?? undefined,
        p_failure_reason: authoritativeTx.failureReason ?? undefined,
        p_payload_summary: authoritativeTx.rawSummary as Json,
      }
    );

    if (rpcErr) {
      translatePaymentRpcError(rpcErr.message);
    }

    const resObj = (rpcData ?? {}) as {
      outcome?: string;
      divergenceAlert?: string | null;
      payment?: { id?: string; order_id?: string; status?: RetailPaymentStatus };
    };

    const resultStatus = (resObj.payment?.status ?? authoritativeTx.status) as RetailPaymentStatus;
    const outcome = resObj.outcome ?? "processed";

    if (outcome === "processed" || outcome === "rejected_divergence") {
      const auditAction =
        outcome === "rejected_divergence"
          ? "retail.payment_divergence_blocked"
          : resultStatus === "paid"
          ? "retail.payment_approved"
          : resultStatus === "failed" || resultStatus === "expired"
          ? "retail.payment_failed"
          : null;

      if (auditAction) {
        await AuditService.recordEvent({
          supabase: admin,
          tenantId: targetPayment.tenant_id,
          actorUserId: null,
          action: auditAction,
          resourceType: "retail_payment",
          resourceId: targetPayment.id,
          metadata: {
            orderId: targetPayment.order_id,
            externalPaymentId: authoritativeTx.externalPaymentId,
            paymentStatus: resultStatus,
            amountCents: authoritativeTx.amountCents,
            divergenceAlert: resObj.divergenceAlert ?? null,
          },
        });
      }
    }

    return {
      paymentId: targetPayment.id,
      orderId: targetPayment.order_id,
      paymentStatus: resultStatus,
      processingResult: outcome,
    };
  }

  /**
   * 12. Simulador determinístico Sandbox (dispara fluxo completo: provedor -> webhook assinado HMAC -> consulta autoritativa -> RPC)
   */
  public static async simulateSandboxProviderOutcome(params: {
    tenantId: string;
    orderId: string;
    outcome: "approved" | "pending" | "rejected" | "expired" | "cancelled";
    paymentMethod?: RetailPaymentMethod;
    overrideAmountCents?: number;
    overrideCurrency?: string;
    overrideSellerAccountId?: string;
    overrideExternalReference?: string;
    customExternalEventId?: string;
    customExternalPaymentId?: string;
  }): Promise<{
    paymentId: string;
    orderId: string;
    paymentStatus: RetailPaymentStatus;
    processingResult: string;
    externalPaymentId: string;
  }> {
    PaymentInvariants.assertSandboxOnlyMode("sandbox");

    const externalPaymentId =
      params.customExternalPaymentId ??
      `mp_pay_sbx_${Date.now()}_${randomBytes(3).toString("hex")}`;
    const externalEventId =
      params.customExternalEventId ??
      `evt_sbx_${Date.now()}_${randomBytes(4).toString("hex")}`;

    const mappedStatus: RetailPaymentStatus =
      params.outcome === "approved"
        ? "paid"
        : params.outcome === "pending"
        ? "processing"
        : params.outcome === "rejected"
        ? "failed"
        : params.outcome;

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { xamppQuery } = await import("@/infrastructure/xampp-test/db");
      const payRows = await xamppQuery<
        Array<
          RowDataPacket & {
            id: string;
            external_preference_id: string | null;
            external_reference: string;
            amount_cents: number;
            currency: string;
            seller_account_id: string;
          }
        >
      >(
        `SELECT id, external_preference_id, external_reference, amount_cents, currency, seller_account_id
           FROM retail_payments
          WHERE tenant_id = ? AND order_id = ?
          ORDER BY created_at DESC LIMIT 1`,
        [params.tenantId, params.orderId]
      );
      const pay = payRows[0];
      if (!pay) {
        throw new NotFoundError("Sessão de pagamento não encontrada para simulação.");
      }

      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      const secrets = await XamppRetailPaymentAdapter.getDecryptedConnectionSecrets(
        params.tenantId
      );

      const amountCents = params.overrideAmountCents ?? Number(pay.amount_cents);
      MercadoPagoSandboxProvider.seedSimulatedTransaction({
        externalPaymentId,
        externalPreferenceId: pay.external_preference_id ?? "XAMPP-PREF",
        externalReference: params.overrideExternalReference ?? pay.external_reference,
        sellerAccountId: params.overrideSellerAccountId ?? pay.seller_account_id,
        status: mappedStatus,
        amountCents,
        refundedAmountCents: 0,
        currency: params.overrideCurrency ?? pay.currency,
        paymentMethod: params.paymentMethod ?? "pix",
        approvedAt: mappedStatus === "paid" ? new Date().toISOString() : null,
        failureCode: mappedStatus === "failed" ? "cc_rejected_high_risk" : null,
        failureReason:
          mappedStatus === "failed" ? "Pagamento recusado pelo emissor no Sandbox" : null,
      });

      const xRequestId = `req_${randomBytes(6).toString("hex")}`;
      const ts = Math.floor(Date.now() / 1000);
      const xSignature = buildMercadoPagoWebhookSignature({
        dataId: externalPaymentId,
        xRequestId,
        timestampSeconds: ts,
        webhookSecret: secrets.webhookSecret,
      });

      const res = await RetailPaymentService.processWebhookNotification({
        providerName: "xampp_sandbox",
        headers: {
          "x-signature": xSignature,
          "x-request-id": xRequestId,
        },
        query: {
          "data.id": externalPaymentId,
          type: "payment",
          tenant_id: params.tenantId,
          order_id: params.orderId,
        },
        rawBody: JSON.stringify({
          id: externalEventId,
          type: "payment",
          action: "payment.updated",
          live_mode: false,
          data: { id: externalPaymentId },
        }),
      });

      return { ...res, externalPaymentId };
    }

    const admin = createAdminClient();
    const { data: payRow } = await admin
      .from("retail_payments")
      .select(
        "id, external_preference_id, external_reference, amount_cents, currency, seller_account_id"
      )
      .eq("tenant_id", params.tenantId)
      .eq("order_id", params.orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payRow) {
      throw new NotFoundError("Sessão de pagamento não encontrada para este pedido.");
    }

    const decryptedConn = await RetailPaymentService.loadDecryptedActiveConnection(
      admin,
      params.tenantId
    );

    const amountCents = params.overrideAmountCents ?? payRow.amount_cents;
    MercadoPagoSandboxProvider.seedSimulatedTransaction({
      externalPaymentId,
      externalPreferenceId: payRow.external_preference_id ?? "MP-PREF-SBX",
      externalReference: params.overrideExternalReference ?? payRow.external_reference,
      sellerAccountId: params.overrideSellerAccountId ?? payRow.seller_account_id,
      status: mappedStatus,
      amountCents,
      refundedAmountCents: 0,
      currency: params.overrideCurrency ?? payRow.currency,
      paymentMethod: params.paymentMethod ?? "pix",
      approvedAt: mappedStatus === "paid" ? new Date().toISOString() : null,
      failureCode: mappedStatus === "failed" ? "cc_rejected_high_risk" : null,
      failureReason:
        mappedStatus === "failed" ? "Pagamento recusado pelo emissor no Sandbox" : null,
    });

    const xRequestId = `req_${randomBytes(6).toString("hex")}`;
    const ts = Math.floor(Date.now() / 1000);
    const xSignature = buildMercadoPagoWebhookSignature({
      dataId: externalPaymentId,
      xRequestId,
      timestampSeconds: ts,
      webhookSecret: decryptedConn.webhookSecret,
    });

    const res = await RetailPaymentService.processWebhookNotification({
      providerName: decryptedConn.provider,
      headers: {
        "x-signature": xSignature,
        "x-request-id": xRequestId,
      },
      query: {
        "data.id": externalPaymentId,
        type: "payment",
        tenant_id: params.tenantId,
        order_id: params.orderId,
      },
      rawBody: JSON.stringify({
        id: externalEventId,
        type: "payment",
        action: "payment.updated",
        live_mode: false,
        data: { id: externalPaymentId },
      }),
    });

    return { ...res, externalPaymentId };
  }

  /**
   * 13. Reconciliar pagamento manualmente no painel (consulta autoritativa ao gateway)
   */
  public static async reconcilePayment(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    paymentId: string;
    externalPaymentId?: string;
  }): Promise<RetailPaymentWithDetails> {
    if (!RetailPermissionService.hasPermission(params.context.role, "manage_retail_payments")) {
      throw new ForbiddenError("Seu papel não possui permissão para reconciliar pagamentos.");
    }

    const current = await RetailPaymentService.getPaymentWithDetails({
      supabase: params.supabase,
      context: params.context,
      paymentId: params.paymentId,
    });

    const extPayId = params.externalPaymentId?.trim() || current.externalPaymentId;

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      const secrets = await XamppRetailPaymentAdapter.getDecryptedConnectionSecrets(
        params.context.tenantId
      );
      const tx = await xamppProviderInstance.reconcilePayment({
        externalPaymentId: extPayId,
        externalReference: current.externalReference,
        sellerAccessToken: secrets.accessToken,
        expectedSellerAccountId: current.sellerAccountId,
      });

      if (tx) {
        await XamppRetailPaymentAdapter.reconcilePaymentTx({
          tenantId: params.context.tenantId,
          paymentId: current.id,
          provider: "xampp_sandbox",
          externalEventId: `manual_reconcile_${Date.now()}`,
          eventType: "payment.manual_reconcile",
          signatureVerified: true,
          externalPaymentId: tx.externalPaymentId,
          externalReference: tx.externalReference,
          sellerAccountId: tx.sellerAccountId,
          authoritativeStatus: tx.status,
          authoritativeAmountCents: tx.amountCents,
          authoritativeCurrency: tx.currency,
          paymentMethod: tx.paymentMethod,
          paymentMethodLabel: tx.paymentMethodLabel,
          failureCode: tx.failureCode,
          failureReason: tx.failureReason,
          payloadSummary: tx.rawSummary,
        });
      }

      return RetailPaymentService.getPaymentWithDetails({
        supabase: params.supabase,
        context: params.context,
        paymentId: params.paymentId,
      });
    }

    const admin = createAdminClient();
    const decryptedConn = await RetailPaymentService.loadDecryptedActiveConnection(
      admin,
      params.context.tenantId
    );
    const provider = getProviderImplementation(decryptedConn.provider);

    const authoritativeTx = await provider.reconcilePayment({
      externalPaymentId: extPayId,
      externalReference: current.externalReference,
      sellerAccessToken: decryptedConn.accessToken,
      expectedSellerAccountId: decryptedConn.sellerAccountId,
    });

    if (!authoritativeTx) {
      return current;
    }

    const { error: rpcErr } = await admin.rpc("reconcile_retail_payment_tx", {
      p_tenant_id: params.context.tenantId,
      p_payment_id: current.id,
      p_provider: decryptedConn.provider,
      p_external_event_id: `manual_reconcile_${Date.now()}_${randomBytes(3).toString("hex")}`,
      p_event_type: "payment.manual_reconcile",
      p_signature_verified: true,
      p_external_payment_id: authoritativeTx.externalPaymentId,
      p_external_reference: authoritativeTx.externalReference,
      p_seller_account_id: authoritativeTx.sellerAccountId,
      p_authoritative_status: authoritativeTx.status,
      p_authoritative_amount_cents: authoritativeTx.amountCents,
      p_authoritative_currency: authoritativeTx.currency,
      p_payment_method: authoritativeTx.paymentMethod,
      p_payment_method_label: authoritativeTx.paymentMethodLabel,
      p_failure_code: authoritativeTx.failureCode ?? undefined,
      p_failure_reason: authoritativeTx.failureReason ?? undefined,
      p_payload_summary: authoritativeTx.rawSummary as Json,
    });

    if (rpcErr) {
      translatePaymentRpcError(rpcErr.message);
    }

    return RetailPaymentService.getPaymentWithDetails({
      supabase: params.supabase,
      context: params.context,
      paymentId: params.paymentId,
    });
  }

  /**
   * 14. Cancelar ou expirar sessão pendente (verificando antes no provedor se houve pagamento tardio)
   */
  public static async expireOrCancelPendingPayment(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    paymentId: string;
    mode: "expired" | "cancelled";
  }): Promise<RetailPaymentWithDetails> {
    if (!RetailPermissionService.hasPermission(params.context.role, "manage_retail_payments")) {
      throw new ForbiddenError("Seu papel não possui permissão para cancelar sessões de pagamento.");
    }

    const current = await RetailPaymentService.getPaymentWithDetails({
      supabase: params.supabase,
      context: params.context,
      paymentId: params.paymentId,
    });

    if (current.status !== "pending") {
      throw new ConflictError(
        "Apenas sessões de pagamento aguardando pagamento podem ser canceladas ou expiradas."
      );
    }

    if (current.externalPaymentId) {
      const reconciled = await RetailPaymentService.reconcilePayment({
        supabase: params.supabase,
        context: params.context,
        paymentId: current.id,
        externalPaymentId: current.externalPaymentId,
      });
      if (reconciled.status === "paid" || reconciled.status === "processing") {
        return reconciled;
      }
    }

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      await XamppRetailPaymentAdapter.reconcilePaymentTx({
        tenantId: params.context.tenantId,
        paymentId: current.id,
        provider: current.provider,
        externalEventId: `merchant_${params.mode}_${Date.now()}`,
        eventType: `payment.merchant_${params.mode}`,
        signatureVerified: true,
        externalPaymentId: current.externalPaymentId ?? `sess_${current.id.slice(0, 8)}`,
        externalReference: current.externalReference,
        sellerAccountId: current.sellerAccountId,
        authoritativeStatus: params.mode,
        authoritativeAmountCents: current.amountCents,
        authoritativeCurrency: current.currency,
        paymentMethod: current.paymentMethod,
        paymentMethodLabel: current.paymentMethodLabel,
        failureCode: params.mode,
        failureReason: `Sessão marcada como ${params.mode} pelo estabelecimento`,
        payloadSummary: { action: params.mode, actorUserId: params.context.userId },
      });

      return RetailPaymentService.getPaymentWithDetails({
        supabase: params.supabase,
        context: params.context,
        paymentId: current.id,
      });
    }

    const admin = createAdminClient();
    const { error: rpcErr } = await admin.rpc("reconcile_retail_payment_tx", {
      p_tenant_id: params.context.tenantId,
      p_payment_id: current.id,
      p_provider: current.provider,
      p_external_event_id: `merchant_${params.mode}_${Date.now()}_${randomBytes(3).toString("hex")}`,
      p_event_type: `payment.merchant_${params.mode}`,
      p_signature_verified: true,
      p_external_payment_id: current.externalPaymentId ?? `sess_${current.id.slice(0, 8)}`,
      p_external_reference: current.externalReference,
      p_seller_account_id: current.sellerAccountId,
      p_authoritative_status: params.mode,
      p_authoritative_amount_cents: current.amountCents,
      p_authoritative_currency: current.currency,
      p_payment_method: current.paymentMethod ?? "hosted_checkout",
      p_payment_method_label: current.paymentMethodLabel ?? "Checkout Pro",
      p_failure_code: params.mode,
      p_failure_reason: `Sessão marcada como ${params.mode} pelo estabelecimento`,
      p_payload_summary: {
        action: params.mode,
        actorUserId: params.context.userId,
      } as Json,
    });

    if (rpcErr) {
      translatePaymentRpcError(rpcErr.message);
    }

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      action: "retail.payment_cancelled",
      resourceType: "retail_payment",
      resourceId: current.id,
      metadata: {
        orderId: current.orderId,
        orderNumber: current.order.orderNumber,
        mode: params.mode,
      },
    });

    return RetailPaymentService.getPaymentWithDetails({
      supabase: params.supabase,
      context: params.context,
      paymentId: current.id,
    });
  }

  /**
   * 15. Solicitar e registrar estorno confirmado pelo provedor (com proteção contra reposição duplicada de estoque)
   */
  public static async requestConfirmedRefund(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    actorName: string;
    rawInput: RequestPaymentRefundInput;
    idempotencyKey?: string;
  }): Promise<RetailPaymentWithDetails> {
    if (!RetailPermissionService.hasPermission(params.context.role, "manage_retail_payments")) {
      throw new ForbiddenError("Seu papel não possui permissão para estornar pagamentos.");
    }

    const parsed = requestPaymentRefundSchema.parse(params.rawInput);
    const current = await RetailPaymentService.getPaymentWithDetails({
      supabase: params.supabase,
      context: params.context,
      paymentId: parsed.paymentId,
    });

    if (current.status !== "paid" && current.status !== "partially_refunded") {
      throw new ConflictError("Apenas pagamentos confirmados podem receber estorno.");
    }

    const remainingRefundable = current.amountCents - current.refundedAmountCents;
    const refundAmountCents = parsed.refundAmountCents ?? remainingRefundable;

    if (refundAmountCents <= 0 || refundAmountCents > remainingRefundable) {
      throw new ValidationError(
        `O valor solicitado (${refundAmountCents}) excede o saldo disponível para estorno (${remainingRefundable}).`
      );
    }

    const externalPaymentId =
      current.externalPaymentId ?? `mp_pay_sbx_${current.id.slice(0, 8)}`;
    const idempotencyKey =
      params.idempotencyKey ?? `refund_${current.id}_${refundAmountCents}_${Date.now()}`;

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      const secrets = await XamppRetailPaymentAdapter.getDecryptedConnectionSecrets(
        params.context.tenantId
      );

      const providerRefund = await xamppProviderInstance.requestRefund({
        externalPaymentId,
        sellerAccountId: current.sellerAccountId,
        sellerAccessToken: secrets.accessToken,
        refundAmountCents,
        totalPaymentAmountCents: current.amountCents,
        idempotencyKey,
        reason: parsed.reason,
      });

      if (providerRefund.status !== "approved") {
        throw new ConflictError("O provedor de pagamento não confirmou o estorno.");
      }

      await XamppRetailPaymentAdapter.recordPaymentRefundTx({
        tenantId: params.context.tenantId,
        paymentId: current.id,
        provider: "xampp_sandbox",
        externalRefundId: providerRefund.externalRefundId,
        refundAmountCents: providerRefund.refundedAmountCents,
        reason: parsed.reason,
        actorUserId: params.context.userId,
        payloadSummary: providerRefund.rawSummary,
      });

      await AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: params.context.tenantId,
        actorUserId: params.context.userId,
        action: "retail.payment_refunded",
        resourceType: "retail_payment",
        resourceId: current.id,
        metadata: {
          orderId: current.orderId,
          orderNumber: current.order.orderNumber,
          refundAmountCents: providerRefund.refundedAmountCents,
          externalRefundId: providerRefund.externalRefundId,
          reason: parsed.reason,
        },
      });

      return RetailPaymentService.getPaymentWithDetails({
        supabase: params.supabase,
        context: params.context,
        paymentId: current.id,
      });
    }

    const admin = createAdminClient();
    const decryptedConn = await RetailPaymentService.loadDecryptedActiveConnection(
      admin,
      params.context.tenantId
    );
    const provider = getProviderImplementation(decryptedConn.provider);

    const providerRefund = await provider.requestRefund({
      externalPaymentId,
      sellerAccountId: decryptedConn.sellerAccountId,
      sellerAccessToken: decryptedConn.accessToken,
      refundAmountCents,
      totalPaymentAmountCents: current.amountCents,
      idempotencyKey,
      reason: parsed.reason,
    });

    if (providerRefund.status !== "approved") {
      throw new ConflictError("O gateway não confirmou a aprovação do estorno.");
    }

    const { error: rpcErr } = await admin.rpc("record_retail_payment_refund_tx", {
      p_tenant_id: params.context.tenantId,
      p_payment_id: current.id,
      p_provider: decryptedConn.provider,
      p_external_refund_id: providerRefund.externalRefundId,
      p_refund_amount_cents: providerRefund.refundedAmountCents,
      p_reason: parsed.reason,
      p_actor_user_id: params.context.userId,
      p_payload_summary: providerRefund.rawSummary as Json,
    });

    if (rpcErr) {
      translatePaymentRpcError(rpcErr.message);
    }

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      action: "retail.payment_refunded",
      resourceType: "retail_payment",
      resourceId: current.id,
      metadata: {
        orderId: current.orderId,
        orderNumber: current.order.orderNumber,
        refundAmountCents: providerRefund.refundedAmountCents,
        externalRefundId: providerRefund.externalRefundId,
        reason: parsed.reason,
      },
    });

    return RetailPaymentService.getPaymentWithDetails({
      supabase: params.supabase,
      context: params.context,
      paymentId: current.id,
    });
  }

  /**
   * 16. Listar pagamentos do tenant com filtros e paginação
   */
  public static async listPayments(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    filters?: RetailPaymentsFilter & {
      paymentMethod?: RetailPaymentMethod | "all";
      periodDays?: number;
    };
  }): Promise<RetailPaymentsListResult> {
    if (!RetailPermissionService.hasPermission(params.context.role, "view_retail_payments")) {
      throw new ForbiddenError("Seu papel não possui acesso ao módulo financeiro.");
    }

    const filters = params.filters ?? {};

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      return XamppRetailPaymentAdapter.listPayments(params.context, filters);
    }

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, filters.pageSize ?? 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = params.supabase
      .from("retail_payments")
      .select("*, retail_orders!inner(order_number, customer_name)", {
        count: "exact",
      })
      .eq("tenant_id", params.context.tenantId)
      .order("created_at", { ascending: false });

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters.paymentMethod && filters.paymentMethod !== "all") {
      query = query.eq("payment_method", filters.paymentMethod);
    }

    if (filters.periodDays && filters.periodDays > 0) {
      const sinceIso = new Date(
        Date.now() - filters.periodDays * 24 * 3600 * 1000
      ).toISOString();
      query = query.gte("created_at", sinceIso);
    }

    if (filters.search && filters.search.trim().length > 0) {
      const term = filters.search.trim();
      query = query.or(
        `external_payment_id.ilike.%${term}%,external_reference.ilike.%${term}%`
      );
    }

    const { data, count, error } = await query.range(from, to);
    if (error) {
      throw new ValidationError(
        `Falha ao listar transações financeiras: ${error.message}`
      );
    }

    const rows = (data ?? []) as Array<
      PaymentRow & {
        retail_orders: {
          order_number: string;
          customer_name: string;
        } | null;
      }
    >;

    const payments = rows.map((row) =>
      mapPaymentRow(row, {
        orderNumber: row.retail_orders?.order_number,
        customerName: row.retail_orders?.customer_name,
      })
    );

    const totalCount = count ?? payments.length;
    return {
      payments,
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }

  /**
   * 17. Obter detalhe completo de um pagamento (com pedido, tentativas e trilha de webhooks/eventos)
   */
  public static async getPaymentWithDetails(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    paymentId: string;
  }): Promise<RetailPaymentWithDetails> {
    if (!RetailPermissionService.hasPermission(params.context.role, "view_retail_payments")) {
      throw new ForbiddenError("Seu papel não possui acesso ao módulo financeiro.");
    }

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      return XamppRetailPaymentAdapter.getPaymentWithDetails(
        params.context,
        params.paymentId
      );
    }

    const { data: paymentRow, error: payErr } = await params.supabase
      .from("retail_payments")
      .select("*")
      .eq("tenant_id", params.context.tenantId)
      .eq("id", params.paymentId)
      .maybeSingle();

    if (payErr || !paymentRow) {
      throw new NotFoundError("Transação financeira não localizada.");
    }

    const [order, { data: attemptRows }, { data: eventRows }] = await Promise.all([
      RetailOrderService.getOrderById(
        params.supabase,
        params.context,
        paymentRow.order_id
      ),
      params.supabase
        .from("retail_payment_attempts")
        .select("*")
        .eq("tenant_id", params.context.tenantId)
        .eq("payment_id", params.paymentId)
        .order("attempt_number", { ascending: false }),
      params.supabase
        .from("retail_payment_events")
        .select("*")
        .eq("tenant_id", params.context.tenantId)
        .eq("payment_id", params.paymentId)
        .order("created_at", { ascending: false }),
    ]);

    return {
      ...mapPaymentRow(paymentRow, {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
      }),
      order,
      attempts: (attemptRows ?? []).map(mapAttemptRow),
      events: (eventRows ?? []).map(mapEventRow),
    };
  }

  /**
   * 18. Obter pagamento vinculado a um pedido específico (se existir)
   */
  public static async getPaymentByOrderId(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
    orderId: string;
  }): Promise<RetailPayment | null> {
    if (!RetailPermissionService.hasPermission(params.context.role, "view_retail_payments")) {
      return null;
    }

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      return XamppRetailPaymentAdapter.getPaymentByOrderId(
        params.context,
        params.orderId
      );
    }

    const { data: payRow } = await params.supabase
      .from("retail_payments")
      .select("*")
      .eq("tenant_id", params.context.tenantId)
      .eq("order_id", params.orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payRow) {
      return null;
    }

    return mapPaymentRow(payRow);
  }

  /**
   * 19. Obter métricas financeiras reais do tenant (apenas pagamentos confirmados menos estornos)
   */
  public static async getPaymentStats(params: {
    supabase: AppSupabaseClient;
    context: TenantContext;
  }): Promise<RetailPaymentStats> {
    if (!RetailPermissionService.hasPermission(params.context.role, "view_retail_payments")) {
      throw new ForbiddenError("Seu papel não possui acesso às métricas financeiras.");
    }

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const XamppRetailPaymentAdapter = await loadXamppRetailPaymentAdapter();
      return XamppRetailPaymentAdapter.getPaymentStats(params.context);
    }

    const { data: rows, error } = await params.supabase
      .from("retail_payments")
      .select(
        "status, amount_cents, refunded_amount_cents, divergence_alert, approved_at, created_at"
      )
      .eq("tenant_id", params.context.tenantId)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      throw new ValidationError(
        `Falha ao calcular métricas financeiras: ${error.message}`
      );
    }

    return computeStatsFromPayments(
      (rows ?? []).map((r) => ({
        status: r.status as RetailPaymentStatus,
        amountCents: r.amount_cents,
        refundedAmountCents: r.refunded_amount_cents,
        divergenceAlert: r.divergence_alert,
        approvedAt: r.approved_at,
        createdAt: r.created_at,
      }))
    );
  }

  /**
   * Auxiliar interno (service_role) para descriptografar credenciais sandbox do tenant
   */
  private static async loadDecryptedActiveConnection(
    admin: AppSupabaseClient,
    tenantId: string
  ): Promise<InternalDecryptedConnection> {
    const { data: connRow, error } = await admin
      .from("retail_payment_connections")
      .select(
        "id, tenant_id, store_id, provider, environment, status, seller_account_id, seller_account_label, access_token_encrypted, webhook_secret_encrypted"
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (
      error ||
      !connRow ||
      connRow.status !== "connected" ||
      !connRow.seller_account_id ||
      !connRow.access_token_encrypted ||
      !connRow.webhook_secret_encrypted
    ) {
      throw new ValidationError(
        "A loja não possui conta de recebimento sandbox ativa configurada pela DevEssent."
      );
    }

    const accessToken = decryptPaymentSecret(
      connRow.access_token_encrypted,
      tenantId
    );
    const webhookSecret = decryptPaymentSecret(
      connRow.webhook_secret_encrypted,
      tenantId
    );

    PaymentInvariants.assertSandboxOnlyMode(connRow.environment, accessToken);

    return {
      id: connRow.id,
      tenantId: connRow.tenant_id,
      storeId: connRow.store_id,
      provider: connRow.provider as RetailPaymentProviderName,
      environment: connRow.environment as RetailPaymentEnvironment,
      status: connRow.status as RetailPaymentConnectionStatus,
      sellerAccountId: connRow.seller_account_id,
      sellerAccountLabel: connRow.seller_account_label ?? connRow.seller_account_id,
      accessToken,
      webhookSecret,
    };
  }

  /**
   * Auxiliar interno (service_role) para localizar o pagamento alvo de um webhook
   */
  private static async locateTargetPaymentForWebhook(
    admin: AppSupabaseClient,
    params: {
      externalPaymentId: string;
      hintTenantId?: string;
      hintOrderId?: string;
    }
  ): Promise<{
    id: string;
    tenant_id: string;
    order_id: string;
    external_reference: string;
  }> {
    if (params.hintTenantId && params.hintOrderId) {
      const { data: hinted } = await admin
        .from("retail_payments")
        .select("id, tenant_id, order_id, external_reference")
        .eq("tenant_id", params.hintTenantId)
        .eq("order_id", params.hintOrderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (hinted) {
        return hinted;
      }
    }

    const { data: byExtId } = await admin
      .from("retail_payments")
      .select("id, tenant_id, order_id, external_reference")
      .eq("external_payment_id", params.externalPaymentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byExtId) {
      return byExtId;
    }

    throw new NotFoundError("Transação correspondente ao webhook não localizada.");
  }
}
