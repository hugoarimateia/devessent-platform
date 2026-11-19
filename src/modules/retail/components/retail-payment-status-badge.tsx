import * as React from "react";
import type { RetailPaymentStatus } from "../types/retail.types";
import { PAYMENT_STATUS_PRESENTATION } from "../domain/payment-invariants";

const TONE_CLASSES: Record<
  "neutral" | "info" | "success" | "warning" | "danger",
  string
> = {
  neutral:
    "bg-surface-muted text-foreground-muted border-surface-border",
  info:
    "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25",
  success:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  warning:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
  danger:
    "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25",
};

export function RetailPaymentStatusBadge({
  status = "not_started",
  showFullLabel = false,
}: {
  status?: RetailPaymentStatus;
  showFullLabel?: boolean;
}) {
  const meta =
    PAYMENT_STATUS_PRESENTATION[status] || PAYMENT_STATUS_PRESENTATION.not_started;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
        TONE_CLASSES[meta.tone]
      }`}
    >
      {showFullLabel ? meta.label : meta.shortLabel}
    </span>
  );
}
