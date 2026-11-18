"use client";

import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import type { StorefrontCatalogProps } from "../../types/storefront.types";
import { ExperimentalProductCard } from "./experimental-product-card";

export function ExperimentalCatalog({
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
    <div className="bg-[#0a0a0c] min-h-screen py-10 px-4 sm:px-6 text-neutral-100">
      <div className="max-w-7xl mx-auto">
        {/* Header / Breadcrumb */}
        <div className="mb-8 pb-6 border-b border-neutral-800">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-neutral-500 mb-2">
            <Link href={`/loja/${store.slug}${previewOnlyParam}`} className="hover:text-[#d4ff00]">
              Home
            </Link>
            <span>/</span>
            <span className="text-[#d4ff00] font-bold">
              {activeCategory ? activeCategory.name : "Catálogo Geral"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight font-display text-white">
                {activeCategory ? activeCategory.name : "Catálogo de Peças"}
              </h1>
              <p className="mt-1 text-xs text-neutral-400 font-mono">
                {activeCategory
                  ? activeCategory.description || "Modelos pertencentes a esta linha autoral."
                  : "Todos os modelos ativos desenvolvidos sob demanda na DevEssent Retail."}
              </p>
            </div>
            <span className="text-xs font-mono text-[#d4ff00]">
              [{totalCount} {totalCount === 1 ? "peça ativa" : "peças ativas"}]
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121215] p-4 rounded-[2px] border border-neutral-800">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none text-xs font-mono">
            <Link
              href={`/loja/${store.slug}/produtos${previewOnlyParam}`}
              className={`px-3 py-1.5 rounded-[2px] uppercase tracking-wider font-bold whitespace-nowrap transition-colors ${
                !activeCategorySlug
                  ? "bg-[#d4ff00] text-black"
                  : "bg-[#18181d] text-neutral-300 hover:text-white"
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
                  className={`px-3 py-1.5 rounded-[2px] uppercase tracking-wider font-bold whitespace-nowrap transition-colors ${
                    isSelected
                      ? "bg-[#d4ff00] text-black"
                      : "bg-[#18181d] text-neutral-300 hover:text-white"
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
                placeholder="Buscar modelo..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#18181d] border border-neutral-700 rounded-[2px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#d4ff00]"
              />
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </form>

            <form method="GET" className="flex items-center gap-1.5">
              {previewTemplate && (
                <input type="hidden" name="preview_template" value={previewTemplate} />
              )}
              {search && <input type="hidden" name="search" value={search} />}
              <div className="flex items-center gap-1 bg-[#18181d] border border-neutral-700 rounded-[2px] px-2 py-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
                <select
                  name="sort"
                  defaultValue={sort || "featured"}
                  aria-label="Ordenar produtos"
                  onChange={(e) => e.target.form?.submit()}
                  className="bg-transparent text-xs text-neutral-200 font-mono font-medium focus:outline-none cursor-pointer"
                >
                  <option value="featured" className="bg-[#18181d] text-white">Destaques</option>
                  <option value="newest" className="bg-[#18181d] text-white">Lançamentos</option>
                  <option value="price_asc" className="bg-[#18181d] text-white">Menor Preço</option>
                  <option value="price_desc" className="bg-[#18181d] text-white">Maior Preço</option>
                  <option value="name_asc" className="bg-[#18181d] text-white">Nome (A-Z)</option>
                </select>
              </div>
            </form>
          </div>
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center py-24 bg-[#121215] rounded-[2px] border border-neutral-800">
            <p className="text-base font-mono font-bold text-white">
              Nenhuma peça encontrada no filtro atual.
            </p>
            <p className="mt-1 text-xs text-neutral-400 font-mono">
              Tente redefinir o termo de busca ou altere a categoria selecionada.
            </p>
            <div className="mt-4">
              <Link
                href={`/loja/${store.slug}/produtos${previewOnlyParam}`}
                className="inline-flex items-center text-xs font-mono uppercase font-bold text-[#d4ff00] hover:underline"
              >
                Limpar filtros de busca
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product, index) => (
              <ExperimentalProductCard
                key={product.id}
                product={product}
                store={store}
                index={index}
                previewTemplate={previewTemplate}
              />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-16 pt-8 border-t border-neutral-800 flex items-center justify-between font-mono">
            <span className="text-xs text-neutral-500">
              Página {page} de {totalPages}
            </span>

            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={`?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}${sort ? `&sort=${sort}` : ""}${queryParam}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase bg-[#141418] border border-neutral-700 rounded-[2px] text-white hover:border-[#d4ff00] transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase bg-[#101014] border border-neutral-800 rounded-[2px] text-neutral-600 cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </span>
              )}

              {page < totalPages ? (
                <Link
                  href={`?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}${sort ? `&sort=${sort}` : ""}${queryParam}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase bg-[#141418] border border-neutral-700 rounded-[2px] text-white hover:border-[#d4ff00] transition-colors"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase bg-[#101014] border border-neutral-800 rounded-[2px] text-neutral-600 cursor-not-allowed">
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
