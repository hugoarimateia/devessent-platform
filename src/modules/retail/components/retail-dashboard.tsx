"use client";

import * as React from "react";
import Link from "next/link";
import {
  Package,
  CheckCircle2,
  FileEdit,
  AlertTriangle,
  Plus,
  ArrowRight,
  Store,
  Tag,
  Settings,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import type {
  RetailCatalogStats,
  RetailOrderStats,
  RetailProductWithDetails,
  RetailStore,
} from "../types";
import { ProductInvariants } from "../domain/product-invariants";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

interface RetailDashboardProps {
  tenantSlug?: string;
  store: RetailStore;
  stats: RetailCatalogStats;
  orderStats?: RetailOrderStats | null;
  recentProducts: RetailProductWithDetails[];
  userRole: string;
}

export function RetailDashboard({
  tenantSlug: _tenantSlug,
  store,
  stats,
  orderStats,
  recentProducts,
  userRole,
}: RetailDashboardProps) {
  const canWrite = userRole === "owner" || userRole === "manager" || userRole === "platform_admin";

  return (
    <div className="space-y-6">
      {/* Banner Superior HORIZON — Módulo Retail */}
      <section className="relative overflow-hidden rounded-2xl border border-[#CFC5FA] dark:border-[#2E2556] bg-gradient-to-br from-[#FBF9FF] via-[#F2EEFC] to-[#E5DDFB] dark:from-[#0E101E] dark:via-[#14132C] dark:to-[#221445] p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-[0_12px_32px_-16px_rgba(91,70,229,0.25)]">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-[0.14em] bg-white/80 dark:bg-white/10 border border-[#CFC5FA] dark:border-white/15 text-[#5B46E5] dark:text-[#B9A4FF]">
            <Store className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Comercial Retail · {store.storeName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#111022] dark:text-white tracking-tight">
            Catálogo & Gestão de Produtos
          </h1>
          <p className="text-xs sm:text-sm text-[#413B5C] dark:text-[#C5C0DD] leading-relaxed">
            Administre produtos, variantes, imagens e níveis de estoque da sua loja mantendo o isolamento completo por estabelecimento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {canWrite && (
            <Link
              href="/dashboard/retail/pedidos"
              prefetch={false}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-[#6C4EF2] to-[#5638DC] dark:from-[#9F7EFF] dark:to-[#7D5CFA] text-white dark:text-[#110D22] text-xs sm:text-[13px] font-semibold shadow-sm hover:brightness-105 transition-all"
            >
              <ClipboardList className="w-4 h-4" aria-hidden="true" />
              <span>
                Pedidos{orderStats && orderStats.requestedOrders > 0 ? ` (${orderStats.requestedOrders})` : ""}
              </span>
            </Link>
          )}
          {canWrite && (
            <Link
              href="/dashboard/retail/produtos/novo"
              prefetch={false}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white/85 dark:bg-white/[0.08] border border-[#CFC5FA] dark:border-white/15 text-[#111022] dark:text-white hover:bg-white dark:hover:bg-white/15 transition-colors"
            >
              <Plus className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Novo Produto</span>
            </Link>
          )}
          <Link
            href="/dashboard/retail/categorias"
            prefetch={false}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white/85 dark:bg-white/[0.08] border border-[#CFC5FA] dark:border-white/15 text-[#111022] dark:text-white hover:bg-white dark:hover:bg-white/15 transition-colors"
          >
            <Tag className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Categorias</span>
          </Link>
          {store.slug && store.isActive && (
            <a
              href={`/loja/${store.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white/85 dark:bg-white/[0.08] border border-[#CFC5FA] dark:border-white/15 text-[#111022] dark:text-white hover:bg-white dark:hover:bg-white/15 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Vitrine</span>
            </a>
          )}
          {canWrite && (
            <Link
              href="/dashboard/retail/configuracoes"
              prefetch={false}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white/85 dark:bg-white/[0.08] border border-[#CFC5FA] dark:border-white/15 text-[#111022] dark:text-white hover:bg-white dark:hover:bg-white/15 transition-colors"
              title="Configurações Operacionais da Loja"
            >
              <Settings className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Operação</span>
            </Link>
          )}
        </div>
      </section>

      {/* Grid de KPIs Reutilizáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          highlighted
          title="Publicados (Ativos)"
          value={stats.publishedProducts}
          unit="ativos"
          icon={<CheckCircle2 className="w-4 h-4" />}
          description={`De ${stats.totalProducts} produtos no catálogo`}
          href="/dashboard/retail/produtos?status=published"
        />
        <KpiCard
          title="Total no Catálogo"
          value={stats.totalProducts}
          unit="itens"
          icon={<Package className="w-4 h-4" />}
          description={`${stats.totalCategories} categorias ativas`}
          href="/dashboard/retail/produtos"
        />
        <KpiCard
          title="Em Rascunho"
          value={stats.draftProducts}
          icon={<FileEdit className="w-4 h-4" />}
          badge={
            stats.draftProducts > 0
              ? { label: "Revisar", tone: "warning" }
              : { label: "Em dia", tone: "neutral" }
          }
          description="Edição interna em andamento"
          href="/dashboard/retail/produtos?status=draft"
        />
        <KpiCard
          title="Sem Estoque"
          value={stats.outOfStockProducts}
          icon={<AlertTriangle className="w-4 h-4" />}
          badge={
            stats.outOfStockProducts > 0
              ? { label: "Reposição", tone: "danger" }
              : { label: "Regular", tone: "success" }
          }
          description="Variantes zeradas no estoque"
          href="/dashboard/retail/produtos"
        />
      </div>

      {/* Seção de Produtos Recentes com DataTable Unificada */}
      <section className="rounded-2xl bg-surface border border-surface-border overflow-hidden shadow-[var(--shadow-card)]">
        <div className="p-5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold font-display text-foreground">
              Produtos Recentes
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Últimas adições e atualizações do catálogo comercial
            </p>
          </div>
          <Link
            href="/dashboard/retail/produtos"
            prefetch={false}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <span>Ver todo o catálogo</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recentProducts.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="text-sm font-medium">Nenhum produto cadastrado no catálogo.</p>
            <p className="text-xs mt-1">
              Clique em &quot;Novo Produto&quot; para iniciar seu catálogo comercial.
            </p>
          </div>
        ) : (
          <DataTable embedded ariaLabel="Produtos recentes do catálogo">
            <thead className="bg-surface-muted/50 text-foreground-muted font-mono uppercase text-[10px] tracking-wider border-b border-surface-border">
              <tr>
                <th className="py-3 px-5">Produto</th>
                <th className="py-3 px-4">Categorias</th>
                <th className="py-3 px-4">Preço</th>
                <th className="py-3 px-4">Estoque Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-xs">
              {recentProducts.map((p) => {
                const statusMap: Record<string, { status: "active" | "pending" | "suspended"; label: string }> = {
                  published: { status: "active", label: "Publicado" },
                  draft: { status: "pending", label: "Rascunho" },
                  archived: { status: "suspended", label: "Arquivado" },
                };
                const st = statusMap[p.status] || statusMap.draft;

                return (
                  <tr key={p.id} className="hover:bg-surface-muted/40 transition-colors">
                    <td data-label="Produto" className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        {p.primaryImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={p.primaryImage.publicUrl}
                            alt={p.primaryImage.altText || p.name}
                            className="w-10 h-10 rounded-lg object-cover bg-surface-muted shrink-0 border border-surface-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-surface-muted flex items-center justify-center shrink-0 border border-surface-border text-foreground-muted">
                            <Package className="w-5 h-5 opacity-40" aria-hidden="true" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/retail/produtos/${p.id}`}
                            prefetch={false}
                            className="font-semibold text-foreground hover:text-accent transition-colors block truncate"
                          >
                            {p.name}
                          </Link>
                          <span className="block font-mono text-[11px] text-foreground-muted truncate">
                            /{p.slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td data-label="Categorias" className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 justify-end sm:justify-start">
                        {p.categories.length > 0 ? (
                          p.categories.map((c) => (
                            <span
                              key={c.id}
                              className="px-2 py-0.5 rounded-full text-[10px] bg-surface-muted border border-surface-border text-foreground-muted font-medium"
                            >
                              {c.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-foreground-muted italic text-[11px]">
                            Sem categoria
                          </span>
                        )}
                      </div>
                    </td>

                    <td data-label="Preço" className="py-3.5 px-4 font-mono font-medium text-foreground tabular-nums">
                      {p.minPriceCents === p.maxPriceCents
                        ? ProductInvariants.formatCentsToCurrency(p.minPriceCents, store.currency)
                        : `${ProductInvariants.formatCentsToCurrency(
                            p.minPriceCents,
                            store.currency
                          )} – ${ProductInvariants.formatCentsToCurrency(
                            p.maxPriceCents,
                            store.currency
                          )}`}
                    </td>

                    <td data-label="Estoque Total" className="py-3.5 px-4 font-mono tabular-nums">
                      <span
                        className={`font-semibold ${
                          p.totalStock === 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                        }`}
                      >
                        {p.totalStock} un
                      </span>
                    </td>

                    <td data-label="Status" className="py-3.5 px-4">
                      <StatusBadge status={st.status} label={st.label} />
                    </td>

                    <td data-label="Ação" className="py-3.5 px-5 text-right">
                      <Link
                        href={`/dashboard/retail/produtos/${p.id}`}
                        prefetch={false}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-accent/10 hover:text-accent border border-surface-border transition-colors text-foreground"
                      >
                        <span>Gerenciar</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </section>
    </div>
  );
}
