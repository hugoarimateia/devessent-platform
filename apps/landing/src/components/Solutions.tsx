"use client";

import React from "react";
import { SITE_CONFIG } from "@/config/site";
import {
  SystemIcon,
  TechBarcode,
  TechCrosshair,
  TechSlantedBars,
} from "./TechDecor";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

/**
 * SEÇÃO 03 — NOSSAS SOLUÇÕES (#solucoes)
 * Produtos/Soluções da suíte DevEssent:
 * - DevEssent Web
 * - DevEssent Pages
 * - DevEssent Catalog
 * - DevEssent Booking
 * - DevEssent Service (Em planejamento)
 * - DevEssent CRM (Em planejamento)
 */
export function Solutions() {
  const activeSolutions = SITE_CONFIG.solutions.filter((s) => !s.isPlanned);
  const plannedSolutions = SITE_CONFIG.solutions.filter((s) => s.isPlanned);

  return (
    <section
      id="solucoes"
      aria-labelledby="solucoes-heading"
      className="relative border-t border-[#E9E7DF]/10 py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="de-hud-grid pointer-events-none absolute inset-0 opacity-35"
      />

      <SectionTransition
        number="03"
        code="SEC // NOSSAS SOLUÇÕES"
        label="SUÍTE DEVESSENT"
      />

      <div className="relative mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          {/* Cabeçalho Editorial Assimétrico */}
          <div className="mb-14 grid grid-cols-1 items-end gap-8 sm:mb-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="mb-4 inline-flex items-center gap-3">
                <span className="font-tech text-xs font-semibold tracking-[0.3em] text-[#A782FF] uppercase">
                  03 {"//"} NOSSAS SOLUÇÕES
                </span>
                <span className="h-[1px] w-12 bg-[#A782FF]/45" />
                <TechSlantedBars />
              </div>
              <h2
                id="solucoes-heading"
                className="font-display text-2xl leading-[1.18] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl lg:text-[2.65rem]"
              >
                Produtos e arquiteturas desenhados para o que faz sua empresa{" "}
                <span className="text-[#A782FF]">funcionar e evoluir.</span>
              </h2>
            </div>

            <div className="flex flex-col items-start justify-end lg:col-span-5 lg:items-end">
              <p className="max-w-md text-sm leading-relaxed text-[#BAB5C5] sm:text-base lg:text-right">
                Cada solução da suíte DevEssent resolve um gargalo real de
                posicionamento, vendas, agendamento ou gestão operacional.
              </p>
              <div className="mt-4 flex items-center gap-3 font-tech text-xs tracking-[0.2em] text-[#BAB5C5]/75">
                <TechCrosshair className="h-5 w-5" />
                <span>SUÍTE PROPRIETÁRIA • ESCOPO TRANSPARENTE</span>
              </div>
            </div>
          </div>

          {/* Grid Editorial Assimétrico — 4 Soluções Disponíveis */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {activeSolutions.map((sol, idx) => {
              const colSpanClass =
                idx === 0 || idx === 3 ? "lg:col-span-7" : "lg:col-span-5";
              const isFeatured = idx === 0 || idx === 3;

              return (
                <article
                  key={sol.id}
                  className={`${colSpanClass} group relative flex flex-col justify-between rounded-[20px] border ${
                    isFeatured
                      ? "border-[#A782FF]/35 bg-gradient-to-br from-[#1F1930]/85 via-[#14111E]/92 to-[#0D0B12]/95"
                      : "border-[#E9E7DF]/16 bg-[#14121B]/85"
                  } p-6 backdrop-blur-xl transition-all duration-300 hover:border-[#A782FF]/70 hover:shadow-[0_16px_44px_-14px_rgba(167,130,255,0.22)] sm:p-8 lg:p-9`}
                >
                  <div>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E7DF]/10 pb-6">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#A782FF]/50 bg-[#161124] text-[#E9E7DF]">
                          <SystemIcon type={sol.iconType} className="h-6 w-6" />
                        </div>
                        <div>
                          <span className="block font-tech text-[0.65rem] tracking-[0.24em] text-[#B695FF] uppercase">
                            {sol.code}
                          </span>
                          <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#E9E7DF]/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#A782FF]" />
                            {sol.category}
                          </span>
                        </div>
                      </div>

                      <TechBarcode className="hidden h-3 w-auto opacity-65 sm:block" />
                    </div>

                    <span className="font-tech text-xs font-semibold tracking-[0.2em] text-[#B695FF] uppercase">
                      {sol.productName}
                    </span>
                    <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-[#E9E7DF] sm:text-2xl">
                      {sol.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#BAB5C5] sm:text-[0.96rem]">
                      {sol.description}
                    </p>

                    <ul className="mt-6 space-y-2.5">
                      {sol.highlights.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2.5 text-xs text-[#E9E7DF]/88 sm:text-sm"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#A782FF]"
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-[#E9E7DF]/10 pt-5">
                    <a
                      href={`/contato?servico=${encodeURIComponent(
                        sol.shortTitle
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#B695FF] transition-colors group-hover:text-[#E9E7DF]"
                    >
                      <span>{sol.ctaLabel}</span>
                      <span
                        aria-hidden="true"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#A782FF]/40 bg-[#A782FF]/10 text-[#E9E7DF] transition-transform duration-200 group-hover:translate-x-1 group-hover:bg-[#A782FF] group-hover:text-[#0B0B0B]"
                      >
                        ↗
                      </span>
                    </a>
                    <span className="font-tech text-[0.62rem] tracking-[0.22em] text-[#BAB5C5]/50 uppercase">
                      {sol.productName}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Bloco Transparente: Soluções em Planejamento (DevEssent Service & DevEssent CRM) */}
          <div className="mt-8 rounded-[22px] border border-dashed border-[#A782FF]/40 bg-gradient-to-r from-[#161124]/70 via-[#120F1C]/85 to-[#161124]/70 p-6 sm:p-8 lg:p-10">
            <div className="mb-7 flex flex-col justify-between gap-4 border-b border-[#E9E7DF]/12 pb-6 lg:flex-row lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-[#A782FF]/45 bg-[#A782FF]/12 px-3.5 py-1 font-tech text-xs tracking-[0.18em] text-[#B695FF] uppercase">
                  <span className="h-2 w-2 rounded-full bg-[#A782FF] animate-hud-pulse" />
                  ROADMAP DE PRODUTO {"//"} TRANSPARÊNCIA COMERCIAL
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-[#E9E7DF] sm:text-xl">
                  Soluções em Planejamento — DevEssent Service & DevEssent CRM
                </h3>
              </div>
              <p className="max-w-xl text-xs text-[#BAB5C5] sm:text-sm">
                Estes produtos encontram-se em fase de arquitetura e modelagem.
                Você pode registrar interesse para priorização ou solicitar uma
                implementação dedicada sob medida para sua operação.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {plannedSolutions.map((sol) => (
                <article
                  key={sol.id}
                  className="flex flex-col justify-between rounded-[16px] border border-[#E9E7DF]/14 bg-[#0B0B0B]/70 p-6 transition-colors hover:border-[#A782FF]/45"
                >
                  <div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#A782FF]/35 bg-[#161124]">
                          <SystemIcon type={sol.iconType} className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="block font-tech text-[10px] tracking-[0.2em] text-[#B695FF] uppercase">
                            {sol.productName}
                          </span>
                          <h4 className="font-display text-lg font-bold text-[#E9E7DF]">
                            {sol.title}
                          </h4>
                        </div>
                      </div>
                      <span className="rounded-md border border-[#B695FF]/40 bg-[#A782FF]/15 px-2.5 py-1 font-tech text-[0.62rem] tracking-[0.16em] text-[#E9E7DF] uppercase">
                        Em planejamento
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed text-[#BAB5C5]">
                      {sol.description}
                    </p>

                    <ul className="mt-4 space-y-1.5">
                      {sol.highlights.map((h) => (
                        <li
                          key={h}
                          className="flex items-center gap-2 text-xs text-[#BAB5C5]/90"
                        >
                          <span aria-hidden="true" className="text-[#A782FF]">
                            {"//"}
                          </span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 border-t border-[#E9E7DF]/10 pt-4">
                    <a
                      href={`/contato?servico=${encodeURIComponent(
                        sol.shortTitle
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-[#B695FF] transition-colors hover:text-[#E9E7DF] sm:text-sm"
                    >
                      <span>{sol.ctaLabel}</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
