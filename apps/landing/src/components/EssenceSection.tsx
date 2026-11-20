import React from "react";
import { EssentOctagonBadge, TechSlantedBars } from "./TechDecor";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

/**
 * SEÇÃO 01 — NOSSA ESSÊNCIA (#nossa-essencia)
 * Apresenta o significado de DevEssent:
 * - Dev: Desenvolvimento
 * - Essent: Essencial, essência, aquilo que faz sentido existir
 * Layout: Título grande editorial, texto curto, elemento geométrico discreto e numeração técnica 01.
 */
export function EssenceSection() {
  return (
    <section
      id="nossa-essencia"
      tabIndex={-1}
      aria-labelledby="essencia-heading"
      className="relative border-t border-[#E9E7DF]/10 bg-gradient-to-b from-[#0B0B0B] via-[#120E1D] to-[#0B0B0B] py-20 sm:py-28 focus:outline-none"
    >
      <SectionTransition
        number="01"
        code="SEC // NOSSA ESSÊNCIA"
        label="DEV + ESSENT"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Coluna Editorial Principal (7 colunas) */}
            <div className="lg:col-span-7">
              <div className="mb-5 inline-flex items-center gap-3">
                <span className="font-tech text-xs font-semibold tracking-[0.3em] text-[#A782FF] uppercase">
                  01 {"//"} NOSSA ESSÊNCIA
                </span>
                <span className="h-[1px] w-12 bg-[#A782FF]/45" />
                <TechSlantedBars />
              </div>

              <h2
                id="essencia-heading"
                className="font-display text-3xl leading-[1.15] font-bold tracking-tight text-[#E9E7DF] sm:text-5xl lg:text-[3.1rem]"
              >
                Quando o desenvolvimento encontra{" "}
                <span className="text-[#A782FF]">
                  aquilo que faz sentido existir.
                </span>
              </h2>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#BAB5C5] sm:text-lg">
                A <strong className="font-semibold text-[#E9E7DF]">DevEssent</strong>{" "}
                nasce da fusão entre engenharia de software e clareza de
                propósito. Não construímos tecnologia por excesso ou modismo:
                projetamos estruturas digitais que se tornam parte essencial da
                operação, das vendas e do crescimento de um negócio real.
              </p>

              {/* Decomposição Editorial Dev + Essent */}
              <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[#E9E7DF]/16 bg-[#14111F]/80 p-6 transition-colors hover:border-[#A782FF]/50">
                  <div className="flex items-center justify-between border-b border-[#E9E7DF]/10 pb-3">
                    <span className="font-display text-2xl font-bold tracking-wide text-[#E9E7DF]">
                      Dev
                    </span>
                    <span className="font-tech text-[10px] tracking-[0.24em] text-[#BAB5C5]/70 uppercase">
                      ENGENHARIA
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold tracking-[0.16em] text-[#B695FF] uppercase">
                    Desenvolvimento
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[#BAB5C5]">
                    Código limpo, arquitetura escalável, segurança e precisão
                    técnica para transformar processos complexos em plataformas
                    confiáveis.
                  </p>
                </div>

                <div className="rounded-[18px] border border-[#A782FF]/40 bg-gradient-to-br from-[#1C162C]/90 to-[#110E1A]/90 p-6 transition-colors hover:border-[#B695FF]">
                  <div className="flex items-center justify-between border-b border-[#E9E7DF]/10 pb-3">
                    <span className="font-display text-2xl font-bold tracking-wide text-[#B695FF]">
                      Essent
                    </span>
                    <span className="font-tech text-[10px] tracking-[0.24em] text-[#B695FF] uppercase">
                      本質 {"//"} ESSÊNCIA
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold tracking-[0.16em] text-[#E9E7DF] uppercase">
                    O Essencial
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[#BAB5C5]">
                    Aquilo que é indispensável e faz sentido existir: clareza,
                    utilidade prática e resultado concreto todos os dias.
                  </p>
                </div>
              </div>
            </div>

            {/* Coluna Geométrica Direita (5 colunas): Numeração Técnica 01 + Diagrama Orbital + Selo Octogonal */}
            <div className="lg:col-span-5">
              <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[24px] border border-[#E9E7DF]/14 bg-[#0E0C16]/90 p-8 sm:p-10">
                {/* Grande numeração técnica 01 em marca d'água geométrica */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-4 right-6 font-tech text-6xl font-bold tracking-tighter text-[#A782FF]/12 select-none sm:text-7xl"
                >
                  01
                </span>

                {/* Anéis orbitais geométricos discretos */}
                <div className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                  <svg
                    viewBox="0 0 280 280"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full"
                  >
                    <circle
                      cx="140"
                      cy="140"
                      r="126"
                      stroke="#E9E7DF"
                      strokeOpacity="0.14"
                      strokeWidth="1"
                    />
                    <circle
                      cx="140"
                      cy="140"
                      r="102"
                      stroke="#A782FF"
                      strokeOpacity="0.35"
                      strokeWidth="1"
                      strokeDasharray="4 6"
                    />
                    <line
                      x1="14"
                      y1="140"
                      x2="266"
                      y2="140"
                      stroke="#A782FF"
                      strokeOpacity="0.2"
                      strokeWidth="1"
                    />
                    <line
                      x1="140"
                      y1="14"
                      x2="140"
                      y2="266"
                      stroke="#A782FF"
                      strokeOpacity="0.2"
                      strokeWidth="1"
                    />
                    <circle cx="140" cy="38" r="3.5" fill="#B695FF" />
                    <circle cx="242" cy="140" r="3" fill="#E9E7DF" />
                    <circle cx="140" cy="242" r="3.5" fill="#A782FF" />
                    <circle cx="38" cy="140" r="3" fill="#E9E7DF" />
                  </svg>

                  <EssentOctagonBadge
                    subtitle="ESSÊNCIA"
                    className="relative z-10 h-36 w-32 sm:h-40 sm:w-36"
                  />
                </div>

                <div className="mt-4 flex w-full items-center justify-between border-t border-[#E9E7DF]/10 pt-4 font-tech text-[10px] tracking-[0.24em] text-[#BAB5C5]/75 uppercase">
                  <span>INDEX // 01</span>
                  <span className="text-[#B695FF]">O ESSENCIAL É EVOLUIR</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

