"use client";

import React, { useRef, useState } from "react";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

type ShowroomKey = "catalog" | "platform" | "web" | "booking" | "roadmap";

interface ShowroomCategory {
  id: ShowroomKey;
  tabLabel: string;
  productName: string;
  statusBadge: string;
  isPlanned?: boolean;
  headline: string;
  description: string;
  capabilities: string[];
  ctaLabel: string;
  ctaServiceParam: string;
}

const SHOWROOM_ITEMS: ShowroomCategory[] = [
  {
    id: "catalog",
    tabLabel: "Vitrine & Catálogo",
    productName: "DevEssent Catalog",
    statusBadge: "Demonstração sob consulta",
    headline: "Vitrine digital com categorias, variantes e sacola estruturada.",
    description:
      "Cada loja mantém sua própria identidade visual dentro de uma experiência rápida no celular — pronta para transformar visitas em pedidos organizados.",
    capabilities: [
      "Vitrine editorial responsiva",
      "Categorias, tamanhos e variantes",
      "Pedido estruturado sem atrito",
    ],
    ctaLabel: "Agendar demo do Catalog",
    ctaServiceParam: "DevEssent Catalog — Catálogo Digital",
  },
  {
    id: "platform",
    tabLabel: "Painel Operacional",
    productName: "DevEssent Platform · Retail",
    statusBadge: "Demonstração sob consulta",
    headline: "Gestão comercial de catálogo, estoque e pedidos em um só painel.",
    description:
      "Módulo comercial verificado da DevEssent Platform para administrar produtos, categorias, variantes e status de pedidos com isolamento multiempresa.",
    capabilities: [
      "Indicadores de publicados, rascunho e estoque",
      "Gestão de variantes e categorias",
      "Acompanhamento de pedidos em tempo real",
    ],
    ctaLabel: "Conhecer a DevEssent Platform",
    ctaServiceParam: "DevEssent Web — Site ou Sistema Sob Medida",
  },
  {
    id: "web",
    tabLabel: "Sites & Pages",
    productName: "DevEssent Web & Pages",
    statusBadge: "Disponível sob medida",
    headline: "Sites institucionais e landing pages com direção de arte própria.",
    description:
      "Projetos autorais em Next.js e TypeScript — zero template genérico, performance otimizada e estrutura pronta para posicionar sua marca.",
    capabilities: [
      "Identidade visual e narrativa sob medida",
      "Carregamento leve e SEO técnico",
      "Formulários seguros e canais diretos",
    ],
    ctaLabel: "Solicitar escopo Web",
    ctaServiceParam: "DevEssent Web — Site ou Sistema Sob Medida",
  },
  {
    id: "booking",
    tabLabel: "Agenda Online",
    productName: "DevEssent Booking",
    statusBadge: "Demonstração sob consulta",
    headline: "Agendamento direto por serviço, profissional e horário livre.",
    description:
      "Reduza faltas e trocas manuais de mensagem centralizando reservas e regras de agenda em uma interface intuitiva para o cliente.",
    capabilities: [
      "Regras flexíveis de duração e janela",
      "Reserva ágil pelo smartphone",
      "Painel diário para recepção",
    ],
    ctaLabel: "Consultar DevEssent Booking",
    ctaServiceParam: "DevEssent Booking — Agendamento Online",
  },
  {
    id: "roadmap",
    tabLabel: "Roadmap",
    productName: "DevEssent Service & CRM",
    statusBadge: "Em planejamento",
    isPlanned: true,
    headline: "Próximos módulos em arquitetura: Ordens de Serviço e CRM enxuto.",
    description:
      "Transparência comercial: estes produtos estão em fase de modelagem funcional na suíte DevEssent e podem ser contratados hoje como projeto sob medida.",
    capabilities: [
      "DevEssent Service — chamados, checklists e histórico",
      "DevEssent CRM — funil comercial objetivo para PMEs",
      "Lista prioritária ou escopo dedicado",
    ],
    ctaLabel: "Registrar interesse",
    ctaServiceParam: "DevEssent Service — Ordens de Serviço (Em planejamento)",
  },
];

/**
 * SEÇÃO 03 — NOSSAS SOLUÇÕES (#solucoes)
 * Showroom interativo de produtos digitais com demos reais inspiradas nos módulos
 * verificados da DevEssent Platform (sempre com dados fictícios/demo transparentes).
 */
export function Solutions() {
  const [activeKey, setActiveKey] = useState<ShowroomKey>("catalog");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = Math.max(
    0,
    SHOWROOM_ITEMS.findIndex((i) => i.id === activeKey)
  );
  const current = SHOWROOM_ITEMS[activeIndex] ?? SHOWROOM_ITEMS[0];

  const selectIndex = (idx: number, focus = false) => {
    const wrapped = (idx + SHOWROOM_ITEMS.length) % SHOWROOM_ITEMS.length;
    setActiveKey(SHOWROOM_ITEMS[wrapped].id);
    const el = tabRefs.current[wrapped];
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (focus) el.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      selectIndex(idx + 1, true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      selectIndex(idx - 1, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectIndex(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      selectIndex(SHOWROOM_ITEMS.length - 1, true);
    }
  };

  return (
    <section
      id="solucoes"
      aria-labelledby="solucoes-heading"
      className="relative py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="de-hud-grid pointer-events-none absolute inset-0 opacity-25"
      />

      <SectionTransition
        number="03"
        code="NOSSAS SOLUÇÕES"
        label="SHOWROOM DE PRODUTOS"
      />

      <div className="relative z-10 mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          {/* Cabeçalho Editorial */}
          <div className="mb-8 flex flex-col justify-between gap-4 lg:mb-10 lg:flex-row lg:items-end">
            <h2
              id="solucoes-heading"
              className="max-w-2xl font-display text-2xl leading-[1.14] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl lg:text-[2.6rem]"
            >
              Soluções prontas para{" "}
              <span className="text-[#A782FF]">
                posicionar, vender e operar.
              </span>
            </h2>
            <p className="max-w-sm text-sm text-[#BAB5C5] lg:text-right">
              Explore cada frente no showroom interativo abaixo — todas as
              prévias usam dados demonstrativos.
            </p>
          </div>

          {/* Barra de Categorias em linha única rolável (Tabs acessíveis) */}
          <div
            role="tablist"
            aria-label="Categorias do showroom DevEssent"
            className="de-tab-strip mb-8 gap-2 border-b border-[#E9E7DF]/12 pb-2"
          >
            {SHOWROOM_ITEMS.map((item, idx) => {
              const isSelected = item.id === activeKey;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    tabRefs.current[idx] = el;
                  }}
                  id={`showroom-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => selectIndex(idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  className={`de-tab-button min-h-[44px] rounded-t-lg px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm ${
                    isSelected
                      ? "bg-[#161124] font-semibold text-[#E9E7DF]"
                      : "text-[#BAB5C5] hover:text-[#E9E7DF]"
                  }`}
                >
                  {item.tabLabel}
                  {item.isPlanned && (
                    <span className="ml-2 rounded border border-[#A782FF]/40 bg-[#A782FF]/12 px-1.5 py-0.5 font-tech text-[9px] text-[#B695FF] uppercase">
                      Conceito
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Palco Assimétrico do Showroom: Visual Demo (7 cols) + Briefing Enxuto (5 cols) */}
          <div
            role="tabpanel"
            aria-labelledby={`showroom-tab-${current.id}`}
            key={current.id}
            className="animate-stage-enter grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12 lg:gap-8"
          >
            {/* Área Visual Interativa */}
            <div className="de-stage-surface flex flex-col justify-between p-4 sm:p-6 lg:col-span-7">
              <ShowroomStage activeKey={current.id} />
            </div>

            {/* Painel Editorial Direto */}
            <aside className="flex flex-col justify-between rounded-[20px] border border-[#E9E7DF]/14 bg-[#120F1B]/90 p-6 sm:p-8 lg:col-span-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E9E7DF]/10 pb-4">
                  <span className="font-tech text-[11px] font-semibold tracking-[0.22em] text-[#B695FF] uppercase">
                    {current.productName}
                  </span>
                  <span
                    className={`rounded-md border px-2.5 py-1 font-tech text-[9px] tracking-[0.16em] uppercase ${
                      current.isPlanned
                        ? "border-dashed border-[#B695FF]/50 bg-[#A782FF]/12 text-[#E9E7DF]"
                        : "border-[#A782FF]/35 bg-[#161124] text-[#B695FF]"
                    }`}
                  >
                    {current.statusBadge}
                  </span>
                </div>

                <h3 className="mt-5 font-display text-xl leading-snug font-bold text-[#E9E7DF] sm:text-2xl">
                  {current.headline}
                </h3>

                <p className="mt-3 text-sm leading-relaxed text-[#BAB5C5]">
                  {current.description}
                </p>

                <ul className="mt-6 space-y-2.5 border-t border-[#E9E7DF]/10 pt-5">
                  {current.capabilities.map((cap) => (
                    <li
                      key={cap}
                      className="flex items-start gap-2.5 text-xs text-[#E9E7DF]/90 sm:text-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#A782FF]"
                      />
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 border-t border-[#E9E7DF]/10 pt-5">
                <a
                  href={`/contato?servico=${encodeURIComponent(
                    current.ctaServiceParam
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-[46px] w-full items-center justify-between rounded-[10px] bg-gradient-to-r from-[#B695FF] to-[#A782FF] px-5 py-3 text-sm font-semibold text-[#0B0B0B] transition-all duration-200 hover:brightness-105"
                >
                  <span>{current.ctaLabel}</span>
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  >
                    ↗
                  </span>
                </a>
              </div>
            </aside>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function ShowroomStage({ activeKey }: { activeKey: ShowroomKey }) {
  switch (activeKey) {
    case "catalog":
      return <CatalogStorefrontMockup />;
    case "platform":
      return <RetailAdminMockup />;
    case "web":
      return <WebExperienceMockup />;
    case "booking":
      return <BookingInteractiveMockup />;
    case "roadmap":
      return <RoadmapBlueprintMockup />;
  }
}

/* DEMO 1: Vitrine Editorial (Baseada no módulo Storefront da DevEssent Platform) */
const STOREFRONT_ITEMS = [
  { id: "v1", name: "Blazer Linho Studio", tag: "Coleção", price: "R$ 329,00" },
  { id: "v2", name: "Bolsa Minimal Couro", tag: "Acessórios", price: "R$ 245,00" },
  { id: "v3", name: "Camisa Algodão Pima", tag: "Coleção", price: "R$ 179,00" },
];

function CatalogStorefrontMockup() {
  const [cat, setCat] = useState<"Todos" | "Coleção" | "Acessórios">("Todos");
  const [selectedSize, setSelectedSize] = useState<"P" | "M" | "G">("M");
  const [cartItems, setCartItems] = useState(1);

  const items =
    cat === "Todos"
      ? STOREFRONT_ITEMS
      : STOREFRONT_ITEMS.filter((i) => i.tag === cat);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-[#E9E7DF]/14 bg-[#0B0B0B]">
      {/* Moldura institucional DevEssent envolvendo a vitrine da loja cliente */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E9E7DF]/10 bg-[#14111F] px-4 py-2.5">
        <span className="font-tech text-[9px] tracking-[0.2em] text-[#BAB5C5] uppercase">
          VITRINE COMERCIAL // LOJA DEMO
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#A782FF]/20 px-2 py-0.5 font-tech text-[9px] text-[#E9E7DF]">
            SACOLA ({cartItems})
          </span>
          <span className="rounded border border-[#A782FF]/35 bg-[#0B0B0B] px-2 py-0.5 font-tech text-[9px] text-[#B695FF] uppercase">
            DADOS DEMO
          </span>
        </div>
      </div>

      {/* Paleta editorial clara contida na moldura DevEssent (demonstra personalização por cliente) */}
      <div className="flex-1 bg-[#FAF9F6] p-4 text-[#161514] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-3">
          <div>
            <span className="block font-mono text-[9px] tracking-[0.22em] text-stone-500 uppercase">
              ATELIÊ DEMO · VITRINE EDITORIAL
            </span>
            <p className="font-display text-lg font-bold tracking-tight text-stone-950">
              Peças em Destaque
            </p>
          </div>
          <div className="flex items-center gap-1">
            {(["Todos", "Coleção", "Acessórios"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cat === c}
                onClick={() => setCat(c)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  cat === c
                    ? "bg-stone-900 text-white"
                    : "bg-stone-200/80 text-stone-700 hover:bg-stone-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-lg border border-stone-200 bg-white p-3"
            >
              <div>
                <div className="relative flex h-24 items-end justify-between overflow-hidden rounded-md bg-gradient-to-br from-stone-200/90 via-stone-100 to-stone-200/60 p-2">
                  {/* Ilustração vetorial editorial minimalista de cada peça demo */}
                  <svg
                    viewBox="0 0 80 64"
                    fill="none"
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1.5 right-2 h-14 w-16 text-stone-500/45"
                  >
                    {item.id === "v1" ? (
                      <path
                        d="M26 10 40 20 54 10 66 20 60 54 H20 L14 20 26 10Z M40 20 V54"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    ) : item.id === "v2" ? (
                      <>
                        <path
                          d="M28 24 V17 A12 12 0 0 1 52 17 V24"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <rect
                          x="18"
                          y="24"
                          width="44"
                          height="30"
                          rx="4"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <path d="M18 34 H62" stroke="currentColor" strokeWidth="1.2" />
                      </>
                    ) : (
                      <path
                        d="M28 10 H52 L66 22 58 30 52 25 V54 H28 V25 L22 30 14 22 28 10Z M40 10 V54"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                  <span className="relative z-10 rounded bg-white/95 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-stone-700 uppercase">
                    {item.tag}
                  </span>
                  <span className="relative z-10 font-mono text-[8px] text-stone-500">
                    Tam. {selectedSize}
                  </span>
                </div>
                <p className="mt-2.5 text-xs font-bold text-stone-900">
                  {item.name}
                </p>
                <p className="mt-0.5 font-mono text-[11px] font-semibold text-stone-700">
                  {item.price}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartItems((c) => c + 1)}
                className="mt-3 w-full rounded-md bg-stone-900 py-1.5 text-[10px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                + Adicionar ({selectedSize})
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-stone-600">
              Variante:
            </span>
            {(["P", "M", "G"] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                aria-pressed={selectedSize === sz}
                onClick={() => setSelectedSize(sz)}
                className={`h-6 w-6 rounded border text-[10px] font-bold transition-colors ${
                  selectedSize === sz
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-700"
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] text-stone-500">
            Paleta personalizada por marca cliente
          </span>
        </div>
      </div>
    </div>
  );
}

/* DEMO 2: Painel Retail Admin (Baseado no RetailDashboard verificado na DevEssent Platform) */
const RETAIL_ROWS = [
  { sku: "ESS-01", name: "Jaqueta Estruturada", variants: "3 variantes", stock: 18, status: "Publicado" },
  { sku: "ESS-02", name: "Mochila Urbana 20L", variants: "2 variantes", stock: 7, status: "Publicado" },
  { sku: "ESS-03", name: "Coleção Inverno (Novo)", variants: "4 variantes", stock: 0, status: "Rascunho" },
];

function RetailAdminMockup() {
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Publicado" | "Rascunho">("Todos");
  const filtered =
    statusFilter === "Todos"
      ? RETAIL_ROWS
      : RETAIL_ROWS.filter((r) => r.status === statusFilter);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-[#A782FF]/35 bg-[#0E0C16]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E9E7DF]/10 bg-[#14111F] px-4 py-2.5">
        <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF] uppercase">
          DEVESSENT PLATFORM // RETAIL ADMIN
        </span>
        <span className="rounded border border-[#A782FF]/35 bg-[#0B0B0B] px-2 py-0.5 font-tech text-[9px] text-[#BAB5C5] uppercase">
          SANDBOX DEMO
        </span>
      </div>

      <div className="flex-1 space-y-4 p-4 sm:p-5">
        {/* KPIs espelhando os cards reais do RetailDashboard */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: "Publicados", val: "24", accent: true },
            { label: "Catálogo", val: "29", accent: false },
            { label: "Rascunhos", val: "05", accent: false },
            { label: "Sem estoque", val: "01", accent: false },
          ].map((k) => (
            <div
              key={k.label}
              className={`rounded-xl border p-3 ${
                k.accent
                  ? "border-[#A782FF]/50 bg-[#1B1430]"
                  : "border-[#E9E7DF]/12 bg-[#14111F]"
              }`}
            >
              <span className="block font-tech text-[8px] tracking-[0.16em] text-[#BAB5C5] uppercase">
                {k.label}
              </span>
              <span className="mt-1 block font-display text-lg font-bold text-[#E9E7DF]">
                {k.val}
              </span>
            </div>
          ))}
        </div>

        {/* Filtros de catálogo */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-tech text-[9px] tracking-[0.18em] text-[#E9E7DF]/80 uppercase">
            PRODUTOS & VARIANTES
          </span>
          <div className="inline-flex gap-1">
            {(["Todos", "Publicado", "Rascunho"] as const).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={statusFilter === st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  statusFilter === st
                    ? "bg-[#A782FF] font-semibold text-[#0B0B0B]"
                    : "border border-[#E9E7DF]/12 text-[#BAB5C5] hover:text-[#E9E7DF]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela de produtos */}
        <div className="overflow-x-auto rounded-xl border border-[#E9E7DF]/12 bg-[#0B0B0B]/85">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E9E7DF]/10 bg-[#14111F] font-tech text-[9px] tracking-[0.14em] text-[#BAB5C5] uppercase">
              <tr>
                <th scope="col" className="px-3 py-2">SKU</th>
                <th scope="col" className="px-3 py-2">Produto</th>
                <th scope="col" className="px-3 py-2">Estoque</th>
                <th scope="col" className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E7DF]/8 text-[11px]">
              {filtered.map((row) => (
                <tr key={row.sku}>
                  <td className="px-3 py-2.5 font-mono text-[#B695FF]">{row.sku}</td>
                  <td className="px-3 py-2.5 text-[#E9E7DF]">
                    <span className="block font-medium">{row.name}</span>
                    <span className="text-[10px] text-[#BAB5C5]">{row.variants}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[#BAB5C5]">
                    {row.stock} un.
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] ${
                        row.status === "Publicado"
                          ? "bg-[#A782FF]/20 text-[#B695FF]"
                          : "bg-[#E9E7DF]/10 text-[#BAB5C5]"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* DEMO 3: Sites & Landing Pages */
function WebExperienceMockup() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-[#A782FF]/35 bg-[#0E0C16]">
      <div className="flex items-center justify-between border-b border-[#E9E7DF]/10 bg-[#14111F] px-4 py-2.5">
        <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF] uppercase">
          DEVESSENT WEB & PAGES
        </span>
        <span className="font-tech text-[9px] text-[#BAB5C5] uppercase">
          NEXT.JS · EDGE CDN
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 items-center gap-4 p-5 sm:grid-cols-12">
        <div className="rounded-xl border border-[#E9E7DF]/14 bg-[#0B0B0B] p-4 sm:col-span-8">
          <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF] uppercase">
            DESKTOP EDITORIAL
          </span>
          <p className="mt-2 font-display text-base font-bold text-[#E9E7DF]">
            Design próprio sem moldes engessados.
          </p>
          <p className="mt-1.5 text-xs text-[#BAB5C5]">
            Tipografia legível, ritmo visual e carregamento imediato na borda
            global.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["SEO Técnico", "Zero Bloat", "Acessível"].map((pill) => (
              <div
                key={pill}
                className="rounded-lg border border-[#A782FF]/25 bg-[#161124] px-2 py-2 text-center font-tech text-[9px] text-[#E9E7DF]"
              >
                {pill}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#A782FF]/40 bg-[#14111F] p-3.5 sm:col-span-4">
          <div className="mx-auto mb-2.5 h-1 w-8 rounded-full bg-[#E9E7DF]/25" />
          <span className="block font-tech text-[8px] tracking-[0.2em] text-[#B695FF] uppercase">
            MOBILE-FIRST
          </span>
          <p className="mt-1.5 font-display text-xs font-bold text-[#E9E7DF]">
            Leitura limpa em 360px
          </p>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full rounded-full bg-[#E9E7DF]/15" />
            <div className="h-2 w-4/5 rounded-full bg-[#E9E7DF]/12" />
            <div className="mt-3 rounded-lg bg-[#A782FF] py-1.5 text-center text-[10px] font-semibold text-[#0B0B0B]">
              Fale Conosco
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* DEMO 4: Agendamento Online */
const BOOKING_SLOTS = ["09:30", "11:00", "14:30", "16:00"];

function BookingInteractiveMockup() {
  const [selectedSlot, setSelectedSlot] = useState("14:30");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-[#A782FF]/35 bg-[#0E0C16]">
      <div className="flex items-center justify-between border-b border-[#E9E7DF]/10 bg-[#14111F] px-4 py-2.5">
        <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF] uppercase">
          DEVESSENT BOOKING // AGENDA DEMO
        </span>
        <span className="rounded border border-[#A782FF]/35 bg-[#0B0B0B] px-2 py-0.5 font-tech text-[9px] text-[#BAB5C5]">
          INTERATIVO
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#E9E7DF]/12 bg-[#14111F] p-3.5">
            <span className="font-tech text-[9px] tracking-[0.18em] text-[#BAB5C5] uppercase">
              01 // SERVIÇO
            </span>
            <p className="mt-1 font-display text-sm font-bold text-[#E9E7DF]">
              Atendimento Consultivo · 45 min
            </p>
            <p className="mt-0.5 text-[11px] text-[#B695FF]">
              Equipe Disponível · Confirmação imediata
            </p>
          </div>

          <div className="rounded-xl border border-[#E9E7DF]/12 bg-[#14111F] p-3.5">
            <span className="font-tech text-[9px] tracking-[0.18em] text-[#BAB5C5] uppercase">
              02 // SELECIONE O HORÁRIO
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {BOOKING_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={selectedSlot === slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-lg py-1.5 font-mono text-xs font-semibold transition-colors ${
                    selectedSlot === slot
                      ? "bg-[#A782FF] text-[#0B0B0B]"
                      : "border border-[#E9E7DF]/14 bg-[#0B0B0B] text-[#E9E7DF] hover:border-[#A782FF]/60"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A782FF]/35 bg-[#181228] px-4 py-3">
          <div>
            <span className="block font-tech text-[9px] tracking-[0.18em] text-[#B695FF] uppercase">
              PRÉVIA DA RESERVA
            </span>
            <p className="mt-0.5 text-xs text-[#E9E7DF]">
              Horário selecionado:{" "}
              <strong className="font-mono text-[#B695FF]">
                {selectedSlot}
              </strong>{" "}
              · Lembrete automático antes do atendimento
            </p>
          </div>
          <span className="rounded-md bg-[#A782FF]/20 px-2.5 py-1 font-tech text-[9px] text-[#E9E7DF] uppercase">
            Livre
          </span>
        </div>
      </div>
    </div>
  );
}

/* DEMO 5: Roadmap Conceitual Transparente */
function RoadmapBlueprintMockup() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-dashed border-[#A782FF]/45 bg-[#0E0C16]">
      <div className="flex items-center justify-between border-b border-[#E9E7DF]/10 bg-[#14111F] px-4 py-2.5">
        <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF] uppercase">
          ARQUITETURA EM EVOLUÇÃO
        </span>
        <span className="rounded border border-[#B695FF]/40 bg-[#A782FF]/12 px-2 py-0.5 font-tech text-[9px] text-[#E9E7DF] uppercase">
          EM PLANEJAMENTO
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div className="flex flex-col justify-between rounded-xl border border-[#E9E7DF]/14 bg-[#14111F]/80 p-4">
          <div>
            <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF] uppercase">
              CONCEITO 01 // SERVICE
            </span>
            <h4 className="mt-1.5 font-display text-base font-bold text-[#E9E7DF]">
              Ordens de Serviço
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-[#BAB5C5]">
              Abertura de chamados, checklists técnicos, orçamento e histórico
              por equipamento ou cliente.
            </p>
          </div>
          <div className="mt-4 flex gap-1.5">
            {["Abertura", "Checklist", "Entrega"].map((s) => (
              <span
                key={s}
                className="rounded border border-[#E9E7DF]/12 bg-[#0B0B0B] px-2 py-1 font-tech text-[8px] text-[#BAB5C5] uppercase"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-[#E9E7DF]/14 bg-[#14111F]/80 p-4">
          <div>
            <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF] uppercase">
              CONCEITO 02 // CRM
            </span>
            <h4 className="mt-1.5 font-display text-base font-bold text-[#E9E7DF]">
              CRM Comercial Enxuto
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-[#BAB5C5]">
              Funil visual de oportunidades, histórico de propostas e lembretes
              de retorno sem telas poluídas.
            </p>
          </div>
          <div className="mt-4 flex gap-1.5">
            {["Lead", "Proposta", "Fechamento"].map((s) => (
              <span
                key={s}
                className="rounded border border-[#E9E7DF]/12 bg-[#0B0B0B] px-2 py-1 font-tech text-[8px] text-[#BAB5C5] uppercase"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
