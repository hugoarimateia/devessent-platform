export type FieldSource =
  | "barcode_scan"
  | "authorized_catalog"
  | "client_spreadsheet"
  | "pdf_extract"
  | "ocr_photo"
  | "open_database"
  | "manual_operator"
  | "missing";

export type FieldConfidence =
  | "verified"
  | "high"
  | "medium"
  | "low"
  | "unconfirmed"
  | "missing";

export interface FieldProvenance {
  source: FieldSource;
  confidence: FieldConfidence;
  note: string;
}

export type CaptureMethod =
  | "barcode_camera"
  | "barcode_usb"
  | "barcode_manual"
  | "barcode_image"
  | "photo_ocr"
  | "spreadsheet_csv"
  | "spreadsheet_xlsx"
  | "catalog_pdf"
  | "authorized_feed";

export type DuplicateResolution = "skip" | "update_selected" | "create_variant";

export type BatchItemStatus =
  | "captured"
  | "identified"
  | "reviewed"
  | "approved"
  | "importing"
  | "imported"
  | "updated"
  | "skipped"
  | "partial_image_failed"
  | "failed";

export interface ScannerVariantDraft {
  id: string;
  sku: string;
  name: string;
  gtin: string | null;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  stockQuantity: number | null;
  isAvailable: boolean;
  optionsSummary: Record<string, string>;
}

export interface ScannerImageAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  localRelativePath: string | null;
  remoteUrl: string | null;
  source: FieldSource;
  rightsConfirmed: boolean;
  isPrimary: boolean;
  uploadedStoragePath: string | null;
  uploadedPublicUrl: string | null;
  uploadError: string | null;
}

export interface DuplicateMatchInfo {
  matchType: "sku" | "gtin" | "slug" | "batch_duplicate";
  existingProductId: string;
  existingProductName: string;
  existingSlug: string;
  existingStatus: string;
  matchedSku: string | null;
  matchedVariantId: string | null;
  existingPriceCents: number | null;
  existingStockQuantity: number | null;
}

export interface ScannerItemProvenanceMap {
  gtin: FieldProvenance;
  name: FieldProvenance;
  brand: FieldProvenance;
  description: FieldProvenance;
  category: FieldProvenance;
  presentation: FieldProvenance;
  price: FieldProvenance;
  stock: FieldProvenance;
  image: FieldProvenance;
}

export interface ScannerBatchItem {
  id: string;
  idempotencyKey: string;
  externalSourceId: string | null;
  captureMethod: CaptureMethod;
  status: BatchItemStatus;
  gtin: string | null;
  gtinFormat: string | null;
  gtinValid: boolean;
  name: string;
  brand: string | null;
  description: string | null;
  presentation: string | null;
  categoryName: string | null;
  categoryId: string | null;
  variants: ScannerVariantDraft[];
  images: ScannerImageAttachment[];
  /** Regra comercial fundamental (§7): preço e estoque devem ser confirmados com dados do estabelecimento */
  priceConfirmedByMerchant: boolean;
  stockConfirmedByMerchant: boolean;
  /** Em caso de duplicação, nunca sobrescrever preço/estoque existente sem confirmação explícita (§9) */
  allowOverwritePrice: boolean;
  allowOverwriteStock: boolean;
  updateFields: Array<"name" | "description" | "category" | "images" | "price" | "stock">;
  duplicateMatch: DuplicateMatchInfo | null;
  duplicateResolution: DuplicateResolution;
  lookupStatus: "matched" | "partial" | "not_found" | "skipped";
  lookupSourceLabel: string | null;
  ocrRawText: string | null;
  ocrConfidence: number | null;
  provenance: ScannerItemProvenanceMap;
  pendingReasons: string[];
  approved: boolean;
  importedProductId: string | null;
  importedProductSlug: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchImportSummary {
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  paused: boolean;
  totalApproved: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  partialImageFailedCount: number;
  failedCount: number;
  categoriesCreatedCount: number;
  imagesUploadedCount: number;
  duplicatesAvoidedCount: number;
}

export interface ScannerBatch {
  id: string;
  label: string;
  environment: "staging";
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  defaultCategoryId: string | null;
  defaultCategoryName: string | null;
  duplicateScanPolicy: "ignore" | "increment_stock" | "add_variant";
  createdByUserId: string;
  createdByEmail: string;
  status: "open" | "importing" | "paused" | "completed" | "completed_with_errors";
  pauseRequested: boolean;
  items: ScannerBatchItem[];
  lastImportSummary: BatchImportSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizedSupplierRecord {
  gtin: string;
  sku?: string;
  name: string;
  brand?: string;
  description?: string;
  category?: string;
  presentation?: string;
  imageUrl?: string;
  sourceName: string;
  licenseNote: string;
}

export interface TenantStoreOption {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeTemplate: string;
  storeActive: boolean;
  inventoryMode: string;
  productCount: number;
  categoryCount: number;
  categories: Array<{ id: string; name: string; slug: string }>;
}

export interface AuthorizedOwnerSession {
  userId: string;
  email: string;
  fullName: string;
  accessToken: string;
  expiresAt: number;
}
