import * as React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

interface AlertBannerProps {
  variant?: "success" | "error" | "warning" | "info";
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
}

export function AlertBanner({
  variant = "info",
  title,
  children,
  onDismiss,
}: AlertBannerProps) {
  const styles = {
    success: {
      container:
        "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300",
      icon: CheckCircle2,
    },
    error: {
      container: "bg-red-500/10 border-red-500/25 text-red-800 dark:text-red-300",
      icon: AlertCircle,
    },
    warning: {
      container:
        "bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300",
      icon: AlertTriangle,
    },
    info: {
      container: "bg-accent/10 border-accent/25 text-foreground",
      icon: Info,
    },
  };

  const cfg = styles[variant];
  const Icon = cfg.icon;

  return (
    <div
      role="alert"
      className={`p-4 rounded-xl border text-xs sm:text-sm flex items-start justify-between gap-3 ${cfg.container}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          {title && <p className="font-semibold">{title}</p>}
          <div className="leading-relaxed">{children}</div>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="text-current opacity-60 hover:opacity-100 p-0.5 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

