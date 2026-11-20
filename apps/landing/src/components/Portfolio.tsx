"use client";

import React, { useState } from "react";
import { PortfolioGroup, SITE_CONFIG } from "@/config/site";
import { TechSlantedBars } from "./TechDecor";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

const GROUPS: Array<"Todos" | PortfolioGroup> = [
  "Todos",
  "Projetos reais",
  "Protótipos",
  "Soluções em desenvolvimento",
];

/**
 * SEÇÃO 04 — PORTFÓLIO (#portfolio)
 * Separa claramente:
 * - Projetos reais
 * - Protótipos
 * - Soluções em desenvolvimento
 * Sem inventar clientes fictícios nem resultados inexistentes.
 */
export function Portfolio() {
  const [selectedGroup, setSelectedGroup] =
    useState<(typeof GROUPS)[number]>("Todos");

  const filteredItems =
    selectedGroup === "Todos"
      ? SITE_CONFIG.portfolioBlueprints
      : SITE_CONFIG.portfolioBlueprints.filter(
          (item) => item.group === selectedGroup
        );

  return (
    <section
      id="portfolio"
      aria-labelledby="portfolio-heading"
      className="relative border-t border-[#E9E7DF]/10 py-20 sm:py-28"
    >
      <SectionTransition
        number="04"
        code="SEC // PORTFÓLIO & ARQUITETURAS"
        label="TRANSPARÊNCIA TÉCNICA"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          {/* Cabeçalho transparente */}
          <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-3">
                <span className="font-tech text-xs font-semibold tracking-[0.3em] text-[#A782FF] uppercase">
                  04 {"//"} PORTFÓLIO
                </span>
                <span className="h-[1px] w-10 bg-[#A782FF]/45" />
                <TechSlantedBars />
              </div>
              <h2
                id="portfolio-heading"
                className="font-display text-2xl font-bold tracking-tight text-[#E9E7DF] sm:text-4xl"
              >
                Projetos reais, protótipos e{" "}
                <span className="text-[#A782FF]">
                  soluções em desenvolvimento.
                </span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#BAB5C5] sm:text-base">
                Compromisso absoluto com a verdade técnica: separamos de forma
                explícita nossas entregas reais, nossos protótipos funcionais e
                os produtos que estão em desenvolvimento na suíte DevEssent.
              </p>
            </div>

            {/* Filtros explícitos exigidos pelo escopo */}
            <div
              role="group"
              aria-label="Filtrar portfólio por estágio"
              className="flex flex-wrap items-center gap-2"
            >
              {GROUPS.map((group) => {
                const isSelected = selectedGroup === group;
                return (
                  <button
                    key={group}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedGroup(group)}
                    className={`min-h-[42px] rounded-lg px-4 py-2.5 text-xs font-medium transition-all sm:text-sm ${
                      isSelected
                        ? "bg-[#A782FF] font-semibold text-[#0B0B0B] shadow-[0_0_18px_rgba(167,130,255,0.35)]"
                        : "border border-[#E9E7DF]/16 bg-[#161124]/60 text-[#BAB5C5] hover:border-[#A782FF]/50 hover:text-[#E9E7DF]"
                    }`}
                  >
                    {group}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid de Cards classificados claramente */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="flex flex-col justify-between overflow-hidden rounded-[20px] border border-[#E9E7DF]/16 bg-gradient-to-b from-[#1A1626]/90 to-[#110F18]/95 transition-all duration-300 hover:border-[#A782FF]/60"
              >
                <div>
                  {/* Wireframe UI Preview Header */}
                  <div className="relative border-b border-[#E9E7DF]/12 bg-[#0E0B15] p-5">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="rounded-md border border-[#E9E7DF]/20 bg-[#1A1A1A] px-2.5 py-0.5 font-tech text-[0.6rem] tracking-[0.16em] text-[#E9E7DF] uppercase">
                        {item.group}
                      </span>
                      <span className="rounded-md border border-[#A782FF]/45 bg-[#161124] px-2.5 py-0.5 font-tech text-[0.6rem] tracking-[0.16em] text-[#B695FF] uppercase">
                        {item.statusLabel}
                      </span>
                    </div>

                    {/* Mini diagrama esquemático da interface */}
                    <div
                      aria-hidden="true"
                      className="space-y-2.5 rounded-xl border border-[#A782FF]/25 bg-[#14111F] p-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-tech text-[0.6rem] tracking-[0.2em] text-[#E9E7DF]/70">
                          {item.code}
                        </span>
                        <span className="h-1.5 w-12 rounded-full bg-[#A782FF]/40" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {item.previewModules.map((mod) => (
                          <div
                            key={mod}
                            className="rounded-lg border border-[#E9E7DF]/12 bg-[#0B0B0B]/70 px-2.5 py-2 text-center"
                          >
                            <div className="mx-auto mb-1.5 h-1 w-6 rounded-full bg-[#A782FF]" />
                            <span className="block truncate text-[0.65rem] font-medium text-[#E9E7DF]/85">
                              {mod}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Corpo do card */}
                  <div className="p-6 sm:p-7">
                    <span className="font-tech text-[0.65rem] tracking-[0.22em] text-[#B695FF] uppercase">
                      {item.category}
                    </span>
                    <h3 className="mt-1.5 font-display text-xl font-bold text-[#E9E7DF]">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#BAB5C5]">
                      {item.summary}
                    </p>

                    <ul className="mt-5 space-y-2 border-t border-[#E9E7DF]/10 pt-4">
                      {item.architecturePoints.map((pt) => (
                        <li
                          key={pt}
                          className="flex items-start gap-2 text-xs text-[#E9E7DF]/85"
                        >
                          <span
                            aria-hidden="true"
                            className="font-semibold text-[#A782FF]"
                          >
                            {"//"}
                          </span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="px-6 pt-2 pb-6 sm:px-7 sm:pb-7">
                  <a
                    href={`/contato?servico=${encodeURIComponent(item.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-between rounded-xl border border-[#A782FF]/35 bg-[#161124]/75 px-4 py-3 text-xs font-medium text-[#E9E7DF] transition-colors hover:border-[#A782FF] hover:bg-[#A782FF]/15 sm:text-sm"
                  >
                    <span>Solicitar apresentação ou escopo</span>
                    <span aria-hidden="true" className="text-[#B695FF]">
                      ↗
                    </span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
