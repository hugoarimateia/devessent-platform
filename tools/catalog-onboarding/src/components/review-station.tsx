"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import type {
  DuplicateResolution,
  FieldConfidence,
  ScannerBatch,
  ScannerBatchItem,
  ScannerVariantDraft,
  TenantStoreOption,
} from "@scanner/lib/types";

interface ReviewStationProps {
  batch: ScannerBatch;
  tenantStore: TenantStoreOption | null;
  onBatchUpdated: (batch: ScannerBatch) => void;
  onProceedToDeploy: () => void;
}

function confidenceBadgeStyle(conf: FieldConfidence): string {
  switch (conf) {
    case "verified":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "high":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "medium":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "unconfirmed":
      return "bg-violet-500/15 text-violet-300 border-violet-500/30";
    case "low":
      return "bg-orange-500/15 text-orange-300 border-orange-500/30";
    default:
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  }
}

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function ReviewStation({
  batch,
  tenantStore,
  onBatchUpdated,
  onProceedToDeploy,
}: ReviewStationProps) {
  const [filter, setFilter] = React.useState<
    "all" | "ready" | "pending" | "duplicate" | "approved" | "imported" | "failed"
  >("all");
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return batch.items.filter((item) => {
      if (filter === "ready" && (item.pendingReasons.length > 0 || item.approved)) return false;
      if (filter === "pending" && item.pendingReasons.length === 0) return false;
      if (filter === "duplicate" && !item.duplicateMatch) return false;
      if (filter === "approved" && !item.approved) return false;
      if (filter === "imported" && item.status !== "imported" && item.status !== "updated")
        return false;
      if (filter === "failed" && item.status !== "failed" && item.status !== "partial_image_failed")
        return false;

      if (q) {
        const haystack = [
          item.name,
          item.brand,
          item.gtin,
          item.categoryName,
          ...item.variants.map((v) => v.sku),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [batch.items, filter, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const runBulkAction = async (payload: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/batches/${batch.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: Array.from(selectedIds),
          ...payload,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        batch?: ScannerBatch;
        approvedCount?: number;
        blockedCount?: number;
      };
      if (!res.ok || !data.ok || !data.batch) {
        setError(data.error || "Falha na operação em lote.");
        return;
      }
      onBatchUpdated(data.batch);
      if (typeof data.approvedCount === "number") {
        setNotice(
          `${data.approvedCount} item(ns) aprovado(s). ${
            data.blockedCount ? `${data.blockedCount} bloqueado(s) por pendências comerciais.` : ""
          }`
        );
      } else {
        setNotice(successMsg);
      }
    } catch {
      setError("Erro de comunicação ao atualizar lote.");
    } finally {
      setBusy(false);
    }
  };

  const patchItem = async (itemId: string, patch: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/batches/${batch.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, patch }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; batch?: ScannerBatch };
      if (!res.ok || !data.ok || !data.batch) {
        setError(data.error || "Não foi possível salvar alteração do item.");
        return;
      }
      onBatchUpdated(data.batch);
    } catch {
      setError("Erro ao salvar item.");
    } finally {
      setBusy(false);
    }
  };

  const uploadItemImage = async (itemId: string, file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("isPrimary", "true");
      const res = await fetch(`/api/batches/${batch.id}/items/${itemId}/image`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; batch?: ScannerBatch };
      if (!res.ok || !data.ok || !data.batch) {
        setError(data.error || "Falha ao anexar imagem.");
        return;
      }
      onBatchUpdated(data.batch);
      setNotice("Imagem validada e anexada ao item.");
    } catch {
      setError("Erro ao enviar imagem.");
    } finally {
      setBusy(false);
    }
  };

  const approvedCount = batch.items.filter((i) => i.approved).length;
  const pendingCount = batch.items.filter((i) => i.pendingReasons.length > 0).length;
  const duplicateCount = batch.items.filter((i) => Boolean(i.duplicateMatch)).length;

  return (
    <div className="space-y-4">
      {/* Resumo + Barra de Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", `Todos (${batch.items.length})`],
                ["pending", `Pendentes (${pendingCount})`],
                ["duplicate", `Duplicados (${duplicateCount})`],
                ["approved", `Aprovados (${approvedCount})`],
                ["ready", "Prontos p/ aprovar"],
                ["imported", "Importados"],
                ["failed", "Com erro"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  filter === key
                    ? "bg-emerald-500 text-slate-950 font-semibold"
                    : "bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome, SKU, GTIN ou categoria..."
            className="w-full sm:w-64 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500"
          />
        </div>

        {/* Barra de ações em lote */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={selectAllVisible}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            {selectedIds.size === filteredItems.length && filteredItems.length > 0
              ? "Limpar seleção"
              : `Selecionar visíveis (${filteredItems.length})`}
          </button>

          <div className="flex items-center gap-1">
            <input
              type="text"
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              placeholder="Categoria em lote..."
              list="existing-tenant-categories"
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white w-40"
            />
            <datalist id="existing-tenant-categories">
              {(tenantStore?.categories || []).map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <button
              type="button"
              disabled={busy || !bulkCategory.trim()}
              onClick={() => {
                const matchedCat = tenantStore?.categories.find(
                  (c) => c.name.toLowerCase() === bulkCategory.trim().toLowerCase()
                );
                void runBulkAction(
                  {
                    action: "bulk_set_category",
                    categoryId: matchedCat?.id ?? null,
                    categoryName: bulkCategory.trim(),
                  },
                  `Categoria '${bulkCategory.trim()}' aplicada em lote.`
                );
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 disabled:opacity-50 cursor-pointer"
            >
              Aplicar
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              runBulkAction(
                { action: "bulk_confirm_commercial", confirmPrice: true, confirmStock: true },
                "Preços e estoques preenchidos marcados como confirmados pelo estabelecimento."
              )
            }
            className="px-2.5 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-xs text-sky-200 cursor-pointer"
          >
            Confirmar Preço/Estoque (Lojista)
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              runBulkAction(
                { action: "bulk_approve", approved: true },
                "Itens válidos aprovados para implantação."
              )
            }
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer"
          >
            Aprovar Prontos
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              runBulkAction(
                { action: "bulk_reidentify" },
                "Re-identificação de GTINs concluída."
              )
            }
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-300 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-identificar</span>
          </button>

          {selectedIds.size > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                runBulkAction(
                  { action: "bulk_remove" },
                  "Itens selecionados removidos da fila."
                ).then(() => setSelectedIds(new Set()))
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-xs text-rose-200 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remover ({selectedIds.size})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onProceedToDeploy}
            disabled={approvedCount === 0}
            className="ml-auto px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs disabled:opacity-40 cursor-pointer"
          >
            Avançar para Implantação ({approvedCount} aprovados) →
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Tabela / Cards de Revisão */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
          Nenhum item nesta visualização. Capture códigos, fotos ou importe uma planilha na etapa anterior.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <ReviewItemCard
              key={item.id}
              batchId={batch.id}
              item={item}
              tenantCategories={tenantStore?.categories || []}
              selected={selectedIds.has(item.id)}
              expanded={expandedId === item.id}
              busy={busy}
              onToggleSelect={() => toggleSelect(item.id)}
              onToggleExpand={() =>
                setExpandedId((prev) => (prev === item.id ? null : item.id))
              }
              onPatch={(patch) => patchItem(item.id, patch)}
              onUploadImage={(file) => uploadItemImage(item.id, file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ReviewItemCardProps {
  batchId: string;
  item: ScannerBatchItem;
  tenantCategories: Array<{ id: string; name: string; slug: string }>;
  selected: boolean;
  expanded: boolean;
  busy: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
  onUploadImage: (file: File) => Promise<void>;
}

function ReviewItemCard({
  batchId,
  item,
  tenantCategories,
  selected,
  expanded,
  busy,
  onToggleSelect,
  onToggleExpand,
  onPatch,
  onUploadImage,
}: ReviewItemCardProps) {
  const [name, setName] = React.useState(item.name);
  const [brand, setBrand] = React.useState(item.brand || "");
  const [categoryName, setCategoryName] = React.useState(item.categoryName || "");
  const [description, setDescription] = React.useState(item.description || "");
  const [gtin, setGtin] = React.useState(item.gtin || "");
  const [variants, setVariants] = React.useState<ScannerVariantDraft[]>(item.variants);
  const [priceConfirmed, setPriceConfirmed] = React.useState(item.priceConfirmedByMerchant);
  const [stockConfirmed, setStockConfirmed] = React.useState(item.stockConfirmedByMerchant);
  const [duplicateResolution, setDuplicateResolution] = React.useState<DuplicateResolution>(
    item.duplicateResolution
  );
  const [allowOverwritePrice, setAllowOverwritePrice] = React.useState(item.allowOverwritePrice);
  const [allowOverwriteStock, setAllowOverwriteStock] = React.useState(item.allowOverwriteStock);

  React.useEffect(() => {
    setName(item.name);
    setBrand(item.brand || "");
    setCategoryName(item.categoryName || "");
    setDescription(item.description || "");
    setGtin(item.gtin || "");
    setVariants(item.variants);
    setPriceConfirmed(item.priceConfirmedByMerchant);
    setStockConfirmed(item.stockConfirmedByMerchant);
    setDuplicateResolution(item.duplicateResolution);
    setAllowOverwritePrice(item.allowOverwritePrice);
    setAllowOverwriteStock(item.allowOverwriteStock);
  }, [item]);

  const primaryImg = item.images.find((i) => i.isPrimary) || item.images[0] || null;
  const thumbUrl = primaryImg?.uploadedPublicUrl
    ? primaryImg.uploadedPublicUrl
    : primaryImg?.localRelativePath
    ? `/api/batches/${batchId}/images/${primaryImg.localRelativePath.replace(`${batchId}/`, "")}`
    : null;

  const isLocked = item.status === "imported" || item.status === "updated";
  const firstVar = item.variants[0];

  const handleSave = async () => {
    const matchedCat = tenantCategories.find(
      (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
    );
    await onPatch({
      name,
      brand: brand || null,
      categoryId: matchedCat?.id ?? null,
      categoryName: categoryName || null,
      description: description || null,
      gtin: gtin || null,
      variants,
      priceConfirmedByMerchant: priceConfirmed,
      stockConfirmedByMerchant: stockConfirmed,
      duplicateResolution,
      allowOverwritePrice,
      allowOverwriteStock,
    });
  };

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        item.status === "imported" || item.status === "updated"
          ? "border-emerald-500/35 bg-emerald-950/15"
          : item.status === "failed" || item.status === "partial_image_failed"
          ? "border-rose-500/40 bg-rose-950/15"
          : item.approved
          ? "border-emerald-500/30 bg-slate-900/90"
          : "border-slate-800 bg-slate-900/65"
      }`}
    >
      {/* Linha compacta */}
      <div className="p-3.5 flex flex-wrap items-center gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Selecionar ${item.name || item.gtin || "item"}`}
          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
        />

        <div className="w-12 h-12 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shrink-0 flex items-center justify-center text-[10px] text-slate-500 font-mono">
          {thumbUrl ? (
            <img src={thumbUrl} alt={item.name || "Produto"} className="w-full h-full object-cover" />
          ) : (
            <span>SEM FOTO</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-white truncate max-w-md">
              {item.name || "(Sem nome — preencher)"}
            </span>
            {item.brand && (
              <span className="text-[11px] text-slate-400 font-mono">· {item.brand}</span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${confidenceBadgeStyle(
                item.provenance.name.confidence
              )}`}
            >
              {item.lookupSourceLabel || item.captureMethod}
            </span>
            {item.duplicateMatch && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/35">
                Duplicado ({item.duplicateMatch.matchType.toUpperCase()} · {item.duplicateResolution})
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span>SKU: {firstVar?.sku || "—"}</span>
            <span>GTIN: {item.gtin || "Sem GTIN"}</span>
            <span>Cat: {item.categoryName || "Pendente"}</span>
            <span>Variantes: {item.variants.length}</span>
            <span className={item.priceConfirmedByMerchant ? "text-emerald-300" : "text-amber-300"}>
              Preço: {formatCents(firstVar?.priceCents ?? null)}
              {!item.priceConfirmedByMerchant && " (não conf.)"}
            </span>
            <span className={item.stockConfirmedByMerchant ? "text-emerald-300" : "text-amber-300"}>
              Est: {firstVar?.stockQuantity ?? "—"}
              {!item.stockConfirmedByMerchant && " (não conf.)"}
            </span>
          </div>

          {item.pendingReasons.length > 0 && !isLocked && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{item.pendingReasons.join(" · ")}</span>
            </div>
          )}

          {item.lastError && (
            <div className="text-[11px] text-rose-300 font-mono">Erro: {item.lastError}</div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isLocked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPatch({ approved: !item.approved })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                item.approved
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{item.approved ? "Aprovado" : "Aprovar"}</span>
            </button>
          )}

          {isLocked && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-mono">
              {item.status === "imported" ? "Rascunho Criado" : "Atualizado"}
            </span>
          )}

          <button
            type="button"
            onClick={onToggleExpand}
            className="p-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300 cursor-pointer"
            aria-label="Expandir detalhes do item"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Editor Completo Expansível */}
      {expanded && (
        <div className="border-t border-slate-800 p-4 bg-slate-950/60 space-y-4 rounded-b-2xl">
          {/* Origem / Confiabilidade */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(item.provenance) as Array<[string, { confidence: FieldConfidence; note: string }]>).map(
              ([field, prov]) => (
                <span
                  key={field}
                  title={prov.note}
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-mono ${confidenceBadgeStyle(
                    prov.confidence
                  )}`}
                >
                  {field}: {prov.confidence}
                </span>
              )
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">Nome Comercial *</label>
              <input
                type="text"
                disabled={isLocked}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Marca</label>
              <input
                type="text"
                disabled={isLocked}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Categoria</label>
              <input
                type="text"
                disabled={isLocked}
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                list="existing-tenant-categories"
                placeholder="Ex.: Alfaiataria, Casa & Aromas..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">GTIN / EAN</label>
              <input
                type="text"
                disabled={isLocked}
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] text-slate-400 mb-1">Descrição</label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          {/* Variantes, Preços e Estoque */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Variantes (SKU · Preço em centavos ou R$ · Estoque)
              </span>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() =>
                    setVariants((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        sku: `${prev[0]?.sku || "ITEM"}-V${prev.length + 1}`,
                        name: `Variante ${prev.length + 1}`,
                        gtin: null,
                        priceCents: prev[0]?.priceCents ?? null,
                        compareAtPriceCents: null,
                        stockQuantity: 0,
                        isAvailable: true,
                        optionsSummary: {},
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar Variante</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div
                  key={v.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-800 bg-slate-900/70 p-2.5"
                >
                  <input
                    type="text"
                    disabled={isLocked}
                    value={v.sku}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, sku: e.target.value } : row))
                      )
                    }
                    placeholder="SKU"
                    className="sm:col-span-3 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-white"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    value={v.name}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row))
                      )
                    }
                    placeholder="Variante (ex.: Preto / M)"
                    className="sm:col-span-3 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isLocked}
                    value={v.priceCents !== null ? (v.priceCents / 100).toFixed(2) : ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Math.round(Number(e.target.value) * 100);
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, priceCents: val } : row))
                      );
                    }}
                    placeholder="Preço R$"
                    className="sm:col-span-3 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-white"
                  />
                  <input
                    type="number"
                    min="0"
                    disabled={isLocked}
                    value={v.stockQuantity ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value)));
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, stockQuantity: val } : row))
                      );
                    }}
                    placeholder="Estoque"
                    className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-white"
                  />
                  {!isLocked && variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                      className="sm:col-span-1 p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Regra comercial obrigatória (§7) */}
            <div className="flex flex-wrap gap-4 pt-1 text-xs">
              <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={priceConfirmed}
                  onChange={(e) => setPriceConfirmed(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Preço confirmado com o estabelecimento</span>
              </label>
              <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={stockConfirmed}
                  onChange={(e) => setStockConfirmed(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Estoque confirmado com o estabelecimento</span>
              </label>
            </div>
          </div>

          {/* Controle de Duplicação (§9) */}
          {item.duplicateMatch && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 space-y-2 text-xs">
              <div className="font-semibold text-amber-200">
                Registro já existe nesta empresa: &ldquo;{item.duplicateMatch.existingProductName}&rdquo;
                (SKU {item.duplicateMatch.matchedSku || "—"}, preço atual{" "}
                {formatCents(item.duplicateMatch.existingPriceCents)}, estoque{" "}
                {item.duplicateMatch.existingStockQuantity ?? "—"})
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  disabled={isLocked}
                  value={duplicateResolution}
                  onChange={(e) => setDuplicateResolution(e.target.value as DuplicateResolution)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-xs text-white"
                >
                  <option value="skip">Ignorar registro existente (padrão seguro)</option>
                  <option value="update_selected">Atualizar campos selecionados</option>
                  <option value="create_variant">Criar nova variante no produto existente</option>
                </select>
                {duplicateResolution === "update_selected" && (
                  <>
                    <label className="inline-flex items-center gap-1.5 text-amber-100">
                      <input
                        type="checkbox"
                        disabled={isLocked}
                        checked={allowOverwritePrice}
                        onChange={(e) => setAllowOverwritePrice(e.target.checked)}
                      />
                      <span>Permitir sobrescrever preço</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-amber-100">
                      <input
                        type="checkbox"
                        disabled={isLocked}
                        checked={allowOverwriteStock}
                        onChange={(e) => setAllowOverwriteStock(e.target.checked)}
                      />
                      <span>Permitir sobrescrever estoque</span>
                    </label>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Imagens anexadas */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {item.images.map((img) => (
                <div
                  key={img.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 text-[11px] text-slate-200"
                >
                  {img.isPrimary && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                  <span className="truncate max-w-36">{img.fileName}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {img.uploadedStoragePath ? "Storage OK" : `${Math.round(img.sizeBytes / 1024)}KB`}
                  </span>
                </div>
              ))}
              {!isLocked && (
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-700 hover:border-emerald-500/50 text-xs text-slate-300 cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Anexar foto (PNG/JPG/WebP)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void onUploadImage(f);
                    }}
                  />
                </label>
              )}
            </div>

            {!isLocked && (
              <button
                type="button"
                disabled={busy}
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer"
              >
                Salvar Revisão do Item
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
