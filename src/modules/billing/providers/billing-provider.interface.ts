import type {
  BillingCycle,
  BillingInvoiceStatus,
  BillingProviderName,
  BillingProviderRuntimeStatus,
  BillingSubscriptionStatus,
  OfficialSandboxIdentityVerification,
} from "../types/billing.types";

export type BillingWebhookResourceType =
  | "subscription_preapproval"
  | "subscription_authorized_payment"
  | "payment"
  | "subscription_preapproval_plan";

export interface CreateExternalSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
  tenantName: string;
  planName: string;
  externalReference: string;
  amountCents: number;
  currency: "BRL";
  billingCycle: BillingCycle;
  scheduledStartDate: string;
  payerEmail: string;
  backUrl: string;
}

export interface CreatedExternalSubscription {
  provider: BillingProviderName;
  externalSubscriptionId: string;
  externalPlanId: string | null;
  authorizationUrl: string;
  providerStatus: "pending" | "authorized" | "paused" | "cancelled";
  rawSummary: Record<string, unknown>;
}

export interface AuthorizeExternalSubscriptionInput {
  externalSubscriptionId: string;
  cardBrand: string;
  cardLast4: string;
  payerEmail: string;
}

export interface UpdateExternalPaymentMethodInput {
  externalSubscriptionId: string;
  cardBrand: string;
  cardLast4: string;
}

export interface AuthoritativeBillingEvent {
  provider: BillingProviderName;
  externalEventId: string;
  eventType: string;
  resourceType: BillingWebhookResourceType;
  externalResourceId: string;
  externalSubscriptionId: string | null;
  externalReference: string | null;
  collectorId?: string | null;
  applicationId?: string | null;
  invoiceStatus: BillingInvoiceStatus | null;
  subscriptionStatus: BillingSubscriptionStatus | null;
  amountCents: number | null;
  currency: "BRL";
  dueDate: string | null;
  billingCycleKey: string | null;
  paymentMethodLabel: string | null;
  failureCode: string | null;
  failureReason: string | null;
  rawSummary: Record<string, unknown>;
}

export interface VerifiedBillingWebhookHeader {
  externalEventId: string;
  hasProviderEventId: boolean;
  eventType: string;
  resourceType: BillingWebhookResourceType;
  externalResourceId: string;
  signatureVerified: boolean;
  authMethod: "hmac_sha256" | "authoritative_fallback";
}

export interface BillingProvider {
  readonly providerName: BillingProviderName;
  getRuntimeStatus(): BillingProviderRuntimeStatus;
  verifyOfficialSandboxCredentials(
    forceRefresh?: boolean
  ): Promise<OfficialSandboxIdentityVerification>;
  createRecurringAuthorization(
    input: CreateExternalSubscriptionInput
  ): Promise<CreatedExternalSubscription>;
  getExternalSubscription(externalSubscriptionId: string): Promise<AuthoritativeBillingEvent>;
  searchExternalSubscriptions(params: {
    externalReference?: string;
    payerEmail?: string;
    limit?: number;
  }): Promise<AuthoritativeBillingEvent[]>;
  getAuthorizedPayment(authorizedPaymentId: string): Promise<AuthoritativeBillingEvent>;
  searchAuthorizedPayments(params: {
    preapprovalId?: string;
    externalReference?: string;
    limit?: number;
  }): Promise<AuthoritativeBillingEvent[]>;
  updateExternalSubscription(params: {
    externalSubscriptionId: string;
    status?: "paused" | "authorized" | "cancelled";
    reason?: string;
    autoRecurringAmountCents?: number;
  }): Promise<{ updated: boolean; providerStatus: string }>;
  confirmSandboxAuthorization(
    input: AuthorizeExternalSubscriptionInput
  ): Promise<{ authorized: boolean; paymentMethodLabel: string }>;
  updatePaymentMethod(
    input: UpdateExternalPaymentMethodInput
  ): Promise<{ updated: boolean; paymentMethodLabel: string }>;
  cancelExternalSubscription(params: {
    externalSubscriptionId: string;
    reason: string;
  }): Promise<{ cancelled: boolean }>;
  validateWebhookSignature(params: {
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
    rawBody: string;
  }): VerifiedBillingWebhookHeader;
  fetchAuthoritativeEventResource(params: {
    resourceType: BillingWebhookResourceType;
    externalResourceId: string;
    rawBodyObj?: Record<string, unknown>;
  }): Promise<AuthoritativeBillingEvent>;
}
