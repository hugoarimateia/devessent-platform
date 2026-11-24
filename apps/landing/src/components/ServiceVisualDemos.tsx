"use client";

import React, { useState } from "react";

interface ServiceVisualDemoProps {
  serviceId: string;
}

/**
 * Demonstrações Visuais Interativas para a Seção 02 — O Que Construímos.
 * Cada frente de serviço exibe uma mini-interface navegável e transparente
 * (claramente marcada como exemplo ilustrativo quando utiliza dados fictícios).
 */
export function ServiceVisualDemo({ serviceId }: ServiceVisualDemoProps) {
  switch (serviceId) {
    case "desenvolvimento-de-sites":
      return <ResponsiveSiteDemo />;
    case "landing-pages":
      return <LandingAnatomyDemo />;
    case "sistemas-web":
      return <WebSystemDashboardDemo />;
    case "plataformas-comerciais":
      return <CommercialCatalogDemo />;
    case "automacao-de-processos":
      return <AutomationBeforeAfterDemo />;
    case "integracoes":
      return <IntegrationsFlowDemo />;
    default:
      return <ResponsiveSiteDemo />;
  }
}

function DemoHeaderBar({
  label,
  badge = "DEMO INTERATIVA",
  rightSlot,
}: {
  label: string;
  badge?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E9E7DF]/10 bg-[#0D0B14]/90 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-[#E9E7DF]/25" />
          <span className="h-2 w-2 rounded-full bg-[#A782FF]/45" />
          <span className="h-2 w-2 rounded-full bg-[#B695FF]/70" />
        </span>
        <span className="font-tech text-[10px] tracking-[0.2em] text-[#BAB5C5] uppercase">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {rightSlot}
        <span className="rounded border border-[#A782FF]/35 bg-[#161124] px-2 py-0.5 font-tech text-[9px] tracking-[0.18em] text-[#B695FF] uppercase">
          {badge}
        </span>
      </div>
    </div>
  );
}

/* 1. SITES — Alternância interativa Desktop ⇄ Mobile */
function ResponsiveSiteDemo() {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#A782FF]/30 bg-[#0E0C16]">
      <DemoHeaderBar
        label="SITE INSTITUCIONAL RESPONSIVO"
        rightSlot={
          <div
            role="group"
            aria-label="Alternar visualização desktop ou mobile"
            className="inline-flex rounded-lg border border-[#E9E7DF]/15 bg-[#0B0B0B] p-0.5"
          >
            {(["desktop", "mobile"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewport === mode}
                onClick={() => setViewport(mode)}
                className={`rounded-md px-2.5 py-1 font-tech text-[9px] tracking-[0.16em] uppercase transition-colors ${
                  viewport === mode
                    ? "bg-[#A782FF] font-semibold text-[#0B0B0B]"
                    : "text-[#BAB5C5] hover:text-[#E9E7DF]"
                }`}
              >
                {mode === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex min-h-[296px] items-center justify-center bg-gradient-to-b from-[#131020] to-[#0B0B0B] p-5 sm:p-6">
        <div
          className={`overflow-hidden rounded-xl border border-[#E9E7DF]/16 bg-[#0B0B0B] shadow-xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            viewport === "desktop" ? "w-full max-w-[520px]" : "w-[216px]"
          }`}
        >
          {/* Barra superior da simulação */}
          <div className="flex items-center justify-between border-b border-[#E9E7DF]/10 bg-[#14111F] px-3.5 py-2.5">
            <span className="font-display text-[11px] font-bold tracking-wide text-[#E9E7DF]">
              SUA<span className="text-[#A782FF]">MARCA</span>
            </span>
            {viewport === "desktop" ? (
              <div className="flex items-center gap-3 font-tech text-[8px] tracking-[0.16em] text-[#BAB5C5] uppercase">
                <span>Soluções</span>
                <span>Projetos</span>
                <span className="rounded bg-[#A782FF] px-2 py-0.5 font-semibold text-[#0B0B0B]">
                  Contato
                </span>
              </div>
            ) : (
              <span className="rounded border border-[#A782FF]/45 px-1.5 py-0.5 font-tech text-[8px] text-[#B695FF]">
                MENU
              </span>
            )}
          </div>

          {/* Corpo do site demonstrativo */}
          <div
            className={`grid gap-3.5 p-4 ${
              viewport === "desktop" ? "grid-cols-12 items-center" : "grid-cols-1"
            }`}
          >
            <div className={viewport === "desktop" ? "col-span-7" : ""}>
              <span className="font-tech text-[8px] tracking-[0.22em] text-[#B695FF] uppercase">
                PRESENÇA DIGITAL AUTORAL
              </span>
              <p className="mt-1.5 font-display text-sm leading-snug font-bold text-[#E9E7DF]">
                Autoridade clara e carregamento imediato em qualquer tela.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-md bg-[#A782FF] px-2.5 py-1 text-[10px] font-semibold text-[#0B0B0B]">
                  Falar com equipe
                </span>
                <span className="rounded-md border border-[#E9E7DF]/15 px-2.5 py-1 text-[10px] text-[#BAB5C5]">
                  Portfólio
                </span>
              </div>
            </div>

            <div
              className={`rounded-lg border border-[#A782FF]/25 bg-gradient-to-br from-[#1C1530] to-[#110E1B] p-3 ${
                viewport === "desktop" ? "col-span-5" : ""
              }`}
            >
              <div className="flex items-center justify-between font-tech text-[8px] text-[#B695FF]">
                <span>SEO · PERFORMANCE</span>
                <span>A+</span>
              </div>
              <div className="mt-2.5 space-y-2">
                <div className="h-2 w-4/5 rounded-full bg-[#A782FF]/45" />
                <div className="h-2 w-3/5 rounded-full bg-[#E9E7DF]/18" />
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div className="rounded border border-[#E9E7DF]/10 bg-[#0B0B0B]/70 p-2 text-center font-tech text-[8px] text-[#E9E7DF]">
                    SEO
                  </div>
                  <div className="rounded border border-[#A782FF]/30 bg-[#161124] p-2 text-center font-tech text-[8px] text-[#B695FF]">
                    MOBILE
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 2. LANDING PAGES — Anatomia de Conversão Interativa */
function LandingAnatomyDemo() {
  const [focusBlock, setFocusBlock] = useState<"hero" | "oferta" | "cta">("hero");
  const blocks: Array<{
    id: "hero" | "oferta" | "cta";
    label: string;
    note: string;
  }> = [
    {
      id: "hero",
      label: "01 Hero",
      note: "Proposta direta em até 3 segundos com contraste alto.",
    },
    {
      id: "oferta",
      label: "02 Prova visual",
      note: "Demonstração clara da solução no lugar de paredes de texto.",
    },
    {
      id: "cta",
      label: "03 Conversão",
      note: "Chamada objetiva integrada a formulário seguro ou WhatsApp.",
    },
  ];
  const current = blocks.find((b) => b.id === focusBlock) ?? blocks[0];

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#A782FF]/30 bg-[#0E0C16]">
      <DemoHeaderBar
        label="ANATOMIA DE LANDING PAGE"
        rightSlot={
          <div className="inline-flex gap-1">
            {blocks.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={focusBlock === b.id}
                onClick={() => setFocusBlock(b.id)}
                className={`rounded-md px-2 py-1 font-tech text-[9px] tracking-[0.14em] uppercase transition-colors ${
                  focusBlock === b.id
                    ? "bg-[#A782FF] font-semibold text-[#0B0B0B]"
                    : "border border-[#E9E7DF]/12 text-[#BAB5C5] hover:text-[#E9E7DF]"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="min-h-[296px] space-y-3 bg-gradient-to-b from-[#131020] to-[#0B0B0B] p-5">
        <div
          className={`rounded-xl border p-3.5 transition-all duration-300 ${
            focusBlock === "hero"
              ? "border-[#B695FF] bg-[#1B152C]"
              : "border-[#E9E7DF]/10 bg-[#120F1B]/70 opacity-65"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF]">
              BLOCO 01 // PROMESSA CLARA
            </span>
            <span className="font-tech text-[9px] text-[#E9E7DF]/70">
              ACIMA DA DOBRA
            </span>
          </div>
          <p className="mt-1.5 font-display text-sm font-bold text-[#E9E7DF]">
            Headline orientada ao problema real do cliente + ação imediata
          </p>
        </div>

        <div
          className={`grid grid-cols-3 gap-2.5 rounded-xl border p-3.5 transition-all duration-300 ${
            focusBlock === "oferta"
              ? "border-[#B695FF] bg-[#1B152C]"
              : "border-[#E9E7DF]/10 bg-[#120F1B]/70 opacity-65"
          }`}
        >
          {["Diferencial Visual", "Demo do Produto", "Fluxo Simples"].map(
            (item) => (
              <div
                key={item}
                className="rounded-lg border border-[#E9E7DF]/10 bg-[#0B0B0B]/75 px-2.5 py-2.5 text-center"
              >
                <span className="mx-auto mb-1.5 block h-1 w-6 rounded-full bg-[#A782FF]" />
                <span className="block text-[10px] font-medium text-[#E9E7DF]">
                  {item}
                </span>
              </div>
            )
          )}
        </div>

        <div
          className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-all duration-300 ${
            focusBlock === "cta"
              ? "border-[#B695FF] bg-[#1B152C]"
              : "border-[#E9E7DF]/10 bg-[#120F1B]/70 opacity-65"
          }`}
        >
          <div>
            <span className="font-tech text-[9px] tracking-[0.2em] text-[#B695FF]">
              BLOCO 03 // CONVERSÃO
            </span>
            <p className="mt-0.5 text-xs text-[#E9E7DF]">
              Briefing estruturado sem atrito
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-[#A782FF] px-3 py-1.5 text-[11px] font-semibold text-[#0B0B0B]">
            Solicitar proposta →
          </span>
        </div>

        <p className="pt-1 text-center text-xs text-[#BAB5C5]">
          <strong className="text-[#E9E7DF]">{current.label}:</strong>{" "}
          {current.note}
        </p>
      </div>
    </div>
  );
}

/* 3. SISTEMAS WEB — Mini Dashboard Operacional (Dados Fictícios) */
const DEMO_ORDERS = [
  { id: "OP-104", unit: "Unidade Centro", status: "Ativo", metric: "14 itens" },
  { id: "OP-105", unit: "Operação Sul", status: "Em revisão", metric: "06 itens" },
  { id: "OP-106", unit: "Filial Leste", status: "Ativo", metric: "22 itens" },
];

function WebSystemDashboardDemo() {
  const [filter, setFilter] = useState<"Todos" | "Ativo" | "Em revisão">("Todos");
  const rows =
    filter === "Todos"
      ? DEMO_ORDERS
      : DEMO_ORDERS.filter((r) => r.status === filter);

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#A782FF]/30 bg-[#0E0C16]">
      <DemoHeaderBar label="PAINEL OPERACIONAL" badge="EXEMPLO FICTÍCIO" />

      <div className="min-h-[296px] space-y-4 bg-gradient-to-b from-[#131020] to-[#0B0B0B] p-5">
        {/* KPIs fictícios */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Operações", value: "42" },
            { label: "Em dia", value: "96%" },
            { label: "Alertas", value: "02" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-[#E9E7DF]/12 bg-[#14111F] p-3"
            >
              <span className="block font-tech text-[8px] tracking-[0.18em] text-[#BAB5C5] uppercase">
                {kpi.label}
              </span>
              <span className="mt-1 block font-display text-lg font-bold text-[#E9E7DF]">
                {kpi.value}
              </span>
            </div>
          ))}
        </div>

        {/* Filtros interativos */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-tech text-[9px] tracking-[0.18em] text-[#B695FF] uppercase">
            FILTRO DE REGISTROS
          </span>
          <div className="inline-flex gap-1">
            {(["Todos", "Ativo", "Em revisão"] as const).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={filter === st}
                onClick={() => setFilter(st)}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  filter === st
                    ? "bg-[#A782FF] font-semibold text-[#0B0B0B]"
                    : "border border-[#E9E7DF]/12 text-[#BAB5C5] hover:text-[#E9E7DF]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela estruturada */}
        <div className="overflow-hidden rounded-xl border border-[#E9E7DF]/12 bg-[#0B0B0B]/85">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E9E7DF]/10 bg-[#14111F] font-tech text-[9px] tracking-[0.16em] text-[#BAB5C5] uppercase">
              <tr>
                <th scope="col" className="px-3 py-2">Código</th>
                <th scope="col" className="px-3 py-2">Unidade</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E7DF]/8 text-[11px]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5 font-mono text-[#B695FF]">{r.id}</td>
                  <td className="px-3 py-2.5 text-[#E9E7DF]">{r.unit}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] ${
                        r.status === "Ativo"
                          ? "bg-[#A782FF]/18 text-[#B695FF]"
                          : "bg-[#E9E7DF]/10 text-[#E9E7DF]"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#BAB5C5]">
                    {r.metric}
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

/* 4. PLATAFORMAS COMERCIAIS — Mini Vitrine Interativa (Dados Fictícios) */
const DEMO_PRODUCTS = [
  { id: "p1", name: "Peça Linha Essencial", cat: "Destaque", price: "R$ 189" },
  { id: "p2", name: "Kit Coleção Studio", cat: "Novidades", price: "R$ 240" },
  { id: "p3", name: "Item Edição Limitada", cat: "Destaque", price: "R$ 310" },
];

function CommercialCatalogDemo() {
  const [cat, setCat] = useState<"Todos" | "Destaque" | "Novidades">("Todos");
  const [bagCount, setBagCount] = useState(1);

  const visible =
    cat === "Todos"
      ? DEMO_PRODUCTS
      : DEMO_PRODUCTS.filter((p) => p.cat === cat);

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#A782FF]/30 bg-[#0E0C16]">
      <DemoHeaderBar
        label="VITRINE & CATÁLOGO"
        badge="EXEMPLO FICTÍCIO"
        rightSlot={
          <span className="rounded-md bg-[#A782FF]/20 px-2 py-0.5 font-tech text-[9px] text-[#E9E7DF]">
            SACOLA ({bagCount})
          </span>
        }
      />

      <div className="min-h-[296px] space-y-4 bg-gradient-to-b from-[#131020] to-[#0B0B0B] p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["Todos", "Destaque", "Novidades"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                cat === c
                  ? "bg-[#A782FF] font-semibold text-[#0B0B0B]"
                  : "border border-[#E9E7DF]/14 bg-[#14111F] text-[#BAB5C5] hover:text-[#E9E7DF]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {visible.map((prod) => (
            <div
              key={prod.id}
              className="flex flex-col justify-between rounded-xl border border-[#E9E7DF]/12 bg-[#14111F] p-3"
            >
              <div>
                <div className="mb-2.5 flex h-20 items-end rounded-lg border border-[#A782FF]/20 bg-gradient-to-br from-[#211A36] to-[#110E1B] p-2">
                  <span className="rounded bg-[#0B0B0B]/80 px-1.5 py-0.5 font-tech text-[8px] text-[#B695FF] uppercase">
                    {prod.cat}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#E9E7DF]">
                  {prod.name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-[#B695FF]">
                  {prod.price}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBagCount((c) => c + 1)}
                className="mt-3 w-full rounded-lg border border-[#A782FF]/45 bg-[#161124] py-1.5 text-[10px] font-semibold text-[#E9E7DF] transition-colors hover:bg-[#A782FF] hover:text-[#0B0B0B]"
              >
                + Adicionar item
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* 5. AUTOMAÇÃO — Antes vs Depois */
function AutomationBeforeAfterDemo() {
  const [mode, setMode] = useState<"depois" | "antes">("depois");

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#A782FF]/30 bg-[#0E0C16]">
      <DemoHeaderBar
        label="FLUXO OPERACIONAL"
        rightSlot={
          <div
            role="group"
            aria-label="Comparar processo manual e automatizado"
            className="inline-flex rounded-lg border border-[#E9E7DF]/15 bg-[#0B0B0B] p-0.5"
          >
            <button
              type="button"
              aria-pressed={mode === "antes"}
              onClick={() => setMode("antes")}
              className={`rounded-md px-2.5 py-1 font-tech text-[9px] uppercase transition-colors ${
                mode === "antes"
                  ? "bg-[#E9E7DF] font-semibold text-[#0B0B0B]"
                  : "text-[#BAB5C5] hover:text-[#E9E7DF]"
              }`}
            >
              Antes
            </button>
            <button
              type="button"
              aria-pressed={mode === "depois"}
              onClick={() => setMode("depois")}
              className={`rounded-md px-2.5 py-1 font-tech text-[9px] uppercase transition-colors ${
                mode === "depois"
                  ? "bg-[#A782FF] font-semibold text-[#0B0B0B]"
                  : "text-[#BAB5C5] hover:text-[#E9E7DF]"
              }`}
            >
              Depois
            </button>
          </div>
        }
      />

      <div className="flex min-h-[296px] flex-col justify-center bg-gradient-to-b from-[#131020] to-[#0B0B0B] p-5">
        {mode === "antes" ? (
          <div className="space-y-3">
            <span className="font-tech text-[10px] tracking-[0.2em] text-[#BAB5C5] uppercase">
              ROTINA MANUAL FRAGMENTADA
            </span>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                { step: "01", title: "Mensagem solta", desc: "Dados incompletos no chat" },
                { step: "02", title: "Cópia em planilha", desc: "Digitação manual sujeita a erro" },
                { step: "03", title: "Retorno atrasado", desc: "Sem rastreio de status" },
              ].map((s) => (
                <div
                  key={s.step}
                  className="rounded-xl border border-dashed border-[#E9E7DF]/22 bg-[#14111F]/60 p-3.5"
                >
                  <span className="font-tech text-[9px] text-[#BAB5C5]">
                    GARGALO {s.step}
                  </span>
                  <p className="mt-1 text-xs font-semibold text-[#E9E7DF]">
                    {s.title}
                  </p>
                  <p className="mt-1 text-[11px] text-[#BAB5C5]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <span className="font-tech text-[10px] tracking-[0.2em] text-[#B695FF] uppercase">
              ESTEIRA AUTOMATIZADA DEVESSENT
            </span>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { n: "01", title: "Entrada", desc: "Captura validada" },
                { n: "02", title: "Regra", desc: "Validação instantânea" },
                { n: "03", title: "Ação", desc: "Notificação automática" },
                { n: "04", title: "Registro", desc: "Histórico centralizado" },
              ].map((s) => (
                <div
                  key={s.n}
                  className="rounded-xl border border-[#A782FF]/40 bg-[#181228] p-3"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#A782FF] font-tech text-[9px] font-bold text-[#0B0B0B]">
                    {s.n}
                  </span>
                  <p className="mt-2 text-xs font-semibold text-[#E9E7DF]">
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#BAB5C5]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* 6. INTEGRAÇÕES — Diagrama Interativo de Nós */
const NODES = [
  { id: "site", label: "Site / Loja", detail: "Envia pedidos e formulários validados via HTTPS." },
  { id: "api", label: "API Core", detail: "Orquestra regras de negócio, autenticação e logs." },
  { id: "whatsapp", label: "Atendimento", detail: "Recebe alertas e resumos prontos para ação." },
  { id: "erp", label: "ERP / Banco", detail: "Sincroniza cadastros e estoque sem digitação dupla." },
] as const;

function IntegrationsFlowDemo() {
  const [selectedNode, setSelectedNode] =
    useState<(typeof NODES)[number]["id"]>("api");
  const active = NODES.find((n) => n.id === selectedNode) ?? NODES[1];

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#A782FF]/30 bg-[#0E0C16]">
      <DemoHeaderBar label="ARQUITETURA CONECTADA" />

      <div className="flex min-h-[296px] flex-col justify-between bg-gradient-to-b from-[#131020] to-[#0B0B0B] p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NODES.map((node) => {
            const isSelected = node.id === selectedNode;
            return (
              <button
                key={node.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedNode(node.id)}
                className={`rounded-xl border px-3 py-4 text-center transition-all duration-200 ${
                  isSelected
                    ? "border-[#B695FF] bg-[#1E1633] text-[#E9E7DF] shadow-[0_0_24px_rgba(167,130,255,0.22)]"
                    : "border-[#E9E7DF]/14 bg-[#14111F] text-[#BAB5C5] hover:border-[#A782FF]/50 hover:text-[#E9E7DF]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mx-auto mb-2 block h-2 w-2 rounded-full ${
                    isSelected ? "bg-[#B695FF]" : "bg-[#A782FF]/40"
                  }`}
                />
                <span className="block font-tech text-[10px] tracking-[0.14em] uppercase">
                  {node.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Linha de fluxo animada */}
        <svg
          aria-hidden="true"
          viewBox="0 0 600 44"
          fill="none"
          className="my-2 h-11 w-full"
        >
          <path
            d="M 40 22 H 560"
            stroke="#A782FF"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
          <path
            d="M 40 22 H 560"
            stroke="#B695FF"
            strokeWidth="1.5"
            strokeDasharray="6 10"
            className="animate-signal-flow"
          />
          {[75, 225, 375, 525].map((cx, i) => (
            <circle
              key={cx}
              cx={cx}
              cy={22}
              r={NODES[i].id === selectedNode ? 6 : 4}
              fill={NODES[i].id === selectedNode ? "#B695FF" : "#161124"}
              stroke="#B695FF"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        <div className="rounded-xl border border-[#A782FF]/25 bg-[#14111F] px-4 py-3 text-xs text-[#BAB5C5]">
          <span className="font-tech text-[10px] tracking-[0.18em] text-[#B695FF] uppercase">
            {active.label} {"//"}{" "}
          </span>
          <span className="text-[#E9E7DF]">{active.detail}</span>
        </div>
      </div>
    </div>
  );
}
