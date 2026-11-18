import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicStorefront } from "../../../types/retail.types";

interface EditorialHeroProps {
  store: PublicStorefront;
  previewTemplate?: string;
}

export function EditorialHero({ store, previewTemplate }: EditorialHeroProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const catalogHref = `/loja/${store.slug}/produtos${queryParam}`;

  const brandWords = (store.storeName || "ATELIÊ").toUpperCase().split(" ");
  const mainWord = brandWords[0] || "GAZU";
  const secondWord = brandWords.slice(1).join(" ") || "STUDIO®";

  return (
    <section className="relative overflow-hidden bg-[#faf9f6] text-stone-900 pt-12 pb-16 lg:pt-16 lg:pb-24 border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Tagline */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-4 mb-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-stone-500">
            {store.brandHeadline || "CONTEMPORARY APPAREL FOR A MODERN LIFE"}
          </p>
          <span className="text-[11px] font-mono uppercase tracking-widest text-stone-600 bg-stone-200/60 px-3 py-1 rounded-full self-start sm:self-auto">
            {store.heroBadge || "NEW SEASON — SPRING 2026"}
          </span>
        </div>

        {/* Massive Typographic Hero with Model Composition */}
        <div className="relative my-6 lg:my-10 flex flex-col items-center justify-center">
          {/* Big Typography Layer */}
          <div className="w-full text-center select-none pointer-events-none">
            <h1 className="text-[16vw] lg:text-[180px] font-black tracking-tighter leading-[0.85] text-stone-950 font-display">
              {mainWord}
            </h1>
            {secondWord && (
              <span className="block text-2xl lg:text-4xl font-light tracking-[0.35em] text-stone-800 mt-2 uppercase">
                {secondWord}
              </span>
            )}
          </div>

          {/* Model / Garment Composition Overlap */}
          <div className="relative mt-8 lg:-mt-12 w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center z-10">
            {/* Visual Block */}
            <div className="md:col-span-7 relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden rounded-[2px] bg-stone-200/60 shadow-lg">
              {/* Artistic Fashion Composition SVG / Image */}
              <div className="w-full h-full bg-gradient-to-tr from-stone-900 via-stone-800 to-stone-700 flex items-center justify-center p-8 text-stone-100">
                <div className="text-center space-y-3">
                  <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-amber-300">
                    Editorial Lookbook
                  </span>
                  <p className="text-2xl sm:text-3xl font-serif italic max-w-md mx-auto text-stone-100">
                    &ldquo;{store.brandSubheadline || "Alfaiataria contemporânea, silhuetas descontraídas e corte impecável."}&rdquo;
                  </p>
                  <p className="text-xs text-stone-400 font-light max-w-xs mx-auto">
                    Desenvolvido exclusivamente na DevEssent Retail para marcas autorais.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions & Editorial Manifesto */}
            <div className="md:col-span-5 flex flex-col justify-center space-y-6">
              <p className="text-sm text-stone-600 font-light leading-relaxed">
                {store.aboutText ||
                  "Peças autorais construídas para durar, combinando técnicas manuais tradicionais com estética contemporânea e tecidos de procedência certificada."}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href={catalogHref}
                  className="inline-flex items-center justify-center gap-2 bg-stone-950 text-white px-6 py-3.5 text-xs font-semibold uppercase tracking-wider rounded-[2px] hover:bg-stone-800 transition-colors shadow-sm"
                >
                  <span>Explorar Coleção</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href={`${catalogHref}?sort=newest`}
                  className="inline-flex items-center justify-center gap-2 bg-transparent text-stone-900 border border-stone-300 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider rounded-[2px] hover:bg-stone-100 transition-colors"
                >
                  <span>Lançamentos</span>
                </Link>
              </div>

              <div className="pt-4 border-t border-stone-200/80 flex items-center gap-6 text-[11px] font-mono text-stone-500">
                <div>
                  <span className="block font-bold text-stone-900">EDIÇÃO LIMITADA</span>
                  <span>Tiragens exclusivas</span>
                </div>
                <div className="h-6 w-px bg-stone-300" />
                <div>
                  <span className="block font-bold text-stone-900">ORIGEM 100% NACIONAL</span>
                  <span>Produção responsável</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

