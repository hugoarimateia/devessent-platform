"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Package,
  Search,
  Plus,
  Edit,
} from "lucide-react";
import type {
  RetailCategory,
  RetailProductWithDetails,
} from "../types";
import { ProductInvariants } from "../domain/product-invariants";
import {
  publishProductAction,
  archiveProductAction,
} from "../actions/retail-product.actions";

interface RetailProductTableProps {
  tenantId: string;
  currency: string;
  products: RetailProductWithDetails[];
  categories: RetailCategory[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentStatus: string;
  currentCategory: string;
  currentSearch: string;
  userRole: string;
}

export function RetailProductTable({
  tenantId,
  currency,
  products,
  categories,
  totalCount,
  page,
  pageSize: _pageSize,
  totalPages,
  currentStatus,
  currentCategory,
  currentSearch,
  userRole,
}: RetailProductTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(currentSearch);
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ text: string; error?: boolean } | null>(null);

  const canWrite = userRole === "owner" || userRole === "manager" || userRole === "platform_admin";

  const updateFilters = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams?.toString() || "");
    for (const [k, v] of Object.entries(params)) {
      if (!v || v === "all") {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: search.trim() || null });
  };

  const handlePublish = async (productId: string) => {
    setLoadingAction(productId);
    setFeedback(null);
    const res = await publishProductAction(tenantId, productId);
    setLoadingAction(null);
    if (!res.success) {
      setFeedback({ text: res.error || "Falha ao publicar.", error: true });
    } else {
      setFeedback({ text: "Produto publicado com sucesso!" });
      router.refresh();
    }
  };

  const handleArchive = async (productId: string) => {
    setLoadingAction(productId);
    setFeedback(null);
    const res = await archiveProductAction(tenantId, productId);
    setLoadingAction(null);
    if (!res.success) {
      setFeedback({ text: res.error || "Falha ao arquivar.", error: true });
    } else {
      setFeedback({ text: "Produto arquivado com sucesso!" });
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-4 rounded-[14px] border border-border shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou slug..."
            className="w-full pl-9 pr-4 py-2 rounded-[10px] bg-background border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro de Categoria */}
          <select
            value={currentCategory}
            onChange={(e) => updateFilters({ categoryId: e.target.value })}
            className="px-3 py-2 rounded-[10px] bg-background border border-border text-xs text-foreground focus:outline-none"
            aria-label="Filtrar por categoria"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Filtro de Status */}
          <select
            value={currentStatus}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className="px-3 py-2 rounded-[10px] bg-background border border-border text-xs text-foreground focus:outline-none"
            aria-label="Filtrar por situação do produto"
          >
            <option value="all">Todas as situações</option>
            <option value="published">Publicados</option>
            <option value="draft">Rascunhos</option>
            <option value="archived">Arquivados</option>
          </select>

          {canWrite && (
            <Link
              href="/dashboard/retail/produtos/novo"
              prefetch={false}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity"
              style={{ backgroundColor: "var(--t-fill, var(--accent))" }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo</span>
            </Link>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3 rounded-[10px] text-xs flex items-center justify-between border ${
            feedback.error
              ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold px-2 py-0.5"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabela de Produtos */}
      <div className="rounded-[16px] bg-surface border border-border overflow-hidden shadow-xs">
        {products.length === 0 ? (
          <div className="p-16 text-center text-foreground-muted">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <h3 className="text-sm font-semibold text-foreground">Nenhum produto encontrado</h3>
            <p className="text-xs mt-1 max-w-sm mx-auto">
              Tente alterar os termos da busca ou os filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted/50 text-foreground-muted font-mono uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">Categorias</th>
                  <th className="py-3 px-4">Variantes</th>
                  <th className="py-3 px-4">Faixa de Preço</th>
                  <th className="py-3 px-4">Estoque</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {products.map((p) => {
                  const statusBadgeClass =
                    p.status === "published"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : p.status === "archived"
                      ? "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

                  const statusLabel =
                    p.status === "published"
                      ? "Publicado"
                      : p.status === "archived"
                      ? "Arquivado"
                      : "Rascunho";

                  return (
                    <tr key={p.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {p.primaryImage ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={p.primaryImage.publicUrl}
                              alt={p.primaryImage.altText || p.name}
                              className="w-11 h-11 rounded-[8px] object-cover bg-surface-muted shrink-0 border border-border"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-[8px] bg-surface-muted flex items-center justify-center shrink-0 border border-border text-foreground-muted">
                              <Package className="w-5 h-5 opacity-40" />
                            </div>
                          )}
                          <div>
                            <Link
                              href={`/dashboard/retail/produtos/${p.id}`}
                              prefetch={false}
                              className="font-medium text-foreground hover:underline text-sm"
                            >
                              {p.name}
                            </Link>
                            <span className="block font-mono text-[11px] text-foreground-muted">
                              /{p.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {p.categories.length > 0 ? (
                            p.categories.map((c) => (
                              <span
                                key={c.id}
                                className="px-2 py-0.5 rounded-full text-[10px] bg-surface-muted border border-border text-foreground-muted font-medium"
                              >
                                {c.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-foreground-muted italic text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-foreground">
                        {p.variants.length} var
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        {p.minPriceCents === p.maxPriceCents
                          ? ProductInvariants.formatCentsToCurrency(p.minPriceCents, currency)
                          : `${ProductInvariants.formatCentsToCurrency(
                              p.minPriceCents,
                              currency
                            )} – ${ProductInvariants.formatCentsToCurrency(
                              p.maxPriceCents,
                              currency
                            )}`}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <span
                          className={`font-semibold ${
                            p.totalStock === 0 ? "text-amber-500" : "text-foreground"
                          }`}
                        >
                          {p.totalStock} un
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadgeClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/dashboard/retail/produtos/${p.id}`}
                            prefetch={false}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-[6px] bg-surface-muted hover:bg-surface border border-border transition-colors text-foreground"
                          >
                            <Edit className="w-3 h-3 text-foreground-muted" />
                            <span>Editar</span>
                          </Link>

                          {canWrite && p.status !== "published" && (
                            <button
                              onClick={() => handlePublish(p.id)}
                              disabled={loadingAction === p.id}
                              className="px-2 py-1 text-xs rounded-[6px] text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                              title="Publicar no catálogo"
                            >
                              Publicar
                            </button>
                          )}

                          {canWrite && p.status === "published" && (
                            <button
                              onClick={() => handleArchive(p.id)}
                              disabled={loadingAction === p.id}
                              className="px-2 py-1 text-xs rounded-[6px] text-zinc-500 hover:bg-surface-muted transition-colors"
                              title="Arquivar produto"
                            >
                              Arquivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-foreground-muted">
            <span>
              Mostrando {products.length} de {totalCount} produtos
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateFilters({ page: String(page - 1) })}
                disabled={page <= 1}
                className="px-3 py-1 rounded-[8px] bg-surface-muted border border-border disabled:opacity-40 hover:bg-surface"
              >
                Anterior
              </button>
              <span className="font-mono">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => updateFilters({ page: String(page + 1) })}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded-[8px] bg-surface-muted border border-border disabled:opacity-40 hover:bg-surface"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

