"use client";

import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import type { StorefrontCatalogProps } from "../../types/storefront.types";
import { EditorialProductCard } from "./editorial-product-card";

export function EditorialCatalog({
  store,
  categories,
  products,
  totalCount,
  page,
  totalPages,
  activeCategorySlug,
  search,
  sort,
  previewTemplate,
}: StorefrontCatalogProps) {
  const queryParam = previewTemplate ? `&preview_template=${previewTemplate}` : "";
  const previewOnlyParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";

  const activeCategory = categories.find((c) => c.slug === activeCategorySlug);

  return (
    <div className="bg-[#faf9f6] min-h-screen py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header / Breadcrumb */}
        <div className="mb-8 pb-6 border-b border-stone-200">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-stone-500 mb-2">
            <Link href={`/loja/${store.slug}${previewOnlyParam}`} className="hover:text-stone-900">
              Início
            </Link>
            <span>/</span>
            <span className="text-stone-900 font-bold">
              {activeCategory ? activeCategory.name : "Catálogo Geral"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight font-display text-stone-950">
                {activeCategory ? activeCategory.name : "Catálogo Comercial"}
              </h1>
              <p className="mt-1 text-xs text-stone-500 font-light">
                {activeCategory
                  ? activeCategory.description || "Linha de produtos autorais desta categoria."
                  : "Coleção autoral completa desenvolvida para a DevEssent Retail."}
              </p>
            </div>
            <span className="text-xs font-mono text-stone-500">
              {totalCount} {totalCount === 1 ? "peça encontrada" : "peças encontradas"}
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#f4f2ec] p-4 rounded-[2px] border border-stone-200">
          {/* Categories Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none text-xs">
            <Link
              href={`/loja/${store.slug}/produtos${previewOnlyParam}`}
              className={`px-3 py-1.5 rounded-[2px] uppercase tracking-wider font-medium whitespace-nowrap transition-colors ${
                !activeCategorySlug
                  ? "bg-stone-950 text-white font-semibold"
                  : "bg-white/80 text-stone-700 hover:bg-white"
              }`}
            >
              Todos
            </Link>
            {categories.map((cat) => {
              const isSelected = activeCategorySlug === cat.slug;
              return (
                <Link
                  key={cat.id}
                  href={`/loja/${store.slug}/categoria/${cat.slug}${previewOnlyParam}`}
                  className={`px-3 py-1.5 rounded-[2px] uppercase tracking-wider font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? "bg-stone-950 text-white font-semibold"
                      : "bg-white/80 text-stone-700 hover:bg-white"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>

          {/* Search Input & Sort Form */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <form method="GET" className="relative flex-1 sm:w-64">
              {previewTemplate && (
                <input type="hidden" name="preview_template" value={previewTemplate} />
              )}
              {sort && <input type="hidden" name="sort" value={sort} />}
              <input
                type="text"
                name="search"
                defaultValue={search || ""}
                placeholder="Buscar por nome..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-[2px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </form>

            <form method="GET" className="flex items-center gap-1.5">
              {previewTemplate && (
                <input type="hidden" name="preview_template" value={previewTemplate} />
              )}
              {search && <input type="hidden" name="search" value={search} />}
              <div className="flex items-center gap-1 bg-white border border-stone-300 rounded-[2px] px-2 py-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500" />
                <select
                  name="sort"
                  defaultValue={sort || "featured"}
                  aria-label="Ordenar produtos"
                  onChange={(e) => e.target.form?.submit()}
                  className="bg-transparent text-xs text-stone-800 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="featured">Destaques</option>
                  <option value="newest">Lançamentos</option>
                  <option value="price_asc">Menor Preço</option>
                  <option value="price_desc">Maior Preço</option>
                  <option value="name_asc">Nome (A-Z)</option>
                </select>
              </div>
            </form>
          </div>
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center py-24 bg-white/60 rounded-[2px] border border-stone-200">
            <p className="text-base font-semibold text-stone-900">
              Nenhuma peça encontrada para os critérios selecionados.
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Tente redefinir a busca ou selecione outra categoria autoral.
            </p>
            <div className="mt-4">
              <Link
                href={`/loja/${store.slug}/produtos${previewOnlyParam}`}
                className="inline-flex items-center text-xs uppercase tracking-wider font-semibold text-stone-900 underline hover:opacity-80"
              >
                Limpar filtros de busca
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {products.map((product) => (
              <EditorialProductCard
                key={product.id}
                product={product}
                store={store}
                previewTemplate={previewTemplate}
              />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-16 pt-8 border-t border-stone-200 flex items-center justify-between">
            <span className="text-xs font-mono text-stone-500">
              Página {page} de {totalPages}
            </span>

            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={`?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}${sort ? `&sort=${sort}` : ""}${queryParam}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium uppercase tracking-wider bg-white border border-stone-300 rounded-[2px] text-stone-800 hover:bg-stone-100 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium uppercase tracking-wider bg-stone-100 border border-stone-200 rounded-[2px] text-stone-400 cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </span>
              )}

              {page < totalPages ? (
                <Link
                  href={`?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}${sort ? `&sort=${sort}` : ""}${queryParam}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium uppercase tracking-wider bg-white border border-stone-300 rounded-[2px] text-stone-800 hover:bg-stone-100 transition-colors"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium uppercase tracking-wider bg-stone-100 border border-stone-200 rounded-[2px] text-stone-400 cursor-not-allowed">
                  <span>Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
