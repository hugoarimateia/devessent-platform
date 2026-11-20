import * as fs from "fs";
import * as path from "path";
import { validateGtin, type GtinValidationResult } from "./barcode";
import { getScannerServerConfig } from "./env";
import type { ScannerSupabaseClient } from "./supabase";
import type {
  AuthorizedSupplierRecord,
  DuplicateMatchInfo,
  FieldProvenance,
  ScannerItemProvenanceMap,
} from "./types";

export interface CatalogLookupResult {
  gtinCheck: GtinValidationResult;
  lookupStatus: "matched" | "partial" | "not_found";
  sourceLabel: string | null;
  suggestedName: string | null;
  brand: string | null;
  description: string | null;
  categoryName: string | null;
  presentation: string | null;
  skuSuggestion: string | null;
  remoteImageUrl: string | null;
  duplicateMatch: DuplicateMatchInfo | null;
  provenance: Partial<ScannerItemProvenanceMap>;
}

/**
 * Interface extensível para provedores futuros autorizados (ex.: GS1 Brasil, API comercial licenciada).
 * Nenhum provedor pago é habilitado automaticamente.
 */
export interface AuthorizedProductLookupProvider {
  id: string;
  label: string;
  lookupByGtin(gtin: string): Promise<AuthorizedSupplierRecord | null>;
}

function getAuthorizedCatalogsDir(): string {
  return path.resolve(process.cwd(), "data/authorized-catalogs");
}

let cachedLocalCatalogMap: Map<string, AuthorizedSupplierRecord> | null = null;

export function loadAuthorizedLocalSupplierCatalogs(
  forceReload = false
): Map<string, AuthorizedSupplierRecord> {
  if (cachedLocalCatalogMap && !forceReload) return cachedLocalCatalogMap;
  const map = new Map<string, AuthorizedSupplierRecord>();
  const dir = getAuthorizedCatalogsDir();
  if (!fs.existsSync(dir)) {
    cachedLocalCatalogMap = map;
    return map;
  }

  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(dir, entry), "utf-8")
      ) as {
        sourceName?: string;
        licenseNote?: string;
        records?: AuthorizedSupplierRecord[];
      };
      for (const rec of parsed.records || []) {
        const cleanGtin = (rec.gtin || "").replace(/\D/g, "");
        if (!cleanGtin) continue;
        map.set(cleanGtin, {
          ...rec,
          gtin: cleanGtin,
          sourceName: rec.sourceName || parsed.sourceName || entry,
          licenseNote: rec.licenseNote || parsed.licenseNote || "Catálogo autorizado",
        });
      }
    } catch {
      // ignora arquivo malformado sem derrubar o scanner
    }
  }

  cachedLocalCatalogMap = map;
  return map;
}

/**
 * Consulta opcional à base aberta Open Food Facts (ODbL), habilitada somente quando
 * `CATALOG_SCANNER_OPEN_LOOKUP=openfoodfacts`. Nunca faz scraping de marketplaces.
 */
async function lookupOpenFoodFactsAuthorized(
  gtin: string
): Promise<AuthorizedSupplierRecord | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(gtin)}.json?fields=product_name,brands,categories,quantity,generic_name,image_front_url`,
      {
        method: "GET",
        headers: {
          "User-Agent": "DevEssentCatalogScanner/1.0 (Internal Onboarding MVP)",
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        brands?: string;
        categories?: string;
        quantity?: string;
        generic_name?: string;
        image_front_url?: string;
      };
    };
    if (json.status !== 1 || !json.product?.product_name) return null;

    const firstCategory = json.product.categories
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0];

    return {
      gtin,
      name: json.product.product_name.trim(),
      brand: json.product.brands?.trim() || undefined,
      description: json.product.generic_name?.trim() || undefined,
      category: firstCategory || undefined,
      presentation: json.product.quantity?.trim() || undefined,
      imageUrl: json.product.image_front_url?.trim() || undefined,
      sourceName: "Open Food Facts (Base Aberta ODbL)",
      licenseNote: "Open Database License — verificar direitos comerciais de imagem antes de publicar",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verifica duplicidade no catálogo REAL do tenant de destino no Supabase (escopo isolado por `tenant_id`).
 * Produtos com mesmo GTIN/SKU em OUTRA empresa nunca são tratados como duplicação (§9).
 */
export async function findTenantCatalogDuplicate(params: {
  supabase: ScannerSupabaseClient;
  tenantId: string;
  sku?: string | null;
  gtin?: string | null;
  slug?: string | null;
}): Promise<DuplicateMatchInfo | null> {
  const { supabase, tenantId } = params;

  // 1. Checar por SKU normalizado no tenant
  if (params.sku && params.sku.trim().length >= 3) {
    const normSku = params.sku.trim().toUpperCase();
    const { data: variantRow } = await supabase
      .from("retail_variants")
      .select("id, sku, price_cents, stock_quantity, product_id, retail_products!inner(id, name, slug, status)")
      .eq("tenant_id", tenantId)
      .eq("sku", normSku)
      .maybeSingle();

    if (variantRow) {
      const prod = variantRow.retail_products as unknown as {
        id: string;
        name: string;
        slug: string;
        status: string;
      };
      return {
        matchType: "sku",
        existingProductId: prod.id,
        existingProductName: prod.name,
        existingSlug: prod.slug,
        existingStatus: prod.status,
        matchedSku: variantRow.sku,
        matchedVariantId: variantRow.id,
        existingPriceCents: variantRow.price_cents,
        existingStockQuantity: variantRow.stock_quantity,
      };
    }
  }

  // 2. Checar por GTIN armazenado em `options_summary->>gtin` ou SKU derivado `EAN-<gtin>` no tenant
  if (params.gtin && params.gtin.trim().length >= 8) {
    const cleanGtin = params.gtin.replace(/\D/g, "");
    const { data: gtinVariants } = await supabase
      .from("retail_variants")
      .select("id, sku, price_cents, stock_quantity, options_summary, product_id, retail_products!inner(id, name, slug, status)")
      .eq("tenant_id", tenantId)
      .or(`sku.eq.EAN-${cleanGtin},options_summary->>gtin.eq.${cleanGtin}`)
      .limit(1);

    const matched = gtinVariants?.[0];
    if (matched) {
      const prod = matched.retail_products as unknown as {
        id: string;
        name: string;
        slug: string;
        status: string;
      };
      return {
        matchType: "gtin",
        existingProductId: prod.id,
        existingProductName: prod.name,
        existingSlug: prod.slug,
        existingStatus: prod.status,
        matchedSku: matched.sku,
        matchedVariantId: matched.id,
        existingPriceCents: matched.price_cents,
        existingStockQuantity: matched.stock_quantity,
      };
    }
  }

  // 3. Checar por slug no tenant
  if (params.slug && params.slug.trim().length >= 2) {
    const { data: prodRow } = await supabase
      .from("retail_products")
      .select("id, name, slug, status, retail_variants(id, sku, price_cents, stock_quantity)")
      .eq("tenant_id", tenantId)
      .eq("slug", params.slug.trim().toLowerCase())
      .maybeSingle();

    if (prodRow) {
      const firstVar = (prodRow.retail_variants as Array<{
        id: string;
        sku: string;
        price_cents: number;
        stock_quantity: number;
      }> | null)?.[0];
      return {
        matchType: "slug",
        existingProductId: prodRow.id,
        existingProductName: prodRow.name,
        existingSlug: prodRow.slug,
        existingStatus: prodRow.status,
        matchedSku: firstVar?.sku ?? null,
        matchedVariantId: firstVar?.id ?? null,
        existingPriceCents: firstVar?.price_cents ?? null,
        existingStockQuantity: firstVar?.stock_quantity ?? null,
      };
    }
  }

  return null;
}

/**
 * Orquestra a identificação autorizada de um código GTIN (§4).
 * Nunca inventa dados quando não encontrado; registra origem e confiabilidade por campo.
 */
export async function lookupProductByGtin(params: {
  supabase: ScannerSupabaseClient;
  tenantId: string;
  rawCode: string;
  extraProviders?: AuthorizedProductLookupProvider[];
}): Promise<CatalogLookupResult> {
  const gtinCheck = validateGtin(params.rawCode);
  const gtinProvenance: FieldProvenance = gtinCheck.valid
    ? {
        source: "barcode_scan",
        confidence: "verified",
        note: gtinCheck.reason,
      }
    : {
        source: "barcode_scan",
        confidence: "low",
        note: gtinCheck.reason,
      };

  const duplicateMatch = gtinCheck.valid
    ? await findTenantCatalogDuplicate({
        supabase: params.supabase,
        tenantId: params.tenantId,
        gtin: gtinCheck.normalized,
      })
    : null;

  if (!gtinCheck.valid) {
    return {
      gtinCheck,
      lookupStatus: "not_found",
      sourceLabel: null,
      suggestedName: null,
      brand: null,
      description: null,
      categoryName: null,
      presentation: null,
      skuSuggestion: null,
      remoteImageUrl: null,
      duplicateMatch: null,
      provenance: {
        gtin: gtinProvenance,
      },
    };
  }

  // 1. Catálogos autorizados de fornecedores/clientes locais
  const localCatalog = loadAuthorizedLocalSupplierCatalogs();
  let matchedRecord: AuthorizedSupplierRecord | null =
    localCatalog.get(gtinCheck.normalized) ?? null;
  let recordSourceType: "authorized_catalog" | "open_database" = "authorized_catalog";

  // 2. Provedores adicionais injetados (ex.: feed de fornecedor enviado na sessão ou futuro GS1)
  if (!matchedRecord && params.extraProviders) {
    for (const provider of params.extraProviders) {
      const candidate = await provider.lookupByGtin(gtinCheck.normalized).catch(() => null);
      if (candidate) {
        matchedRecord = candidate;
        recordSourceType = "authorized_catalog";
        break;
      }
    }
  }

  // 3. Base aberta ODbL opcional (somente se habilitada explicitamente na config privativa)
  if (!matchedRecord) {
    try {
      const cfg = getScannerServerConfig();
      if (cfg.openLookupMode === "openfoodfacts") {
        matchedRecord = await lookupOpenFoodFactsAuthorized(gtinCheck.normalized);
        if (matchedRecord) {
          recordSourceType = "open_database";
        }
      }
    } catch {
      // ignora em testes unitários sem .env.scanner.local
    }
  }

  if (!matchedRecord) {
    return {
      gtinCheck,
      lookupStatus: "not_found",
      sourceLabel: null,
      suggestedName: null,
      brand: null,
      description: null,
      categoryName: null,
      presentation: null,
      skuSuggestion: `EAN-${gtinCheck.normalized}`,
      remoteImageUrl: null,
      duplicateMatch,
      provenance: {
        gtin: gtinProvenance,
        name: {
          source: "missing",
          confidence: "missing",
          note: "Produto não encontrado nas fontes autorizadas. Preencha manualmente na revisão.",
        },
        price: {
          source: "missing",
          confidence: "missing",
          note: "Preço não informado — definir com base nos dados do estabelecimento.",
        },
        stock: {
          source: "missing",
          confidence: "missing",
          note: "Estoque não informado — confirmar quantidade real da loja.",
        },
      },
    };
  }

  const fieldConf = recordSourceType === "authorized_catalog" ? "high" : "medium";
  const srcNote =
    recordSourceType === "authorized_catalog"
      ? `Obtido de ${matchedRecord.sourceName}`
      : `Sugerido por ${matchedRecord.sourceName} (revisar antes de aprovar)`;

  return {
    gtinCheck,
    lookupStatus: "matched",
    sourceLabel: matchedRecord.sourceName,
    suggestedName: matchedRecord.name,
    brand: matchedRecord.brand ?? null,
    description: matchedRecord.description ?? null,
    categoryName: matchedRecord.category ?? null,
    presentation: matchedRecord.presentation ?? null,
    skuSuggestion: matchedRecord.sku || `EAN-${gtinCheck.normalized}`,
    remoteImageUrl: matchedRecord.imageUrl ?? null,
    duplicateMatch,
    provenance: {
      gtin: gtinProvenance,
      name: { source: recordSourceType, confidence: fieldConf, note: srcNote },
      brand: matchedRecord.brand
        ? { source: recordSourceType, confidence: fieldConf, note: srcNote }
        : { source: "missing", confidence: "missing", note: "Marca não informada." },
      description: matchedRecord.description
        ? { source: recordSourceType, confidence: fieldConf, note: srcNote }
        : { source: "missing", confidence: "missing", note: "Descrição pendente." },
      category: matchedRecord.category
        ? {
            source: recordSourceType,
            confidence: "medium",
            note: `Categoria sugerida (${matchedRecord.category}) — confirmar mapeamento na loja.`,
          }
        : { source: "missing", confidence: "missing", note: "Categoria pendente." },
      presentation: matchedRecord.presentation
        ? { source: recordSourceType, confidence: fieldConf, note: srcNote }
        : { source: "missing", confidence: "missing", note: "Apresentação não informada." },
      price: {
        source: "missing",
        confidence: "missing",
        note: "Preço não informado — nunca usar preço da internet; informar preço do lojista.",
      },
      stock: {
        source: "missing",
        confidence: "missing",
        note: "Estoque não informado — confirmar estoque físico do estabelecimento.",
      },
      image: matchedRecord.imageUrl
        ? {
            source: recordSourceType,
            confidence: "unconfirmed",
            note: "Imagem externa pendente de confirmação de direitos e domínio autorizado.",
          }
        : {
            source: "missing",
            confidence: "missing",
            note: "Imagem pendente — fotografar ou anexar arquivo local.",
          },
    },
  };
}
