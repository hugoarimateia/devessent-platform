"use client";

import React, { useState } from "react";
import { SITE_CONFIG } from "@/config/site";
import { TechCrosshair, TechSlantedBars } from "./TechDecor";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

/**
 * SEÇÃO 02 — O QUE CONSTRUÍMOS (#servicos)
 * Apresenta os 6 serviços principais em formato de lista horizontal interativa
 * combinada com painel arquitetural dinâmico (evitando blocos repetitivos tradicionais).
 */
export function ServicesSection() {
  const services = SITE_CONFIG.services;
  const [activeId, setActiveId] = useState<string>(services[0].id);

  const activeService =
    services.find((s) => s.id === activeId) ?? services[0];

  return (
    <section
      id="servicos"
      aria-labelledby="servicos-heading"
      className="relative border-t border-[#E9E7DF]/10 py-20 sm:py-28"
    >
      <SectionTransition
        number="02"
        code="SEC // O QUE CONSTRUÍMOS"
        label="ENGENHARIA & SERVIÇOS"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          {/* Cabeçalho Editorial */}
          <div className="mb-12 grid grid-cols-1 items-end gap-6 lg:mb-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="mb-4 inline-flex items-center gap-3">
                <span className="font-tech text-xs font-semibold tracking-[0.3em] text-[#A782FF] uppercase">
                  02 {"//"} O QUE CONSTRUÍMOS
                </span>
                <span className="h-[1px] w-12 bg-[#A782FF]/45" />
                <TechSlantedBars />
              </div>

              <h2
                id="servicos-heading"
                className="font-display text-2xl leading-[1.18] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl lg:text-[2.65rem]"
              >
                Engenharia digital sob medida para cada{" "}
                <span className="text-[#A782FF]">frente do seu negócio.</span>
              </h2>
            </div>

            <div className="flex flex-col items-start justify-end lg:col-span-5 lg:items-end">
              <p className="max-w-md text-sm leading-relaxed text-[#BAB5C5] sm:text-base lg:text-right">
                Da presença institucional às integrações que automatizam sua
                rotina: selecione uma frente abaixo para inspecionar nossa
                entrega técnica.
              </p>
            </div>
          </div>

          {/* Layout Interativo: Lista Horizontal Editorial (7 cols) + Painel de Especificação Ativa (5 cols) */}
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            {/* Lista Horizontal Interativa */}
            <div
              role="region"
              aria-label="Frentes de serviço da DevEssent"
              className="divide-y divide-[#E9E7DF]/12 rounded-[20px] border border-[#E9E7DF]/15 bg-[#120F1B]/75 backdrop-blur-md lg:col-span-7"
            >
              {services.map((service) => {
                const isActive = service.id === activeService.id;
                return (
                  <div key={service.id} className="transition-colors">
                    <button
                      type="button"
                      onClick={() => setActiveId(service.id)}
                      onMouseEnter={() => setActiveId(service.id)}
                      aria-expanded={isActive}
                      className={`group flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-all duration-200 sm:px-7 sm:py-6 ${
                        isActive
                          ? "bg-gradient-to-r from-[#A782FF]/16 via-[#161124]/90 to-transparent"
                          : "hover:bg-[#161124]/45"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-4 sm:gap-6">
                        <span
                          className={`font-tech text-xs tracking-[0.22em] transition-colors ${
                            isActive
                              ? "font-bold text-[#B695FF]"
                              : "text-[#BAB5C5]/60 group-hover:text-[#B695FF]"
                          }`}
                        >
                          {service.index}
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3
                              className={`font-display text-lg font-bold tracking-tight transition-colors sm:text-xl ${
                                isActive
                                  ? "text-[#E9E7DF]"
                                  : "text-[#E9E7DF]/85 group-hover:text-[#E9E7DF]"
                              }`}
                            >
                              {service.title}
                            </h3>
                            <span className="hidden rounded border border-[#A782FF]/30 bg-[#161124] px-2 py-0.5 font-tech text-[10px] tracking-[0.18em] text-[#B695FF] uppercase sm:inline-block">
                              {service.code}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-[#BAB5C5] sm:text-sm">
                            {service.subtitle}
                          </p>
                        </div>
                      </div>

                      <span
                        aria-hidden="true"
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
                          isActive
                            ? "border-[#B695FF] bg-[#A782FF] text-[#0B0B0B]"
                            : "border-[#E9E7DF]/15 bg-[#0B0B0B]/60 text-[#BAB5C5] group-hover:border-[#A782FF]/50 group-hover:text-[#E9E7DF]"
                        }`}
                      >
                        →
                      </span>
                    </button>

                    {/* Detalhe expansível visível no mobile/tablet abaixo do item ativo */}
                    {isActive && (
                      <div className="border-t border-[#E9E7DF]/10 bg-[#0E0B16]/90 px-5 py-5 sm:px-7 lg:hidden">
                        <p className="text-sm leading-relaxed text-[#BAB5C5]">
                          {service.description}
                        </p>
                        <ul className="mt-4 space-y-2">
                          {service.deliverables.map((item) => (
                            <li
                              key={item}
                              className="flex items-start gap-2 text-xs text-[#E9E7DF]/90"
                            >
                              <span
                                aria-hidden="true"
                                className="font-semibold text-[#A782FF]"
                              >
                                {"//"}
                              </span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-5">
                          <a
                            href={`/contato?servico=${encodeURIComponent(
                              service.title
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-semibold text-[#B695FF] hover:text-[#E9E7DF]"
                          >
                            <span>Solicitar escopo de {service.title}</span>
                            <span aria-hidden="true">↗</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Painel Arquitetural Lateral (Desktop) */}
            <div className="hidden lg:col-span-5 lg:block lg:sticky lg:top-28">
              <article
                aria-live="polite"
                className="relative overflow-hidden rounded-[22px] border border-[#A782FF]/45 bg-gradient-to-br from-[#1D172E]/92 via-[#13101D]/95 to-[#0B0B0B] p-8 shadow-[0_20px_50px_-15px_rgba(167,130,255,0.2)]"
              >
                <div className="flex items-center justify-between border-b border-[#E9E7DF]/12 pb-5">
                  <div>
                    <span className="font-tech text-[11px] tracking-[0.26em] text-[#B695FF] uppercase">
                      {activeService.code} {"//"} {activeService.tag}
                    </span>
                    <span className="mt-1 block font-tech text-xs text-[#BAB5C5]/75">
                      FRENTE {activeService.index} DE 06
                    </span>
                  </div>
                  <TechCrosshair className="h-6 w-6" />
                </div>

                <h3 className="mt-6 font-display text-2xl font-bold text-[#E9E7DF]">
                  {activeService.title}
                </h3>
                <p className="mt-1.5 text-xs font-semibold tracking-[0.14em] text-[#B695FF] uppercase">
                  {activeService.subtitle}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-[#BAB5C5]">
                  {activeService.description}
                </p>

                <div className="mt-6 border-t border-[#E9E7DF]/12 pt-5">
                  <span className="block font-tech text-[10px] tracking-[0.24em] text-[#BAB5C5]/75 uppercase">
                    ENTREGÁVEIS & ARQUITETURA
                  </span>
                  <ul className="mt-3.5 space-y-2.5">
                    {activeService.deliverables.map((deliv) => (
                      <li
                        key={deliv}
                        className="flex items-start gap-2.5 text-sm text-[#E9E7DF]/90"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#A782FF]"
                        />
                        <span>{deliv}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 border-t border-[#E9E7DF]/12 pt-5">
                  <a
                    href={`/contato?servico=${encodeURIComponent(
                      activeService.title
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex min-h-[46px] w-full items-center justify-between rounded-[10px] border border-[#B695FF]/60 bg-[#A782FF] px-5 py-3 text-sm font-semibold text-[#0B0B0B] transition-all duration-200 hover:bg-[#B695FF]"
                  >
                    <span>Conversar sobre {activeService.title}</span>
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
              </article>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

