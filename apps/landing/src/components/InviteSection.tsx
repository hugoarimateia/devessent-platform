import React from "react";
import { TechSlantedBars } from "./TechDecor";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

/**
 * SEÇÃO FINAL — CONVITE (#convite)
 * Seção final forte, limpa e direta:
 * - Texto: "Seu próximo passo começa com uma solução essencial."
 * - Botão: Fale com a DevEssent (abre /contato em uma nova guia)
 * - Sem exibir o formulário na homepage.
 */
export function InviteSection() {
  return (
    <section
      id="convite"
      aria-labelledby="convite-heading"
      className="relative border-t border-[#E9E7DF]/10 py-20 sm:py-28"
    >
      <SectionTransition
        number="07"
        code="SEC // PRÓXIMO PASSO"
        label="CANAL DIRETO"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[26px] border border-[#A782FF]/45 bg-gradient-to-br from-[#1E1730] via-[#120F1D] to-[#0B0B0B] px-6 py-14 text-center shadow-[0_24px_64px_-18px_rgba(167,130,255,0.25)] sm:px-12 sm:py-20">
            {/* Brilho radial de fundo */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#A782FF]/18 blur-[80px]"
            />

            <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center">
              <div className="mb-5 inline-flex items-center gap-3">
                <TechSlantedBars />
                <span className="font-tech text-xs font-semibold tracking-[0.28em] text-[#B695FF] uppercase">
                  CONVITE INSTITUCIONAL
                </span>
              </div>

              <h2
                id="convite-heading"
                className="font-display text-2xl leading-[1.2] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl lg:text-5xl"
              >
                Seu próximo passo começa com uma{" "}
                <span className="text-[#A782FF]">solução essencial.</span>
              </h2>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#BAB5C5] sm:text-base">
                Conte o momento atual da sua empresa em nossa página exclusiva
                de atendimento e receba um direcionamento técnico claro para o
                seu projeto.
              </p>

              <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
                <a
                  href="/contato"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-[52px] items-center justify-center gap-3.5 rounded-[12px] bg-gradient-to-r from-[#B695FF] to-[#A782FF] px-8 py-4 text-base font-semibold text-[#0B0B0B] shadow-[0_0_32px_rgba(167,130,255,0.42)] transition-all duration-200 hover:brightness-105 hover:shadow-[0_0_42px_rgba(167,130,255,0.62)]"
                >
                  <span
                    aria-hidden="true"
                    className="font-mono text-base font-bold tracking-tighter text-[#0B0B0B]/85"
                  >
                    &lt;/&gt;
                  </span>
                  <span>Fale com a DevEssent</span>
                  <svg
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 17L17 7M7 7h10v10" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

