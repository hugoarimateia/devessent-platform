import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { requireScannerOwner } from "@scanner/lib/auth";
import { buildSafeSku, validateGtin } from "@scanner/lib/barcode";
import {
  createScannerBatchItem,
  evaluateItemReadiness,
  loadBatch,
  saveBatch,
} from "@scanner/lib/batch-store";
import { lookupProductByGtin } from "@scanner/lib/lookup";
import { createScannerPrivilegedClient } from "@scanner/lib/supabase";
import { handleScannerApiError, jsonNoStore } from "@scanner/lib/api-helpers";
import type { CaptureMethod } from "@scanner/lib/types";

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

    const body = (await req.json()) as {
      code?: string;
      captureMethod?: CaptureMethod;
    };

    const rawCode = (body.code || "").trim();
    if (!rawCode) {
      return jsonNoStore({ ok: false, error: "Código de barras vazio." }, 400);
    }

    const gtinCheck = validateGtin(rawCode);
    if (!gtinCheck.valid) {
      return jsonNoStore(
        {
          ok: false,
          error: gtinCheck.reason,
          gtinCheck,
        },
        400
      );
    }

    // Tratar leitura repetida no mesmo lote conforme regra configurada (§3)
    const existingInBatch = batch.items.find((i) => i.gtin === gtinCheck.normalized);
    if (existingInBatch) {
      if (batch.duplicateScanPolicy === "ignore") {
        return jsonNoStore({
          ok: true,
          action: "ignored_repeat_scan",
          message: `Código ${gtinCheck.normalized} já está na fila deste lote (regra: ignorar repetição).`,
          item: existingInBatch,
          batch,
        });
      }

      if (batch.duplicateScanPolicy === "increment_stock") {
        const firstVar = existingInBatch.variants[0];
        if (firstVar) {
          firstVar.stockQuantity = (firstVar.stockQuantity ?? 0) + 1;
          existingInBatch.provenance.stock = {
            source: "barcode_scan",
            confidence: "unconfirmed",
            note: "Contagem incrementada por leitura repetida — confirmar estoque final com o lojista.",
          };
          existingInBatch.pendingReasons = evaluateItemReadiness(existingInBatch).pendingReasons;
          saveBatch(batch);
        }
        return jsonNoStore({
          ok: true,
          action: "incremented_stock",
          message: `Contagem do item ${existingInBatch.name || gtinCheck.normalized} incrementada (+1).`,
          item: existingInBatch,
          batch,
        });
      }

      if (batch.duplicateScanPolicy === "add_variant") {
        const nextIdx = existingInBatch.variants.length + 1;
        existingInBatch.variants.push({
          id: randomUUID(),
          sku: buildSafeSku({ gtin: gtinCheck.normalized, suffix: `V${nextIdx}` }),
          name: `Variante ${nextIdx}`,
          gtin: gtinCheck.normalized,
          priceCents: existingInBatch.variants[0]?.priceCents ?? null,
          compareAtPriceCents: null,
          stockQuantity: 1,
          isAvailable: true,
          optionsSummary: { gtin: gtinCheck.normalized, Variante: `V${nextIdx}` },
        });
        existingInBatch.pendingReasons = evaluateItemReadiness(existingInBatch).pendingReasons;
        saveBatch(batch);
        return jsonNoStore({
          ok: true,
          action: "added_variant",
          message: `Nova variante adicionada ao item ${existingInBatch.name || gtinCheck.normalized}.`,
          item: existingInBatch,
          batch,
        });
      }
    }

    const supabase = createScannerPrivilegedClient();
    const lookup = await lookupProductByGtin({
      supabase,
      tenantId: batch.tenantId,
      rawCode: gtinCheck.normalized,
    });

    const item = createScannerBatchItem({
      batch,
      captureMethod: body.captureMethod || "barcode_manual",
      gtin: gtinCheck.normalized,
      name: lookup.suggestedName || "",
      brand: lookup.brand,
      description: lookup.description,
      presentation: lookup.presentation,
      categoryName: lookup.categoryName,
      variants: [
        {
          id: randomUUID(),
          sku: buildSafeSku({
            explicitSku: lookup.skuSuggestion,
            gtin: gtinCheck.normalized,
            name: lookup.suggestedName,
          }),
          name: lookup.presentation || "Padrão",
          gtin: gtinCheck.normalized,
          priceCents: null,
          compareAtPriceCents: null,
          stockQuantity: null,
          isAvailable: true,
          optionsSummary: { gtin: gtinCheck.normalized },
        },
      ],
      images: lookup.remoteImageUrl
        ? [
            {
              id: randomUUID(),
              fileName: `remote-${gtinCheck.normalized}.jpg`,
              mimeType: "image/jpeg",
              sizeBytes: 0,
              width: null,
              height: null,
              sha256: "",
              localRelativePath: null,
              remoteUrl: lookup.remoteImageUrl,
              source: "open_database",
              rightsConfirmed: false, // §4/§10: nunca assumir direitos sem confirmação
              isPrimary: true,
              uploadedStoragePath: null,
              uploadedPublicUrl: null,
              uploadError: null,
            },
          ]
        : [],
      duplicateMatch: lookup.duplicateMatch,
      lookupStatus: lookup.lookupStatus,
      lookupSourceLabel: lookup.sourceLabel,
      provenance: lookup.provenance,
    });

    batch.items.unshift(item);
    saveBatch(batch);

    return jsonNoStore(
      {
        ok: true,
        action: "created",
        message:
          lookup.lookupStatus === "matched"
            ? `Produto identificado via ${lookup.sourceLabel}. Preço e estoque aguardam confirmação do lojista.`
            : `Código ${gtinCheck.format} validado, porém não localizado nas fontes autorizadas. Item incluído para preenchimento na revisão.`,
        lookup,
        item,
        batch,
      },
      201
    );
  } catch (err) {
    return handleScannerApiError(err);
  }
}
