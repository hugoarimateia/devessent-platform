import React from "react";
import { DevEssentLogo } from "./DevEssentLogo";
import { FloatingAstronaut } from "./FloatingAstronaut";
import { VerticalTicker } from "./VerticalTicker";
import { ExploreArrow } from "./ExploreArrow";
import { TechSlantedBars } from "./TechDecor";

/**
 * Primeira Dobra Cinematográfica (100svh) dedicada exclusivamente à identidade DevEssent.
 * Elementos presentes:
 * - Logotipo DevEssent (fiel à referência 03_logo_wordmark.png)
 * - Assinatura SOFTWARE HOUSE
 * - Headline institucional
 * - Texto conceitual curto
 * - Astronauta com flutuação e hover
 * - Elementos HUD
 * - Letreiro lateral animado (vertical no desktop / faixa compacta no mobile)
 * - Botão Fale Conosco (/contato em nova guia)
 * - Seta animada de exploração (ExploreArrow)
 */
export function ImmersiveHero() {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-heading"
      className="relative flex min-h-[100svh] w-full flex-col justify-between overflow-hidden pt-16 pb-3 sm:pt-20 sm:pb-5 lg:h-[100svh]"
    >
      {/* Pontos estelares sutis e atmosfera espacial */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "radial-gradient(1.5px 1.5px at 14% 22%, rgba(233,231,223,0.7), transparent), radial-gradient(1px 1px at 36% 14%, rgba(167,130,255,0.8), transparent), radial-gradient(1.5px 1.5px at 62% 8%, rgba(233,231,223,0.5), transparent), radial-gradient(1px 1px at 84% 28%, rgba(182,149,255,0.6), transparent), radial-gradient(1.5px 1.5px at 22% 76%, rgba(167,130,255,0.5), transparent)",
        }}
      />

      {/* Área Central da Primeira Dobra */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 items-center px-4 sm:px-8 lg:px-10">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
          {/* Letreiro Lateral Animado (Desktop à esquerda / Mobile no topo compacto) */}
          <VerticalTicker />

          {/* Grid Editorial Principal: Identidade + Astronauta */}
          <div className="grid flex-1 grid-cols-1 items-center gap-4 sm:gap-6 lg:grid-cols-12 lg:gap-6">
            {/* Coluna Esquerda: Assinatura, Logotipo Principal, Headline, Texto Curto e CTA */}
            <div className="z-10 flex min-w-0 flex-col items-start text-left lg:col-span-6">
              {/* Assinatura SOFTWARE HOUSE ────── ////// */}
              <div className="mb-3 inline-flex max-w-full flex-wrap items-center gap-2.5 sm:mb-4 sm:gap-3.5">
                <span className="font-tech text-[0.64rem] font-medium tracking-[0.28em] text-[#E9E7DF]/90 uppercase sm:text-xs sm:tracking-[0.34em]">
                  SOFTWARE HOUSE
                </span>
                <span
                  aria-hidden="true"
                  className="h-[1px] w-8 bg-gradient-to-r from-[#A782FF]/85 to-[#A782FF]/25 sm:w-16"
                />
                <TechSlantedBars variant="filled-first" />
              </div>

              {/* Logotipo Principal do Hero — Vetor 1:1 fiel a 03_logo_wordmark.png */}
              <div className="mb-3.5 max-w-full sm:mb-5">
                <DevEssentLogo variant="hero" />
              </div>

              {/* Headline Institucional */}
              <h1
                id="hero-heading"
                tabIndex={-1}
                className="max-w-full font-display text-[clamp(1.12rem,3.4vw,1.95rem)] leading-[1.32] font-light tracking-[0.07em] break-words text-[#E9E7DF] uppercase sm:max-w-xl sm:tracking-[0.12em]"
              >
                TECNOLOGIA ESSENCIAL{" "}
                <span className="mt-0.5 block">
                  PARA NEGÓCIOS QUE{" "}
                  <strong className="font-extrabold tracking-[0.08em] text-[#A782FF] drop-shadow-[0_0_18px_rgba(167,130,255,0.35)] sm:tracking-[0.14em]">
                    EVOLUEM.
                  </strong>
                </span>
              </h1>

              {/* Texto Conceitual Curto */}
              <p className="mt-3 max-w-[33rem] text-sm leading-[1.62] font-normal text-[#BAB5C5] sm:mt-4 sm:text-[1.02rem]">
                Desenvolvemos sites, sistemas e soluções digitais sob medida,
                com foco em performance, segurança e resultado.
              </p>

              {/* Botão Fale Conosco + Atalho discreto de exploração */}
              <div className="mt-5 flex w-full flex-wrap items-center gap-3.5 sm:mt-7 sm:w-auto">
                <a
                  href="/contato"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-[46px] w-full items-center justify-center gap-3 rounded-[10px] bg-gradient-to-r from-[#B695FF] to-[#A782FF] px-6 py-3 text-sm font-semibold text-[#0B0B0B] shadow-[0_0_28px_rgba(167,130,255,0.36)] transition-all duration-200 hover:brightness-105 hover:shadow-[0_0_36px_rgba(167,130,255,0.58)] sm:min-h-[48px] sm:w-auto sm:text-[0.94rem]"
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
              </div>
            </div>

            {/* Coluna Direita: Astronauta Protagonista + HUD */}
            <div className="relative z-10 min-w-0 lg:col-span-6">
              <FloatingAstronaut />
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé da Primeira Dobra: Horizonte Wireframe sutil + Seta Animada de Exploração */}
      <div className="relative z-20 mx-auto flex w-full max-w-[1440px] flex-col items-center justify-center px-4 pt-1">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-2 left-0 -z-10 mx-auto h-14 max-w-[1440px] overflow-hidden opacity-45 sm:h-20"
        >
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <defs>
              <linearGradient
                id="hero-wireframe-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#A782FF" stopOpacity="0" />
                <stop offset="28%" stopColor="#A782FF" stopOpacity="0.4" />
                <stop offset="55%" stopColor="#B695FF" stopOpacity="0.65" />
                <stop offset="85%" stopColor="#A782FF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#A782FF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M180 118 L320 68 L410 98 L510 42 L620 88 L730 34 L850 92 L960 58 L1120 118"
              stroke="url(#hero-wireframe-grad)"
              strokeWidth="1.1"
            />
            <path
              d="M1060 120 Q1260 45 1440 25"
              stroke="#B695FF"
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        <ExploreArrow targetId="nossa-essencia" label="EXPLORAR" />
      </div>
    </section>
  );
}

