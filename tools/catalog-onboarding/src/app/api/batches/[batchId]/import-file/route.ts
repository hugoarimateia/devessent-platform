import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { requireScannerOwner } from "@scanner/lib/auth";
import { buildSafeSku, validateGtin } from "@scanner/lib/barcode";
import {
  createScannerBatchItem,
  loadBatch,
  saveBatch,
} from "@scanner/lib/batch-store";
import {
  applyColumnMapping,
  parseCsvBuffer,
  parsePdfCatalogBuffer,
  parseXlsxBuffer,
  type CanonicalColumnKey,
  type NormalizedImportedProductRow,
} from "@scanner/lib/importers";
import { findTenantCatalogDuplicate } from "@scanner/lib/lookup";
import { createScannerPrivilegedClient } from "@scanner/lib/supabase";
import { handleScannerApiError, jsonNoStore } from "@scanner/lib/api-helpers";
import type { CaptureMethod, ScannerBatchItem } from "@scanner/lib/types";

const MAX_CATALOG_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    await requireScannerOwner();
    const { batchId } = await context.params;
    const batch = loadBatch(batchId);
    if (!batch) {
      return jsonNoStore({ ok: false, error: "Lote não encontrado." }, 404);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") || "preview");
    const mappingJson = formData.get("mapping");
    const confirmMerchantPrices = formData.get("confirmMerchantPrices") === "true";
    const confirmMerchantStock = formData.get("confirmMerchantStock") === "true";

    if (!(file instanceof File)) {
      return jsonNoStore(
        { ok: false, error: "Envie um arquivo .csv, .xlsx ou .pdf." },
        400
      );
    }

    if (file.size > MAX_CATALOG_FILE_BYTES) {
      return jsonNoStore(
        { ok: false, error: "Arquivo excede o limite máximo de 15 MB." },
        400
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const buffer = Buffer.from(await file.arrayBuffer());

    let parsed;
    if (ext === "csv" || ext === "txt") {
      parsed = parseCsvBuffer(buffer, file.name);
    } else if (ext === "xlsx") {
      parsed = await parseXlsxBuffer(buffer, file.name);
    } else if (ext === "pdf") {
      parsed = await parsePdfCatalogBuffer(buffer, file.name);
    } else {
      return jsonNoStore(
        {
          ok: false,
          error: "Formato não suportado para importação tabular. Envie .csv, .xlsx ou .pdf.",
        },
        400
      );
    }

    if (mode === "preview") {
      return jsonNoStore({
        ok: true,
        preview: {
          sourceType: parsed.sourceType,
          fileName: parsed.fileName,
          headers: parsed.headers,
          suggestedMapping: parsed.suggestedMapping,
          sampleRows: parsed.sampleRows,
          totalRows: parsed.totalRows,
          pdfMeta: parsed.pdfMeta,
        },
      });
    }

    const mapping: Partial<Record<CanonicalColumnKey, string>> =
      typeof mappingJson === "string" && mappingJson.trim().length > 0
        ? (JSON.parse(mappingJson) as Partial<Record<CanonicalColumnKey, string>>)
        : parsed.suggestedMapping;

    const normalizedRows = applyColumnMapping(parsed.allRows, mapping, file.name);
    if (normalizedRows.length === 0) {
      return jsonNoStore(
        {
          ok: false,
          error: "Nenhuma linha válida de produto encontrada com o mapeamento informado.",
        },
        400
      );
    }

    // Agrupar linhas com mesmo nome comercial exato em um produto com múltiplas variantes (§6)
    const grouped = new Map<string, NormalizedImportedProductRow[]>();
    for (const r of normalizedRows) {
      const groupKey = r.name.trim().toLowerCase();
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      grouped.get(groupKey)!.push(r);
    }

    const captureMethod: CaptureMethod =
      parsed.sourceType === "xlsx"
        ? "spreadsheet_xlsx"
        : parsed.sourceType === "pdf"
        ? "catalog_pdf"
        : "spreadsheet_csv";

    const fieldSource = parsed.sourceType === "pdf" ? "pdf_extract" : "client_spreadsheet";
    const sourceConf = parsed.sourceType === "pdf" ? "medium" : "high";
    const supabase = createScannerPrivilegedClient();

    // Carregar mapa rápido de SKUs/GTINs já existentes no lote para evitar duplicação intra-lote
    const existingBatchSkus = new Set(
      batch.items.flatMap((it) => it.variants.map((v) => v.sku.toUpperCase()))
    );

    const addedItems: ScannerBatchItem[] = [];
    let skippedIntraBatch = 0;

    for (const rows of grouped.values()) {
      const lead = rows[0];
      const variants = rows.map((row, idx) => {
        const cleanGtin = row.gtin && validateGtin(row.gtin).valid ? validateGtin(row.gtin).normalized : null;
        return {
          id: randomUUID(),
          sku: buildSafeSku({
            explicitSku: row.sku,
            gtin: cleanGtin,
            name: row.name,
            suffix: rows.length > 1 ? `V${idx + 1}` : null,
          }),
          name: row.variantName || "Padrão",
          gtin: cleanGtin,
          priceCents: row.priceCents,
          compareAtPriceCents: row.compareAtPriceCents,
          stockQuantity: row.stockQuantity,
          isAvailable: true,
          optionsSummary: {
            ...row.optionsSummary,
            ...(cleanGtin ? { gtin: cleanGtin } : {}),
          },
        };
      });

      if (variants.every((v) => existingBatchSkus.has(v.sku.toUpperCase()))) {
        skippedIntraBatch++;
        continue;
      }

      const duplicateMatch = await findTenantCatalogDuplicate({
        supabase,
        tenantId: batch.tenantId,
        sku: variants[0]?.sku,
        gtin: variants[0]?.gtin,
      });

      const hasPrices = variants.every((v) => v.priceCents !== null && v.priceCents > 0);
      const hasStock = variants.every((v) => v.stockQuantity !== null && v.stockQuantity >= 0);

      // PDFs NUNCA são auto-confirmados — sempre exigem revisão do operador (§6)
      const priceConfirmed =
        parsed.sourceType !== "pdf" && confirmMerchantPrices && hasPrices;
      const stockConfirmed =
        parsed.sourceType !== "pdf" && confirmMerchantStock && hasStock;

      const remoteImages = rows
        .map((r) => r.imageRef)
        .filter((ref): ref is string => Boolean(ref && ref.startsWith("https://")));

      const item = createScannerBatchItem({
        batch,
        captureMethod,
        externalSourceId: lead.externalSourceId,
        gtin: variants[0]?.gtin ?? lead.gtin,
        name: lead.name,
        brand: lead.brand,
        description: lead.description,
        presentation: lead.presentation,
        categoryName: lead.category,
        variants,
        images: remoteImages.slice(0, 3).map((url, idx) => ({
          id: randomUUID(),
          fileName: `feed-${idx + 1}.jpg`,
          mimeType: "image/jpeg",
          sizeBytes: 0,
          width: null,
          height: null,
          sha256: "",
          localRelativePath: null,
          remoteUrl: url,
          source: fieldSource,
          rightsConfirmed: false, // requer confirmação explícita de direitos e domínio autorizado
          isPrimary: idx === 0,
          uploadedStoragePath: null,
          uploadedPublicUrl: null,
          uploadError: null,
        })),
        priceConfirmedByMerchant: priceConfirmed,
        stockConfirmedByMerchant: stockConfirmed,
        duplicateMatch,
        lookupStatus: "matched",
        lookupSourceLabel: `Arquivo ${file.name} (${parsed.sourceType.toUpperCase()})`,
        provenance: {
          gtin: variants[0]?.gtin
            ? {
                source: fieldSource,
                confidence: "verified",
                note: `GTIN validado a partir de ${file.name}`,
              }
            : undefined,
          name: {
            source: fieldSource,
            confidence: sourceConf,
            note: `Extraído de ${file.name}`,
          },
          brand: lead.brand
            ? { source: fieldSource, confidence: sourceConf, note: `Extraído de ${file.name}` }
            : undefined,
          description: lead.description
            ? { source: fieldSource, confidence: sourceConf, note: `Extraído de ${file.name}` }
            : undefined,
          category: lead.category
            ? { source: fieldSource, confidence: sourceConf, note: `Extraído de ${file.name}` }
            : undefined,
          price: hasPrices
            ? {
                source: fieldSource,
                confidence: priceConfirmed ? "verified" : "unconfirmed",
                note: priceConfirmed
                  ? `Preço da planilha oficial do estabelecimento (${file.name}) confirmado.`
                  : `Preço lido em ${file.name} — confirmar com o estabelecimento antes da aprovação.`,
              }
            : undefined,
          stock: hasStock
            ? {
                source: fieldSource,
                confidence: stockConfirmed ? "verified" : "unconfirmed",
                note: stockConfirmed
                  ? `Estoque da planilha oficial do estabelecimento (${file.name}) confirmado.`
                  : `Estoque lido em ${file.name} — confirmar com o estabelecimento antes da aprovação.`,
              }
            : undefined,
        },
      });

      variants.forEach((v) => existingBatchSkus.add(v.sku.toUpperCase()));
      batch.items.push(item);
      addedItems.push(item);
    }

    saveBatch(batch);

    return jsonNoStore(
      {
        ok: true,
        addedCount: addedItems.length,
        skippedIntraBatch,
        totalRowsProcessed: normalizedRows.length,
        batch,
      },
      201
    );
  } catch (err) {
    return handleScannerApiError(err);
  }
}
