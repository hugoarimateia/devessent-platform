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
}

