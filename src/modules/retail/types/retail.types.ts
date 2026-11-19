import type { Database } from "@/types/database.types";

export type RetailStoreRow = Database["public"]["Tables"]["retail_stores"]["Row"];
export type RetailCategoryRow = Database["public"]["Tables"]["retail_categories"]["Row"];
export type RetailProductRow = Database["public"]["Tables"]["retail_products"]["Row"];
export type RetailVariantRow = Database["public"]["Tables"]["retail_variants"]["Row"];
export type RetailProductOptionRow = Database["public"]["Tables"]["retail_product_options"]["Row"];
export type RetailProductImageRow = Database["public"]["Tables"]["retail_product_images"]["Row"];

export type RetailProductStatus = "draft" | "published" | "archived";
export type StorefrontTemplate = "editorial" | "experimental";
export type RetailInventoryMode = "track_quantity" | "untracked";

export interface RetailStore {
  id: string;
  tenantId: string;
  storeName: string;
  slug: string;
  currency: string;
  template: StorefrontTemplate;
  brandHeadline: string | null;
  brandSubheadline: string | null;
  aboutText: string | null;
  heroBadge: string | null;
  heroImagePath: string | null;
  accentColor: string | null;
  secondaryColor: string | null;
  announcementBar: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  socialLinks: Record<string, string>;
  isActive: boolean;
  inventoryMode: RetailInventoryMode;
  createdAt: string;
  updatedAt: string;
}

export interface PublicStorefront {
  storeId: string;
  tenantId: string;
  slug: string;
  storeName: string;
  currency: string;
  template: StorefrontTemplate;
  brandHeadline: string | null;
  brandSubheadline: string | null;
  aboutText: string | null;
  heroBadge: string | null;
  heroImagePath: string | null;
  accentColor: string | null;
  secondaryColor: string | null;
  announcementBar: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  socialLinks: Record<string, string>;
  isActive: boolean;
}

export interface RetailCategory {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
}

export interface RetailProductOption {
  id: string;
  tenantId: string;
  productId: string;
  name: string;
  position: number;
  values: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RetailVariant {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  name: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stockQuantity: number;
  isAvailable: boolean;
  optionsSummary: Record<string, string>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RetailProductImage {
  id: string;
  tenantId: string;
  productId: string;
  storagePath: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  variantId: string | null;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetailProduct {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  status: RetailProductStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetailProductWithDetails extends RetailProduct {
  categories: RetailCategory[];
  variants: RetailVariant[];
  options: RetailProductOption[];
  images: RetailProductImage[];
  primaryImage?: RetailProductImage | null;
  minPriceCents: number;
  maxPriceCents: number;
  totalStock: number;
}

export interface RetailCatalogFilter {
  search?: string;
  status?: RetailProductStatus | "all";
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export interface RetailCatalogResult {
  products: RetailProductWithDetails[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RetailCatalogStats {
  totalProducts: number;
  publishedProducts: number;
  draftProducts: number;
  archivedProducts: number;
  outOfStockProducts: number;
  totalCategories: number;
}

export interface RetailCategoryDistributionItem {
  categoryId: string;
  name: string;
  productCount: number;
}

export interface RetailDashboardSummary {
  stats: RetailCatalogStats;
  lowStockProducts: number;
  totalStockUnits: number;
  categoryDistribution: RetailCategoryDistributionItem[];
  recentProducts: RetailProductWithDetails[];
}

/**
 * Contrato preparado para integração futura da Fase 6C (Pedidos, Receita e Conversão),
 * sem exibir dados fictícios enquanto o módulo não estiver implementado.
 */
export interface FutureCommerceMetricsSlot {
  available: false;
  plannedPhase: "6C";
}

export type StorefrontSortOption = "featured" | "price_asc" | "price_desc" | "name_asc" | "newest";

export interface StorefrontCatalogFilter {
  categorySlug?: string;
  search?: string;
  sort?: StorefrontSortOption;
  page?: number;
  pageSize?: number;
}

// ==============================================================================
// FASE 6C: CARRINHO PERSISTENTE, SOLICITAÇÕES DE PEDIDO E ESTOQUE TRANSACIONAL
// ==============================================================================

export type RetailCartStatus = "active" | "converted" | "expired" | "abandoned";

export type RetailOrderStatus =
  | "requested"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type RetailDeliveryMode = "pickup" | "delivery";

export type RetailOrderChannel = "storefront" | "manual";

export interface RetailCartItem {
  id: string;
  cartId: string;
  tenantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  unitPriceCents: number;
  compareAtPriceCents: number | null;
  quantity: number;
  lineTotalCents: number;
  availableStock: number;
  isAvailable: boolean;
  isProductPublished: boolean;
  imageUrl: string | null;
  availabilityIssue?: string | null;
}

export interface RetailCart {
  id: string | null;
  tenantId: string;
  storeId: string;
  storeSlug: string;
  currency: string;
  inventoryMode: RetailInventoryMode;
  status: RetailCartStatus;
  items: RetailCartItem[];
  itemCount: number;
  subtotalCents: number;
  hasUnavailableItems: boolean;
  expiresAt: string | null;
}

export interface RetailOrderItem {
  id: string;
  orderId: string;
  tenantId: string;
  productId: string | null;
  variantId: string | null;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  imageUrlSnapshot: string | null;
  createdAt: string;
}

export interface RetailOrderStatusHistoryEntry {
  id: string;
  orderId: string;
  tenantId: string;
  fromStatus: RetailOrderStatus | null;
  toStatus: RetailOrderStatus;
  changedByUserId: string | null;
  changedByNameSnapshot: string | null;
  reason: string | null;
  createdAt: string;
}

export interface RetailOrder {
  id: string;
  tenantId: string;
  storeId: string;
  cartId: string | null;
  orderNumber: string;
  status: RetailOrderStatus;
  stockDeducted: boolean;
  channel: RetailOrderChannel;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryMode: RetailDeliveryMode;
  deliveryAddress: string | null;
  notes: string | null;
  cancellationReason: string | null;
  idempotencyKey: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  // Fase 6D — Estado financeiro independente do ciclo operacional
  paymentStatus?: RetailPaymentStatus;
  shippingFeeCents?: number | null;
  discountCents?: number;
  paidAmountCents?: number;
  refundedAmountCents?: number;
  paidAt?: string | null;
  hasPaymentShareLink?: boolean;
  paymentShareExpiresAt?: string | null;
}

export interface RetailOrderWithDetails extends RetailOrder {
  items: RetailOrderItem[];
  history: RetailOrderStatusHistoryEntry[];
}

export interface RetailOrdersFilter {
  status?: RetailOrderStatus | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface RetailOrdersListResult {
  orders: RetailOrder[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RetailOrderStats {
  totalOrders: number;
  requestedOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  /** Soma em centavos dos pedidos solicitados/ativos (não representa cobrança online) */
  requestedSubtotalCents: number;
  /** Soma em centavos apenas dos pedidos confirmados/em andamento/concluídos */
  confirmedTotalCents: number;
}

export interface PublicOrderTrackingView {
  orderNumber: string;
  status: RetailOrderStatus;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  customerName: string;
  deliveryMode: RetailDeliveryMode;
  /** Nunca expor endereço completo na rota pública (apenas confirmação booleana) */
  hasDeliveryAddress: boolean;
  notes: string | null;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  items: RetailOrderItem[];
  storeName: string;
  storeSlug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  // Fase 6D — Informações financeiras seguras na visualização do recibo
  paymentStatus?: RetailPaymentStatus;
  shippingFeeCents?: number | null;
  discountCents?: number;
  paidAmountCents?: number;
  refundedAmountCents?: number;
  paidAt?: string | null;
  canStartOnlinePayment?: boolean;
  paymentBlockedReason?: string | null;
  receiverAccountLabel?: string | null;
  activeCheckoutUrl?: string | null;
}

// ==============================================================================
// FASE 6D: INTEGRAÇÃO DE PAGAMENTOS, CHECKOUT FINANCEIRO E GESTÃO DE RECEBIMENTOS
// ==============================================================================

export type RetailPaymentProviderName = "mercado_pago" | "xampp_sandbox";

export type RetailPaymentEnvironment = "sandbox";

export type RetailPaymentConnectionStatus =
  | "connected"
  | "disconnected"
  | "expired"
  | "error";

export type RetailPaymentStatus =
  | "not_started"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "disputed";

export type RetailPaymentMethod =
  | "pix"
  | "credit_card"
  | "debit_card"
  | "account_money"
  | "boleto"
  | "hosted_checkout"
  | "other";

export type RetailPaymentEventProcessingStatus =
  | "processed"
  | "ignored_duplicate"
  | "ignored_out_of_order"
  | "rejected_divergence"
  | "failed_retryable";

/**
 * Resumo comercial da conexão de pagamento do estabelecimento (Zero Segredos/Tokens).
 */
export interface RetailPaymentConnectionSummary {
  id: string | null;
  tenantId: string;
  storeId: string;
  provider: RetailPaymentProviderName;
  environment: RetailPaymentEnvironment;
  status: RetailPaymentConnectionStatus;
  sellerAccountId: string | null;
  sellerAccountLabel: string | null;
  publicKey: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastVerifiedAt: string | null;
}

export interface RetailPayment {
  id: string;
  tenantId: string;
  storeId: string;
  orderId: string;
  orderNumber?: string;
  customerNameMinimized?: string;
  connectionId: string | null;
  provider: RetailPaymentProviderName;
  environment: RetailPaymentEnvironment;
  externalPaymentId: string | null;
  externalPreferenceId: string | null;
  externalReference: string;
  sellerAccountId: string;
  currency: string;
  amountCents: number;
  refundedAmountCents: number;
  status: RetailPaymentStatus;
  paymentMethod: RetailPaymentMethod | null;
  paymentMethodLabel: string | null;
  checkoutUrl: string | null;
  idempotencyKey: string;
  payerEmailMasked: string | null;
  divergenceAlert: string | null;
  approvedAt: string | null;
  failedAt: string | null;
  expiredAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  lastReconciledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetailPaymentAttempt {
  id: string;
  tenantId: string;
  storeId: string;
  orderId: string;
  paymentId: string;
  attemptNumber: number;
  provider: RetailPaymentProviderName;
  externalAttemptId: string | null;
  externalPaymentId: string | null;
  amountCents: number;
  currency: string;
  status: "pending" | "processing" | "paid" | "failed" | "expired" | "cancelled";
  paymentMethod: string | null;
  checkoutUrl: string | null;
  idempotencyKey: string;
  failureCode: string | null;
  failureReason: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetailPaymentEvent {
  id: string;
  tenantId: string;
  storeId: string;
  orderId: string | null;
  paymentId: string | null;
  provider: RetailPaymentProviderName;
  externalEventId: string;
  eventType: string;
  signatureVerified: boolean;
  processingStatus: RetailPaymentEventProcessingStatus;
  previousStatus: string | null;
  newStatus: string | null;
  amountCents: number | null;
  currency: string | null;
  payloadSummary: Record<string, unknown>;
  errorMessage: string | null;
  processedAt: string;
  createdAt: string;
}

export interface RetailPaymentWithDetails extends RetailPayment {
  order: RetailOrder;
  attempts: RetailPaymentAttempt[];
  events: RetailPaymentEvent[];
}

export interface RetailPaymentsFilter {
  status?: RetailPaymentStatus | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface RetailPaymentsListResult {
  payments: RetailPayment[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RetailPaymentPeriodBucket {
  periodLabel: string;
  confirmedCents: number;
  refundedCents: number;
  netConfirmedCents: number;
  paidCount: number;
}

export interface RetailPaymentStats {
  /** Valor bruto confirmado pelo provedor (pagamentos paid + partially_refunded) */
  grossConfirmedCents: number;
  /** Valor efetivamente recebido após subtrair reembolsos confirmados */
  netReceivedCents: number;
  /** Soma em centavos de pagamentos pendentes/em processamento (NÃO integra receita) */
  pendingCents: number;
  /** Soma em centavos de tentativas recusadas/expiradas/canceladas */
  rejectedOrExpiredCents: number;
  /** Soma em centavos de valores efetivamente reembolsados */
  refundedCents: number;
  paidOrdersCount: number;
  pendingPaymentsCount: number;
  rejectedPaymentsCount: number;
  refundedPaymentsCount: number;
  divergenceAlertsCount: number;
  periodEvolution: RetailPaymentPeriodBucket[];
}

/**
 * Visão pública com escopo mínimo do link opaco de pagamento (/loja/[slug]/pagamento/[shareToken]).
 * Nunca inclui endereço, telefone, e-mail completo ou token administrativo do pedido (§7).
 */
export interface PublicOrderPaymentShareView {
  orderId: string;
  orderNumber: string;
  operationalStatus: RetailOrderStatus;
  paymentStatus: RetailPaymentStatus;
  currency: string;
  subtotalCents: number;
  shippingFeeCents: number | null;
  discountCents: number;
  totalCents: number;
  paidAmountCents: number;
  refundedAmountCents: number;
  customerFirstName: string;
  deliveryMode: RetailDeliveryMode;
  storeName: string;
  storeSlug: string;
  receiverAccountLabel: string | null;
  provider: RetailPaymentProviderName | null;
  canInitiatePayment: boolean;
  blockedReason: string | null;
  activeCheckoutUrl: string | null;
  activePaymentId: string | null;
  shareExpiresAt: string;
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
}


