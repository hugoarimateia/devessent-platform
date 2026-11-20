import React from "react";
import { DevEssentLogo } from "./DevEssentLogo";
import { AstronautScene } from "./AstronautScene";
import { TechSlantedBars } from "./TechDecor";

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden pt-6 pb-8 sm:pt-10 lg:pt-12 lg:pb-10"
    >
      {/* Pontos estelares sutis de fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "radial-gradient(1.5px 1.5px at 14% 22%, rgba(233,231,223,0.7), transparent), radial-gradient(1px 1px at 36% 14%, rgba(167,130,255,0.8), transparent), radial-gradient(1.5px 1.5px at 62% 8%, rgba(233,231,223,0.5), transparent), radial-gradient(1px 1px at 84% 28%, rgba(182,149,255,0.6), transparent), radial-gradient(1.5px 1.5px at 22% 76%, rgba(167,130,255,0.5), transparent)",
        }}
      />

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-10 lg:gap-6">
          {/* Coluna Esquerda (48% / 6 cols): Proposta Comercial */}
          <div className="lg:col-span-6 min-w-0 z-10 flex flex-col items-start text-left">
            {/* Eyebrow: SOFTWARE HOUSE ────── ////// */}
            <div className="inline-flex flex-wrap items-center gap-2.5 sm:gap-4 mb-5 sm:mb-6 max-w-full">
              <span className="font-tech text-[0.65rem] sm:text-xs font-medium tracking-[0.26em] sm:tracking-[0.34em] text-[#E9E7DF]/90 uppercase">
                SOFTWARE HOUSE
              </span>
              <span
                aria-hidden="true"
                className="h-[1px] w-8 sm:w-20 bg-gradient-to-r from-[#A782FF]/80 to-[#A782FF]/30"
              />
              <TechSlantedBars variant="filled-first" />
            </div>

            {/* Assinatura visual da marca conforme 01_landing_page_referencia.png */}
            <div aria-hidden="true" className="mb-5 sm:mb-6 max-w-full">
              <DevEssentLogo variant="hero" />
            </div>

            {/* Headline Principal (H1 semântico com foco em "EVOLUEM.") */}
            <h1
              id="hero-heading"
              tabIndex={-1}
              className="font-display text-[clamp(1.15rem,4.2vw,2.1rem)] leading-[1.34] tracking-[0.07em] sm:tracking-[0.13em] text-[#E9E7DF] font-light uppercase max-w-full sm:max-w-2xl break-words"
            >
              TECNOLOGIA ESSENCIAL{" "}
              <span className="block mt-1">
                PARA NEGÓCIOS QUE{" "}
                <strong className="font-extrabold text-[#A782FF] tracking-[0.08em] sm:tracking-[0.14em] drop-shadow-[0_0_18px_rgba(167,130,255,0.35)]">
                  EVOLUEM.
                </strong>
              </span>
            </h1>

            {/* Linha de apoio comercial */}
            <p className="mt-5 sm:mt-6 text-base sm:text-[1.08rem] leading-[1.68] text-[#BAB5C5] max-w-[34rem] font-normal">
              Desenvolvemos sites, sistemas e soluções digitais sob medida, com
              foco em performance, segurança e resultado.
            </p>

            {/* CTAs Primário e Secundário — Fiel a 01_landing_page_referencia.png */}
            <div className="mt-8 sm:mt-9 flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <a
                href="#contato"
                className="group inline-flex items-center justify-center gap-3.5 rounded-[11px] bg-gradient-to-r from-[#B695FF] to-[#A782FF] px-6 py-3.5 text-[0.95rem] font-semibold text-[#0B0B0B] shadow-[0_0_28px_rgba(167,130,255,0.38)] transition-all duration-200 hover:brightness-105 hover:shadow-[0_0_36px_rgba(167,130,255,0.58)] min-h-[50px] w-full sm:w-auto"
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-base font-bold tracking-tighter text-[#0B0B0B]/85"
                >
                  &lt;/&gt;
                </span>
                <span>Solicitar Orçamento</span>
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                >
                  <path
                    d="M4 10H16M16 10L11 5M16 10L11 15"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>

              <a
                href="#solucoes"
                className="group inline-flex items-center justify-center gap-3 rounded-[11px] border border-[#E9E7DF]/32 bg-[#14111E]/75 px-6 py-3.5 text-[0.95rem] font-medium text-[#E9E7DF] backdrop-blur-md transition-all duration-200 hover:border-[#A782FF] hover:bg-[#A782FF]/12 min-h-[50px] w-full sm:w-auto"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  className="w-4 h-4 text-[#E9E7DF] transition-transform duration-200 group-hover:scale-110"
                >
                  <polygon
                    points="6,4 16,10 6,16"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                <span>Conhecer Soluções</span>
              </a>
            </div>
          </div>

          {/* Coluna Direita (52% / 6 cols): Astronauta + HUD */}
          <div className="lg:col-span-6 min-w-0 relative z-10">
            <AstronautScene />
          </div>
        </div>
      </div>

      {/* Transição inferior: Terreno Wireframe SVG e Horizonte Planetário sutil */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative mx-auto max-w-[1440px] -mt-6 sm:-mt-12 lg:-mt-16 h-16 sm:h-24 overflow-hidden"
      >
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full h-full opacity-55"
        >
          <defs>
            <linearGradient id="wireframe-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A782FF" stopOpacity="0" />
              <stop offset="28%" stopColor="#A782FF" stopOpacity="0.45" />
              <stop offset="55%" stopColor="#B695FF" stopOpacity="0.7" />
              <stop offset="85%" stopColor="#A782FF" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#A782FF" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Cordilheira wireframe poligonal */}
          <path
            d="M180 118 L320 68 L410 98 L510 42 L620 88 L730 34 L850 92 L960 58 L1120 118"
            stroke="url(#wireframe-grad)"
            strokeWidth="1.2"
          />
          <path
            d="M240 118 L320 68 L365 118 M410 98 L510 42 L555 118 M620 88 L730 34 L780 118 M850 92 L960 58 L1020 118"
            stroke="url(#wireframe-grad)"
            strokeWidth="0.8"
            strokeDasharray="3 3"
          />
          {/* Arco de horizonte planetário à direita */}
          <path
            d="M1060 120 Q1260 45 1440 25"
            stroke="#B695FF"
            strokeOpacity="0.55"
            strokeWidth="1.8"
          />
        </svg>
      </div>
    </section>
  );
}

