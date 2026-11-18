import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StorefrontHomeProps } from "../../types/storefront.types";
import { EditorialHero } from "./editorial-hero";
import { EditorialCategoryStrip } from "./editorial-category-strip";
import { EditorialFeatureSection } from "./editorial-feature-section";
import { EditorialProductCard } from "./editorial-product-card";
import { EditorialValueBadges } from "./editorial-value-badges";

export function EditorialHome({
  store,
  categories,
  featuredProducts,
  previewTemplate,
}: StorefrontHomeProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const catalogHref = `/loja/${store.slug}/produtos${queryParam}`;

  return (
    <div className="space-y-0">
      {/* 1. Hero Editorial */}
      <EditorialHero store={store} previewTemplate={previewTemplate} />

      {/* 2. Faixa de Categorias em Destaque */}
      <EditorialCategoryStrip
        categories={categories}
        store={store}
        previewTemplate={previewTemplate}
      />

      {/* 3. Destaque Editorial "A Nova Temporada" */}
      <EditorialFeatureSection store={store} previewTemplate={previewTemplate} />

      {/* 4. Vitrine de Peças em Destaque (Featured Pieces) */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[#faf9f6]">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="flex items-end justify-between mb-10 pb-4 border-b border-stone-200">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-stone-500 block mb-1">
                SELEÇÃO EXCLUSIVA
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider font-display text-stone-950">
                Peças em Destaque
              </h2>
            </div>
            <Link
              href={catalogHref}
              className="text-xs uppercase font-semibold tracking-wider text-stone-900 hover:text-stone-600 inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Ver Catálogo Completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Product Grid */}
          {featuredProducts.length === 0 ? (
            <div className="text-center py-16 bg-stone-100/60 rounded-[2px] border border-stone-200/80">
              <p className="text-sm text-stone-600 font-light">
                Nenhum produto publicado no momento nesta vitrine.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
              {featuredProducts.map((product) => (
                <EditorialProductCard
                  key={product.id}
                  product={product}
                  store={store}
                  previewTemplate={previewTemplate}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. Pilares e Selos de Valor */}
      <EditorialValueBadges />
    </div>
  );
}

