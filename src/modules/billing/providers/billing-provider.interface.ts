import type {
  BillingCycle,
  BillingInvoiceStatus,
  BillingProviderName,
  BillingProviderRuntimeStatus,
  BillingSubscriptionStatus,
} from "../types/billing.types";

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
  resourceType: "subscription_preapproval" | "subscription_authorized_payment";
  externalResourceId: string;
  externalSubscriptionId: string | null;
  externalReference: string | null;
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

export interface BillingProvider {
  readonly providerName: BillingProviderName;
  getRuntimeStatus(): BillingProviderRuntimeStatus;
  createRecurringAuthorization(
    input: CreateExternalSubscriptionInput
  ): Promise<CreatedExternalSubscription>;
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
  }): {
    externalEventId: string;
    eventType: string;
    resourceType: "subscription_preapproval" | "subscription_authorized_payment";
    externalResourceId: string;
  };
  fetchAuthoritativeEventResource(params: {
    resourceType: "subscription_preapproval" | "subscription_authorized_payment";
    externalResourceId: string;
    rawBodyObj?: Record<string, unknown>;
  }): Promise<AuthoritativeBillingEvent>;
}
