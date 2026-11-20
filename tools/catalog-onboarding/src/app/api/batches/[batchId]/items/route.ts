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
import type {
  DuplicateResolution,
  ScannerBatchItem,
  ScannerVariantDraft,
} from "@scanner/lib/types";

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
      action:
        | "create_manual"
        | "bulk_approve"
        | "bulk_set_category"
        | "bulk_confirm_commercial"
        | "bulk_remove"
        | "bulk_reidentify";
      itemIds?: string[];
      categoryId?: string | null;
      categoryName?: string | null;
      confirmPrice?: boolean;
      confirmStock?: boolean;
      approved?: boolean;
      manualItem?: {
        name: string;
        sku?: string;
        brand?: string;
        description?: string;
        categoryName?: string;
        categoryId?: string | null;
        priceCents?: number | null;
        stockQuantity?: number | null;
      };
    };

    if (body.action === "create_manual" && body.manualItem) {
      const m = body.manualItem;
      const item = createScannerBatchItem({
        batch,
        captureMethod: "barcode_manual",
        gtin: null,
        name: m.name,
        brand: m.brand || null,
        description: m.description || null,
        categoryName: m.categoryName || null,
        categoryId: m.categoryId || null,
        variants: [
          {
            id: randomUUID(),
            sku: buildSafeSku({ explicitSku: m.sku, name: m.name }),
            name: "Padrão",
            gtin: null,
            priceCents: m.priceCents ?? null,
            compareAtPriceCents: null,
            stockQuantity: m.stockQuantity ?? null,
            isAvailable: true,
            optionsSummary: {},
          },
        ],
        priceConfirmedByMerchant: Boolean(m.priceCents && m.priceCents > 0),
        stockConfirmedByMerchant: m.stockQuantity !== null && m.stockQuantity !== undefined && m.stockQuantity >= 0,
        lookupStatus: "skipped",
        lookupSourceLabel: "Cadastro manual assistido (sem GTIN)",
        provenance: {
          gtin: {
            source: "manual_operator",
            confidence: "verified",
            note: "Produto cadastrado sem código de barras (item artesanal/próprio).",
          },
          name: {
            source: "manual_operator",
            confidence: "verified",
            note: "Informado manualmente pelo operador.",
          },
        },
      });
      batch.items.unshift(item);
      saveBatch(batch);
      return jsonNoStore({ ok: true, item, batch }, 201);
    }

    const idSet = new Set(body.itemIds || []);
    const targets =
      idSet.size > 0 ? batch.items.filter((i) => idSet.has(i.id)) : batch.items;

    if (body.action === "bulk_remove") {
      batch.items = batch.items.filter(
        (i) => !idSet.has(i.id) || i.status === "imported" || i.status === "updated"
      );
      saveBatch(batch);
      return jsonNoStore({ ok: true, batch });
    }

    if (body.action === "bulk_set_category") {
      for (const item of targets) {
        if (item.status === "imported" || item.status === "updated") continue;
        item.categoryId = body.categoryId ?? null;
        item.categoryName = body.categoryName ?? null;
        item.provenance.category = {
          source: "manual_operator",
          confidence: "verified",
          note: `Categoria associada em lote (${body.categoryName || "removida"}).`,
        };
        item.pendingReasons = evaluateItemReadiness(item).pendingReasons;
      }
      saveBatch(batch);
      return jsonNoStore({ ok: true, batch });
    }

    if (body.action === "bulk_confirm_commercial") {
      for (const item of targets) {
        if (item.status === "imported" || item.status === "updated") continue;
        if (
          body.confirmPrice &&
          item.variants.every((v) => v.priceCents !== null && v.priceCents > 0)
        ) {
          item.priceConfirmedByMerchant = true;
          item.provenance.price = {
            source: "manual_operator",
            confidence: "verified",
            note: "Preço confirmado em lote com base na tabela do estabelecimento.",
          };
        }
        if (
          body.confirmStock &&
          item.variants.every((v) => v.stockQuantity !== null && v.stockQuantity >= 0)
        ) {
          item.stockConfirmedByMerchant = true;
          item.provenance.stock = {
            source: "manual_operator",
            confidence: "verified",
            note: "Estoque confirmado em lote com base no inventário do estabelecimento.",
          };
        }
        item.pendingReasons = evaluateItemReadiness(item).pendingReasons;
      }
      saveBatch(batch);
      return jsonNoStore({ ok: true, batch });
    }

    if (body.action === "bulk_approve") {
      const targetApproved = body.approved ?? true;
      let approvedCount = 0;
      let blockedCount = 0;
      for (const item of targets) {
        if (item.status === "imported" || item.status === "updated") continue;
        const readiness = evaluateItemReadiness(item);
        item.pendingReasons = readiness.pendingReasons;
        if (targetApproved) {
          if (readiness.canApprove) {
            item.approved = true;
            item.status = "approved";
            approvedCount++;
          } else {
            item.approved = false;
            blockedCount++;
          }
        } else {
          item.approved = false;
          item.status = "reviewed";
        }
      }
      saveBatch(batch);
      return jsonNoStore({ ok: true, approvedCount, blockedCount, batch });
    }

    if (body.action === "bulk_reidentify") {
      const supabase = createScannerPrivilegedClient();
      let updated = 0;
      for (const item of targets) {
        if (!item.gtin || item.status === "imported" || item.status === "updated") continue;
        const lookup = await lookupProductByGtin({
          supabase,
          tenantId: batch.tenantId,
          rawCode: item.gtin,
        });
        item.duplicateMatch = lookup.duplicateMatch;
        item.lookupStatus = lookup.lookupStatus;
        item.lookupSourceLabel = lookup.sourceLabel;
        if (lookup.suggestedName && !item.name) item.name = lookup.suggestedName;
        if (lookup.brand && !item.brand) item.brand = lookup.brand;
        if (lookup.description && !item.description) item.description = lookup.description;
        if (lookup.categoryName && !item.categoryName) item.categoryName = lookup.categoryName;
        if (lookup.presentation && !item.presentation) item.presentation = lookup.presentation;
        item.provenance = { ...item.provenance, ...lookup.provenance };
        item.pendingReasons = evaluateItemReadiness(item).pendingReasons;
        updated++;
      }
      saveBatch(batch);
      return jsonNoStore({ ok: true, reidentifiedCount: updated, batch });
    }

    return jsonNoStore({ ok: false, error: "Ação em lote inválida." }, 400);
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
      itemId: string;
      patch: Partial<{
        name: string;
        brand: string | null;
        description: string | null;
        presentation: string | null;
        gtin: string | null;
        categoryId: string | null;
        categoryName: string | null;
        variants: ScannerVariantDraft[];
        priceConfirmedByMerchant: boolean;
        stockConfirmedByMerchant: boolean;
        allowOverwritePrice: boolean;
        allowOverwriteStock: boolean;
        duplicateResolution: DuplicateResolution;
        updateFields: ScannerBatchItem["updateFields"];
        approved: boolean;
      }>;
    };

    const item = batch.items.find((i) => i.id === body.itemId);
    if (!item) {
      return jsonNoStore({ ok: false, error: "Item não encontrado no lote." }, 404);
    }

    const p = body.patch || {};
    if (p.name !== undefined) {
      item.name = p.name.trim();
      item.provenance.name = {
        source: "manual_operator",
        confidence: "verified",
        note: "Revisado pelo operador na estação de catálogo.",
      };
    }
    if (p.brand !== undefined) {
      item.brand = p.brand?.trim() || null;
      item.provenance.brand = item.brand
        ? { source: "manual_operator", confidence: "verified", note: "Revisado pelo operador." }
        : { source: "missing", confidence: "missing", note: "Marca não informada." };
    }
    if (p.description !== undefined) {
      item.description = p.description?.trim() || null;
      item.provenance.description = item.description
        ? { source: "manual_operator", confidence: "verified", note: "Revisado pelo operador." }
        : { source: "missing", confidence: "missing", note: "Descrição opcional." };
    }
    if (p.presentation !== undefined) {
      item.presentation = p.presentation?.trim() || null;
    }
    if (p.gtin !== undefined) {
      const clean = p.gtin?.replace(/\D/g, "") || null;
      const gtinInfo = clean ? validateGtin(clean) : null;
      item.gtin = clean;
      item.gtinFormat = gtinInfo?.format ?? null;
      item.gtinValid = Boolean(gtinInfo?.valid);
      item.provenance.gtin = gtinInfo
        ? {
            source: "manual_operator",
            confidence: gtinInfo.valid ? "verified" : "low",
            note: gtinInfo.reason,
          }
        : { source: "manual_operator", confidence: "verified", note: "Sem GTIN." };
    }
    if (p.categoryId !== undefined) item.categoryId = p.categoryId;
    if (p.categoryName !== undefined) {
      item.categoryName = p.categoryName?.trim() || null;
      item.provenance.category = item.categoryName
        ? { source: "manual_operator", confidence: "verified", note: "Categoria revisada." }
        : { source: "missing", confidence: "missing", note: "Categoria pendente." };
    }
    if (p.variants !== undefined && Array.isArray(p.variants)) {
      item.variants = p.variants.map((v) => ({
        ...v,
        id: v.id || randomUUID(),
        sku: v.sku.trim().toUpperCase(),
        name: v.name.trim() || "Padrão",
      }));
    }
    if (p.priceConfirmedByMerchant !== undefined) {
      item.priceConfirmedByMerchant = Boolean(p.priceConfirmedByMerchant);
      if (item.priceConfirmedByMerchant) {
        item.provenance.price = {
          source: "manual_operator",
          confidence: "verified",
          note: "Preço confirmado com dados do estabelecimento.",
        };
      }
    }
    if (p.stockConfirmedByMerchant !== undefined) {
      item.stockConfirmedByMerchant = Boolean(p.stockConfirmedByMerchant);
      if (item.stockConfirmedByMerchant) {
        item.provenance.stock = {
          source: "manual_operator",
          confidence: "verified",
          note: "Estoque confirmado com dados do estabelecimento.",
        };
      }
    }
    if (p.allowOverwritePrice !== undefined) item.allowOverwritePrice = Boolean(p.allowOverwritePrice);
    if (p.allowOverwriteStock !== undefined) item.allowOverwriteStock = Boolean(p.allowOverwriteStock);
    if (p.duplicateResolution !== undefined) item.duplicateResolution = p.duplicateResolution;
    if (p.updateFields !== undefined) item.updateFields = p.updateFields;

    const readiness = evaluateItemReadiness(item);
    item.pendingReasons = readiness.pendingReasons;

    if (p.approved !== undefined) {
      if (p.approved && !readiness.canApprove) {
        return jsonNoStore(
          {
            ok: false,
            error: `Item não pode ser aprovado com pendências: ${readiness.pendingReasons.join(" ")}`,
            pendingReasons: readiness.pendingReasons,
          },
          400
        );
      }
      item.approved = Boolean(p.approved);
      if (item.status !== "imported" && item.status !== "updated") {
        item.status = item.approved ? "approved" : "reviewed";
      }
    } else if (!readiness.canApprove) {
      item.approved = false;
      if (item.status === "approved") item.status = "reviewed";
    }

    item.updatedAt = new Date().toISOString();
    saveBatch(batch);

    return jsonNoStore({ ok: true, item, batch });
  } catch (err) {
    return handleScannerApiError(err);
  }
}
