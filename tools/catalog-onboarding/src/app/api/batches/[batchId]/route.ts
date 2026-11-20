import { NextRequest } from "next/server";
import { requireScannerOwner } from "@scanner/lib/auth";
import { loadBatch, saveBatch } from "@scanner/lib/batch-store";
import { handleScannerApiError, jsonNoStore } from "@scanner/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    await requireScannerOwner();
    const { batchId } = await context.params;
    const batch = loadBatch(batchId);
    if (!batch) {
      return jsonNoStore({ ok: false, error: "Lote não encontrado." }, 404);
    }
    return jsonNoStore({ ok: true, batch });
  } catch (err) {
    return handleScannerApiError(err);
  }
}

export async function PATCH(
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
      tenantId?: string;
      storeId?: string;
      label?: string;
      duplicateScanPolicy?: "ignore" | "increment_stock" | "add_variant";
      pauseRequested?: boolean;
    };

    // Bloqueio explícito contra alteração silenciosa do tenant/loja de destino (§8)
    if (
      (body.tenantId && body.tenantId !== batch.tenantId) ||
      (body.storeId && body.storeId !== batch.storeId)
    ) {
      return jsonNoStore(
        {
          ok: false,
          error:
            "BLOQUEIO DE SEGURANÇA: não é permitido alterar a empresa ou loja de destino de um lote em andamento. Crie um novo lote.",
        },
        403
      );
    }

    if (typeof body.label === "string" && body.label.trim().length >= 2) {
      batch.label = body.label.trim().slice(0, 120);
    }
    if (
      body.duplicateScanPolicy &&
      ["ignore", "increment_stock", "add_variant"].includes(body.duplicateScanPolicy)
    ) {
      batch.duplicateScanPolicy = body.duplicateScanPolicy;
    }
    if (typeof body.pauseRequested === "boolean") {
      batch.pauseRequested = body.pauseRequested;
      if (body.pauseRequested && batch.status === "importing") {
        batch.status = "paused";
      }
    }

    saveBatch(batch);
    return jsonNoStore({ ok: true, batch });
  } catch (err) {
    return handleScannerApiError(err);
  }
}
