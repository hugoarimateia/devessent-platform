import * as React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  embedded?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  embedded = false,
}: EmptyStateProps) {
  return (
    <div
      className={`p-8 sm:p-10 text-center space-y-3 ${
        embedded ? "" : "rounded-xl border border-surface-border bg-surface"
      }`}
    >
      {icon && (
        <div className="w-11 h-11 rounded-[10px] bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mx-auto">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
        <p className="text-[13px] text-foreground-muted max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
