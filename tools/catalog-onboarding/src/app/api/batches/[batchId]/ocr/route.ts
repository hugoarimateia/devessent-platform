import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { requireScannerOwner } from "@scanner/lib/auth";
import { buildSafeSku } from "@scanner/lib/barcode";
import {
  createScannerBatchItem,
  loadBatch,
  saveBatch,
} from "@scanner/lib/batch-store";
import { saveStagedImageFile, validateImageBuffer } from "@scanner/lib/images";
import { lookupProductByGtin } from "@scanner/lib/lookup";
import { runLocalImageOcr } from "@scanner/lib/ocr";
import { createScannerPrivilegedClient } from "@scanner/lib/supabase";
import { handleScannerApiError, jsonNoStore } from "@scanner/lib/api-helpers";

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
    const attachAsProductPhoto = formData.get("attachAsProductPhoto") !== "false";
    const skipOcr = formData.get("skipOcr") === "true";

    if (!(file instanceof File)) {
      return jsonNoStore(
        { ok: false, error: "Envie um arquivo de imagem (PNG, JPEG ou WebP)." },
        400
      );
    }

    const rawBuf = Buffer.from(await file.arrayBuffer());
    const validated = validateImageBuffer(rawBuf, file.name, file.type);
    const localRelativePath = saveStagedImageFile(batch.id, validated);

    const ocr = skipOcr
      ? {
          rawText: "",
          confidence: 0,
          suggestedName: null,
          brand: null,
          gtin: null,
          gtinFormat: null,
          skuCandidate: null,
          presentation: null,
          size: null,
          color: null,
          unconfirmedPriceCents: null,
          ambiguous: true,
          notes: ["Fotografia anexada sem OCR automático — preencha os campos manualmente."],
        }
      : await runLocalImageOcr(validated.buffer);

    // Se o OCR identificou um GTIN válido na embalagem/etiqueta, consulta automaticamente fontes autorizadas!
    let lookup = null;
    if (ocr.gtin) {
      const supabase = createScannerPrivilegedClient();
      lookup = await lookupProductByGtin({
        supabase,
        tenantId: batch.tenantId,
        rawCode: ocr.gtin,
      });
    }

    const optionsSummary: Record<string, string> = {};
    if (ocr.color) optionsSummary.Cor = ocr.color;
    if (ocr.size) optionsSummary.Tamanho = ocr.size;
    if (ocr.gtin) optionsSummary.gtin = ocr.gtin;

    const variantLabel =
      [ocr.color, ocr.size, ocr.presentation || lookup?.presentation]
        .filter(Boolean)
        .join(" / ") || "Padrão";

    const finalName = lookup?.suggestedName || ocr.suggestedName || "";
    const item = createScannerBatchItem({
      batch,
      captureMethod: "photo_ocr",
      gtin: ocr.gtin,
      name: finalName,
      brand: lookup?.brand || ocr.brand,
      description: lookup?.description || null,
      presentation: lookup?.presentation || ocr.presentation,
      categoryName: lookup?.categoryName || null,
      variants: [
        {
          id: randomUUID(),
          sku: buildSafeSku({
            explicitSku: lookup?.skuSuggestion || ocr.skuCandidate,
            gtin: ocr.gtin,
            name: finalName || file.name,
          }),
          name: variantLabel,
          gtin: ocr.gtin,
          priceCents: ocr.unconfirmedPriceCents,
          compareAtPriceCents: null,
          stockQuantity: null,
          isAvailable: true,
          optionsSummary,
        },
      ],
      images: attachAsProductPhoto
        ? [
            {
              id: randomUUID(),
              fileName: validated.safeFileName,
              mimeType: validated.mimeType,
              sizeBytes: validated.sizeBytes,
              width: validated.width,
              height: validated.height,
              sha256: validated.sha256,
              localRelativePath,
              remoteUrl: null,
              source: "ocr_photo",
              rightsConfirmed: true, // foto própria capturada pelo operador na loja
              isPrimary: true,
              uploadedStoragePath: null,
              uploadedPublicUrl: null,
              uploadError: null,
            },
          ]
        : [],
      priceConfirmedByMerchant: false, // §5/§7: preço lido em etiqueta SEMPRE aguarda confirmação
      stockConfirmedByMerchant: false,
      duplicateMatch: lookup?.duplicateMatch ?? null,
      lookupStatus: lookup?.lookupStatus ?? (finalName ? "partial" : "not_found"),
      lookupSourceLabel: lookup?.sourceLabel ?? `OCR Local Tesseract (${ocr.confidence}%)`,
      ocrRawText: ocr.rawText,
      ocrConfidence: ocr.confidence,
      provenance: {
        ...(lookup?.provenance || {}),
        name: lookup?.suggestedName
          ? lookup.provenance.name
          : ocr.suggestedName
          ? {
              source: "ocr_photo",
              confidence: ocr.confidence >= 75 ? "medium" : "low",
              note: `Texto sugerido por OCR local (confiança ${ocr.confidence}%). Revisar antes de aprovar.`,
            }
          : {
              source: "missing",
              confidence: "missing",
              note: "Nome não reconhecido com clareza na foto. Informar manualmente.",
            },
        brand: lookup?.brand
          ? lookup.provenance.brand
          : ocr.brand
          ? {
              source: "ocr_photo",
              confidence: "medium",
              note: "Marca extraída por OCR local.",
            }
          : undefined,
        price: ocr.unconfirmedPriceCents
          ? {
              source: "ocr_photo",
              confidence: "unconfirmed",
              note: "Preço lido na etiqueta por OCR — requer confirmação explícita do estabelecimento.",
            }
          : undefined,
        image: attachAsProductPhoto
          ? {
              source: "ocr_photo",
              confidence: "verified",
              note: `Foto original validada (${validated.mimeType}, ${validated.width ?? "?"}x${validated.height ?? "?"}px).`,
            }
          : undefined,
      },
    });

    batch.items.unshift(item);
    saveBatch(batch);

    return jsonNoStore({ ok: true, ocr, item, batch }, 201);
  } catch (err) {
    return handleScannerApiError(err);
  }
}
