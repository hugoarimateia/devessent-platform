import { NextRequest } from "next/server";
import { requireScannerOwner } from "@scanner/lib/auth";
import { loadBatch } from "@scanner/lib/batch-store";
import {
  executeBatchImport,
  previewBatchImport,
} from "@scanner/lib/retail-importer";
import { createScannerPrivilegedClient } from "@scanner/lib/supabase";
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

    const supabase = createScannerPrivilegedClient();
    const preview = await previewBatchImport({ supabase, batch });
    return jsonNoStore({ ok: true, preview });
  } catch (err) {
    return handleScannerApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const owner = await requireScannerOwner();
    const { batchId } = await context.params;
    const batch = loadBatch(batchId);
    if (!batch) {
      return jsonNoStore({ ok: false, error: "Lote não encontrado." }, 404);
    }

    const body = (await req.json()) as {
      confirmTenantId?: string;
      confirmStoreId?: string;
      confirmApproved?: boolean;
      onlyFailedOrPending?: boolean;
      concurrency?: number;
    };

    // Exige confirmação explícita de tenant, loja e aprovação antes de gravar no Supabase (§8)
    if (
      !body.confirmApproved ||
      body.confirmTenantId !== batch.tenantId ||
      body.confirmStoreId !== batch.storeId
    ) {
      return jsonNoStore(
        {
          ok: false,
          error:
            "Confirmação explícita obrigatória: confirme a empresa, loja de destino e aprovação do lote antes de implantar.",
        },
        400
      );
    }

    const supabase = createScannerPrivilegedClient();
    const result = await executeBatchImport({
      supabase,
      owner,
      batchId: batch.id,
      onlyFailedOrPending: Boolean(body.onlyFailedOrPending),
      concurrency: body.concurrency ?? 2,
    });

    return jsonNoStore({
      ok: true,
      batch: result.batch,
      summary: result.summary,
    });
  } catch (err) {
    return handleScannerApiError(err);
  }
}
