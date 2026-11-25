"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, PieChart, ArrowUpRight, Package } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { RetailCategoryDistributionItem } from "@/modules/retail/types/retail.types";

/**
 * Contrato preparado para métricas comerciais da futura Fase 6C.
 * Nunca exibe valores fictícios enquanto `available` for falso.
 */
export interface FutureCommerceMetricsContract {
  ordersCount?: number;
  revenueCents?: number;
  available: boolean;
}

interface CategoryDistributionChartProps {
  items: RetailCategoryDistributionItem[];
  totalProducts: number;
  retailActive: boolean;
}

/**
 * Gráfico de barras em SVG leve para distribuição real de produtos por categoria.
 */
export function CategoryDistributionChart({
  items,
  totalProducts,
  retailActive,
}: CategoryDistributionChartProps) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const topItems = React.useMemo(() => items.slice(0, 6), [items]);
  const maxValue = React.useMemo(
    () => Math.max(1, ...topItems.map((i) => i.productCount)),
    [topItems]
  );

  return (
    <section
      aria-label="Distribuição de produtos por categoria"
      className="rounded-2xl border border-surface-border bg-surface p-5 flex flex-col justify-between gap-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-[10px] bg-surface-muted border border-surface-border flex items-center justify-center text-accent shrink-0">
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-foreground tracking-tight truncate">
              Produtos por Categoria
            </h3>
            <p className="text-[11px] text-foreground-muted truncate">
              Distribuição real do catálogo ativo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 tabular-nums">
            {totalProducts} prod.
          </span>
          <InfoTooltip
            label="Sobre o gráfico de categorias"
            content="Exibe a contagem real de produtos vinculados a cada categoria ativa do estabelecimento."
          />
        </div>
      </div>

      {!retailActive ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-xs font-medium text-foreground-muted">
            Módulo Retail desativado nesta unidade.
          </p>
          <Link
            href="/dashboard/retail"
            prefetch={false}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <span>Acessar painel Retail</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : topItems.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <Package className="w-7 h-7 mx-auto text-foreground-muted/40" aria-hidden="true" />
          <p className="text-xs font-medium text-foreground-muted">
            Nenhuma categoria ativa cadastrada ainda.
          </p>
          <Link
            href="/dashboard/retail/categorias"
            prefetch={false}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <span>Criar primeira categoria</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tooltip de destaque dinâmico sem sobrepor eixos */}
          <div className="h-6 flex items-center justify-between text-[11px]">
            {hoveredIdx !== null && topItems[hoveredIdx] ? (
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-surface-muted border border-surface-border text-foreground font-medium">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="truncate max-w-[160px]">{topItems[hoveredIdx].name}:</span>
                <strong className="font-mono tabular-nums">
                  {topItems[hoveredIdx].productCount}{" "}
                  {topItems[hoveredIdx].productCount === 1 ? "produto" : "produtos"}
                </strong>
              </div>
            ) : (
              <span className="text-foreground-muted">
                Passe o cursor ou navegue nas barras para detalhar
              </span>
            )}
            <span className="font-mono text-[10px] text-foreground-muted tabular-nums">
              Máx: {maxValue}
            </span>
          </div>

          {/* Gráfico de Barras Vertical */}
          <div className="w-full">
            <div
              className="grid gap-2 sm:gap-3 items-end h-[148px] pt-3 pb-1 border-b border-surface-border"
              style={{
                gridTemplateColumns: `repeat(${Math.max(topItems.length, 1)}, minmax(0, 1fr))`,
              }}
            >
              {topItems.map((item, idx) => {
                const ratio = item.productCount > 0 ? item.productCount / maxValue : 0;
                const heightPct = item.productCount > 0 ? Math.max(16, Math.round(ratio * 100)) : 4;
                const isActive = hoveredIdx === idx;

                return (
                  <button
                    key={item.categoryId}
                    type="button"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onFocus={() => setHoveredIdx(idx)}
                    onBlur={() => setHoveredIdx(null)}
                    aria-label={`${item.name}: ${item.productCount} produtos`}
                    className="group h-full flex flex-col items-center justify-end gap-1 focus-visible:outline-none cursor-pointer"
                  >
                    <span
                      className={`font-mono text-[10px] tabular-nums transition-opacity ${
                        isActive
                          ? "text-foreground font-bold opacity-100"
                          : "text-foreground-muted opacity-80"
                      }`}
                    >
                      {item.productCount}
                    </span>
                    <div
                      className={`w-full max-w-[44px] rounded-t-lg transition-all duration-200 ${
                        item.productCount === 0
                          ? "bg-surface-muted border border-surface-border"
                          : isActive
                          ? "bg-gradient-to-b from-[#A782FF] to-[#5B46E5] ring-2 ring-accent/40"
                          : "bg-gradient-to-b from-[#8F74FA] to-[#5B46E5]/85 dark:from-[#9F85FF] dark:to-[#6549E8]"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </button>
                );
              })}
            </div>

            <div
              className="grid gap-2 sm:gap-3 pt-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(topItems.length, 1)}, minmax(0, 1fr))`,
              }}
            >
              {topItems.map((item, idx) => (
                <span
                  key={item.categoryId}
                  title={item.name}
                  className={`text-[11px] text-center truncate px-1 ${
                    hoveredIdx === idx
                      ? "text-foreground font-semibold"
                      : "text-foreground-muted"
                  }`}
                >
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface StatusSlice {
  label: string;
  count: number;
  color: string;
}

interface CatalogStatusDonutChartProps {
  title: string;
  subtitle: string;
  centerLabel: string;
  slices: StatusSlice[];
  href?: string;
  tooltip: string;
}

/**
 * Gráfico Donut leve em SVG para distribuição real de status do catálogo ou composição da equipe.
 */
export function CatalogStatusDonutChart({
  title,
  subtitle,
  centerLabel,
  slices,
  href,
  tooltip,
}: CatalogStatusDonutChartProps) {
  const total = slices.reduce((acc, s) => acc + s.count, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-surface-border bg-surface p-5 flex flex-col justify-between gap-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-[10px] bg-surface-muted border border-surface-border flex items-center justify-center text-accent shrink-0">
            <PieChart className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-foreground tracking-tight truncate">
              {title}
            </h3>
            <p className="text-[11px] text-foreground-muted truncate">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <InfoTooltip label={`Sobre ${title}`} content={tooltip} />
          {href && (
            <Link
              href={href}
              prefetch={false}
              aria-label={`Ver detalhes de ${title}`}
              className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center space-y-1.5">
          <p className="text-xs font-medium text-foreground-muted">
            Sem itens registrados para exibir a distribuição.
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
          <div className="relative w-[124px] h-[124px] shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="currentColor"
                className="text-surface-muted"
                strokeWidth="16"
              />
              {slices
                .filter((s) => s.count > 0)
                .map((slice) => {
                  const pct = slice.count / total;
                  const dashLength = pct * circumference;
                  const dashOffset = -cumulativeOffset;
                  cumulativeOffset += dashLength;

                  return (
                    <circle
                      key={slice.label}
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="16"
                      strokeDasharray={`${dashLength} ${circumference}`}
                      strokeDashoffset={dashOffset}
                    />
                  );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display text-xl font-bold text-foreground tabular-nums leading-none">
                {total}
              </span>
              <span className="text-[10px] text-foreground-muted mt-0.5">
                {centerLabel}
              </span>
            </div>
          </div>

          <ul className="w-full space-y-2.5 text-xs">
            {slices.map((slice) => {
              const pct = total > 0 ? Math.round((slice.count / total) * 100) : 0;
              return (
                <li key={slice.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden="true"
                    />
                    <span className="text-foreground truncate">{slice.label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] shrink-0 tabular-nums">
                    <span className="font-semibold text-foreground">{slice.count}</span>
                    <span className="text-foreground-muted w-9 text-right">{pct}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
