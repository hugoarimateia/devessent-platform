import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export interface KpiCardProps {
  title: string;
  value: string | number | null | undefined;
  unit?: string;
  icon: React.ReactNode;
  description?: string;
  badge?: {
    label: string;
    tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  };
  highlighted?: boolean;
  loading?: boolean;
  emptyLabel?: string;
  tooltip?: string;
  href?: string;
  hasPermission?: boolean;
}

/**
 * Componente reutilizável de Indicador KPI (Fase 6B.1).
 * Suporta destaque violeta opcional (para KPI principal), estados vazios e de carregamento,
 * verificação de permissão e navegação contextual sem exibir números inventados.
 */
export function KpiCard({
  title,
  value,
  unit,
  icon,
  description,
  badge,
  highlighted = false,
  loading = false,
  emptyLabel = "Sem dados",
  tooltip,
  href,
  hasPermission = true,
}: KpiCardProps) {
  if (!hasPermission) {
    return null;
  }

  const hasValue = value !== null && value !== undefined && value !== "";

  const badgeToneClasses: Record<
    NonNullable<NonNullable<KpiCardProps["badge"]>["tone"]>,
    string
  > = {
    neutral: highlighted
      ? "bg-white/15 text-white border-white/20"
      : "bg-surface-muted text-foreground-muted border-surface-border",
    success: highlighted
      ? "bg-emerald-400/20 text-emerald-100 border-emerald-300/30"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    warning: highlighted
      ? "bg-amber-400/20 text-amber-100 border-amber-300/30"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    danger: highlighted
      ? "bg-red-400/20 text-red-100 border-red-300/30"
      : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    accent: highlighted
      ? "bg-white/20 text-white border-white/25"
      : "bg-accent/10 text-accent border-accent/25",
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-label={`Carregando indicador ${title}`}
        className="rounded-2xl border border-surface-border bg-surface p-4 sm:p-5 space-y-3 animate-pulse"
      >
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-24 rounded bg-surface-muted" />
          <div className="h-8 w-8 rounded-lg bg-surface-muted" />
        </div>
        <div className="h-7 w-16 rounded bg-surface-muted" />
        <div className="h-3 w-32 rounded bg-surface-muted" />
      </div>
    );
  }

  const cardSurfaceClasses = highlighted
    ? "relative rounded-2xl border border-[#7456F1]/55 dark:border-[#9478FF]/45 bg-gradient-to-br from-[#6247EA] via-[#6D52EF] to-[#4A32BE] dark:from-[#5D43DE] dark:via-[#4930B8] dark:to-[#291B6B] text-white shadow-[0_12px_28px_-10px_rgba(91,70,229,0.45)]"
    : "relative rounded-2xl border border-surface-border bg-surface text-foreground hover:border-[#7C5CFA]/40 dark:hover:border-[#9A8DF7]/35 transition-colors shadow-[var(--shadow-card)]";

  return (
    <article className={`${cardSurfaceClasses} p-4 sm:p-5 flex flex-col justify-between gap-3`}>
      {highlighted && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden opacity-35 bg-[radial-gradient(65%_65%_at_95%_10%,rgba(255,255,255,0.32)_0%,transparent_70%)]"
        />
      )}

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 border ${
              highlighted
                ? "bg-white/15 border-white/25 text-white"
                : "bg-surface-muted/80 border-surface-border text-accent"
            }`}
            aria-hidden="true"
          >
            {icon}
          </span>
          <h3
            className={`text-xs font-semibold tracking-tight leading-snug ${
              highlighted ? "text-white/95" : "text-foreground-muted"
            }`}
          >
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {tooltip && (
            <InfoTooltip
              label={`Mais informações sobre ${title}`}
              content={tooltip}
              className={highlighted ? "text-white" : "text-foreground-muted"}
            />
          )}
          {href && (
            <Link
              href={href}
              prefetch={false}
              aria-label={`Abrir ${title}`}
              className={`inline-flex items-center justify-center w-6 h-6 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                highlighted
                  ? "text-white/80 hover:text-white hover:bg-white/15"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      <div className="relative z-10 space-y-1.5">
        <div className="flex items-baseline flex-wrap gap-2">
          <span
            className={`font-display text-2xl sm:text-[1.75rem] font-bold tracking-tight tabular-nums leading-none ${
              highlighted ? "text-white" : "text-foreground"
            }`}
          >
            {hasValue ? value : emptyLabel}
          </span>
          {hasValue && unit && (
            <span
              className={`text-xs font-medium ${
                highlighted ? "text-white/80" : "text-foreground-muted"
              }`}
            >
              {unit}
            </span>
          )}
          {badge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                badgeToneClasses[badge.tone || "neutral"]
              }`}
            >
              {badge.label}
            </span>
          )}
        </div>

        {description && (
          <p
            className={`text-[11px] leading-snug truncate ${
              highlighted ? "text-white/80" : "text-foreground-muted"
            }`}
          >
            {description}
          </p>
        )}
      </div>
    </article>
  );
}
