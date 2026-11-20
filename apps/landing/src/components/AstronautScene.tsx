import React from "react";
import Image from "next/image";
import { SITE_CONFIG } from "@/config/site";
import { EssentOctagonBadge, TechSlantedBars } from "./TechDecor";

/**
 * Composição espacial do Astronauta + HUD Técnico Vetorial/DOM
 * Reproduz fielmente o lado direito de `01_landing_page_referencia.png`
 * utilizando o asset tratado (sem insígnia NASA e sem textos rasterizados à direita)
 * combinando elementos reais de DOM e SVG.
 */
export function AstronautScene() {
  return (
    <div className="relative w-full max-w-[740px] mx-auto lg:mx-0 select-none">
      {/* Brilho atmosférico radial atrás do capacete */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[78%] h-[78%] rounded-full bg-[#A782FF]/14 blur-[72px]"
      />

      {/* Container proporcional à cena de referência (770x504) */}
      <div className="relative aspect-[770/504] w-full overflow-visible">
        {/* Imagem principal do astronauta (tratada sem logo de terceiros e sem textos direitos) */}
        <Image
          src="/images/astronaut-hero.webp"
          alt="Astronauta em traje escuro com visor digital composto por feixes luminosos em tons de lilás e branco, simbolizando exploração tecnológica e visão de futuro da DevEssent."
          width={770}
          height={504}
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 55vw, 740px"
          className="w-full h-full object-contain drop-shadow-[0_14px_40px_rgba(0,0,0,0.75)]"
        />

        {/* Reflexo sutil animado no visor digital (respeita prefers-reduced-motion) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[34.5%] top-[18.5%] w-[27.5%] h-[29.5%] rounded-full bg-gradient-to-tr from-[#A782FF]/20 via-transparent to-[#E9E7DF]/25 mix-blend-screen blur-md animate-visor-shimmer"
        />

        {/* Índice técnico [782] reconstruído em DOM nítido */}
        <div
          aria-hidden="true"
          className="absolute left-[13.6%] top-[4.8%] flex items-center justify-center rounded-[4px] border border-[#E9E7DF]/70 bg-[#0E0C16]/90 px-1.5 py-2 shadow-[0_0_12px_rgba(167,130,255,0.2)]"
        >
          <span className="font-tech text-[0.6rem] sm:text-[0.66rem] font-semibold tracking-[0.18em] text-[#E9E7DF] [writing-mode:vertical-rl] rotate-180 leading-none">
            782
          </span>
        </div>

        {/* Coluna HUD Direita em DOM/SVG Real: Selo 本質 / ESSENT + Barras ////// + Lista // SISTEMAS */}
        <div className="absolute right-[1%] sm:right-[2.2%] top-[8%] sm:top-[9.5%] z-20 flex flex-col items-start origin-top-right scale-[0.72] xs:scale-[0.82] sm:scale-100">
          <EssentOctagonBadge
            subtitle="ESSENT"
            className="w-[116px] h-[126px] sm:w-[126px] sm:h-[136px] lg:w-[138px] lg:h-[148px]"
          />

          <div className="mt-3 sm:mt-4 pl-1">
            <TechSlantedBars
              variant="all-filled"
              className="h-2 sm:h-2.5 w-auto opacity-90"
            />
          </div>

          <ul
            aria-label="Áreas de atuação técnica"
            className="mt-3 sm:mt-4 pl-1 space-y-1 sm:space-y-1.5"
          >
            {SITE_CONFIG.heroTechList.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 font-sans text-[0.68rem] sm:text-[0.72rem] lg:text-[0.76rem] font-medium tracking-[0.18em] sm:tracking-[0.2em] text-[#E9E7DF]/90 uppercase"
              >
                <span aria-hidden="true" className="text-[#B695FF] font-semibold">
                  {"//"}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
