"use client";

import React, { useRef, useState } from "react";
import { SITE_CONFIG } from "@/config/site";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";
import { ServiceVisualDemo } from "./ServiceVisualDemos";

/**
 * SEÇÃO 02 — O QUE CONSTRUÍMOS (#servicos)
 * Experiência "Show, Don't Tell":
 * - Seletor interativo acessível (tablist com teclado ArrowUp/Down/Left/Right)
 * - No mobile: faixa horizontal rolável em linha única (sem depender de hover)
 * - No desktop: lista editorial enxuta à esquerda + palco visual interativo à direita
 */
export function ServicesSection() {
  const services = SITE_CONFIG.services;
  const [activeId, setActiveId] = useState<string>(services[0].id);
  const desktopTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mobileTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = Math.max(
    0,
    services.findIndex((s) => s.id === activeId)
  );
  const activeService = services[activeIndex] ?? services[0];

  const selectByIndex = (
    idx: number,
    focusTab = false,
    variant: "desktop" | "mobile" = "desktop"
  ) => {
    const wrapped = (idx + services.length) % services.length;
    setActiveId(services[wrapped].id);
    const refs = variant === "mobile" ? mobileTabRefs : desktopTabRefs;
    const btn = refs.current[wrapped];
    if (btn) {
      btn.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (focusTab) btn.focus();
    }
  };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number,
    variant: "desktop" | "mobile"
  ) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      selectByIndex(idx + 1, true, variant);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      selectByIndex(idx - 1, true, variant);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectByIndex(0, true, variant);
    } else if (e.key === "End") {
      e.preventDefault();
      selectByIndex(services.length - 1, true, variant);
    }
  };

  return (
    <section
      id="servicos"
      aria-labelledby="servicos-heading"
      className="relative py-20 sm:py-28"
    >
      <SectionTransition
        number="02"
        code="O QUE CONSTRUÍMOS"
        label="EXPLORE AS DEMONSTRAÇÕES"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          {/* Cabeçalho direto e visual */}
          <div className="mb-10 flex flex-col justify-between gap-4 lg:mb-12 lg:flex-row lg:items-end">
            <h2
              id="servicos-heading"
              className="max-w-2xl font-display text-2xl leading-[1.14] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl lg:text-[2.6rem]"
            >
              Veja na prática o que{" "}
              <span className="text-[#A782FF]">construímos para empresas.</span>
            </h2>
            <p className="max-w-sm text-sm text-[#BAB5C5] lg:text-right">
              Selecione uma frente para explorar uma demonstração interativa da
              entrega.
            </p>
          </div>

          {/* Mobile/Tablet (< lg): Tablist horizontal em linha única rolável */}
          <div
            role="tablist"
            aria-label="Frentes de serviço da DevEssent"
            className="de-tab-strip mb-6 gap-2 border-b border-[#E9E7DF]/12 pb-2 lg:hidden"
          >
            {services.map((service, idx) => {
              const isSelected = service.id === activeService.id;
              return (
                <button
                  key={`mob-${service.id}`}
                  ref={(el) => {
                    mobileTabRefs.current[idx] = el;
                  }}
                  id={`service-tab-mob-${service.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => selectByIndex(idx, false, "mobile")}
                  onKeyDown={(e) => handleTabKeyDown(e, idx, "mobile")}
                  className={`de-tab-button min-h-[44px] rounded-t-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? "bg-[#161124] font-semibold text-[#E9E7DF]"
                      : "text-[#BAB5C5] hover:text-[#E9E7DF]"
                  }`}
                >
                  <span className="mr-1.5 font-tech text-[10px] text-[#B695FF]">
                    {service.index}
                  </span>
                  {service.title}
                </button>
              );
            })}
          </div>

          {/* Grid Desktop: Seletor (5 cols) + Palco Interativo (7 cols) */}
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            {/* Lista Vertical de Serviços (Desktop) */}
            <div
              role="tablist"
              aria-label="Frentes de serviço da DevEssent"
              aria-orientation="vertical"
              className="hidden divide-y divide-[#E9E7DF]/10 overflow-hidden rounded-[20px] border border-[#E9E7DF]/14 bg-[#110E1A]/85 lg:col-span-5 lg:block"
            >
              {services.map((service, idx) => {
                const isSelected = service.id === activeService.id;
                return (
                  <button
                    key={service.id}
                    ref={(el) => {
                      desktopTabRefs.current[idx] = el;
                    }}
                    id={`service-tab-${service.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => selectByIndex(idx, false, "desktop")}
                    onKeyDown={(e) => handleTabKeyDown(e, idx, "desktop")}
                    className={`group relative flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors duration-200 ${
                      isSelected
                        ? "bg-gradient-to-r from-[#A782FF]/16 via-[#161124]/90 to-transparent"
                        : "hover:bg-[#161124]/50"
                    }`}
                  >
                    {/* Indicador lateral de seleção por forma */}
                    <span
                      aria-hidden="true"
                      className={`absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full transition-opacity ${
                        isSelected
                          ? "bg-[#A782FF] opacity-100"
                          : "bg-transparent opacity-0"
                      }`}
                    />

                    <div className="flex min-w-0 items-center gap-4">
                      <span
                        className={`font-tech text-[11px] tracking-[0.2em] ${
                          isSelected
                            ? "font-bold text-[#B695FF]"
                            : "text-[#BAB5C5]/55 group-hover:text-[#B695FF]"
                        }`}
                      >
                        {service.index}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-bold text-[#E9E7DF]">
                          {service.title}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-[#BAB5C5]">
                          {service.subtitle}
                        </p>
                      </div>
                    </div>

                    <span
                      aria-hidden="true"
                      className={`font-tech text-xs transition-transform duration-200 ${
                        isSelected
                          ? "translate-x-0.5 text-[#B695FF]"
                          : "text-[#BAB5C5]/40 group-hover:translate-x-0.5 group-hover:text-[#E9E7DF]"
                      }`}
                    >
                      →
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Palco Visual Interativo (Mobile & Desktop) */}
            <div
              role="tabpanel"
              aria-label={`Demonstração interativa: ${activeService.title}`}
              className="lg:col-span-7"
            >
              <div
                key={activeService.id}
                className="animate-stage-enter de-stage-surface p-5 sm:p-6"
              >
                {/* Mini-interface interativa correspondente */}
                <ServiceVisualDemo serviceId={activeService.id} />

                {/* Síntese Editorial Enxuta + Entregáveis + CTA */}
                <div className="mt-5 flex flex-col justify-between gap-5 border-t border-[#E9E7DF]/10 pt-5 sm:flex-row sm:items-end">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-tech text-[10px] tracking-[0.22em] text-[#B695FF] uppercase">
                        {activeService.code} {"//"} {activeService.tag}
                      </span>
                    </div>
                    <p className="max-w-lg text-sm leading-relaxed text-[#BAB5C5]">
                      {activeService.description}
                    </p>
                    <ul className="flex flex-wrap gap-2 pt-1">
                      {activeService.deliverables.map((item) => (
                        <li
                          key={item}
                          className="rounded-md border border-[#E9E7DF]/12 bg-[#0B0B0B]/70 px-2.5 py-1 text-[11px] text-[#E9E7DF]/88"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href={`/contato?servico=${encodeURIComponent(
                      activeService.title
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#A782FF] px-5 py-2.5 text-xs font-semibold text-[#0B0B0B] transition-colors hover:bg-[#B695FF] sm:text-sm"
                  >
                    <span>Solicitar escopo</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
