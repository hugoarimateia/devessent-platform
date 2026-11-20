import { createHash, randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { VariantInvariants } from "@/modules/retail/domain/variant-invariants";
import { buildSafeSku, validateGtin } from "./barcode";
import type {
  CaptureMethod,
  DuplicateMatchInfo,
  FieldProvenance,
  ScannerBatch,
  ScannerBatchItem,
  ScannerImageAttachment,
  ScannerItemProvenanceMap,
  ScannerVariantDraft,
} from "./types";

function getBatchesDir(): string {
  return path.resolve(process.cwd(), "data/batches");
}

function ensureBatchesDir(): string {
  const dir = getBatchesDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getBatchFilePath(batchId: string): string {
  const safeId = batchId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) throw new Error("Identificador de lote inválido.");
  return path.join(ensureBatchesDir(), `${safeId}.json`);
}

export function defaultMissingProvenance(note: string): FieldProvenance {
  return { source: "missing", confidence: "missing", note };
}

export function buildDefaultProvenanceMap(
  overrides: Partial<ScannerItemProvenanceMap> = {}
): ScannerItemProvenanceMap {
  return {
    gtin: overrides.gtin ?? defaultMissingProvenance("Sem código GTIN/EAN."),
    name: overrides.name ?? defaultMissingProvenance("Nome do produto pendente."),
    brand: overrides.brand ?? defaultMissingProvenance("Marca não informada."),
    description: overrides.description ?? defaultMissingProvenance("Descrição opcional pendente."),
    category: overrides.category ?? defaultMissingProvenance("Categoria pendente de associação."),
    presentation: overrides.presentation ?? defaultMissingProvenance("Apresentação não informada."),
    price:
      overrides.price ??
      defaultMissingProvenance("Preço de venda pendente de confirmação do estabelecimento."),
    stock:
      overrides.stock ??
      defaultMissingProvenance("Estoque pendente de confirmação do estabelecimento."),
    image: overrides.image ?? defaultMissingProvenance("Imagem pendente."),
  };
}

/**
 * Recalcula pendências comerciais e validações obrigatórias de um item (§7, §8, §9).
 * Regra fundamental: preço e estoque devem ser confirmados com informações do estabelecimento.
 */
export function evaluateItemReadiness(item: ScannerBatchItem): {
  pendingReasons: string[];
  canApprove: boolean;
} {
  const pending: string[] = [];

  if (!item.name || item.name.trim().length < 2) {
    pending.push("Nome comercial obrigatório (mínimo 2 caracteres).");
  }
  if (item.name.trim().length > 120) {
    pending.push("Nome excede o limite de 120 caracteres do Retail.");
  }

  if (item.gtin && !validateGtin(item.gtin).valid) {
    pending.push("Código GTIN informado possui dígito verificador ou formato inválido.");
  }

  if (!item.variants || item.variants.length === 0) {
    pending.push("Informe pelo menos uma variante com SKU, preço e estoque.");
  } else {
    const skuSet = new Set<string>();
    for (let i = 0; i < item.variants.length; i++) {
      const v = item.variants[i];
      if (!v.sku || !VariantInvariants.SKU_REGEX.test(v.sku.trim().toUpperCase())) {
        pending.push(`Variante #${i + 1}: SKU inválido (3-48 caracteres A-Z, 0-9, -, _).`);
      } else {
        const norm = v.sku.trim().toUpperCase();
        if (skuSet.has(norm)) {
          pending.push(`SKU duplicado entre variantes deste produto (${norm}).`);
        }
        skuSet.add(norm);
      }

      if (v.priceCents === null || v.priceCents === undefined || v.priceCents <= 0) {
        pending.push(`Variante ${v.sku || `#${i + 1}`}: preço de venda obrigatório (> R$ 0,00).`);
      }
      if (
        v.compareAtPriceCents !== null &&
        v.compareAtPriceCents !== undefined &&
        v.priceCents !== null &&
        v.compareAtPriceCents < v.priceCents
      ) {
        pending.push(
          `Variante ${v.sku || `#${i + 1}`}: preço comparativo menor que o preço de venda.`
        );
      }
      if (v.stockQuantity === null || v.stockQuantity === undefined || v.stockQuantity < 0) {
        pending.push(`Variante ${v.sku || `#${i + 1}`}: estoque obrigatório (>= 0).`);
      }
    }
  }

  if (!item.priceConfirmedByMerchant) {
    pending.push("Preço ainda não confirmado com os dados do estabelecimento.");
  }
  if (!item.stockConfirmedByMerchant) {
    pending.push("Estoque ainda não confirmado com os dados do estabelecimento.");
  }

  if (item.duplicateMatch && item.duplicateResolution === "update_selected") {
    if (item.updateFields.includes("price") && !item.allowOverwritePrice) {
      pending.push(
        "Atualização de preço em item duplicado exige confirmação explícita (allowOverwritePrice)."
      );
    }
    if (item.updateFields.includes("stock") && !item.allowOverwriteStock) {
      pending.push(
        "Atualização de estoque em item duplicado exige confirmação explícita (allowOverwriteStock)."
      );
    }
  }

  const unconfirmedImages = item.images.filter((img) => !img.rightsConfirmed);
  if (unconfirmedImages.length > 0) {
    pending.push("Há imagem anexada pendente de confirmação de direitos de uso.");
  }

  return {
    pendingReasons: pending,
    canApprove: pending.length === 0 || (Boolean(item.duplicateMatch) && item.duplicateResolution === "skip"),
  };
}

export function buildItemIdempotencyKey(params: {
  batchId: string;
  tenantId: string;
  storeId: string;
  gtin?: string | null;
  sku?: string | null;
  externalSourceId?: string | null;
  name?: string | null;
}): string {
  const seed = [
    params.batchId,
    params.tenantId,
    params.storeId,
    params.gtin || "",
    params.sku || "",
    params.externalSourceId || "",
    params.name || "",
  ].join("|");
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

export function createScannerBatchItem(params: {
  batch: ScannerBatch;
  captureMethod: CaptureMethod;
  externalSourceId?: string | null;
  gtin?: string | null;
  name?: string | null;
  brand?: string | null;
  description?: string | null;
  presentation?: string | null;
  categoryName?: string | null;
  categoryId?: string | null;
  variants?: ScannerVariantDraft[];
  images?: ScannerImageAttachment[];
  priceConfirmedByMerchant?: boolean;
  stockConfirmedByMerchant?: boolean;
  duplicateMatch?: DuplicateMatchInfo | null;
  lookupStatus?: ScannerBatchItem["lookupStatus"];
  lookupSourceLabel?: string | null;
  ocrRawText?: string | null;
  ocrConfidence?: number | null;
  provenance?: Partial<ScannerItemProvenanceMap>;
}): ScannerBatchItem {
  const now = new Date().toISOString();
  const gtinInfo = params.gtin ? validateGtin(params.gtin) : null;
  const normalizedGtin = gtinInfo?.valid ? gtinInfo.normalized : params.gtin?.trim() || null;

  const variants: ScannerVariantDraft[] =
    params.variants && params.variants.length > 0
      ? params.variants
      : [
          {
            id: randomUUID(),
            sku: buildSafeSku({
              gtin: normalizedGtin,
              name: params.name,
            }),
            name: params.presentation || "Padrão",
            gtin: normalizedGtin,
            priceCents: null,
            compareAtPriceCents: null,
            stockQuantity: null,
            isAvailable: true,
            optionsSummary: normalizedGtin ? { gtin: normalizedGtin } : {},
          },
        ];

  const primarySku = variants[0]?.sku ?? null;

  const item: ScannerBatchItem = {
    id: randomUUID(),
    idempotencyKey: buildItemIdempotencyKey({
      batchId: params.batch.id,
      tenantId: params.batch.tenantId,
      storeId: params.batch.storeId,
      gtin: normalizedGtin,
      sku: primarySku,
      externalSourceId: params.externalSourceId,
      name: params.name,
    }),
    externalSourceId: params.externalSourceId ?? null,
    captureMethod: params.captureMethod,
    status: params.lookupStatus === "matched" ? "identified" : "captured",
    gtin: normalizedGtin,
    gtinFormat: gtinInfo?.format ?? null,
    gtinValid: Boolean(gtinInfo?.valid),
    name: (params.name || "").trim(),
    brand: params.brand?.trim() || null,
    description: params.description?.trim() || null,
    presentation: params.presentation?.trim() || null,
    categoryName: params.categoryName?.trim() || params.batch.defaultCategoryName || null,
    categoryId: params.categoryId || params.batch.defaultCategoryId || null,
    variants,
    images: params.images || [],
    priceConfirmedByMerchant: Boolean(params.priceConfirmedByMerchant),
    stockConfirmedByMerchant: Boolean(params.stockConfirmedByMerchant),
    allowOverwritePrice: false,
    allowOverwriteStock: false,
    updateFields: ["name", "description", "category", "images"],
    duplicateMatch: params.duplicateMatch ?? null,
    duplicateResolution: "skip",
    lookupStatus: params.lookupStatus ?? "not_found",
    lookupSourceLabel: params.lookupSourceLabel ?? null,
    ocrRawText: params.ocrRawText ?? null,
    ocrConfidence: params.ocrConfidence ?? null,
    provenance: buildDefaultProvenanceMap(params.provenance),
    pendingReasons: [],
    approved: false,
    importedProductId: null,
    importedProductSlug: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  const readiness = evaluateItemReadiness(item);
  item.pendingReasons = readiness.pendingReasons;
  return item;
}

export function selectEligibleBatchItems(
  items: ScannerBatchItem[],
  onlyFailed?: boolean
): ScannerBatchItem[] {
  return items.filter((item) => {
    if (!item.approved) return false;
    // Idempotência: itens já importados, atualizados ou ignorados (duplicados) são preservados sem reprocessamento!
    if (
      item.status === "imported" ||
      item.status === "updated" ||
      item.status === "skipped"
    ) {
      return false;
    }
    if (onlyFailed) {
      return item.status === "failed" || item.status === "partial_image_failed";
    }
    return true;
  });
}

export function createBatchRecord(params: {
  label: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  defaultCategoryId?: string | null;
  defaultCategoryName?: string | null;
  duplicateScanPolicy?: ScannerBatch["duplicateScanPolicy"];
  createdByUserId: string;
  createdByEmail: string;
}): ScannerBatch {
  const now = new Date().toISOString();
  const shortDate = now.slice(0, 10).replace(/-/g, "");
  const batch: ScannerBatch = {
    id: `lote-${shortDate}-${randomUUID().slice(0, 8)}`,
    label: params.label.trim() || `Onboarding ${params.tenantName} (${shortDate})`,
    environment: "staging",
    tenantId: params.tenantId,
    tenantName: params.tenantName,
    tenantSlug: params.tenantSlug,
    storeId: params.storeId,
    storeName: params.storeName,
    storeSlug: params.storeSlug,
    defaultCategoryId: params.defaultCategoryId ?? null,
    defaultCategoryName: params.defaultCategoryName ?? null,
    duplicateScanPolicy: params.duplicateScanPolicy ?? "ignore",
    createdByUserId: params.createdByUserId,
    createdByEmail: params.createdByEmail,
    status: "open",
    pauseRequested: false,
    items: [],
    lastImportSummary: null,
    createdAt: now,
    updatedAt: now,
  };
  saveBatch(batch);
  return batch;
}

export function saveBatch(batch: ScannerBatch): ScannerBatch {
  batch.updatedAt = new Date().toISOString();
  const filePath = getBatchFilePath(batch.id);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(batch, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
  return batch;
}

export function loadBatch(batchId: string): ScannerBatch | null {
  const filePath = getBatchFilePath(batchId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ScannerBatch;
  } catch {
    return null;
  }
}

export function listBatches(): ScannerBatch[] {
  const dir = ensureBatchesDir();
  const batches: ScannerBatch[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(dir, file), "utf-8")
      ) as ScannerBatch;
      batches.push(parsed);
    } catch {
      // ignora arquivo corrompido
    }
  }
  return batches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
