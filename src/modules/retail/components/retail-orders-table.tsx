"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  MapPin,
  PackageCheck,
} from "lucide-react";
import type {
  RetailOrder,
  RetailOrderStats,
  RetailOrderStatus,
} from "../types/retail.types";
import { ProductInvariants } from "../domain/product-invariants";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RetailOrderStatusBadge } from "./retail-order-status-badge";

interface RetailOrdersTableProps {
  orders: RetailOrder[];
  stats: RetailOrderStats;
  currency: string;
  totalCount: number;
  page: number;
  totalPages: number;
  activeStatus: RetailOrderStatus | "all";
  activeSearch: string;
}

const STATUS_FILTER_TABS: Array<{ value: RetailOrderStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "requested", label: "Solicitados" },
  { value: "confirmed", label: "Confirmados" },
  { value: "preparing", label: "Em preparo" },
  { value: "ready", label: "Prontos" },
  { value: "completed", label: "Concluídos" },
  { value: "cancelled", label: "Cancelados" },
];

export function RetailOrdersTable({
  orders,
  stats,
  currency,
  totalCount,
  page,
  totalPages,
  activeStatus,
  activeSearch,
}: RetailOrdersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = React.useState(activeSearch);

  const navigateWithParams = (updates: {
    status?: string;
    search?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.status !== undefined) {
      if (updates.status === "all" || !updates.status) params.delete("status");
      else params.set("status", updates.status);
      params.delete("page");
    }
    if (updates.search !== undefined) {
      if (!updates.search.trim()) params.delete("search");
      else params.set("search", updates.search.trim());
      params.delete("page");
    }
    if (updates.page !== undefined) {
      if (updates.page <= 1) params.delete("page");
      else params.set("page", String(updates.page));
    }
    const qs = params.toString();
    router.push(qs ? `/dashboard/retail/pedidos?${qs}` : "/dashboard/retail/pedidos");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateWithParams({ search: searchValue });
  };

  return (
    <div className="space-y-6">
      {/* KPIs Reais de Pedidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          highlighted
          title="Aguardando Confirmação"
          value={stats.requestedOrders}
          unit="pedidos"
          icon={<ClipboardList className="w-4 h-4" />}
          badge={
            stats.requestedOrders > 0
              ? { label: "Analisar", tone: "warning" }
              : { label: "Em dia", tone: "success" }
          }
          description={`${ProductInvariants.formatCentsToCurrency(stats.requestedSubtotalCents, currency)} solicitados`}
          href="/dashboard/retail/pedidos?status=requested"
        />
        <KpiCard
          title="Confirmados / Em Andamento"
          value={stats.inProgressOrders}
          unit="ativos"
          icon={<PackageCheck className="w-4 h-4" />}
          description="Confirmados, em preparo ou prontos"
          href="/dashboard/retail/pedidos?status=confirmed"
        />
        <KpiCard
          title="Total Confirmado (Pedidos)"
          value={ProductInvariants.formatCentsToCurrency(stats.confirmedTotalCents, currency)}
          icon={<ClipboardList className="w-4 h-4" />}
          description="Soma de pedidos com estoque validado (sem pagamento online)"
        />
        <KpiCard
          title="Histórico Total"
          value={stats.totalOrders}
          unit="registros"
          icon={<ClipboardList className="w-4 h-4" />}
          description={`${stats.completedOrders} concluídos · ${stats.cancelledOrders} cancelados`}
          href="/dashboard/retail/pedidos"
        />
      </div>

      {/* Painel Filtros + Tabela */}
      <section className="rounded-2xl bg-surface border border-surface-border overflow-hidden shadow-[var(--shadow-card)]">
        <div className="p-5 border-b border-surface-border space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold font-display text-foreground">
                Fila de Solicitações & Pedidos
              </h2>
              <p className="text-xs text-foreground-muted mt-0.5">
                {totalCount} {totalCount === 1 ? "pedido encontrado" : "pedidos encontrados"} neste estabelecimento
              </p>
            </div>

            <search>
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 sm:w-64 h-9 px-3 rounded-lg bg-surface-muted/60 border border-surface-border focus-within:border-accent">
                  <Search
                    className="w-3.5 h-3.5 text-foreground-muted pointer-events-none shrink-0"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Código, cliente ou telefone..."
                    aria-label="Buscar pedidos por código, cliente ou telefone"
                    className="w-full h-9 bg-transparent text-xs text-foreground focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-surface-muted hover:bg-surface-border/60 border border-surface-border text-foreground transition-colors"
                >
                  Buscar
                </button>
              </form>
            </search>
          </div>

          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por status">
            {STATUS_FILTER_TABS.map((tab) => {
              const active = activeStatus === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => navigateWithParams({ status: tab.value })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    active
                      ? "bg-accent text-white border-accent font-semibold"
                      : "bg-surface-muted/50 text-foreground-muted border-surface-border hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              Nenhum pedido encontrado para os filtros aplicados.
            </p>
            <p className="text-xs mt-1">
              Assim que um cliente enviar uma solicitação pela vitrine pública, ela aparecerá aqui.
            </p>
          </div>
        ) : (
          <DataTable embedded ariaLabel="Lista de pedidos comerciais da loja">
            <thead className="bg-surface-muted/50 text-foreground-muted font-mono uppercase text-[10px] tracking-wider border-b border-surface-border">
              <tr>
                <th className="py-3 px-5">Pedido</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Modalidade</th>
                <th className="py-3 px-4">Total Solicitado</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-xs">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-surface-muted/40 transition-colors">
                  <td data-label="Pedido" className="py-3.5 px-5">
                    <Link
                      href={`/dashboard/retail/pedidos/${order.id}`}
                      className="font-mono font-bold text-foreground hover:text-accent transition-colors"
                    >
                      {order.orderNumber}
                    </Link>
                    <span className="block text-[11px] text-foreground-muted mt-0.5">
                      {new Date(order.createdAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                      {order.itemCount !== undefined ? ` · ${order.itemCount} un` : ""}
                    </span>
                  </td>

                  <td data-label="Cliente" className="py-3.5 px-4">
                    <span className="font-semibold text-foreground block">{order.customerName}</span>
                    <span className="text-[11px] font-mono text-foreground-muted">
                      {order.customerPhone}
                    </span>
                  </td>

                  <td data-label="Modalidade" className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-foreground-muted">
                      {order.deliveryMode === "delivery" ? (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                          <span>Entrega</span>
                        </>
                      ) : (
                        <>
                          <PackageCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          <span>Retirada</span>
                        </>
                      )}
                    </span>
                  </td>

                  <td
                    data-label="Total Solicitado"
                    className="py-3.5 px-4 font-mono font-semibold text-foreground tabular-nums"
                  >
                    {ProductInvariants.formatCentsToCurrency(order.totalCents, order.currency)}
                  </td>

                  <td data-label="Status" className="py-3.5 px-4">
                    <RetailOrderStatusBadge status={order.status} />
                  </td>

                  <td data-label="Detalhes" className="py-3.5 px-5 text-right">
                    <Link
                      href={`/dashboard/retail/pedidos/${order.id}`}
                      className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                    >
                      <span>Gerenciar</span>
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-surface-border flex items-center justify-between text-xs text-foreground-muted">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => navigateWithParams({ page: page - 1 })}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-surface-border bg-surface hover:bg-surface-muted disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => navigateWithParams({ page: page + 1 })}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-surface-border bg-surface hover:bg-surface-muted disabled:opacity-40"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
