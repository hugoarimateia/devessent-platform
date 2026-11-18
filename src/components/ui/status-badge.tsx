import * as React from "react";
import { CheckCircle2, PauseCircle, Clock, Ban, CircleDot } from "lucide-react";

export type StatusBadgeVariant = "active" | "suspended" | "pending" | "expired" | "revoked" | "neutral";

interface StatusBadgeProps {
  status: StatusBadgeVariant | string;
  label?: string;
}

const STATUS_CONFIG: Record<
  string,
  {
    defaultLabel: string;
    classes: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  active: {
    defaultLabel: "Ativo",
    classes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    Icon: CheckCircle2,
  },
  suspended: {
    defaultLabel: "Suspenso",
    classes: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25",
    Icon: PauseCircle,
  },
  pending: {
    defaultLabel: "Pendente",
    classes: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25",
    Icon: Clock,
  },
  expired: {
    defaultLabel: "Expirado",
    classes: "bg-surface-muted text-foreground-muted border-surface-border",
    Icon: Clock,
  },
  revoked: {
    defaultLabel: "Revogado",
    classes: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    Icon: Ban,
  },
  neutral: {
    defaultLabel: "Padrão",
    classes: "bg-surface-muted text-foreground-muted border-surface-border",
    Icon: CircleDot,
  },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.neutral;
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[12px] font-semibold border leading-snug ${cfg.classes}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{label || cfg.defaultLabel}</span>
    </span>
  );
}
