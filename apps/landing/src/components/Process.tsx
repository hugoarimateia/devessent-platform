"use client";

import React, { useState } from "react";
import { SITE_CONFIG } from "@/config/site";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

const STEP_VISUALS = [
  {
    code: "ETAPA 01 // MAPA DE PRIORIDADES",
    nodes: ["Objetivo comercial", "Gargalos reais", "Escopo enxuto"],
    caption: "Identificamos o que gera impacto agora — sem inflar complexidade.",
  },
  {
    code: "ETAPA 02 // ARQUITETURA & MARCOS",
    nodes: ["Fluxo visual", "Stack técnica", "Cronograma claro"],
    caption: "Você aprova escopo, prazos e entregas antes de escrevermos código.",
  },
  {
    code: "ETAPA 03 // SPRINT & HOMOLOGAÇÃO",
    nodes: ["Código limpo", "Preview online", "Testes mobile"],
    caption: "Acompanhamento direto em ambiente de testes antes da publicação.",
  },
  {
    code: "ETAPA 04 // PRODUÇÃO & EVOLUÇÃO",
    nodes: ["Deploy seguro", "Treinamento", "Melhoria contínua"],
    caption: "Publicação assistida e base preparada para novas fases do negócio.",
  },
];

/**
 * SEÇÃO 05 — COMO TRABALHAMOS (#como-trabalhamos)
 * Fluxo visual interativo em 4 etapas (substitui 4 cards extensos de texto).
 */
export function Process() {
  const steps = SITE_CONFIG.processSteps;
  const [activeIndex, setActiveIndex] = useState(0);
  const currentStep = steps[activeIndex] ?? steps[0];
  const currentVisual = STEP_VISUALS[activeIndex] ?? STEP_VISUALS[0];

  return (
    <section
      id="como-trabalhamos"
      aria-labelledby="process-heading"
      className="relative py-20 sm:py-28"
    >
      <SectionTransition
        number="05"
        code="COMO TRABALHAMOS"
        label="MÉTODO EM 04 ETAPAS"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          <div className="mb-10 flex flex-col justify-between gap-4 lg:mb-12 lg:flex-row lg:items-end">
            <h2
              id="process-heading"
              className="max-w-2xl font-display text-2xl leading-[1.14] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl lg:text-[2.6rem]"
            >
              Do diagnóstico à produção{" "}
              <span className="text-[#A782FF]">com previsibilidade.</span>
            </h2>
            <p className="max-w-sm text-sm text-[#BAB5C5] lg:text-right">
              Quatro etapas transparentes — selecione qualquer marco para ver a
              entrega da fase.
            </p>
          </div>

          {/* Barra de progresso contínua */}
          <div className="mb-8">
            <div
              aria-hidden="true"
              className="mb-4 h-[2px] w-full overflow-hidden rounded-full bg-[#E9E7DF]/10"
            >
              <div
                style={{
                  transform: `scaleX(${(activeIndex + 1) / steps.length})`,
                }}
                className="h-full origin-left bg-gradient-to-r from-[#A782FF] to-[#B695FF] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              />
            </div>

            <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {steps.map((step, idx) => {
                const isActive = idx === activeIndex;
                const isDone = idx <= activeIndex;
                return (
                  <li key={step.number}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveIndex(idx)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-200 ${
                        isActive
                          ? "border-[#B695FF]/70 bg-[#1B152D] text-[#E9E7DF]"
                          : "border-[#E9E7DF]/12 bg-[#120F1B]/75 text-[#BAB5C5] hover:border-[#A782FF]/45 hover:text-[#E9E7DF]"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-tech text-[11px] font-bold transition-colors ${
                          isDone
                            ? "border-[#B695FF] bg-[#A782FF] text-[#0B0B0B]"
                            : "border-[#A782FF]/45 bg-[#161124] text-[#E9E7DF]"
                        }`}
                      >
                        {step.number}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-sm font-bold">
                          {step.title}
                        </span>
                        <span className="hidden truncate text-[11px] text-[#BAB5C5] sm:block">
                          {step.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Palco Visual Dinâmico da Etapa Selecionada */}
          <div
            key={currentStep.number}
            aria-live="polite"
            className="animate-stage-enter de-stage-surface grid grid-cols-1 items-center gap-6 p-6 sm:p-8 lg:grid-cols-12"
          >
            <div className="lg:col-span-5">
              <span className="font-tech text-[10px] tracking-[0.24em] text-[#B695FF] uppercase">
                {currentVisual.code}
              </span>
              <h3 className="mt-2 font-display text-2xl font-bold text-[#E9E7DF]">
                {currentStep.number}. {currentStep.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#BAB5C5]">
                {currentStep.description}
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#A782FF]/35 bg-[#161124] px-3.5 py-2 text-xs text-[#E9E7DF]">
                <span className="font-tech text-[9px] tracking-[0.18em] text-[#B695FF] uppercase">
                  ENTREGA:
                </span>
                <span>{currentStep.deliverable}</span>
              </div>
            </div>

            {/* Diagrama Técnico Minimalista da Etapa */}
            <div className="rounded-2xl border border-[#E9E7DF]/12 bg-[#0B0B0B]/85 p-5 lg:col-span-7">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {currentVisual.nodes.map((node, i) => (
                  <div
                    key={node}
                    className="rounded-xl border border-[#A782FF]/25 bg-[#14111F] p-4"
                  >
                    <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF]">
                      0{i + 1}
                    </span>
                    <p className="mt-2 font-display text-sm font-bold text-[#E9E7DF]">
                      {node}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-[#E9E7DF]/10 pt-3 text-xs text-[#BAB5C5]">
                {currentVisual.caption}
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
