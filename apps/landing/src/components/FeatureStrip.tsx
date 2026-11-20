import React from "react";
import { SITE_CONFIG } from "@/config/site";
import { SystemIcon, TechSlantedBars } from "./TechDecor";

/**
 * Faixa de 4 Diferenciais + Assinatura Técnica Inferior
 * Reproduz fielmente `08_ui_cards_da_landing.png` e a metade inferior de `01_landing_page_referencia.png`.
 */
export function FeatureStrip() {
  return (
    <section
      id="servicos"
      aria-label="Diferenciais da DevEssent"
      className="relative z-20 pb-14 sm:pb-20"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        {/* Grid de 4 Cards Fiel a 08_ui_cards_da_landing.png */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
          {SITE_CONFIG.featureStrip.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="group relative flex items-center justify-between gap-3.5 rounded-[16px] border border-[#E9E7DF]/20 bg-gradient-to-br from-[#211B30]/80 via-[#15121F]/90 to-[#0E0C15]/95 px-4 py-4 sm:px-5 sm:py-5 backdrop-blur-xl transition-all duration-250 hover:border-[#A782FF]/65 hover:-translate-y-0.5 hover:shadow-[0_12px_34px_-10px_rgba(167,130,255,0.28)] min-w-0"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Caixa de Ícone com cantoneira superior esquerda sutil como na referência 08 */}
                <div className="relative flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-[12px] border border-[#A782FF]/55 bg-[#161124]/90 shadow-[inset_0_0_14px_rgba(167,130,255,0.14)] transition-colors group-hover:border-[#B695FF] group-hover:bg-[#A782FF]/15">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-[2px] -left-[2px] h-3 w-3 rounded-tl-[12px] border-t-2 border-l-2 border-[#B695FF]"
                  />
                  <SystemIcon type={item.icon} className="w-6 h-6" />
                </div>

                {/* Título e descrição curta */}
                <div className="min-w-0">
                  <h2 className="font-display text-[0.95rem] 2xl:text-[1.02rem] font-bold text-[#E9E7DF] leading-snug group-hover:text-white transition-colors">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#BAB5C5]">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Seta lateral direita → */}
              <span
                aria-hidden="true"
                className="shrink-0 self-end sm:self-center text-[#E9E7DF]/70 transition-all duration-200 group-hover:translate-x-1 group-hover:text-[#A782FF]"
              >
                <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
                  <path
                    d="M4.5 10H15.5M15.5 10L11 5.5M15.5 10L11 14.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </a>
          ))}
        </div>

        {/* Assinatura Técnica Inferior: ────── ////// ─── TECNOLOGIA • INOVAÇÃO • RESULTADO ─── ////// ────── */}
        <div
          aria-hidden="true"
          className="mt-10 sm:mt-12 flex items-center justify-center gap-3 sm:gap-5 text-center select-none"
        >
          <span className="hidden md:block h-[1px] flex-1 max-w-[160px] bg-gradient-to-r from-transparent to-[#E9E7DF]/25" />
          <div className="hidden sm:block">
            <TechSlantedBars variant="outline-first" />
          </div>
          <span className="hidden sm:block h-[1px] w-10 lg:w-16 bg-[#E9E7DF]/25" />

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 px-2 font-tech text-[0.65rem] sm:text-xs tracking-[0.28em] text-[#E9E7DF]/85 uppercase">
            <span>TECNOLOGIA</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#A782FF] shadow-[0_0_8px_#A782FF]" />
            <span>INOVAÇÃO</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#A782FF] shadow-[0_0_8px_#A782FF]" />
            <span>RESULTADO</span>
          </div>

          <span className="hidden sm:block h-[1px] w-10 lg:w-16 bg-[#E9E7DF]/25" />
          <div className="hidden sm:block">
            <TechSlantedBars variant="filled-first" />
          </div>
          <span className="hidden md:block h-[1px] flex-1 max-w-[160px] bg-gradient-to-l from-transparent to-[#E9E7DF]/25" />
        </div>
      </div>
    </section>
  );
}

