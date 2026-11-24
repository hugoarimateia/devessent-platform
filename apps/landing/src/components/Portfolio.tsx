"use client";

import React, { useState } from "react";
import Image from "next/image";
import { PortfolioGroup, SITE_CONFIG } from "@/config/site";
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
 * Galeria editorial assimétrica com hierarquia visual real:
 * - Destaque principal (12 cols) com preview real e alternância Desktop ⇄ Mobile
 * - Cards secundários diferenciados para protótipos e entregas B2B sob consulta
 * - Transparência rigorosa sobre status real (Em Produção / Demo Verificada / Em Planejamento)
 */
export function Portfolio() {
  const [selectedGroup, setSelectedGroup] =
    useState<(typeof GROUPS)[number]>("Todos");
  const [flagshipView, setFlagshipView] = useState<"desktop" | "mobile">(
    "desktop"
  );

  const items = SITE_CONFIG.portfolioBlueprints;
  const flagship = items[0];
  const secondaryItems = items.slice(1).filter((item) => {
    if (selectedGroup === "Todos") return true;
    return item.group === selectedGroup;
  });

  const showFlagship =
    selectedGroup === "Todos" || selectedGroup === flagship.group;

  return (
    <section
      id="portfolio"
      aria-labelledby="portfolio-heading"
      className="relative py-20 sm:py-28"
    >
      <SectionTransition
        number="04"
        code="PORTFÓLIO & ARQUITETURAS"
        label="ENTREGAS E PROTÓTIPOS"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          {/* Cabeçalho e Filtros */}
          <div className="mb-10 flex flex-col justify-between gap-6 lg:mb-12 lg:flex-row lg:items-end">
            <div>
              <h2
                id="portfolio-heading"
                className="font-display text-2xl leading-[1.14] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl lg:text-[2.6rem]"
              >
                Projetos reais, protótipos e{" "}
                <span className="text-[#A782FF]">roadmap transparente.</span>
              </h2>
              <p className="mt-3 max-w-xl text-sm text-[#BAB5C5]">
                Separamos claramente o que está em produção, o que existe como
                demonstração funcional e o que segue em planejamento.
              </p>
            </div>

            <div
              role="group"
              aria-label="Filtrar portfólio por estágio"
              className="de-tab-strip gap-2 pb-1"
            >
              {GROUPS.map((group) => {
                const isSelected = selectedGroup === group;
                return (
                  <button
                    key={group}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedGroup(group)}
                    className={`min-h-[42px] shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm ${
                      isSelected
                        ? "bg-[#A782FF] font-semibold text-[#0B0B0B]"
                        : "border border-[#E9E7DF]/14 bg-[#14111F] text-[#BAB5C5] hover:border-[#A782FF]/50 hover:text-[#E9E7DF]"
                    }`}
                  >
                    {group}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1. DESTAQUE EDITORIAL PRINCIPAL (12 Cols) — Asset Real + Toggle Desktop/Mobile */}
          {showFlagship && (
            <article className="group mb-8 overflow-hidden rounded-[22px] border border-[#A782FF]/35 bg-gradient-to-br from-[#19132A]/90 via-[#120F1C]/95 to-[#0B0B0B] transition-colors duration-300 hover:border-[#B695FF]/65">
              <div className="grid grid-cols-1 items-center lg:grid-cols-12">
                {/* Preview Visual Real */}
                <div className="relative border-b border-[#E9E7DF]/10 bg-[#0D0A15] p-5 sm:p-8 lg:col-span-7 lg:border-r lg:border-b-0">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-[#E9E7DF]/20 bg-[#1A1A1A] px-2.5 py-0.5 font-tech text-[10px] tracking-[0.16em] text-[#E9E7DF] uppercase">
                        {flagship.group}
                      </span>
                      <span className="rounded-md border border-[#A782FF]/45 bg-[#161124] px-2.5 py-0.5 font-tech text-[10px] tracking-[0.16em] text-[#B695FF] uppercase">
                        {flagship.statusLabel}
                      </span>
                    </div>

                    <div
                      role="group"
                      aria-label="Alternar prévia desktop ou mobile do projeto destaque"
                      className="inline-flex rounded-lg border border-[#E9E7DF]/14 bg-[#0B0B0B] p-0.5"
                    >
                      {(["desktop", "mobile"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={flagshipView === v}
                          onClick={() => setFlagshipView(v)}
                          className={`rounded-md px-2.5 py-1 font-tech text-[9px] uppercase transition-colors ${
                            flagshipView === v
                              ? "bg-[#A782FF] font-semibold text-[#0B0B0B]"
                              : "text-[#BAB5C5] hover:text-[#E9E7DF]"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mockup com assets reais da DevEssent */}
                  <div className="flex min-h-[250px] items-center justify-center">
                    <div
                      className={`overflow-hidden rounded-xl border border-[#A782FF]/30 bg-[#0B0B0B] shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        flagshipView === "desktop"
                          ? "w-full"
                          : "w-[220px]"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-[#E9E7DF]/10 bg-[#14111F] px-3 py-2">
                        <Image
                          src="/brand/devessent-logo.webp"
                          alt="Logotipo DevEssent na prévia do projeto institucional"
                          width={110}
                          height={18}
                          loading="lazy"
                          unoptimized
                          className="h-3.5 w-auto object-contain"
                        />
                        <span className="font-tech text-[8px] tracking-[0.16em] text-[#B695FF] uppercase">
                          HTTPS · CDN
                        </span>
                      </div>

                      <div
                        className={`grid items-center gap-4 p-4 ${
                          flagshipView === "desktop"
                            ? "grid-cols-12"
                            : "grid-cols-1 text-center"
                        }`}
                      >
                        <div
                          className={
                            flagshipView === "desktop" ? "col-span-6" : ""
                          }
                        >
                          <span className="font-tech text-[8px] tracking-[0.22em] text-[#B695FF] uppercase">
                            NEXT.JS 15 · CLOUDFLARE PAGES
                          </span>
                          <p className="mt-1.5 font-display text-sm leading-snug font-bold text-[#E9E7DF]">
                            Tecnologia essencial para negócios que evoluem.
                          </p>
                          <div
                            className={`mt-3 flex flex-wrap gap-1.5 ${
                              flagshipView === "mobile" ? "justify-center" : ""
                            }`}
                          >
                            {flagship.previewModules.map((mod) => (
                              <span
                                key={mod}
                                className="rounded border border-[#E9E7DF]/12 bg-[#161124] px-2 py-0.5 text-[9px] text-[#E9E7DF]/85"
                              >
                                {mod}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div
                          className={`overflow-hidden rounded-lg bg-[#0E0B18] p-2 ${
                            flagshipView === "desktop" ? "col-span-6" : ""
                          }`}
                        >
                          <Image
                            src="/images/astronaut-hero.webp"
                            alt="Prévia real da cena do astronauta da landing page institucional DevEssent"
                            width={770}
                            height={504}
                            loading="lazy"
                            unoptimized
                            className="h-auto w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Descrição Editorial Concisa */}
                <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-5">
                  <div>
                    <span className="font-tech text-[10px] tracking-[0.22em] text-[#B695FF] uppercase">
                      {flagship.code} {"//"} {flagship.category}
                    </span>
                    <h3 className="mt-2 font-display text-2xl font-bold text-[#E9E7DF]">
                      {flagship.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#BAB5C5]">
                      {flagship.summary}
                    </p>

                    <ul className="mt-5 space-y-2 border-t border-[#E9E7DF]/10 pt-4">
                      {flagship.architecturePoints.map((pt) => (
                        <li
                          key={pt}
                          className="flex items-start gap-2 text-xs text-[#E9E7DF]/90"
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

                  <div className="mt-7">
                    <a
                      href={`/contato?servico=${encodeURIComponent(
                        flagship.title
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] w-full items-center justify-between rounded-xl bg-[#A782FF] px-4 py-2.5 text-xs font-semibold text-[#0B0B0B] transition-colors hover:bg-[#B695FF] sm:text-sm"
                    >
                      <span>Quero um projeto nesse padrão</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* 2. GRADE EDITORIAL ASSIMÉTRICA — Protótipos, Projetos B2B e Roadmap */}
          {secondaryItems.length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {secondaryItems.map((item, idx) => {
                const isWide =
                  secondaryItems.length >= 2 && (idx === 0 || idx === 3);
                const spanClass = isWide ? "lg:col-span-7" : "lg:col-span-5";
                const isRoadmap =
                  item.group === "Soluções em desenvolvimento";

                return (
                  <article
                    key={item.id}
                    className={`${spanClass} group flex flex-col justify-between overflow-hidden rounded-[20px] border transition-colors duration-300 ${
                      isRoadmap
                        ? "border-dashed border-[#A782FF]/35 bg-[#100D18]/85 hover:border-[#A782FF]/60"
                        : "border-[#E9E7DF]/14 bg-gradient-to-b from-[#171324]/90 to-[#0F0D16]/95 hover:border-[#A782FF]/55"
                    }`}
                  >
                    <div>
                      {/* Mini-palco visual diferenciado por tipo */}
                      <div className="border-b border-[#E9E7DF]/10 bg-[#0D0B14] px-5 py-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded border border-[#E9E7DF]/18 bg-[#1A1A1A] px-2 py-0.5 font-tech text-[9px] tracking-[0.16em] text-[#E9E7DF] uppercase">
                            {item.group}
                          </span>
                          <span className="rounded border border-[#A782FF]/40 bg-[#161124] px-2 py-0.5 font-tech text-[9px] tracking-[0.16em] text-[#B695FF] uppercase">
                            {item.statusLabel}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {item.previewModules.map((mod) => (
                            <div
                              key={mod}
                              className="rounded-lg border border-[#A782FF]/20 bg-[#14111F] px-2.5 py-2.5 text-center transition-colors group-hover:border-[#A782FF]/40"
                            >
                              <span
                                aria-hidden="true"
                                className="mx-auto mb-1.5 block h-1 w-6 rounded-full bg-[#A782FF]"
                              />
                              <span className="block truncate text-[10px] font-medium text-[#E9E7DF]/90">
                                {mod}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-6">
                        <span className="font-tech text-[10px] tracking-[0.2em] text-[#B695FF] uppercase">
                          {item.category}
                        </span>
                        <h3 className="mt-1.5 font-display text-xl font-bold text-[#E9E7DF]">
                          {item.title}
                        </h3>
                        <p className="mt-2.5 text-sm leading-relaxed text-[#BAB5C5]">
                          {item.summary}
                        </p>
                      </div>
                    </div>

                    <div className="px-6 pt-1 pb-6">
                      <a
                        href={`/contato?servico=${encodeURIComponent(
                          item.title
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[42px] w-full items-center justify-between rounded-xl border border-[#A782FF]/35 bg-[#161124]/75 px-4 py-2.5 text-xs font-medium text-[#E9E7DF] transition-colors hover:border-[#A782FF] hover:bg-[#A782FF]/15 sm:text-sm"
                      >
                        <span>Solicitar apresentação</span>
                        <span aria-hidden="true" className="text-[#B695FF]">
                          ↗
                        </span>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
