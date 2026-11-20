import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { requireScannerOwner } from "@scanner/lib/auth";
import { evaluateItemReadiness, loadBatch, saveBatch } from "@scanner/lib/batch-store";
import { saveStagedImageFile, validateImageBuffer } from "@scanner/lib/images";
import { handleScannerApiError, jsonNoStore } from "@scanner/lib/api-helpers";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ batchId: string; itemId: string }> }
) {
  try {
    await requireScannerOwner();
    const { batchId, itemId } = await context.params;
    const batch = loadBatch(batchId);
    if (!batch) return jsonNoStore({ ok: false, error: "Lote não encontrado." }, 404);

    const item = batch.items.find((i) => i.id === itemId);
    if (!item) return jsonNoStore({ ok: false, error: "Item não encontrado." }, 404);

    const formData = await req.formData();
    const file = formData.get("file");
    const isPrimary = formData.get("isPrimary") === "true" || item.images.length === 0;

    if (!(file instanceof File)) {
      return jsonNoStore({ ok: false, error: "Arquivo de imagem obrigatório." }, 400);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const validated = validateImageBuffer(buf, file.name, file.type);

    // Evitar anexar imagem idêntica (mesmo SHA-256) ao mesmo item (§9)
    const alreadyExists = item.images.find((img) => img.sha256 === validated.sha256);
    if (alreadyExists) {
      return jsonNoStore({
        ok: true,
        deduplicated: true,
        message: "Imagem idêntica (mesmo hash SHA-256) já anexada a este item.",
        item,
        batch,
      });
    }

    const localRelativePath = saveStagedImageFile(batch.id, validated);

    if (isPrimary) {
      item.images.forEach((img) => {
        img.isPrimary = false;
      });
    }

    item.images.push({
      id: randomUUID(),
      fileName: validated.safeFileName,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      width: validated.width,
      height: validated.height,
      sha256: validated.sha256,
      localRelativePath,
      remoteUrl: null,
      source: "manual_operator",
      rightsConfirmed: true,
      isPrimary,
      uploadedStoragePath: null,
      uploadedPublicUrl: null,
      uploadError: null,
    });

    item.provenance.image = {
      source: "manual_operator",
      confidence: "verified",
      note: `${item.images.length} imagem(ns) validada(s) pronta(s) para envio ao Supabase Storage.`,
    };
    item.pendingReasons = evaluateItemReadiness(item).pendingReasons;
    saveBatch(batch);

    return jsonNoStore({ ok: true, item, batch }, 201);
  } catch (err) {
    return handleScannerApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ batchId: string; itemId: string }> }
) {
  try {
    await requireScannerOwner();
    const { batchId, itemId } = await context.params;
    const batch = loadBatch(batchId);
    if (!batch) return jsonNoStore({ ok: false, error: "Lote não encontrado." }, 404);

    const item = batch.items.find((i) => i.id === itemId);
    if (!item) return jsonNoStore({ ok: false, error: "Item não encontrado." }, 404);

    const body = (await req.json()) as {
      imageId: string;
      setPrimary?: boolean;
      rightsConfirmed?: boolean;
    };

    const img = item.images.find((i) => i.id === body.imageId);
    if (!img) return jsonNoStore({ ok: false, error: "Imagem não encontrada." }, 404);

    if (body.setPrimary) {
      item.images.forEach((entry) => {
        entry.isPrimary = entry.id === body.imageId;
      });
    }
    if (typeof body.rightsConfirmed === "boolean") {
      img.rightsConfirmed = body.rightsConfirmed;
    }

    item.pendingReasons = evaluateItemReadiness(item).pendingReasons;
    saveBatch(batch);
    return jsonNoStore({ ok: true, item, batch });
  } catch (err) {
    return handleScannerApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ batchId: string; itemId: string }> }
) {
  try {
    await requireScannerOwner();
    const { batchId, itemId } = await context.params;
    const batch = loadBatch(batchId);
    if (!batch) return jsonNoStore({ ok: false, error: "Lote não encontrado." }, 404);

    const item = batch.items.find((i) => i.id === itemId);
    if (!item) return jsonNoStore({ ok: false, error: "Item não encontrado." }, 404);

    const imageId = req.nextUrl.searchParams.get("imageId");
    if (!imageId) return jsonNoStore({ ok: false, error: "imageId obrigatório." }, 400);

    item.images = item.images.filter((i) => i.id !== imageId);
    if (item.images.length > 0 && !item.images.some((i) => i.isPrimary)) {
      item.images[0].isPrimary = true;
    }

    item.pendingReasons = evaluateItemReadiness(item).pendingReasons;
    saveBatch(batch);
    return jsonNoStore({ ok: true, item, batch });
  } catch (err) {
    return handleScannerApiError(err);
  }
}
