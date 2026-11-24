import React from "react";
import { EssentOctagonBadge } from "./TechDecor";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

/**
 * SEÇÃO 01 — NOSSA ESSÊNCIA (#nossa-essencia)
 * Composição visual convergente (DEV + ESSENT -> Núcleo 本質 / "O essencial é evoluir.")
 * Continua organicamente a partir de HeroOrbitalTransition, sem corte seco de container.
 */
export function EssenceSection() {
  return (
    <section
      id="nossa-essencia"
      tabIndex={-1}
      aria-labelledby="essencia-heading"
      className="relative overflow-x-clip pt-6 pb-20 sm:pt-10 sm:pb-28 focus:outline-none"
    >
      {/* Halo atmosférico suave que conecta o ambiente do hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-[420px] w-[780px] -translate-x-1/2 rounded-full bg-[#161124]/60 blur-[110px]"
      />

      <SectionTransition
        number="01"
        code="NOSSA ESSÊNCIA"
        label="DEV + ESSENT"
      />

      <div className="relative z-10 mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          {/* Cabeçalho Editorial Conciso */}
          <div className="mx-auto max-w-3xl text-center">
            <h2
              id="essencia-heading"
              className="font-display text-3xl leading-[1.12] font-bold tracking-tight text-[#E9E7DF] sm:text-5xl"
            >
              Engenharia precisa para o que{" "}
              <span className="text-[#A782FF]">realmente importa.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#BAB5C5] sm:text-base">
              Sem excessos nem modismos: unimos código sólido e clareza de
              negócio para criar tecnologia que trabalha todos os dias pela sua
              empresa.
            </p>
          </div>

          {/* Composição Visual de Convergência: DEV ──▶ [本質 ESSENT] ◀── ESSENT */}
          <div className="relative mt-12 grid grid-cols-1 items-center gap-6 lg:mt-16 lg:grid-cols-12 lg:gap-4">
            {/* Linhas orbitais de convergência (Desktop) */}
            <svg
              aria-hidden="true"
              viewBox="0 0 1200 220"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
            >
              <defs>
                <linearGradient id="ess-left" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#E9E7DF" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#A782FF" stopOpacity="0.55" />
                </linearGradient>
                <linearGradient id="ess-right" x1="100%" y1="0%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#B695FF" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#B695FF" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <path
                d="M 380 110 C 445 110, 470 110, 520 110"
                stroke="url(#ess-left)"
                strokeWidth="1.25"
                strokeDasharray="4 6"
                className="animate-signal-flow"
              />
              <path
                d="M 820 110 C 755 110, 730 110, 680 110"
                stroke="url(#ess-right)"
                strokeWidth="1.25"
                strokeDasharray="4 6"
                className="animate-signal-flow"
              />
            </svg>

            {/* Polo Esquerdo: DEV */}
            <article className="de-essence-left relative rounded-[20px] border border-[#E9E7DF]/14 bg-[#120F1B]/85 p-6 transition-colors duration-300 hover:border-[#A782FF]/45 sm:p-8 lg:col-span-4">
              <div className="flex items-baseline justify-between border-b border-[#E9E7DF]/10 pb-4">
                <span className="font-display text-3xl font-bold tracking-tight text-[#E9E7DF] sm:text-4xl">
                  DEV
                </span>
                <span className="font-tech text-[10px] tracking-[0.26em] text-[#BAB5C5]/75 uppercase">
                  ENGENHARIA
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[#BAB5C5]">
                Arquitetura escalável, código limpo e segurança para transformar
                rotinas complexas em produtos rápidos e confiáveis.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {["Arquitetura", "Performance", "Segurança"].map((tag) => (
                  <li
                    key={tag}
                    className="rounded-md border border-[#E9E7DF]/12 bg-[#0B0B0B]/70 px-2.5 py-1 font-tech text-[10px] tracking-[0.16em] text-[#E9E7DF]/80 uppercase"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </article>

            {/* Núcleo Central de Convergência */}
            <div className="relative flex flex-col items-center justify-center py-4 lg:col-span-4">
              <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
                <svg
                  viewBox="0 0 260 260"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full"
                >
                  <circle
                    cx="130"
                    cy="130"
                    r="118"
                    stroke="#E9E7DF"
                    strokeOpacity="0.12"
                    strokeWidth="1"
                  />
                  <circle
                    cx="130"
                    cy="130"
                    r="94"
                    stroke="#A782FF"
                    strokeOpacity="0.34"
                    strokeWidth="1"
                    strokeDasharray="3 6"
                  />
                  <circle cx="130" cy="36" r="3" fill="#B695FF" />
                  <circle cx="224" cy="130" r="2.5" fill="#E9E7DF" />
                  <circle cx="130" cy="224" r="3" fill="#A782FF" />
                  <circle cx="36" cy="130" r="2.5" fill="#E9E7DF" />
                </svg>

                <EssentOctagonBadge
                  subtitle="ESSENT"
                  className="relative z-10 h-32 w-28 sm:h-36 sm:w-32"
                />
              </div>

              <div className="mt-2 inline-flex items-center gap-2.5 rounded-full border border-[#A782FF]/35 bg-[#161124]/85 px-4 py-1.5">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[#A782FF]"
                />
                <span className="font-tech text-[10px] tracking-[0.26em] text-[#E9E7DF] uppercase">
                  O ESSENCIAL É EVOLUIR
                </span>
              </div>
            </div>

            {/* Polo Direito: ESSENT */}
            <article className="de-essence-right relative rounded-[20px] border border-[#A782FF]/35 bg-gradient-to-br from-[#1A1429]/90 to-[#110E1A]/92 p-6 transition-colors duration-300 hover:border-[#B695FF]/70 sm:p-8 lg:col-span-4">
              <div className="flex items-baseline justify-between border-b border-[#E9E7DF]/10 pb-4">
                <span className="font-display text-3xl font-bold tracking-tight text-[#B695FF] sm:text-4xl">
                  ESSENT
                </span>
                <span className="font-tech text-[10px] tracking-[0.26em] text-[#B695FF] uppercase">
                  本質 {"//"} ESSÊNCIA
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[#BAB5C5]">
                Foco absoluto no que gera valor real: clareza de uso, utilidade
                prática e evolução contínua junto ao seu negócio.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {["Clareza", "Utilidade", "Resultado"].map((tag) => (
                  <li
                    key={tag}
                    className="rounded-md border border-[#A782FF]/30 bg-[#161124]/90 px-2.5 py-1 font-tech text-[10px] tracking-[0.16em] text-[#B695FF] uppercase"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
