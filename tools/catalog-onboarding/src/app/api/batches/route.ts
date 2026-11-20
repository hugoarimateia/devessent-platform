import { NextRequest } from "next/server";
import { requireScannerOwner } from "@scanner/lib/auth";
import { createBatchRecord, listBatches } from "@scanner/lib/batch-store";
import {
  listActiveTenantsAndStores,
  resolveVerifiedOnboardingTenantContext,
} from "@scanner/lib/retail-importer";
import { createScannerPrivilegedClient } from "@scanner/lib/supabase";
import { handleScannerApiError, jsonNoStore } from "@scanner/lib/api-helpers";

export async function GET() {
  try {
    await requireScannerOwner();
    const batches = listBatches().map((b) => ({
      id: b.id,
      label: b.label,
      environment: b.environment,
      tenantId: b.tenantId,
      tenantName: b.tenantName,
      storeId: b.storeId,
      storeName: b.storeName,
      storeSlug: b.storeSlug,
      status: b.status,
      itemCount: b.items.length,
      approvedCount: b.items.filter((i) => i.approved).length,
      importedCount: b.items.filter((i) => i.status === "imported" || i.status === "updated").length,
      updatedAt: b.updatedAt,
      createdAt: b.createdAt,
    }));
    return jsonNoStore({ ok: true, batches });
  } catch (err) {
    return handleScannerApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = await requireScannerOwner();
    const body = (await req.json()) as {
      tenantId?: string;
      storeId?: string;
      label?: string;
      defaultCategoryId?: string | null;
      defaultCategoryName?: string | null;
      duplicateScanPolicy?: "ignore" | "increment_stock" | "add_variant";
    };

    if (!body.tenantId || !body.storeId) {
      return jsonNoStore(
        { ok: false, error: "Selecione explicitamente empresa e loja de destino." },
        400
      );
    }

    const supabase = createScannerPrivilegedClient();
    await resolveVerifiedOnboardingTenantContext({
      supabase,
      owner,
      tenantId: body.tenantId,
      storeId: body.storeId,
    });

    const tenants = await listActiveTenantsAndStores(supabase);
    const chosen = tenants.find(
      (t) => t.tenantId === body.tenantId && t.storeId === body.storeId
    );
    if (!chosen) {
      return jsonNoStore(
        { ok: false, error: "Empresa ou loja Retail ativa não encontrada." },
        404
      );
    }

    const batch = createBatchRecord({
      label: body.label || `Lote ${chosen.tenantName}`,
      tenantId: chosen.tenantId,
      tenantName: chosen.tenantName,
      tenantSlug: chosen.tenantSlug,
      storeId: chosen.storeId,
      storeName: chosen.storeName,
      storeSlug: chosen.storeSlug,
      defaultCategoryId: body.defaultCategoryId ?? null,
      defaultCategoryName: body.defaultCategoryName ?? null,
      duplicateScanPolicy: body.duplicateScanPolicy ?? "ignore",
      createdByUserId: owner.userId,
      createdByEmail: owner.email,
    });

    return jsonNoStore({ ok: true, batch }, 201);
  } catch (err) {
    return handleScannerApiError(err);
  }
}
