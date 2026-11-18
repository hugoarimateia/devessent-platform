import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicStorefront } from "../../../types/retail.types";

interface EditorialFeatureSectionProps {
  store: PublicStorefront;
  previewTemplate?: string;
}

export function EditorialFeatureSection({
  store,
  previewTemplate,
}: EditorialFeatureSectionProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const catalogHref = `/loja/${store.slug}/produtos${queryParam}`;

  return (
    <section className="bg-[#f5f4ef] py-16 lg:py-24 px-4 sm:px-6 border-b border-stone-200">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Text Side */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-stone-500">
              EDIÇÃO LIMITADA 2026
            </span>

            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-stone-950 font-display leading-[1.05]">
              A NOVA <br /> TEMPORADA.
            </h2>

            <p className="text-sm sm:text-base text-stone-600 font-light leading-relaxed">
              Uma curadoria criteriosa de peças essenciais contemporâneas — versáteis,
              atemporais e desenvolvidas com linho puro, algodão de toque macio e técnicas
              nobres de corte e costura.
            </p>

            <div className="pt-2">
              <Link
                href={catalogHref}
                className="inline-flex items-center gap-2.5 bg-stone-950 text-white px-6 py-3.5 text-xs font-semibold uppercase tracking-wider rounded-[2px] hover:bg-stone-800 transition-colors shadow-sm"
              >
                <span>Descobrir a Coleção</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Visual Showcase Side */}
          <div className="lg:col-span-7 relative">
            <div className="aspect-[16/10] bg-stone-900 rounded-[2px] overflow-hidden relative shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-stone-950/40 z-10" />
              {/* Silhouette / Editorial Visual */}
              <div className="w-full h-full flex flex-col justify-end p-8 text-white relative z-20">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300">
                  Caderno de Ateliê
                </span>
                <p className="text-xl sm:text-2xl font-serif italic text-stone-100 mt-2 max-w-md">
                  &ldquo;A elegância reside na precisão daquilo que não precisa de excessos.&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-stone-400 font-light">
                  <span>Modelagem Exclusiva</span>
                  <span>•</span>
                  <span>Produção Limitada</span>
                  <span>•</span>
                  <span>Costuras Reforçadas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

