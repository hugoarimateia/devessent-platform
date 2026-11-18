import * as React from "react";
import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";

interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <header className="pb-5 border-b border-surface-border space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          {eyebrow && (
            <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent font-semibold">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-[1.75rem] sm:text-[2.25rem] font-bold tracking-[-0.03em] leading-[1.1] text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] sm:text-[14px] text-foreground-muted max-w-[62ch] leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center flex-wrap gap-2.5 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
