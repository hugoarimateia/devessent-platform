export type BillingCycle = "monthly" | "quarterly" | "semiannual" | "annual";

export type BillingSubscriptionStatus =
  | "awaiting_activation"
  | "awaiting_authorization"
  | "active"
  | "pending_payment"
  | "past_due"
  | "in_regularization"
  | "cancel_scheduled"
  | "cancelled";

export type BillingInvoiceStatus =
  | "scheduled"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "overdue"
  | "refunded"
  | "void";

export type BillingPaymentMethodType =
  | "credit_card"
  | "pix_automatic_future"
  | "unconfigured";

export type BillingProviderName = "mercado_pago" | "sandbox_simulator";

export type ImplementationContractStatus =
  | "draft"
  | "awaiting_entry"
  | "in_development"
  | "delivered_awaiting_balance"
  | "completed"
  | "cancelled";

export type ImplementationInstallmentStatus =
  | "pending"
  | "receipt_attached"
  | "confirmed"
  | "cancelled";

export type ManualPaymentMethod =
  | "pix_manual"
  | "bank_transfer"
  | "cash"
  | "boleto_manual"
  | "card_machine"
  | "other";

export interface BillingPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: number;
  amountCents: number;
  currency: "BRL";
  billingCycle: BillingCycle;
  includedServices: string[];
  isActive: boolean;
  isDemo: boolean;
  archivedAt: string | null;
  linkedSubscriptionsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingPlanHistoryItem {
  id: string;
  planId: string;
  version: number;
  action: "created" | "updated" | "deactivated" | "reactivated";
  previousAmountCents: number | null;
  newAmountCents: number;
  changedFields: Record<string, unknown>;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
}

export interface BillingSubscription {
  id: string;
  tenantId: string;
  tenantName?: string;
  tenantSlug?: string;
  planId: string;
  planNameSnapshot: string;
  planVersionSnapshot: number;
  contractedAmountCents: number;
  currency: "BRL";
  billingCycle: BillingCycle;
  status: BillingSubscriptionStatus;
  environment: "sandbox";
  provider: BillingProviderName;
  externalPlanId: string | null;
  externalSubscriptionId: string | null;
  externalReference: string;
  paymentMethodType: BillingPaymentMethodType;
  paymentMethodLabel: string | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  authorizationUrl: string | null;
  authorizationExpiresAt: string | null;
  authorizedAt: string | null;
  contractAcceptedAt: string | null;
  contractAcceptedByName: string | null;
  activationConfirmedAt: string | null;
  activationConfirmedBy: string | null;
  scheduledStartDate: string;
  activatedAt: string | null;
  nextBillingDate: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodDays: number;
  delinquentSince: string | null;
  consecutiveFailedCharges: number;
  cancelAtPeriodEnd: boolean;
  cancellationRequestedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSubscriptionHistoryItem {
  id: string;
  subscriptionId: string;
  tenantId: string;
  eventType: string;
  previousStatus: string | null;
  newStatus: string | null;
  previousAmountCents: number | null;
  newAmountCents: number | null;
  actorUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface BillingInvoice {
  id: string;
  subscriptionId: string;
  tenantId: string;
  tenantName?: string;
  invoiceNumber: string;
  billingCycleKey: string;
  environment: "sandbox";
  provider: BillingProviderName;
  externalPaymentId: string | null;
  amountCents: number;
  refundedAmountCents: number;
  currency: "BRL";
  status: BillingInvoiceStatus;
  dueDate: string;
  paidAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  paymentMethodType: BillingPaymentMethodType | null;
  paymentMethodLabel: string | null;
  attemptCount: number;
  lastReconciledAt: string | null;
  createdAt: string;
}

export interface BillingWebhookEventView {
  id: string;
  provider: BillingProviderName;
  environment: "sandbox";
  externalEventId: string;
  eventType: string;
  resourceType: string;
  externalResourceId: string | null;
  subscriptionId: string | null;
  invoiceId: string | null;
  tenantId: string | null;
  signatureVerified: boolean;
  processingStatus: string;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export interface ImplementationInstallment {
  id: string;
  contractId: string;
  tenantId: string;
  installmentKind: "entry" | "balance" | "custom_milestone";
  sequenceNumber: number;
  label: string;
  amountCents: number;
  currency: "BRL";
  dueDate: string | null;
  milestoneDescription: string;
  status: ImplementationInstallmentStatus;
  reportedPaymentMethod: ManualPaymentMethod | null;
  receiptStoragePath: string | null;
  receiptFileName: string | null;
  receiptMimeType: string | null;
  receiptSizeBytes: number | null;
  receiptAttachedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmationNote: string | null;
  createdAt: string;
}

export interface ImplementationContractHistoryItem {
  id: string;
  contractId: string;
  installmentId: string | null;
  action: string;
  actorUserId: string | null;
  note: string | null;
  createdAt: string;
}

export interface ImplementationContract {
  id: string;
  tenantId: string;
  tenantName?: string;
  tenantSlug?: string;
  contractCode: string;
  title: string;
  scopeSummary: string;
  totalAmountCents: number;
  entryPercent: number;
  balancePercent: number;
  currency: "BRL";
  status: ImplementationContractStatus;
  customTermsNote: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  projectStartedAt: string | null;
  deliveryConfirmedAt: string | null;
  deliveryConfirmedBy: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  installments: ImplementationInstallment[];
  history?: ImplementationContractHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BillingProviderRuntimeStatus {
  provider: BillingProviderName;
  mode: "official_sandbox_api" | "internal_sandbox_simulator";
  environment: "sandbox";
  liveChargesEnabled: false;
  supportsCreditCardRecurring: boolean;
  supportsScheduledStartDate: boolean;
  supportsPixAutomatic: boolean;
  webhookEndpointPath: string;
  statusNote: string;
}

export interface GlobalBillingOverview {
  environmentLabel: "staging" | "development" | "test" | "production";
  providerStatus: BillingProviderRuntimeStatus;
  metrics: {
    contractedCompaniesCount: number;
    activeSubscriptionsCount: number;
    pendingSetupSubscriptionsCount: number;
    delinquentSubscriptionsCount: number;
    cancelledSubscriptionsCount: number;
    mrrActiveCents: number;
    paidInvoicesPeriodCents: number;
    pendingInvoicesCents: number;
    overdueInvoicesCents: number;
    activeImplementationContractsCount: number;
    pendingImplementationCents: number;
    confirmedImplementationCents: number;
  };
  plans: BillingPlan[];
  subscriptions: BillingSubscription[];
  recentInvoices: BillingInvoice[];
  recentWebhooks: BillingWebhookEventView[];
  implementationContracts: ImplementationContract[];
  tenantsDirectory: Array<{ id: string; name: string; slug: string; status: string }>;
}

export interface TenantOwnerBillingView {
  tenantId: string;
  tenantName: string;
  environmentLabel: "staging" | "development" | "test" | "production";
  providerStatus: BillingProviderRuntimeStatus;
  subscription: BillingSubscription | null;
  plan: BillingPlan | null;
  invoices: BillingInvoice[];
  history: BillingSubscriptionHistoryItem[];
  implementationContracts: ImplementationContract[];
  notifications: Array<{
    id: string;
    notificationType: string;
    status: string;
    createdAt: string;
  }>;
}
