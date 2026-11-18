import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RetailCategory, PublicStorefront } from "../../../types/retail.types";

interface EditorialCategoryStripProps {
  categories: RetailCategory[];
  store: PublicStorefront;
  previewTemplate?: string;
}

export function EditorialCategoryStrip({
  categories,
  store,
  previewTemplate,
}: EditorialCategoryStripProps) {
  if (!categories || categories.length === 0) return null;

  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";

  // Descrições de apoio para cada categoria
  const defaultDescriptions: Record<string, string> = {
    "moda-masculina": "Cortes essenciais, alfaiataria desestruturada e versatilidade diária.",
    "moda-feminina": "Silhuetas fluidas, drapeados precisos e caimento arquitetônico.",
    "alfaiataria-sob-medida": "Construção sob medida com acabamento manual de alto padrão.",
    "acessorios": "Itens utilitários em couro legítimo e metais nobres.",
    "vasos-ceramicas": "Cerâmica vitrificada moldada artesanalmente em torno.",
    "plantas-raras": "Espécies botânicas selecionadas para ambientes autorais.",
  };

  return (
    <section className="bg-stone-900 text-stone-100 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-stone-800">
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-stone-400">
            Categorias & Linhas Autorais
          </span>
          <Link
            href={`/loja/${store.slug}/produtos${queryParam}`}
            className="text-xs uppercase font-semibold tracking-wider text-amber-300 hover:text-amber-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Ver Todas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.slice(0, 4).map((category, index) => {
            const desc =
              category.description ||
              defaultDescriptions[category.slug] ||
              "Peças desenvolvidas com atenção rigorosa a cada detalhe construtivo.";

            return (
              <div
                key={category.id}
                className="group flex flex-col justify-between p-5 bg-stone-950/70 border border-stone-800 rounded-[2px] hover:border-stone-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-stone-500 mb-3">
                    <span>LINHA 0{index + 1}</span>
                    <span className="text-amber-400">●</span>
                  </div>

                  <h3 className="text-sm uppercase tracking-widest font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                    {category.name}
                  </h3>

                  <p className="mt-2 text-xs text-stone-400 font-light leading-relaxed line-clamp-2">
                    {desc}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-stone-850">
                  <Link
                    href={`/loja/${store.slug}/categoria/${category.slug}${queryParam}`}
                    className="inline-flex items-center gap-2 text-xs uppercase font-medium tracking-wider text-stone-300 hover:text-white group-hover:translate-x-1 transition-all"
                  >
                    <span>Explorar {category.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

