import type { TenantContext } from "@/core/tenants/services/tenant-service";
import { AuditService } from "@/core/audit/services/audit-service";
import { ProductInvariants } from "@/modules/retail/domain/product-invariants";
import { VariantInvariants } from "@/modules/retail/domain/variant-invariants";
import { RetailCategoryService } from "@/modules/retail/services/retail-category-service";
import { RetailImageService } from "@/modules/retail/services/retail-image-service";
import { RetailProductService } from "@/modules/retail/services/retail-product-service";
import { RetailVariantService } from "@/modules/retail/services/retail-variant-service";
import { evaluateItemReadiness, loadBatch, saveBatch, selectEligibleBatchItems } from "./batch-store";
import { getScannerServerConfig } from "./env";
import {
  fetchAuthorizedRemoteImage,
  readStagedImageFile,
  validateImageBuffer,
} from "./images";
import { findTenantCatalogDuplicate } from "./lookup";
import type { ScannerSupabaseClient } from "./supabase";
import type {
  AuthorizedOwnerSession,
  BatchImportSummary,
  ScannerBatch,
  ScannerBatchItem,
  TenantStoreOption,
} from "./types";

export interface BatchDryRunPreview {
  batchId: string;
  tenantId: string;
  tenantName: string;
  storeId: string;
  storeSlug: string;
  totalItems: number;
  approvedReadyCount: number;
  unapprovedOrPendingCount: number;
  alreadyImportedCount: number;
  willCreateDraftCount: number;
  willUpdateCount: number;
  willSkipDuplicateCount: number;
  willCreateVariantCount: number;
  newCategoriesToCreate: string[];
  imagesToUploadCount: number;
  blockingIssues: Array<{ itemId: string; name: string; reasons: string[] }>;
}

/**
 * Lista todos os estabelecimentos ativos e suas lojas Retail no Supabase Staging
 * para seleção explícita na Tela 1 (§8).
 */
export async function listActiveTenantsAndStores(
  supabase: ScannerSupabaseClient
): Promise<TenantStoreOption[]> {
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, slug, status, retail_stores(*)")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar estabelecimentos: ${error.message}`);
  }

  const options: TenantStoreOption[] = [];
  for (const t of tenants || []) {
    const stores = Array.isArray(t.retail_stores)
      ? t.retail_stores
      : t.retail_stores
      ? [t.retail_stores]
      : [];

    const activeStore = stores.find((s) => s && s.is_active) || stores[0];
    if (!activeStore) continue;

    const [categories, stats] = await Promise.all([
      RetailCategoryService.listCategories(supabase, t.id, true),
      RetailProductService.getCatalogStats(supabase, t.id),
    ]);

    options.push({
      tenantId: t.id,
      tenantName: t.name,
      tenantSlug: t.slug,
      tenantStatus: t.status,
      storeId: activeStore.id,
      storeName: activeStore.store_name,
      storeSlug: activeStore.slug || t.slug,
      storeTemplate: activeStore.template || "editorial",
      storeActive: Boolean(activeStore.is_active),
      inventoryMode: activeStore.inventory_mode || "track_quantity",
      productCount: stats.totalProducts,
      categoryCount: categories.length,
      categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    });
  }

  return options;
}

/**
 * Verifica no servidor que o tenant e a loja bloqueados no lote existem, estão ativos e pertencem entre si (§8, §14).
 * Retorna o TenantContext oficial para acionar `RetailProductService`, `RetailCategoryService`,
 * `RetailVariantService` e `RetailImageService` com papel `platform_admin` e auditoria nominal.
 */
export async function resolveVerifiedOnboardingTenantContext(params: {
  supabase: ScannerSupabaseClient;
  owner: AuthorizedOwnerSession;
  tenantId: string;
  storeId: string;
}): Promise<TenantContext> {
  const { data: tenant, error: tErr } = await params.supabase
    .from("tenants")
    .select("id, name, slug, status")
    .eq("id", params.tenantId)
    .maybeSingle();

  if (tErr || !tenant) {
    throw new Error("Estabelecimento de destino não localizado.");
  }
  if (tenant.status !== "active") {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA: estabelecimento '${tenant.name}' não está ativo (status=${tenant.status}).`
    );
  }

  const { data: store, error: sErr } = await params.supabase
    .from("retail_stores")
    .select("id, tenant_id, is_active")
    .eq("id", params.storeId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (sErr || !store || !store.is_active) {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA: loja Retail '${params.storeId}' não pertence ao estabelecimento '${tenant.name}' ou está inativa.`
    );
  }

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    slug: tenant.slug,
    status: "active",
    role: "platform_admin",
    userId: params.owner.userId,
  };
}

/**
 * Calcula prévia determinística (dry-run) das alterações antes da aprovação explícita (§8).
 */
export async function previewBatchImport(params: {
  supabase: ScannerSupabaseClient;
  batch: ScannerBatch;
}): Promise<BatchDryRunPreview> {
  const existingCategories = await RetailCategoryService.listCategories(
    params.supabase,
    params.batch.tenantId,
    true
  );
  const existingCatBySlug = new Map(existingCategories.map((c) => [c.slug, c]));
  const existingCatById = new Map(existingCategories.map((c) => [c.id, c]));

  const newCategories = new Set<string>();
  const blockingIssues: BatchDryRunPreview["blockingIssues"] = [];

  let approvedReadyCount = 0;
  let unapprovedOrPendingCount = 0;
  let alreadyImportedCount = 0;
  let willCreateDraftCount = 0;
  let willUpdateCount = 0;
  let willSkipDuplicateCount = 0;
  let willCreateVariantCount = 0;
  let imagesToUploadCount = 0;

  for (const item of params.batch.items) {
    if (
      item.status === "imported" ||
      item.status === "updated" ||
      item.status === "skipped"
    ) {
      alreadyImportedCount++;
      continue;
    }

    const readiness = evaluateItemReadiness(item);
    if (!item.approved || !readiness.canApprove) {
      unapprovedOrPendingCount++;
      if (item.approved && readiness.pendingReasons.length > 0) {
        blockingIssues.push({
          itemId: item.id,
          name: item.name || item.gtin || item.id,
          reasons: readiness.pendingReasons,
        });
      }
      continue;
    }

    approvedReadyCount++;

    if (item.categoryName && (!item.categoryId || !existingCatById.has(item.categoryId))) {
      const slug = ProductInvariants.slugify(item.categoryName);
      if (slug && !existingCatBySlug.has(slug)) {
        newCategories.add(item.categoryName.trim());
      }
    }

    if (item.duplicateMatch) {
      if (item.duplicateResolution === "skip") {
        willSkipDuplicateCount++;
      } else if (item.duplicateResolution === "update_selected") {
        willUpdateCount++;
        if (item.updateFields.includes("images")) {
          imagesToUploadCount += item.images.filter((i) => !i.uploadedStoragePath).length;
        }
      } else if (item.duplicateResolution === "create_variant") {
        willCreateVariantCount++;
      }
    } else {
      willCreateDraftCount++;
      imagesToUploadCount += item.images.filter((i) => !i.uploadedStoragePath).length;
    }
  }

  return {
    batchId: params.batch.id,
    tenantId: params.batch.tenantId,
    tenantName: params.batch.tenantName,
    storeId: params.batch.storeId,
    storeSlug: params.batch.storeSlug,
    totalItems: params.batch.items.length,
    approvedReadyCount,
    unapprovedOrPendingCount,
    alreadyImportedCount,
    willCreateDraftCount,
    willUpdateCount,
    willSkipDuplicateCount,
    willCreateVariantCount,
    newCategoriesToCreate: Array.from(newCategories),
    imagesToUploadCount,
    blockingIssues,
  };
}

function buildOptionsFromVariants(item: ScannerBatchItem) {
  const map = new Map<string, Set<string>>();
  for (const v of item.variants) {
    for (const [k, val] of Object.entries(v.optionsSummary || {})) {
      if (k.toLowerCase() === "gtin") continue;
      if (!val || !val.trim()) continue;
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(val.trim());
    }
  }
  return Array.from(map.entries()).map(([name, values], idx) => ({
    name,
    position: idx,
    values: Array.from(values),
  }));
}

async function ensureCategoryId(params: {
  supabase: ScannerSupabaseClient;
  context: TenantContext;
  item: ScannerBatchItem;
  categoryCache: Map<string, string>; // slug -> id
  inFlightCategories: Map<string, Promise<string>>; // single-flight anti-race
  counter: { created: number };
}): Promise<string[]> {
  if (params.item.categoryId) {
    return [params.item.categoryId];
  }
  const rawName = params.item.categoryName?.trim();
  if (!rawName || rawName.length < 2) return [];

  const slug = ProductInvariants.slugify(rawName);
  if (!slug) return [];

  const cached = params.categoryCache.get(slug);
  if (cached) return [cached];

  const existingPromise = params.inFlightCategories.get(slug);
  if (existingPromise) {
    const id = await existingPromise;
    return [id];
  }

  const creationPromise = (async () => {
    try {
      const created = await RetailCategoryService.createCategory(
        params.supabase,
        params.context,
        {
          name: rawName.slice(0, 80),
          slug,
          description: "Categoria criada via DevEssent Catalog Scanner",
          sortOrder: 0,
          isActive: true,
        }
      );
      params.categoryCache.set(created.slug, created.id);
      params.counter.created++;
      return created.id;
    } catch (err) {
      // Fallback caso outra requisição concorrente tenha criado a categoria no banco
      const refreshed = await RetailCategoryService.listCategories(
        params.supabase,
        params.context.tenantId,
        true
      );
      const match = refreshed.find((c) => c.slug === slug);
      if (match) {
        params.categoryCache.set(match.slug, match.id);
        return match.id;
      }
      throw err;
    } finally {
      params.inFlightCategories.delete(slug);
    }
  })();

  params.inFlightCategories.set(slug, creationPromise);
  const resolvedId = await creationPromise;
  return [resolvedId];
}

async function uploadItemImagesViaRetailService(params: {
  supabase: ScannerSupabaseClient;
  context: TenantContext;
  productId: string;
  item: ScannerBatchItem;
}): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0;
  let failed = 0;
  const seenHashes = new Set<string>();
  const cfg = getScannerServerConfig();

  for (const img of params.item.images) {
    if (img.uploadedStoragePath) {
      seenHashes.add(img.sha256);
      continue;
    }
    if (!img.rightsConfirmed) {
      img.uploadError = "Direitos da imagem não confirmados.";
      failed++;
      continue;
    }
    if (img.sha256 && seenHashes.has(img.sha256)) {
      continue; // evita upload duplicado da mesma imagem no mesmo produto (§9)
    }

    try {
      let validated;
      if (img.localRelativePath) {
        const rawBuf = readStagedImageFile(img.localRelativePath);
        validated = validateImageBuffer(rawBuf, img.fileName, img.mimeType);
      } else if (img.remoteUrl) {
        validated = await fetchAuthorizedRemoteImage(img.remoteUrl, cfg.allowedImageHosts);
      } else {
        throw new Error("Imagem sem arquivo local nem URL autorizada.");
      }

      if (seenHashes.has(validated.sha256)) {
        continue;
      }

      const uploadedImg = await RetailImageService.uploadProductImage(
        params.supabase,
        params.context,
        params.productId,
        {
          buffer: validated.buffer,
          fileName: validated.safeFileName,
          contentType: validated.mimeType,
          size: validated.sizeBytes,
        },
        params.item.name,
        img.isPrimary,
        null
      );

      img.sha256 = validated.sha256;
      img.width = validated.width;
      img.height = validated.height;
      img.uploadedStoragePath = uploadedImg.storagePath;
      img.uploadedPublicUrl = uploadedImg.publicUrl || null;
      img.uploadError = null;
      seenHashes.add(validated.sha256);
      uploaded++;
    } catch (err) {
      img.uploadError = err instanceof Error ? err.message : "Falha no upload de imagem.";
      failed++;
    }
  }

  return { uploaded, failed };
}

/**
 * Executa a importação controlada em lotes utilizando EXCLUSIVAMENTE os serviços oficiais do Retail (§8, §9, §10, §11).
 *
 * - Sempre cria novos produtos em `status: "draft"` (nunca publica automaticamente).
 * - Respeita concorrência controlada (chunk de 2 itens), pausa e retomada idempotente.
 * - Se falhar no item N, itens 1..N-1 já confirmados mantêm `importedProductId` e jamais são duplicados na retomada.
 */
export async function executeBatchImport(params: {
  supabase: ScannerSupabaseClient;
  owner: AuthorizedOwnerSession;
  batchId: string;
  onlyFailedOrPending?: boolean;
  concurrency?: number;
}): Promise<{ batch: ScannerBatch; summary: BatchImportSummary }> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const batch = loadBatch(params.batchId);
  if (!batch) {
    throw new Error(`Lote '${params.batchId}' não encontrado.`);
  }

  // Travar e verificar no servidor tenant + loja antes de qualquer gravação (§8, §14)
  const context = await resolveVerifiedOnboardingTenantContext({
    supabase: params.supabase,
    owner: params.owner,
    tenantId: batch.tenantId,
    storeId: batch.storeId,
  });

  batch.status = "importing";
  batch.pauseRequested = false;
  saveBatch(batch);

  // Carregar cache de categorias existentes no tenant
  const existingCats = await RetailCategoryService.listCategories(
    params.supabase,
    context.tenantId,
    true
  );
  const categoryCache = new Map<string, string>(existingCats.map((c) => [c.slug, c.id]));
  const inFlightCategories = new Map<string, Promise<string>>();
  const catCounter = { created: 0 };

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let partialImageFailedCount = 0;
  let failedCount = 0;
  let imagesUploadedCount = 0;
  let duplicatesAvoidedCount = 0;

  const eligibleItems = selectEligibleBatchItems(batch.items, params.onlyFailedOrPending);

  const concurrency = Math.max(1, Math.min(3, params.concurrency ?? 2));
  let paused = false;

  const processSingleItem = async (item: ScannerBatchItem): Promise<void> => {
    const readiness = evaluateItemReadiness(item);
    item.pendingReasons = readiness.pendingReasons;
    if (!readiness.canApprove) {
      item.status = "failed";
      item.lastError = readiness.pendingReasons.join(" ");
      failedCount++;
      return;
    }

    const previousStatus = item.status;
    item.status = "importing";
    item.lastError = null;
    item.updatedAt = new Date().toISOString();

    try {
      // Se o item falhou apenas em imagem anteriormente (produto já criado!), retomar apenas o upload sem duplicar produto!
      if (previousStatus === "partial_image_failed" && item.importedProductId) {
        const imgRes = await uploadItemImagesViaRetailService({
          supabase: params.supabase,
          context,
          productId: item.importedProductId,
          item,
        });
        imagesUploadedCount += imgRes.uploaded;
        if (imgRes.failed > 0) {
          item.status = "partial_image_failed";
          item.lastError = `${imgRes.failed} imagem(ns) falharam no upload ao Storage.`;
          partialImageFailedCount++;
        } else {
          item.status = "imported";
          item.lastError = null;
          importedCount++;
        }
        return;
      }

      // Checagem de duplicidade em tempo real no tenant (SKU, GTIN e slug)
      const primarySku = item.variants[0]?.sku;
      const slugCandidate = ProductInvariants.slugify(item.name);
      const liveDup = await findTenantCatalogDuplicate({
        supabase: params.supabase,
        tenantId: context.tenantId,
        sku: primarySku,
        gtin: item.gtin,
        slug: slugCandidate,
      });

      if (liveDup) {
        item.duplicateMatch = liveDup;

        if (item.duplicateResolution === "skip") {
          item.status = "skipped";
          item.importedProductId = liveDup.existingProductId;
          item.importedProductSlug = liveDup.existingSlug;
          skippedCount++;
          duplicatesAvoidedCount++;
          return;
        }

        if (item.duplicateResolution === "update_selected") {
          const existingProd = await RetailProductService.getProductById(
            params.supabase,
            context.tenantId,
            liveDup.existingProductId
          );

          const categoryIds = item.updateFields.includes("category")
            ? await ensureCategoryId({
                supabase: params.supabase,
                context,
                item,
                categoryCache,
                inFlightCategories,
                counter: catCounter,
              })
            : existingProd.categories.map((c) => c.id);

          await RetailProductService.updateProduct(params.supabase, context, {
            id: existingProd.id,
            name: item.updateFields.includes("name") ? item.name : existingProd.name,
            slug: existingProd.slug,
            description: item.updateFields.includes("description")
              ? item.description
              : existingProd.description,
            categoryIds,
          });

          // Nunca sobrescrever preço/estoque sem confirmação explícita (§9)
          const targetVariantId = liveDup.matchedVariantId || existingProd.variants[0]?.id;
          const draftVar = item.variants[0];
          if (targetVariantId && draftVar) {
            if (
              item.updateFields.includes("price") &&
              item.allowOverwritePrice &&
              draftVar.priceCents !== null &&
              draftVar.priceCents > 0
            ) {
              await RetailVariantService.updatePrice(
                params.supabase,
                context,
                targetVariantId,
                draftVar.priceCents,
                draftVar.compareAtPriceCents ?? null
              );
            }
            if (
              item.updateFields.includes("stock") &&
              item.allowOverwriteStock &&
              draftVar.stockQuantity !== null &&
              draftVar.stockQuantity >= 0
            ) {
              await RetailVariantService.adjustStock(params.supabase, context, {
                variantId: targetVariantId,
                newStockQuantity: draftVar.stockQuantity,
              });
            }
          }

          if (item.updateFields.includes("images") && item.images.length > 0) {
            const imgRes = await uploadItemImagesViaRetailService({
              supabase: params.supabase,
              context,
              productId: existingProd.id,
              item,
            });
            imagesUploadedCount += imgRes.uploaded;
            if (imgRes.failed > 0) {
              item.importedProductId = existingProd.id;
              item.importedProductSlug = existingProd.slug;
              item.status = "partial_image_failed";
              item.lastError = `Produto atualizado, mas ${imgRes.failed} imagem(ns) falharam no upload.`;
              partialImageFailedCount++;
              duplicatesAvoidedCount++;
              return;
            }
          }

          item.importedProductId = existingProd.id;
          item.importedProductSlug = existingProd.slug;
          item.status = "updated";
          updatedCount++;
          duplicatesAvoidedCount++;
          return;
        }

        if (item.duplicateResolution === "create_variant") {
          const existingProd = await RetailProductService.getProductById(
            params.supabase,
            context.tenantId,
            liveDup.existingProductId
          );

          const existingSkus = new Set(existingProd.variants.map((v) => v.sku.toUpperCase()));
          const newVariants = item.variants
            .filter((v) => !existingSkus.has(VariantInvariants.normalizeSku(v.sku)))
            .map((v, idx) => ({
              sku: VariantInvariants.normalizeSku(v.sku),
              name: v.name,
              priceCents: v.priceCents ?? 0,
              compareAtPriceCents: v.compareAtPriceCents ?? null,
              stockQuantity: v.stockQuantity ?? 0,
              isAvailable: v.isAvailable,
              optionsSummary: {
                ...v.optionsSummary,
                ...(v.gtin ? { gtin: v.gtin } : {}),
              },
              sortOrder: existingProd.variants.length + idx,
            }));

          if (newVariants.length === 0) {
            item.status = "skipped";
            item.importedProductId = existingProd.id;
            item.importedProductSlug = existingProd.slug;
            skippedCount++;
            duplicatesAvoidedCount++;
            return;
          }

          const mergedVariants = [
            ...existingProd.variants.map((ev) => ({
              id: ev.id,
              sku: ev.sku,
              name: ev.name,
              priceCents: ev.priceCents,
              compareAtPriceCents: ev.compareAtPriceCents,
              stockQuantity: ev.stockQuantity,
              isAvailable: ev.isAvailable,
              optionsSummary: ev.optionsSummary,
              sortOrder: ev.sortOrder,
            })),
            ...newVariants,
          ];

          await RetailProductService.updateProduct(params.supabase, context, {
            id: existingProd.id,
            slug: existingProd.slug,
            variants: mergedVariants,
          });

          item.importedProductId = existingProd.id;
          item.importedProductSlug = existingProd.slug;
          item.status = "updated";
          updatedCount++;
          duplicatesAvoidedCount++;
          return;
        }
      }

      // Novo produto: SEMPRE criado como rascunho (`status: "draft"`) via RetailProductService oficial (§8)
      const categoryIds = await ensureCategoryId({
        supabase: params.supabase,
        context,
        item,
        categoryCache,
        inFlightCategories,
        counter: catCounter,
      });

      const descriptionParts: string[] = [];
      if (item.description) descriptionParts.push(item.description.trim());
      if (item.brand && !item.description?.toLowerCase().includes(item.brand.toLowerCase())) {
        descriptionParts.push(`Marca: ${item.brand}`);
      }
      if (
        item.presentation &&
        !item.description?.toLowerCase().includes(item.presentation.toLowerCase())
      ) {
        descriptionParts.push(`Apresentação: ${item.presentation}`);
      }

      const uniqueSlugBase = ProductInvariants.slugify(item.name) || `produto-${item.id.slice(0, 6)}`;
      const createdProduct = await RetailProductService.createProduct(
        params.supabase,
        context,
        {
          name: item.name.trim(),
          slug: uniqueSlugBase,
          description: descriptionParts.join("\n\n") || null,
          status: "draft", // Obrigatório pela regra §8 — publicação somente após revisão!
          categoryIds,
          options: buildOptionsFromVariants(item),
          variants: item.variants.map((v, idx) => ({
            sku: VariantInvariants.normalizeSku(v.sku),
            name: v.name.trim() || "Padrão",
            priceCents: v.priceCents ?? 0,
            compareAtPriceCents: v.compareAtPriceCents ?? null,
            stockQuantity: v.stockQuantity ?? 0,
            isAvailable: v.isAvailable,
            optionsSummary: {
              ...v.optionsSummary,
              ...(v.gtin || item.gtin ? { gtin: v.gtin || item.gtin || "" } : {}),
            },
            sortOrder: idx,
          })),
        }
      );

      item.importedProductId = createdProduct.id;
      item.importedProductSlug = createdProduct.slug;

      if (item.images.length > 0) {
        const imgRes = await uploadItemImagesViaRetailService({
          supabase: params.supabase,
          context,
          productId: createdProduct.id,
          item,
        });
        imagesUploadedCount += imgRes.uploaded;
        if (imgRes.failed > 0) {
          item.status = "partial_image_failed";
          item.lastError = `Produto criado em rascunho, mas ${imgRes.failed} imagem(ns) falharam no upload ao Storage.`;
          partialImageFailedCount++;
          return;
        }
      }

      item.status = "imported";
      item.lastError = null;
      importedCount++;
    } catch (err) {
      item.status = "failed";
      item.lastError = err instanceof Error ? err.message : "Erro inesperado ao importar produto.";
      failedCount++;
    } finally {
      item.updatedAt = new Date().toISOString();
    }
  };

  for (let i = 0; i < eligibleItems.length; i += concurrency) {
    // Recarregar flag de pausa entre chunks (§11)
    const latestOnDisk = loadBatch(batch.id);
    if (latestOnDisk?.pauseRequested) {
      paused = true;
      batch.pauseRequested = true;
      break;
    }

    const chunk = eligibleItems.slice(i, i + concurrency);
    await Promise.all(chunk.map((item) => processSingleItem(item)));
    saveBatch(batch);
  }

  const finishedAtMs = Date.now();
  const summary: BatchImportSummary = {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    paused,
    totalApproved: eligibleItems.length,
    importedCount,
    updatedCount,
    skippedCount,
    partialImageFailedCount,
    failedCount,
    categoriesCreatedCount: catCounter.created,
    imagesUploadedCount,
    duplicatesAvoidedCount,
  };

  batch.lastImportSummary = summary;
  batch.status = paused
    ? "paused"
    : failedCount > 0 || partialImageFailedCount > 0
    ? "completed_with_errors"
    : "completed";
  saveBatch(batch);

  // Auditoria corporativa no banco oficial (§1, §14)
  await AuditService.recordEvent({
    supabase: params.supabase,
    tenantId: context.tenantId,
    actorUserId: context.userId,
    action: "retail.catalog_onboarding_batch_executed",
    resourceType: "retail_product",
    resourceId: null,
    metadata: {
      source: "devessent_catalog_scanner",
      batchId: batch.id,
      batchLabel: batch.label,
      storeId: batch.storeId,
      storeSlug: batch.storeSlug,
      importedCount,
      updatedCount,
      skippedCount,
      partialImageFailedCount,
      failedCount,
      categoriesCreatedCount: catCounter.created,
      imagesUploadedCount,
      duplicatesAvoidedCount,
      paused,
      durationMs: summary.durationMs,
    },
  });

  return { batch, summary };
}
