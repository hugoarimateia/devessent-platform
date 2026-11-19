import type {
  RetailPaymentEnvironment,
  RetailPaymentMethod,
  RetailPaymentProviderName,
  RetailPaymentStatus,
} from "../types/retail.types";

export interface PaymentSessionLineItem {
  id: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
}

export interface CreatePaymentSessionInput {
  tenantId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  orderId: string;
  orderNumber: string;
  externalReference: string;
  sellerAccountId: string;
  sellerAccessToken: string;
  currency: string;
  amountCents: number;
  shippingFeeCents: number;
  items: PaymentSessionLineItem[];
  payerName: string;
  payerEmail?: string | null;
  returnUrl: string;
  webhookUrl?: string | null;
  expiresAt: string;
  idempotencyKey: string;
}

export interface CreatedPaymentSession {
  provider: RetailPaymentProviderName;
  environment: RetailPaymentEnvironment;
  externalPreferenceId: string;
  externalReference: string;
  checkoutUrl: string;
  expiresAt: string;
  rawMetadata: Record<string, unknown>;
}

export interface AuthoritativeTransactionRecord {
  provider: RetailPaymentProviderName;
  externalPaymentId: string;
  externalPreferenceId: string | null;
  externalReference: string;
  sellerAccountId: string;
  status: RetailPaymentStatus;
  amountCents: number;
  refundedAmountCents: number;
  currency: string;
  paymentMethod: RetailPaymentMethod;
  paymentMethodLabel: string;
  approvedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  rawSummary: Record<string, unknown>;
}

export interface ValidateWebhookNotificationInput {
  headers: Record<string, string | null | undefined>;
  query: Record<string, string | null | undefined>;
  rawBody: string;
  webhookSecret: string;
  nowTimestampSeconds?: number;
  maxSkewSeconds?: number;
}

export interface ValidatedWebhookNotification {
  verified: boolean;
  externalEventId: string;
  eventType: string;
  externalPaymentId: string;
  action: string;
  timestampSeconds: number;
}

export interface RequestRefundInput {
  externalPaymentId: string;
  sellerAccountId: string;
  sellerAccessToken: string;
  refundAmountCents: number;
  totalPaymentAmountCents: number;
  idempotencyKey: string;
  reason: string;
}

export interface ConfirmedRefundRecord {
  externalRefundId: string;
  externalPaymentId: string;
  refundedAmountCents: number;
  status: "approved" | "pending" | "rejected";
  confirmedAt: string;
  rawSummary: Record<string, unknown>;
}

/**
 * Contrato independente de fornecedor para gateways de pagamento do DevEssent Retail (§3).
 */
export interface RetailPaymentProvider {
  readonly providerName: RetailPaymentProviderName;
  readonly environment: RetailPaymentEnvironment;

  /**
   * 1. Criar sessão hospedada de pagamento (ex.: Checkout Pro preference).
   */
  createPaymentSession(input: CreatePaymentSessionInput): Promise<CreatedPaymentSession>;

  /**
   * 2. Consultar status e obter informações autoritativas da transação diretamente no provedor.
   */
  getTransaction(params: {
    externalPaymentId: string;
    sellerAccessToken: string;
    expectedSellerAccountId: string;
  }): Promise<AuthoritativeTransactionRecord>;

  /**
   * 3. Validar notificação de webhook assinada (HMAC-SHA256 + janela anti-replay).
   */
  validateWebhookNotification(
    input: ValidateWebhookNotificationInput
  ): ValidatedWebhookNotification;

  /**
   * 4. Cancelar cobrança pendente no provedor quando suportado.
   */
  cancelPayment(params: {
    externalPaymentId: string;
    sellerAccessToken: string;
  }): Promise<{ cancelled: boolean; status: RetailPaymentStatus }>;

  /**
   * 5. Solicitar/consultar reembolso confirmado no provedor (com X-Idempotency-Key).
   */
  requestRefund(input: RequestRefundInput): Promise<ConfirmedRefundRecord>;

  /**
   * 6. Reconciliar pagamento buscando por referência externa ou ID da transação no provedor.
   */
  reconcilePayment(params: {
    externalPaymentId?: string | null;
    externalReference: string;
    sellerAccessToken: string;
    expectedSellerAccountId: string;
  }): Promise<AuthoritativeTransactionRecord | null>;
}
