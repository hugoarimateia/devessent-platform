import Link from "next/link";
import { ArrowRight, Sliders, ShieldCheck, Globe, Leaf } from "lucide-react";
import type { PublicStorefront } from "../../../types/retail.types";

interface ExperimentalHeroProps {
  store: PublicStorefront;
  previewTemplate?: string;
}

export function ExperimentalHero({
  store,
  previewTemplate,
}: ExperimentalHeroProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const catalogHref = `/loja/${store.slug}/produtos${queryParam}`;

  return (
    <section className="relative bg-[#09090b] text-[#f2f2f4] pt-10 pb-16 lg:pt-14 lg:pb-24 border-b border-neutral-800 overflow-hidden">
      {/* Background Subtle Grid Texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Top Tagline */}
        <div className="flex items-center gap-2 text-[11px] font-mono tracking-[0.3em] uppercase text-neutral-400 mb-6">
          <span>DESIGN</span>
          <span className="text-[#d4ff00]">/</span>
          <span>CUSTOMIZE</span>
          <span className="text-[#d4ff00]">/</span>
          <span>WEAR</span>
        </div>

        {/* Hero Headline & Visual Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Bold Distressed Typography & CTAs */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9] font-display">
              VISTA SUA <br />
              <span className="text-[#d4ff00] underline decoration-neutral-800 decoration-wavy underline-offset-8">
                IDENTIDADE
              </span>
              .
            </h1>

            <p className="text-sm sm:text-base text-neutral-300 font-light max-w-xl leading-relaxed">
              {store.brandHeadline ||
                "Uma plataforma de moda streetwear autoral e customização avançada. Altere estampas, adicione sua essência e vista criações verdadeiramente suas."}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href={catalogHref}
                className="inline-flex items-center justify-center gap-2 bg-[#d4ff00] text-black px-7 py-4 text-xs font-mono font-bold uppercase tracking-wider rounded-[2px] hover:bg-white transition-all shadow-[0_0_20px_rgba(212,255,0,0.25)]"
              >
                <span>Explorar Coleção</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href={`${catalogHref}?sort=newest`}
                className="inline-flex items-center justify-center gap-2 bg-[#121215] text-neutral-200 border border-neutral-700 px-6 py-4 text-xs font-mono font-semibold uppercase tracking-wider rounded-[2px] hover:border-[#d4ff00] transition-colors"
              >
                <span>Ver Lançamentos</span>
              </Link>
            </div>

            {/* 4 Mini Guarantee Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-neutral-800 text-[11px] font-mono text-neutral-400">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#d4ff00] shrink-0" />
                <span>Customizável</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#d4ff00] shrink-0" />
                <span>Tecido Premium</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-[#d4ff00] shrink-0" />
                <span>Envio Rápido</span>
              </div>
              <div className="flex items-center gap-2">
                <Leaf className="w-3.5 h-3.5 text-[#d4ff00] shrink-0" />
                <span>Sob Demanda</span>
              </div>
            </div>
          </div>

          {/* Right Column: Streetwear Garment & Tech Device Preview Mockup */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/5] bg-gradient-to-b from-[#18181d] to-[#0f0f12] rounded-[4px] border border-neutral-800 p-6 flex flex-col justify-between overflow-hidden shadow-2xl">
              {/* Graphic Stamp */}
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-neutral-500">
                <span>LAB / DEVESSENT RETAIL</span>
                <span className="text-[#d4ff00] font-bold">ED. 2026</span>
              </div>

              {/* Central Mockup Visual */}
              <div className="my-auto text-center space-y-4">
                <div className="inline-block p-4 rounded-full bg-[#d4ff00]/10 border border-[#d4ff00]/30 text-[#d4ff00]">
                  <span className="font-mono text-4xl sm:text-5xl font-black">
                    {store.storeName.substring(0, 4).toUpperCase()}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black uppercase font-mono text-neutral-100">
                    STREETWEAR EXPERIMENTAL
                  </h3>
                  <p className="text-xs text-neutral-400 font-mono">
                    Gramatura 400g/m² · Caimento Boxy · Algodão Pesado
                  </p>
                </div>
              </div>

              {/* Bottom Interactive Mockup Bar */}
              <div className="bg-[#121215] border border-neutral-800 p-3 rounded-[2px] flex items-center justify-between text-[11px] font-mono">
                <span className="text-neutral-400">Modo de Exibição</span>
                <span className="text-[#d4ff00] uppercase font-bold">
                  ● {store.template} Engine
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

