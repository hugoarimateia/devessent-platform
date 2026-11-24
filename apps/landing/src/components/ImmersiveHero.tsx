import React from "react";
import { DevEssentLogo } from "./DevEssentLogo";
import { FloatingAstronaut } from "./FloatingAstronaut";
import { VerticalTicker } from "./VerticalTicker";
import { ExploreArrow } from "./ExploreArrow";
import { TechSlantedBars } from "./TechDecor";

/**
 * Primeira Dobra Cinematográfica (min-h-[100svh] sem clipping vertical)
 * - Preserva 100% a identidade DevEssent e o astronauta protagonista
 * - Usa overflow-x-clip (nunca overflow-hidden vertical) para impedir cortes no indicador EXPLORAR
 * - Aplica parallax discreto nas camadas de fundo e astronauta via CSS Scroll-Driven Animations
 */
export function ImmersiveHero() {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-heading"
      className="relative flex min-h-[100svh] w-full flex-col justify-between overflow-x-clip pt-16 pb-3 sm:pt-[72px] sm:pb-4 lg:min-h-[100dvh] lg:pt-[74px] lg:pb-3"
    >
      {/* Pontos estelares sutis com parallax compositor-only */}
      <div
        aria-hidden="true"
        className="de-hero-parallax-stars pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "radial-gradient(1.5px 1.5px at 14% 22%, rgba(233,231,223,0.7), transparent), radial-gradient(1px 1px at 36% 14%, rgba(167,130,255,0.8), transparent), radial-gradient(1.5px 1.5px at 62% 8%, rgba(233,231,223,0.5), transparent), radial-gradient(1px 1px at 84% 28%, rgba(182,149,255,0.6), transparent), radial-gradient(1.5px 1.5px at 22% 76%, rgba(167,130,255,0.5), transparent)",
        }}
      />

      {/* Área Central da Primeira Dobra */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 items-center px-4 py-2 sm:px-8 sm:py-3 lg:px-10 lg:py-2">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:gap-7">
          {/* Letreiro Lateral Animado */}
          <VerticalTicker />

          {/* Grid Editorial Principal: Identidade + Astronauta */}
          <div className="grid flex-1 grid-cols-1 items-center gap-5 sm:gap-6 lg:grid-cols-12 lg:gap-6">
            {/* Coluna Esquerda: Assinatura, Logotipo Principal, Headline, Texto Curto e CTA */}
            <div className="z-10 flex min-w-0 flex-col items-start text-left lg:col-span-6">
              {/* Assinatura SOFTWARE HOUSE ────── ////// */}
              <div className="mb-2.5 inline-flex max-w-full flex-wrap items-center gap-2.5 sm:mb-3.5 sm:gap-3.5">
                <span className="font-tech text-[0.64rem] font-medium tracking-[0.28em] text-[#E9E7DF]/90 uppercase sm:text-xs sm:tracking-[0.34em]">
                  SOFTWARE HOUSE
                </span>
                <span
                  aria-hidden="true"
                  className="h-[1px] w-8 bg-gradient-to-r from-[#A782FF]/85 to-[#A782FF]/25 sm:w-16"
                />
                <TechSlantedBars variant="filled-first" />
              </div>

              {/* Logotipo Principal do Hero */}
              <div className="mb-3 max-w-full sm:mb-4">
                <DevEssentLogo variant="hero" />
              </div>

              {/* Headline Institucional */}
              <h1
                id="hero-heading"
                tabIndex={-1}
                className="max-w-full font-display text-[clamp(1.12rem,2.6vw,1.9rem)] leading-[1.3] font-light tracking-[0.07em] break-words text-[#E9E7DF] uppercase sm:max-w-xl sm:tracking-[0.11em]"
              >
                TECNOLOGIA ESSENCIAL{" "}
                <span className="mt-0.5 block">
                  PARA NEGÓCIOS QUE{" "}
                  <strong className="font-extrabold tracking-[0.08em] text-[#A782FF] drop-shadow-[0_0_16px_rgba(167,130,255,0.3)] sm:tracking-[0.13em]">
                    EVOLUEM.
                  </strong>
                </span>
              </h1>

              {/* Texto Conceitual Curto */}
              <p className="mt-2.5 max-w-[32rem] text-sm leading-[1.6] font-normal text-[#BAB5C5] sm:mt-3.5 sm:text-[1rem]">
                Sites, sistemas web, vitrines comerciais e automações sob
                medida — projetados para operar com velocidade, clareza e
                resultado.
              </p>

              {/* CTA Principal + Atalho para Demonstrações */}
              <div className="mt-5 flex w-full flex-wrap items-center gap-3 sm:mt-6 sm:w-auto">
                <a
                  href="/contato"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-[46px] w-full items-center justify-center gap-3 rounded-[10px] bg-gradient-to-r from-[#B695FF] to-[#A782FF] px-6 py-3 text-sm font-semibold text-[#0B0B0B] shadow-[0_0_24px_rgba(167,130,255,0.32)] transition-all duration-200 hover:brightness-105 hover:shadow-[0_0_32px_rgba(167,130,255,0.5)] sm:min-h-[48px] sm:w-auto sm:text-[0.94rem]"
                >
                  <span
                    aria-hidden="true"
                    className="font-mono text-sm font-bold tracking-tighter text-[#0B0B0B]/85"
                  >
                    &lt;/&gt;
                  </span>
                  <span>Fale Conosco</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  >
                    <path d="M7 17L17 7M7 7h10v10" />
                  </svg>
                </a>

                <a
                  href="#servicos"
                  className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#E9E7DF]/18 bg-[#161124]/60 px-5 py-3 text-xs font-medium tracking-[0.04em] text-[#E9E7DF] transition-colors duration-200 hover:border-[#A782FF]/65 hover:text-[#B695FF] sm:min-h-[48px] sm:w-auto sm:text-sm"
                >
                  <span>Ver demonstrações</span>
                  <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>

            {/* Coluna Direita: Astronauta Protagonista + HUD */}
            <div className="relative z-10 min-w-0 lg:col-span-6">
              <FloatingAstronaut />
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé da Primeira Dobra: Indicador EXPLORAR com folga total e sem linha poligonal cortada */}
      <div className="relative z-20 mx-auto flex w-full max-w-[1440px] flex-col items-center justify-center px-4 pt-1 pb-1">
        <ExploreArrow targetId="nossa-essencia" label="EXPLORAR" />
      </div>
    </section>
  );
}
