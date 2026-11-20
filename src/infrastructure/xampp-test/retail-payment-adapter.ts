import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import type { RoleOrAdmin } from "@/core/permissions/policies/role-matrix";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/core/errors/app-error";
import {
  computeStatsFromPayments,
  PaymentInvariants,
} from "@/modules/retail/domain/payment-invariants";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";
import {
  decryptPaymentSecret,
  encryptPaymentSecret,
} from "@/modules/retail/payments/payment-crypto";
import { hashOpaqueToken } from "@/modules/retail/services/retail-cart-cookie";
import type { ConnectPaymentAccountInput } from "@/modules/retail/schemas/payment.schema";
import type {
  PublicOrderPaymentShareView,
  RetailOrder,
  RetailPayment,
  RetailPaymentAttempt,
  RetailPaymentConnectionSummary,
  RetailPaymentEvent,
  RetailPaymentMethod,
  RetailPaymentProviderName,
  RetailPaymentStats,
  RetailPaymentStatus,
  RetailPaymentWithDetails,
  RetailPaymentsFilter,
  RetailPaymentsListResult,
} from "@/modules/retail/types/retail.types";
import { assertXamppRuntimeAllowed, withXamppTransaction, xamppQuery } from "./db";
import { XamppRetailOrderAdapter } from "./retail-order-adapter";

interface ConnectionRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  store_id: string;
  provider: RetailPaymentProviderName;
  environment: "sandbox";
  status: "connected" | "disconnected" | "expired" | "error";
  seller_account_id: string | null;
  seller_account_label: string | null;
  public_key: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  webhook_secret_encrypted: string | null;
  token_expires_at: string | Date | null;
  connected_at: string | Date | null;
  disconnected_at: string | Date | null;
  last_verified_at: string | Date | null;
}

interface PaymentRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  store_id: string;
  order_id: string;
  order_number?: string;
  customer_name?: string;
  connection_id: string | null;
  provider: RetailPaymentProviderName;
  environment: "sandbox";
  external_payment_id: string | null;
  external_preference_id: string | null;
  external_reference: string;
  seller_account_id: string;
  currency: string;
  amount_cents: number;
  refunded_amount_cents: number;
  status: RetailPaymentStatus;
  payment_method: RetailPaymentMethod | null;
  payment_method_label: string | null;
  checkout_url: string | null;
  idempotency_key: string;
  payer_email_masked: string | null;
  divergence_alert: string | null;
  approved_at: string | Date | null;
  failed_at: string | Date | null;
  expired_at: string | Date | null;
  cancelled_at: string | Date | null;
  refunded_at: string | Date | null;
  last_reconciled_at: string | Date | null;
  metadata_json: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface AttemptRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  store_id: string;
  order_id: string;
  payment_id: string;
  attempt_number: number;
  provider: RetailPaymentProviderName;
  external_attempt_id: string | null;
  external_payment_id: string | null;
  amount_cents: number;
  currency: string;
  status: RetailPaymentAttempt["status"];
  payment_method: string | null;
  checkout_url: string | null;
  idempotency_key: string;
  failure_code: string | null;
  failure_reason: string | null;
  expires_at: string | Date | null;
  completed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface EventRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  store_id: string;
  order_id: string | null;
  payment_id: string | null;
  provider: RetailPaymentProviderName;
  external_event_id: string;
  event_type: string;
  signature_verified: number | boolean;
  processing_status: RetailPaymentEvent["processingStatus"];
  previous_status: string | null;
  new_status: string | null;
  amount_cents: number | null;
  currency: string | null;
  payload_summary_json: string;
  error_message: string | null;
  processed_at: string | Date;
  created_at: string | Date;
}

function toIso(val: string | Date | null | undefined): string | null {
  if (!val) return null;
  return new Date(val).toISOString();
}

export class XamppRetailPaymentAdapter {
  private static mapConnectionSummary(
    row: ConnectionRow | undefined,
    tenantId: string,
    storeId: string
  ): RetailPaymentConnectionSummary {
    if (!row) {
      return {
        id: null,
        tenantId,
        storeId,
        provider: "xampp_sandbox",
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
      storeId: row.store_id,
      provider: row.provider,
      environment: "sandbox",
      status: row.status,
      sellerAccountId: row.seller_account_id,
      sellerAccountLabel: row.seller_account_label,
      publicKey: row.public_key,
      tokenExpiresAt: toIso(row.token_expires_at),
      connectedAt: toIso(row.connected_at),
      disconnectedAt: toIso(row.disconnected_at),
      lastVerifiedAt: toIso(row.last_verified_at),
    };
  }

  public static mapPayment(row: PaymentRow): RetailPayment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      storeId: row.store_id,
      orderId: row.order_id,
      orderNumber: row.order_number,
      customerNameMinimized: row.customer_name
        ? PaymentInvariants.minimizeCustomerName(row.customer_name)
        : undefined,
      connectionId: row.connection_id,
      provider: row.provider,
      environment: "sandbox",
      externalPaymentId: row.external_payment_id,
      externalPreferenceId: row.external_preference_id,
      externalReference: row.external_reference,
      sellerAccountId: row.seller_account_id,
      currency: row.currency,
      amountCents: Number(row.amount_cents),
      refundedAmountCents: Number(row.refunded_amount_cents || 0),
      status: row.status,
      paymentMethod: row.payment_method,
      paymentMethodLabel: row.payment_method_label,
      checkoutUrl: row.checkout_url,
      idempotencyKey: row.idempotency_key,
      payerEmailMasked: row.payer_email_masked,
      divergenceAlert: row.divergence_alert,
      approvedAt: toIso(row.approved_at),
      failedAt: toIso(row.failed_at),
      expiredAt: toIso(row.expired_at),
      cancelledAt: toIso(row.cancelled_at),
      refundedAt: toIso(row.refunded_at),
      lastReconciledAt: toIso(row.last_reconciled_at),
      createdAt: toIso(row.created_at) || new Date().toISOString(),
      updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    };
  }

  private static mapAttempt(row: AttemptRow): RetailPaymentAttempt {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      storeId: row.store_id,
      orderId: row.order_id,
      paymentId: row.payment_id,
      attemptNumber: Number(row.attempt_number),
      provider: row.provider,
      externalAttemptId: row.external_attempt_id,
      externalPaymentId: row.external_payment_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      status: row.status,
      paymentMethod: row.payment_method,
      checkoutUrl: row.checkout_url,
      idempotencyKey: row.idempotency_key,
      failureCode: row.failure_code,
      failureReason: row.failure_reason,
      expiresAt: toIso(row.expires_at),
      completedAt: toIso(row.completed_at),
      createdAt: toIso(row.created_at) || new Date().toISOString(),
      updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    };
  }

  private static mapEvent(row: EventRow): RetailPaymentEvent {
    let parsedSummary: Record<string, unknown> = {};
    try {
      parsedSummary = JSON.parse(row.payload_summary_json || "{}");
    } catch {
      parsedSummary = {};
    }
    return {
      id: row.id,
      tenantId: row.tenant_id,
      storeId: row.store_id,
      orderId: row.order_id,
      paymentId: row.payment_id,
      provider: row.provider,
      externalEventId: row.external_event_id,
      eventType: row.event_type,
      signatureVerified: Boolean(row.signature_verified),
      processingStatus: row.processing_status,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      amountCents: row.amount_cents !== null ? Number(row.amount_cents) : null,
      currency: row.currency,
      payloadSummary: parsedSummary,
      errorMessage: row.error_message,
      processedAt: toIso(row.processed_at) || new Date().toISOString(),
      createdAt: toIso(row.created_at) || new Date().toISOString(),
    };
  }

  public static async getConnectionSummary(
    context: TenantContext
  ): Promise<RetailPaymentConnectionSummary> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "view_retail_payments");

    const storeRows = await xamppQuery<(RowDataPacket & { id: string })[]>(
      `SELECT id FROM retail_stores WHERE tenant_id = ? LIMIT 1`,
      [context.tenantId]
    );
    const storeId = storeRows[0]?.id || "";

    const rows = await xamppQuery<ConnectionRow[]>(
      `SELECT id, tenant_id, store_id, provider, environment, status,
              seller_account_id, seller_account_label, public_key,
              token_expires_at, connected_at, disconnected_at, last_verified_at
         FROM retail_payment_connections
        WHERE tenant_id = ? LIMIT 1`,
      [context.tenantId]
    );

    return this.mapConnectionSummary(rows[0], context.tenantId, storeId);
  }

  public static async getDecryptedConnectionSecrets(tenantId: string): Promise<{
    connection: RetailPaymentConnectionSummary;
    accessToken: string;
    webhookSecret: string;
  }> {
    assertXamppRuntimeAllowed();
    const rows = await xamppQuery<ConnectionRow[]>(
      `SELECT * FROM retail_payment_connections WHERE tenant_id = ? AND status = 'connected' LIMIT 1`,
      [tenantId]
    );
    const row = rows[0];
    if (!row || !row.access_token_encrypted || !row.webhook_secret_encrypted) {
      throw new ValidationError(
        "O estabelecimento não possui conta de pagamentos conectada em modo Sandbox."
      );
    }

    return {
      connection: this.mapConnectionSummary(row, tenantId, row.store_id),
      accessToken: decryptPaymentSecret(row.access_token_encrypted, tenantId),
      webhookSecret: decryptPaymentSecret(row.webhook_secret_encrypted, tenantId),
    };
  }

  public static async connectSellerAccount(params: {
    actorUserId: string;
    actorRole: RoleOrAdmin;
    input: ConnectPaymentAccountInput;
  }): Promise<RetailPaymentConnectionSummary> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(params.actorRole, "manage_payment_connections");
    PaymentInvariants.assertSandboxOnlyMode(
      params.input.environment,
      params.input.accessToken
    );

    const stores = await xamppQuery<(RowDataPacket & { id: string })[]>(
      `SELECT s.id FROM retail_stores s
       INNER JOIN tenants t ON t.id = s.tenant_id
       WHERE s.tenant_id = ? AND t.status = 'active' LIMIT 1`,
      [params.input.tenantId]
    );
    const store = stores[0];
    if (!store) {
      throw new NotFoundError("Loja ativa não encontrada para vincular conta de pagamento.");
    }

    const encAccess = encryptPaymentSecret(params.input.accessToken, params.input.tenantId);
    const encRefresh = params.input.refreshToken
      ? encryptPaymentSecret(params.input.refreshToken, params.input.tenantId)
      : null;
    const encWebhook = encryptPaymentSecret(
      params.input.webhookSecret,
      params.input.tenantId
    );

    const existing = await xamppQuery<ConnectionRow[]>(
      `SELECT id FROM retail_payment_connections WHERE tenant_id = ? LIMIT 1`,
      [params.input.tenantId]
    );

    const id = existing[0]?.id || randomUUID();
    if (existing[0]) {
      await xamppQuery(
        `UPDATE retail_payment_connections
            SET provider = ?, environment = 'sandbox', status = 'connected',
                seller_account_id = ?, seller_account_label = ?, public_key = ?,
                access_token_encrypted = ?, refresh_token_encrypted = ?,
                webhook_secret_encrypted = ?, connected_by_user_id = ?,
                connected_at = NOW(), disconnected_at = NULL, last_verified_at = NOW()
          WHERE tenant_id = ?`,
        [
          params.input.provider,
          params.input.sellerAccountId,
          params.input.sellerAccountLabel,
          params.input.publicKey || null,
          encAccess,
          encRefresh,
          encWebhook,
          params.actorUserId,
          params.input.tenantId,
        ]
      );
    } else {
      await xamppQuery(
        `INSERT INTO retail_payment_connections (
          id, tenant_id, store_id, provider, environment, status,
          seller_account_id, seller_account_label, public_key,
          access_token_encrypted, refresh_token_encrypted, webhook_secret_encrypted,
          scopes_json, connected_by_user_id, connected_at, last_verified_at, metadata_json
        ) VALUES (?, ?, ?, ?, 'sandbox', 'connected', ?, ?, ?, ?, ?, ?, '["read","write","offline_access"]', ?, NOW(), NOW(), '{}')`,
        [
          id,
          params.input.tenantId,
          store.id,
          params.input.provider,
          params.input.sellerAccountId,
          params.input.sellerAccountLabel,
          params.input.publicKey || null,
          encAccess,
          encRefresh,
          encWebhook,
          params.actorUserId,
        ]
      );
    }

    const updated = await xamppQuery<ConnectionRow[]>(
      `SELECT * FROM retail_payment_connections WHERE tenant_id = ? LIMIT 1`,
      [params.input.tenantId]
    );
    return this.mapConnectionSummary(updated[0], params.input.tenantId, store.id);
  }

  public static async disconnectSellerAccount(params: {
    actorUserId: string;
    actorRole: RoleOrAdmin;
    tenantId: string;
  }): Promise<RetailPaymentConnectionSummary> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(params.actorRole, "manage_payment_connections");

    await xamppQuery(
      `UPDATE retail_payment_connections
          SET status = 'disconnected',
              access_token_encrypted = NULL,
              refresh_token_encrypted = NULL,
              webhook_secret_encrypted = NULL,
              disconnected_at = NOW()
        WHERE tenant_id = ?`,
      [params.tenantId]
    );

    const rows = await xamppQuery<ConnectionRow[]>(
      `SELECT * FROM retail_payment_connections WHERE tenant_id = ? LIMIT 1`,
      [params.tenantId]
    );
    return this.mapConnectionSummary(rows[0], params.tenantId, rows[0]?.store_id || "");
  }

  public static async setOrderShippingFee(params: {
    context: TenantContext;
    orderId: string;
    shippingFeeCents: number;
  }): Promise<RetailOrder> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(params.context.role, "manage_retail_orders");

    if (!Number.isInteger(params.shippingFeeCents) || params.shippingFeeCents < 0) {
      throw new ValidationError("O valor de frete não pode ser negativo.");
    }

    return withXamppTransaction(async (conn) => {
      const [orderRows] = await conn.execute<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT * FROM retail_orders WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [params.orderId, params.context.tenantId]
      );
      const order = orderRows[0];
      if (!order) throw new NotFoundError("Pedido não encontrado.");

      if (order.status === "completed" || order.status === "cancelled") {
        throw new ValidationError(
          "Não é possível alterar o frete de um pedido concluído ou cancelado."
        );
      }

      const pStatus = String(order.payment_status || "not_started");
      if (["paid", "processing", "partially_refunded", "refunded", "disputed"].includes(pStatus)) {
        throw new ConflictError(
          "Não é possível alterar o valor de um pedido com pagamento em processamento ou confirmado."
        );
      }

      const newTotal =
        Number(order.subtotal_cents) +
        params.shippingFeeCents -
        Number(order.discount_cents || 0);
      if (newTotal <= 0) {
        throw new ValidationError("O valor total do pedido deve ser maior que zero.");
      }

      await conn.execute(
        `UPDATE retail_payment_attempts
            SET status = 'cancelled', failure_reason = 'Valor de frete atualizado antes do pagamento'
          WHERE order_id = ? AND tenant_id = ? AND status = 'pending'`,
        [params.orderId, params.context.tenantId]
      );

      await conn.execute(
        `UPDATE retail_payments
            SET status = 'cancelled', cancelled_at = NOW()
          WHERE order_id = ? AND tenant_id = ? AND status = 'pending'`,
        [params.orderId, params.context.tenantId]
      );

      await conn.execute(
        `UPDATE retail_orders
            SET shipping_fee_cents = ?,
                total_cents = ?,
                payment_status = CASE WHEN payment_status = 'pending' THEN 'not_started' ELSE payment_status END
          WHERE id = ? AND tenant_id = ?`,
        [params.shippingFeeCents, newTotal, params.orderId, params.context.tenantId]
      );
    }).then(() => XamppRetailOrderAdapter.getOrderById(params.context, params.orderId));
  }

  public static async createPaymentSessionTx(params: {
    tenantId: string;
    orderId: string;
    provider: RetailPaymentProviderName;
    sellerAccountId: string;
    externalPreferenceId: string;
    externalReference: string;
    checkoutUrl: string;
    idempotencyKey: string;
    expiresAt: string;
    payerEmailMasked: string | null;
    metadata: Record<string, unknown>;
  }): Promise<{
    deduplicated: boolean;
    payment: RetailPayment;
    attempt: RetailPaymentAttempt;
  }> {
    assertXamppRuntimeAllowed();

    return withXamppTransaction(async (conn) => {
      const [orders] = await conn.execute<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT * FROM retail_orders WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [params.orderId, params.tenantId]
      );
      const order = orders[0];
      if (!order) throw new NotFoundError("Pedido não encontrado.");

      if (!["confirmed", "preparing", "ready"].includes(String(order.status))) {
        throw new ValidationError(
          `Pagamento online disponível apenas para pedidos confirmados (status atual: ${order.status}).`
        );
      }

      const pStatus = String(order.payment_status || "not_started");
      if (["paid", "partially_refunded", "refunded", "disputed"].includes(pStatus)) {
        throw new ConflictError("Este pedido já possui pagamento confirmado.");
      }

      if (
        order.delivery_mode === "delivery" &&
        (order.shipping_fee_cents === null || order.shipping_fee_cents === undefined)
      ) {
        throw new ValidationError(
          "O valor de entrega deste pedido ainda está a combinar. Defina o valor do frete antes de liberar o pagamento online."
        );
      }

      const expectedTotal =
        Number(order.subtotal_cents) +
        Number(order.shipping_fee_cents || 0) -
        Number(order.discount_cents || 0);
      if (expectedTotal <= 0 || Number(order.total_cents) !== expectedTotal) {
        throw new ValidationError("O total do pedido diverge da soma validada.");
      }

      const [conns] = await conn.execute<ConnectionRow[]>(
        `SELECT * FROM retail_payment_connections
          WHERE tenant_id = ? AND store_id = ? AND status = 'connected' LIMIT 1`,
        [params.tenantId, order.store_id]
      );
      const connection = conns[0];
      if (!connection || !connection.seller_account_id) {
        throw new ValidationError(
          "Estabelecimento não possui conta de pagamento conectada em modo Sandbox."
        );
      }
      if (connection.seller_account_id !== params.sellerAccountId) {
        throw new ForbiddenError("Conta recebedora diverge da conta conectada ao estabelecimento.");
      }

      // Check idempotency
      const [existingIdem] = await conn.execute<PaymentRow[]>(
        `SELECT * FROM retail_payments WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1`,
        [params.tenantId, params.idempotencyKey]
      );
      if (existingIdem[0]) {
        const [attempts] = await conn.execute<AttemptRow[]>(
          `SELECT * FROM retail_payment_attempts WHERE payment_id = ? ORDER BY attempt_number DESC LIMIT 1`,
          [existingIdem[0].id]
        );
        return {
          deduplicated: true,
          payment: this.mapPayment(existingIdem[0]),
          attempt: this.mapAttempt(attempts[0]),
        };
      }

      const [reusableRows] = await conn.execute<PaymentRow[]>(
        `SELECT * FROM retail_payments
          WHERE tenant_id = ? AND order_id = ? AND status IN ('pending', 'failed', 'expired')
            AND amount_cents = ? AND seller_account_id = ?
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [params.tenantId, params.orderId, Number(order.total_cents), connection.seller_account_id]
      );

      let paymentId: string;
      if (!reusableRows[0]) {
        paymentId = randomUUID();
        await conn.execute(
          `INSERT INTO retail_payments (
            id, tenant_id, store_id, order_id, connection_id, provider, environment,
            external_preference_id, external_reference, seller_account_id,
            currency, amount_cents, status, payment_method, payment_method_label,
            checkout_url, idempotency_key, payer_email_masked, metadata_json
          ) VALUES (?, ?, ?, ?, ?, ?, 'sandbox', ?, ?, ?, ?, ?, 'pending', 'hosted_checkout', 'Checkout Pro', ?, ?, ?, ?)`,
          [
            paymentId,
            params.tenantId,
            order.store_id,
            params.orderId,
            connection.id,
            params.provider,
            params.externalPreferenceId,
            params.externalReference,
            connection.seller_account_id,
            String(order.currency || "BRL"),
            Number(order.total_cents),
            params.checkoutUrl,
            params.idempotencyKey,
            params.payerEmailMasked,
            JSON.stringify(params.metadata || {}),
          ]
        );
      } else {
        paymentId = reusableRows[0].id;
        await conn.execute(
          `UPDATE retail_payment_attempts SET status = 'expired', failure_reason = 'Nova sessão solicitada'
            WHERE payment_id = ? AND status = 'pending'`,
          [paymentId]
        );
        await conn.execute(
          `UPDATE retail_payments
              SET external_preference_id = ?, external_reference = ?, checkout_url = ?,
                  status = 'pending', failed_at = NULL, expired_at = NULL
            WHERE id = ?`,
          [params.externalPreferenceId, params.externalReference, params.checkoutUrl, paymentId]
        );
      }

      const [maxRows] = await conn.execute<(RowDataPacket & { max_num: number | null })[]>(
        `SELECT MAX(attempt_number) AS max_num FROM retail_payment_attempts WHERE payment_id = ?`,
        [paymentId]
      );
      const nextAttemptNum = Number(maxRows[0]?.max_num || 0) + 1;
      const attemptId = randomUUID();
      const expiresDate = new Date(params.expiresAt);

      await conn.execute(
        `INSERT INTO retail_payment_attempts (
          id, tenant_id, store_id, order_id, payment_id, attempt_number, provider,
          external_attempt_id, amount_cents, currency, status, payment_method,
          checkout_url, idempotency_key, expires_at, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'hosted_checkout', ?, ?, ?, ?)`,
        [
          attemptId,
          params.tenantId,
          order.store_id,
          params.orderId,
          paymentId,
          nextAttemptNum,
          params.provider,
          params.externalPreferenceId,
          Number(order.total_cents),
          String(order.currency || "BRL"),
          params.checkoutUrl,
          `${params.idempotencyKey}:attempt:${nextAttemptNum}`,
          expiresDate,
          JSON.stringify(params.metadata || {}),
        ]
      );

      await conn.execute(`UPDATE retail_orders SET payment_status = 'pending' WHERE id = ?`, [
        params.orderId,
      ]);

      await conn.execute(
        `INSERT IGNORE INTO retail_payment_events (
          id, tenant_id, store_id, order_id, payment_id, provider,
          external_event_id, event_type, signature_verified, processing_status,
          previous_status, new_status, amount_cents, currency, payload_summary_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'payment.session_created', 1, 'processed', ?, 'pending', ?, ?, ?)`,
        [
          randomUUID(),
          params.tenantId,
          order.store_id,
          params.orderId,
          paymentId,
          params.provider,
          `session:${attemptId}`,
          pStatus,
          Number(order.total_cents),
          String(order.currency || "BRL"),
          JSON.stringify({
            attemptNumber: nextAttemptNum,
            externalPreferenceId: params.externalPreferenceId,
          }),
        ]
      );

      const [payRows] = await conn.execute<PaymentRow[]>(
        `SELECT * FROM retail_payments WHERE id = ? LIMIT 1`,
        [paymentId]
      );
      const [attRows] = await conn.execute<AttemptRow[]>(
        `SELECT * FROM retail_payment_attempts WHERE id = ? LIMIT 1`,
        [attemptId]
      );

      return {
        deduplicated: false,
        payment: this.mapPayment(payRows[0]),
        attempt: this.mapAttempt(attRows[0]),
      };
    });
  }

  public static async reconcilePaymentTx(params: {
    tenantId: string;
    paymentId: string;
    provider: RetailPaymentProviderName;
    externalEventId: string;
    eventType: string;
    signatureVerified: boolean;
    externalPaymentId: string | null;
    externalReference: string;
    sellerAccountId: string;
    authoritativeStatus: RetailPaymentStatus;
    authoritativeAmountCents: number;
    authoritativeCurrency: string;
    paymentMethod: RetailPaymentMethod | null;
    paymentMethodLabel: string | null;
    failureCode: string | null;
    failureReason: string | null;
    payloadSummary: Record<string, unknown>;
  }): Promise<{
    outcome:
      | "processed"
      | "ignored_duplicate"
      | "ignored_out_of_order"
      | "rejected_divergence";
    divergenceAlert?: string | null;
    payment: RetailPayment;
  }> {
    assertXamppRuntimeAllowed();

    return withXamppTransaction(async (conn) => {
      const [existingEvents] = await conn.execute<EventRow[]>(
        `SELECT * FROM retail_payment_events WHERE provider = ? AND external_event_id = ? LIMIT 1`,
        [params.provider, params.externalEventId]
      );
      if (existingEvents[0]) {
        const [payRows] = await conn.execute<PaymentRow[]>(
          `SELECT * FROM retail_payments WHERE id = ? AND tenant_id = ? LIMIT 1`,
          [params.paymentId, params.tenantId]
        );
        if (!payRows[0]) throw new NotFoundError("Pagamento não encontrado.");
        return {
          outcome: "ignored_duplicate",
          payment: this.mapPayment(payRows[0]),
        };
      }

      const [payRows] = await conn.execute<PaymentRow[]>(
        `SELECT * FROM retail_payments WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [params.paymentId, params.tenantId]
      );
      const payment = payRows[0];
      if (!payment) {
        throw new NotFoundError("Registro financeiro não localizado para o estabelecimento.");
      }

      const [orderRows] = await conn.execute<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT * FROM retail_orders WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [payment.order_id, params.tenantId]
      );
      const order = orderRows[0];
      if (!order) throw new NotFoundError("Pedido vinculado não localizado.");

      const prevStatus = payment.status;
      let divergence: string | null = null;

      if (params.sellerAccountId !== payment.seller_account_id) {
        divergence = `SELLER_MISMATCH: Conta recebedora informada (${params.sellerAccountId}) diverge da conta do estabelecimento (${payment.seller_account_id}).`;
      } else if (params.authoritativeCurrency !== payment.currency) {
        divergence = `CURRENCY_MISMATCH: Moeda informada (${params.authoritativeCurrency}) diverge da moeda do pedido (${payment.currency}).`;
      } else if (
        params.authoritativeAmountCents !== Number(payment.amount_cents) ||
        Number(payment.amount_cents) !== Number(order.total_cents)
      ) {
        divergence = `AMOUNT_MISMATCH: Valor informado (${params.authoritativeAmountCents}) diverge do total validado do pedido (${payment.amount_cents}).`;
      } else if (
        params.externalReference &&
        params.externalReference !== payment.external_reference
      ) {
        divergence = `REFERENCE_MISMATCH: Referência externa (${params.externalReference}) diverge da esperada (${payment.external_reference}).`;
      } else if (params.externalPaymentId) {
        const [dupExt] = await conn.execute<PaymentRow[]>(
          `SELECT id FROM retail_payments WHERE provider = ? AND external_payment_id = ? AND id <> ? LIMIT 1`,
          [params.provider, params.externalPaymentId, payment.id]
        );
        if (dupExt[0]) {
          divergence = `DUPLICATE_EXTERNAL_PAYMENT_ID: Identificador externo ${params.externalPaymentId} já está associado a outro pagamento.`;
        }
      }

      if (divergence) {
        await conn.execute(
          `UPDATE retail_payments SET divergence_alert = ?, last_reconciled_at = NOW() WHERE id = ?`,
          [divergence, payment.id]
        );
        await conn.execute(
          `INSERT INTO retail_payment_events (
            id, tenant_id, store_id, order_id, payment_id, provider,
            external_event_id, event_type, signature_verified, processing_status,
            previous_status, new_status, amount_cents, currency, payload_summary_json, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'payment.divergence_blocked', ?, 'rejected_divergence', ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            params.tenantId,
            payment.store_id,
            payment.order_id,
            payment.id,
            params.provider,
            params.externalEventId,
            params.signatureVerified ? 1 : 0,
            prevStatus,
            prevStatus,
            params.authoritativeAmountCents,
            params.authoritativeCurrency,
            JSON.stringify(params.payloadSummary || {}),
            divergence,
          ]
        );

        const [updated] = await conn.execute<PaymentRow[]>(
          `SELECT * FROM retail_payments WHERE id = ? LIMIT 1`,
          [payment.id]
        );
        return {
          outcome: "rejected_divergence",
          divergenceAlert: divergence,
          payment: this.mapPayment(updated[0]),
        };
      }

      if (PaymentInvariants.isOutOfOrderTransition(prevStatus, params.authoritativeStatus)) {
        await conn.execute(
          `INSERT INTO retail_payment_events (
            id, tenant_id, store_id, order_id, payment_id, provider,
            external_event_id, event_type, signature_verified, processing_status,
            previous_status, new_status, amount_cents, currency, payload_summary_json, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ignored_out_of_order', ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            params.tenantId,
            payment.store_id,
            payment.order_id,
            payment.id,
            params.provider,
            params.externalEventId,
            params.eventType,
            params.signatureVerified ? 1 : 0,
            prevStatus,
            prevStatus,
            params.authoritativeAmountCents,
            params.authoritativeCurrency,
            JSON.stringify(params.payloadSummary || {}),
            `Evento fora de ordem ignorado (${prevStatus} -> ${params.authoritativeStatus}).`,
          ]
        );
        return {
          outcome: "ignored_out_of_order",
          payment: this.mapPayment(payment),
        };
      }

      if (order.status === "cancelled" && params.authoritativeStatus === "paid") {
        divergence =
          "LATE_APPROVAL_ON_CANCELLED_ORDER: Pagamento aprovado tardiamente no provedor após cancelamento do pedido. Revisão operacional necessária.";
      }

      await conn.execute(
        `UPDATE retail_payments
            SET external_payment_id = COALESCE(?, external_payment_id),
                status = ?,
                payment_method = COALESCE(?, payment_method),
                payment_method_label = COALESCE(?, payment_method_label),
                divergence_alert = COALESCE(?, divergence_alert),
                approved_at = CASE WHEN ? = 'paid' THEN COALESCE(approved_at, NOW()) ELSE approved_at END,
                failed_at = CASE WHEN ? = 'failed' THEN NOW() ELSE failed_at END,
                expired_at = CASE WHEN ? = 'expired' THEN NOW() ELSE expired_at END,
                cancelled_at = CASE WHEN ? = 'cancelled' THEN NOW() ELSE cancelled_at END,
                last_reconciled_at = NOW()
          WHERE id = ?`,
        [
          params.externalPaymentId,
          params.authoritativeStatus,
          params.paymentMethod,
          params.paymentMethodLabel,
          divergence,
          params.authoritativeStatus,
          params.authoritativeStatus,
          params.authoritativeStatus,
          params.authoritativeStatus,
          payment.id,
        ]
      );

      await conn.execute(
        `UPDATE retail_payment_attempts
            SET external_payment_id = COALESCE(?, external_payment_id),
                status = CASE WHEN ? IN ('paid','failed','expired','cancelled','processing','pending') THEN ? ELSE status END,
                payment_method = COALESCE(?, payment_method),
                failure_code = COALESCE(?, failure_code),
                failure_reason = COALESCE(?, failure_reason),
                completed_at = CASE WHEN ? IN ('paid','failed','expired','cancelled') THEN NOW() ELSE completed_at END
          WHERE payment_id = ?
          ORDER BY attempt_number DESC LIMIT 1`,
        [
          params.externalPaymentId,
          params.authoritativeStatus,
          params.authoritativeStatus,
          params.paymentMethod,
          params.failureCode,
          params.failureReason,
          params.authoritativeStatus,
          payment.id,
        ]
      );

      // Atualiza payment_status do pedido SEM alterar status operacional para 'completed' (§6)
      await conn.execute(
        `UPDATE retail_orders
            SET payment_status = ?,
                paid_amount_cents = CASE WHEN ? = 'paid' THEN ? ELSE paid_amount_cents END,
                paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END
          WHERE id = ?`,
        [
          params.authoritativeStatus,
          params.authoritativeStatus,
          Number(payment.amount_cents),
          params.authoritativeStatus,
          payment.order_id,
        ]
      );

      await conn.execute(
        `INSERT INTO retail_payment_events (
          id, tenant_id, store_id, order_id, payment_id, provider,
          external_event_id, event_type, signature_verified, processing_status,
          previous_status, new_status, amount_cents, currency, payload_summary_json, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processed', ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          params.tenantId,
          payment.store_id,
          payment.order_id,
          payment.id,
          params.provider,
          params.externalEventId,
          params.eventType,
          params.signatureVerified ? 1 : 0,
          prevStatus,
          params.authoritativeStatus,
          params.authoritativeAmountCents,
          params.authoritativeCurrency,
          JSON.stringify(params.payloadSummary || {}),
          divergence,
        ]
      );

      const [updated] = await conn.execute<PaymentRow[]>(
        `SELECT * FROM retail_payments WHERE id = ? LIMIT 1`,
        [payment.id]
      );
      return {
        outcome: "processed",
        divergenceAlert: divergence,
        payment: this.mapPayment(updated[0]),
      };
    });
  }

  public static async recordPaymentRefundTx(params: {
    tenantId: string;
    paymentId: string;
    provider: RetailPaymentProviderName;
    externalRefundId: string;
    refundAmountCents: number;
    reason: string;
    actorUserId: string;
    payloadSummary: Record<string, unknown>;
  }): Promise<{ outcome: "processed" | "ignored_duplicate"; payment: RetailPayment }> {
    assertXamppRuntimeAllowed();

    return withXamppTransaction(async (conn) => {
      const eventKey = `refund:${params.externalRefundId.trim()}`;
      const [existingEv] = await conn.execute<EventRow[]>(
        `SELECT id FROM retail_payment_events WHERE provider = ? AND external_event_id = ? LIMIT 1`,
        [params.provider, eventKey]
      );
      if (existingEv[0]) {
        const [pRows] = await conn.execute<PaymentRow[]>(
          `SELECT * FROM retail_payments WHERE id = ? AND tenant_id = ? LIMIT 1`,
          [params.paymentId, params.tenantId]
        );
        return { outcome: "ignored_duplicate", payment: this.mapPayment(pRows[0]) };
      }

      const [payRows] = await conn.execute<PaymentRow[]>(
        `SELECT * FROM retail_payments WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [params.paymentId, params.tenantId]
      );
      const payment = payRows[0];
      if (!payment) throw new NotFoundError("Pagamento não encontrado.");

      if (payment.status !== "paid" && payment.status !== "partially_refunded") {
        throw new ValidationError(
          `Apenas pagamentos aprovados podem ser reembolsados (status atual: ${payment.status}).`
        );
      }

      const newRefunded = Number(payment.refunded_amount_cents || 0) + params.refundAmountCents;
      if (params.refundAmountCents <= 0 || newRefunded > Number(payment.amount_cents)) {
        throw new ValidationError("O valor de reembolso excede o saldo pago disponível.");
      }

      const nextStatus: RetailPaymentStatus =
        newRefunded >= Number(payment.amount_cents) ? "refunded" : "partially_refunded";

      await conn.execute(
        `UPDATE retail_payments
            SET refunded_amount_cents = ?, status = ?, refunded_at = NOW(), last_reconciled_at = NOW()
          WHERE id = ?`,
        [newRefunded, nextStatus, payment.id]
      );

      await conn.execute(
        `UPDATE retail_orders
            SET refunded_amount_cents = ?, payment_status = ?
          WHERE id = ? AND tenant_id = ?`,
        [newRefunded, nextStatus, payment.order_id, params.tenantId]
      );

      await conn.execute(
        `INSERT INTO retail_payment_events (
          id, tenant_id, store_id, order_id, payment_id, provider,
          external_event_id, event_type, signature_verified, processing_status,
          previous_status, new_status, amount_cents, currency, payload_summary_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'payment.refunded', 1, 'processed', ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          params.tenantId,
          payment.store_id,
          payment.order_id,
          payment.id,
          params.provider,
          eventKey,
          payment.status,
          nextStatus,
          params.refundAmountCents,
          payment.currency,
          JSON.stringify({
            ...params.payloadSummary,
            externalRefundId: params.externalRefundId,
            reason: params.reason,
            actorUserId: params.actorUserId,
          }),
        ]
      );

      const [updated] = await conn.execute<PaymentRow[]>(
        `SELECT * FROM retail_payments WHERE id = ? LIMIT 1`,
        [payment.id]
      );
      return { outcome: "processed", payment: this.mapPayment(updated[0]) };
    });
  }

  public static async saveOrderPaymentShareToken(params: {
    context: TenantContext;
    orderId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<void> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(params.context.role, "manage_retail_orders");

    await xamppQuery(
      `UPDATE retail_orders
          SET payment_share_token_hash = ?, payment_share_expires_at = ?
        WHERE id = ? AND tenant_id = ?`,
      [params.tokenHash, new Date(params.expiresAt), params.orderId, params.context.tenantId]
    );
  }

  public static async getPublicPaymentShareView(params: {
    storeSlug: string;
    shareToken: string;
  }): Promise<PublicOrderPaymentShareView | null> {
    assertXamppRuntimeAllowed();
    if (!params.shareToken || params.shareToken.length < 24) return null;

    const tokenHash = hashOpaqueToken(params.shareToken.trim());
    const rows = await xamppQuery<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT o.*, s.store_name, s.slug AS store_slug
         FROM retail_orders o
         INNER JOIN retail_stores s ON s.id = o.store_id
         INNER JOIN tenants t ON t.id = o.tenant_id
        WHERE s.slug = ?
          AND s.is_active = 1
          AND t.status = 'active'
          AND o.payment_share_token_hash = ?
        LIMIT 1`,
      [params.storeSlug, tokenHash]
    );

    const row = rows[0];
    if (!row || !row.payment_share_expires_at) return null;
    if (new Date(String(row.payment_share_expires_at)).getTime() <= Date.now()) {
      return null;
    }

    const connRows = await xamppQuery<ConnectionRow[]>(
      `SELECT * FROM retail_payment_connections WHERE tenant_id = ? LIMIT 1`,
      [row.tenant_id]
    );
    const connSummary = this.mapConnectionSummary(
      connRows[0],
      String(row.tenant_id),
      String(row.store_id)
    );

    const orderObj = await XamppRetailOrderAdapter.getOrderById(
      {
        tenantId: String(row.tenant_id),
        tenantName: String(row.store_name),
        slug: String(row.store_slug),
        role: "owner",
        status: "active",
        userId: "system",
      },
      String(row.id)
    );

    const eligibility = PaymentInvariants.evaluateOrderPaymentEligibility(orderObj, connSummary);

    const payRows = await xamppQuery<PaymentRow[]>(
      `SELECT * FROM retail_payments WHERE order_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 1`,
      [row.id, row.tenant_id]
    );
    const activePayment = payRows[0];

    return {
      orderId: orderObj.id,
      orderNumber: orderObj.orderNumber,
      operationalStatus: orderObj.status,
      paymentStatus: orderObj.paymentStatus || "not_started",
      currency: orderObj.currency,
      subtotalCents: orderObj.subtotalCents,
      shippingFeeCents: orderObj.shippingFeeCents ?? null,
      discountCents: orderObj.discountCents ?? 0,
      totalCents: orderObj.totalCents,
      paidAmountCents: orderObj.paidAmountCents ?? 0,
      refundedAmountCents: orderObj.refundedAmountCents ?? 0,
      customerFirstName: PaymentInvariants.minimizeCustomerName(orderObj.customerName),
      deliveryMode: orderObj.deliveryMode,
      storeName: String(row.store_name),
      storeSlug: String(row.store_slug || params.storeSlug),
      receiverAccountLabel: connSummary.sellerAccountLabel,
      provider: connSummary.status === "connected" ? connSummary.provider : null,
      canInitiatePayment: eligibility.eligible,
      blockedReason: eligibility.reason,
      activeCheckoutUrl:
        activePayment && activePayment.status === "pending" ? activePayment.checkout_url : null,
      activePaymentId: activePayment ? activePayment.id : null,
      shareExpiresAt: new Date(String(row.payment_share_expires_at)).toISOString(),
      items: orderObj.items.map((it) => ({
        productName: it.productNameSnapshot,
        variantName: it.variantNameSnapshot,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        lineTotalCents: it.lineTotalCents,
      })),
    };
  }

  public static async listPayments(
    context: TenantContext,
    filter: RetailPaymentsFilter = {}
  ): Promise<RetailPaymentsListResult> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "view_retail_payments");

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(50, Math.max(1, filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const params: unknown[] = [context.tenantId];
    let whereSql = `WHERE p.tenant_id = ?`;

    if (filter.status && filter.status !== "all") {
      whereSql += ` AND p.status = ?`;
      params.push(filter.status);
    }

    if (filter.search?.trim()) {
      const q = `%${filter.search.trim()}%`;
      whereSql += ` AND (o.order_number LIKE ? OR p.external_payment_id LIKE ? OR p.external_reference LIKE ?)`;
      params.push(q, q, q);
    }

    const countRows = await xamppQuery<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total
         FROM retail_payments p
         INNER JOIN retail_orders o ON o.id = p.order_id
        ${whereSql}`,
      params
    );
    const totalCount = Number(countRows[0]?.total || 0);

    const rows = await xamppQuery<PaymentRow[]>(
      `SELECT p.*, o.order_number, o.customer_name
         FROM retail_payments p
         INNER JOIN retail_orders o ON o.id = p.order_id
        ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return {
      payments: rows.map((r) => this.mapPayment(r)),
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }

  public static async getPaymentWithDetails(
    context: TenantContext,
    paymentId: string
  ): Promise<RetailPaymentWithDetails> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "view_retail_payments");

    const rows = await xamppQuery<PaymentRow[]>(
      `SELECT p.*, o.order_number, o.customer_name
         FROM retail_payments p
         INNER JOIN retail_orders o ON o.id = p.order_id
        WHERE p.id = ? AND p.tenant_id = ? LIMIT 1`,
      [paymentId, context.tenantId]
    );
    const paymentRow = rows[0];
    if (!paymentRow) {
      throw new NotFoundError("Transação financeira não encontrada neste estabelecimento.");
    }

    const [order, attemptRows, eventRows] = await Promise.all([
      XamppRetailOrderAdapter.getOrderById(context, paymentRow.order_id),
      xamppQuery<AttemptRow[]>(
        `SELECT * FROM retail_payment_attempts WHERE payment_id = ? AND tenant_id = ? ORDER BY attempt_number DESC`,
        [paymentId, context.tenantId]
      ),
      xamppQuery<EventRow[]>(
        `SELECT * FROM retail_payment_events WHERE payment_id = ? AND tenant_id = ? ORDER BY created_at DESC`,
        [paymentId, context.tenantId]
      ),
    ]);

    return {
      ...this.mapPayment(paymentRow),
      order,
      attempts: attemptRows.map((a) => this.mapAttempt(a)),
      events: eventRows.map((e) => this.mapEvent(e)),
    };
  }

  public static async getPaymentByOrderId(
    context: TenantContext,
    orderId: string
  ): Promise<RetailPayment | null> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "view_retail_payments");

    const rows = await xamppQuery<PaymentRow[]>(
      `SELECT p.*, o.order_number, o.customer_name
         FROM retail_payments p
         INNER JOIN retail_orders o ON o.id = p.order_id
        WHERE p.order_id = ? AND p.tenant_id = ?
        ORDER BY p.created_at DESC LIMIT 1`,
      [orderId, context.tenantId]
    );
    return rows[0] ? this.mapPayment(rows[0]) : null;
  }

  public static async getPaymentStats(context: TenantContext): Promise<RetailPaymentStats> {
    assertXamppRuntimeAllowed();
    RetailPermissionService.assertPermission(context.role, "view_retail_payments");

    const rows = await xamppQuery<PaymentRow[]>(
      `SELECT * FROM retail_payments WHERE tenant_id = ? ORDER BY created_at ASC`,
      [context.tenantId]
    );

    return computeStatsFromPayments(rows.map((r) => this.mapPayment(r)));
  }
}

export { computeStatsFromPayments };
