"use client";

import React, { useState } from "react";
import { SITE_CONFIG } from "@/config/site";
import { TechSlantedBars } from "./TechDecor";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

/**
 * SEÇÃO 05 — COMO TRABALHAMOS (#como-trabalhamos)
 * Linha do tempo interativa:
 * 01. Diagnóstico
 * 02. Proposta
 * 03. Desenvolvimento
 * 04. Implantação e evolução
 */
export function Process() {
  const steps = SITE_CONFIG.processSteps;
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  return (
    <section
      id="como-trabalhamos"
      aria-labelledby="process-heading"
      className="relative border-t border-[#E9E7DF]/10 bg-gradient-to-b from-[#0B0B0B] via-[#110E1A] to-[#0B0B0B] py-20 sm:py-28"
    >
      <SectionTransition
        number="05"
        code="SEC // COMO TRABALHAMOS"
        label="MÉTODO EM 04 ETAPAS"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          {/* Cabeçalho da seção */}
          <div className="mb-14 flex flex-col justify-between gap-6 sm:mb-16 md:flex-row md:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-3">
                <span className="font-tech text-xs font-semibold tracking-[0.3em] text-[#A782FF] uppercase">
                  05 {"//"} COMO TRABALHAMOS
                </span>
                <span className="h-[1px] w-10 bg-[#A782FF]/45" />
                <TechSlantedBars />
              </div>
              <h2
                id="process-heading"
                className="font-display text-2xl font-bold tracking-tight text-[#E9E7DF] sm:text-4xl"
              >
                Como transformamos necessidade em{" "}
                <span className="text-[#A782FF]">solução real.</span>
              </h2>
            </div>

            <p className="max-w-md text-sm leading-relaxed text-[#BAB5C5] sm:text-base">
              Linha do tempo direta, previsível e sem jargões desnecessários —
              pensada para quem precisa conduzir o negócio com segurança
              enquanto a tecnologia é construída.
            </p>
          </div>

          {/* Linha do tempo interativa com indicador progressivo */}
          <div className="relative">
            {/* Trilha conectora horizontal no Desktop */}
            <div
              aria-hidden="true"
              className=" absolute top-11 right-[8%] left-[8%] hidden h-[2px] bg-[#E9E7DF]/12 lg:block"
            >
              <div
                style={{
                  width: `${((activeStepIndex + 1) / steps.length) * 100}%`,
                }}
                className="h-full bg-gradient-to-r from-[#A782FF] to-[#B695FF] transition-all duration-500 ease-out"
              />
            </div>

            <ol className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {steps.map((step, index) => {
                const isActive = index === activeStepIndex;
                const isCompleted = index <= activeStepIndex;

                return (
                  <li
                    key={step.number}
                    onMouseEnter={() => setActiveStepIndex(index)}
                    onClick={() => setActiveStepIndex(index)}
                    className={`group relative flex cursor-pointer flex-col justify-between rounded-[18px] border p-6 backdrop-blur-md transition-all duration-300 sm:p-7 ${
                      isActive
                        ? "border-[#A782FF]/75 bg-gradient-to-b from-[#1D162E]/95 to-[#120F1C]/95 shadow-[0_14px_38px_-12px_rgba(167,130,255,0.28)] lg:-translate-y-1.5"
                        : "border-[#E9E7DF]/15 bg-[#14111D]/85 hover:border-[#A782FF]/50"
                    }`}
                  >
                    <div>
                      {/* Topo com nó orbital e índice */}
                      <div className="mb-6 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveStepIndex(index)}
                          aria-label={`Etapa ${step.number}: ${step.title}`}
                          className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full border font-tech text-sm font-bold transition-colors ${
                            isCompleted
                              ? "border-[#B695FF] bg-[#A782FF] text-[#0B0B0B] shadow-[0_0_16px_rgba(167,130,255,0.38)]"
                              : "border-[#A782FF]/55 bg-[#161124] text-[#E9E7DF]"
                          }`}
                        >
                          {step.number}
                        </button>

                        <div className="flex items-center gap-2">
                          <span className="font-tech text-[0.62rem] tracking-[0.22em] text-[#B695FF]/85 uppercase">
                            {step.code}
                          </span>
                          {index < steps.length - 1 && (
                            <span
                              aria-hidden="true"
                              className="font-mono text-xs text-[#A782FF]/70 lg:hidden"
                            >
                              →
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Título e subtítulo */}
                      <h3 className="font-display text-xl font-bold text-[#E9E7DF]">
                        {step.number}. {step.title}
                      </h3>
                      <p className="mt-1 text-xs font-semibold tracking-[0.12em] text-[#B695FF] uppercase">
                        {step.subtitle}
                      </p>

                      {/* Descrição compreensível e direta */}
                      <p className="mt-4 text-sm leading-relaxed text-[#BAB5C5]">
                        {step.description}
                      </p>
                    </div>

                    {/* Entrega da etapa */}
                    <div className="mt-6 border-t border-[#E9E7DF]/10 pt-4">
                      <span className="block font-tech text-[0.58rem] tracking-[0.22em] text-[#BAB5C5]/70 uppercase">
                        ENTREGA DA ETAPA
                      </span>
                      <p className="mt-1 text-xs font-medium text-[#E9E7DF]/90">
                        {step.deliverable}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
