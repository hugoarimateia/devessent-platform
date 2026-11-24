import React from "react";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

/**
 * SEÇÃO 07 — CONVITE / CONVERSÃO (#convite)
 * Fechamento comercial forte, direto e transparente, conduzindo ao canal /contato.
 */
export function InviteSection() {
  return (
    <section
      id="convite"
      aria-labelledby="convite-heading"
      className="relative py-20 sm:py-28"
    >
      <SectionTransition
        number="07"
        code="PRÓXIMO PASSO"
        label="CONVERSA INICIAL"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[24px] border border-[#A782FF]/40 bg-gradient-to-br from-[#1C152E] via-[#120F1D] to-[#0B0B0B] px-6 py-14 text-center sm:px-12 sm:py-18">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#A782FF]/16 blur-[80px]"
            />

            <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center">
              <span className="font-tech text-[10px] font-semibold tracking-[0.28em] text-[#B695FF] uppercase">
                VAMOS CONSTRUIR JUNTOS
              </span>

              <h2
                id="convite-heading"
                className="mt-4 font-display text-2xl leading-[1.16] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl lg:text-5xl"
              >
                Seu próximo passo começa com uma{" "}
                <span className="text-[#A782FF]">solução essencial.</span>
              </h2>

              <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#BAB5C5] sm:text-base">
                Conte o que precisa construir ou profissionalizar e receba um
                direcionamento técnico claro para o seu projeto.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                <a
                  href="/contato"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-[50px] items-center justify-center gap-3 rounded-[12px] bg-gradient-to-r from-[#B695FF] to-[#A782FF] px-8 py-3.5 text-sm font-semibold text-[#0B0B0B] shadow-[0_0_28px_rgba(167,130,255,0.36)] transition-all duration-200 hover:brightness-105 hover:shadow-[0_0_38px_rgba(167,130,255,0.55)] sm:text-base"
                >
                  <span
                    aria-hidden="true"
                    className="font-mono font-bold tracking-tighter text-[#0B0B0B]/85"
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

                <a
                  href="#solucoes"
                  className="inline-flex min-h-[50px] items-center justify-center rounded-[12px] border border-[#E9E7DF]/18 bg-[#0B0B0B]/60 px-6 py-3.5 text-xs font-medium text-[#E9E7DF] transition-colors hover:border-[#A782FF]/60 hover:text-[#B695FF] sm:text-sm"
                >
                  Rever demonstrações
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
