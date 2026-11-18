import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StorefrontHomeProps } from "../../types/storefront.types";
import { ExperimentalHero } from "./experimental-hero";
import { ExperimentalStatement } from "./experimental-statement";
import { ExperimentalProcess } from "./experimental-process";
import { ExperimentalProductCard } from "./experimental-product-card";
import { ExperimentalLookbook } from "./experimental-lookbook";
import { ExperimentalManifesto } from "./experimental-manifesto";

export function ExperimentalHome({
  store,
  categories: _categories,
  featuredProducts,
  previewTemplate,
}: StorefrontHomeProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const catalogHref = `/loja/${store.slug}/produtos${queryParam}`;

  return (
    <div className="space-y-0">
      {/* 1. Hero Experimental */}
      <ExperimentalHero store={store} previewTemplate={previewTemplate} />

      {/* 2. Manifesto & Estatísticas */}
      <ExperimentalStatement store={store} previewTemplate={previewTemplate} />

      {/* 3. Como Funciona (Processo) */}
      <ExperimentalProcess />

      {/* 4. Vitrine de Peças Customizáveis (Customizable Essentials) */}
      <section className="bg-[#0b0b0e] py-16 sm:py-20 px-4 sm:px-6 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="flex items-end justify-between mb-10 pb-4 border-b border-neutral-800">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#d4ff00] block mb-1">
                COLEÇÃO EM DESTAQUE
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase font-display tracking-tight text-white">
                ESSENCIAIS CUSTOMIZÁVEIS
              </h2>
            </div>
            <Link
              href={catalogHref}
              className="text-xs font-mono font-bold uppercase tracking-wider text-[#d4ff00] hover:text-white inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Ver Todos os Modelos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Product Grid */}
          {featuredProducts.length === 0 ? (
            <div className="text-center py-16 bg-[#121215] rounded-[2px] border border-neutral-800">
              <p className="text-sm text-neutral-400 font-mono">
                Nenhum produto publicado no catálogo desta vitrine no momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product, index) => (
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
        </div>
      </section>

      {/* 5. Lookbook Archive */}
      <ExperimentalLookbook store={store} previewTemplate={previewTemplate} />

      {/* 6. Manifesto & Selos de Qualidade */}
      <ExperimentalManifesto />
    </div>
  );
}
