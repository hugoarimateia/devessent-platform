import * as React from "react";

interface DataTableProps {
  ariaLabel: string;
  children: React.ReactNode;
  responsiveStack?: boolean;
  embedded?: boolean;
  className?: string;
}

export function DataTable({
  ariaLabel,
  children,
  responsiveStack = true,
  embedded = false,
  className = "",
}: DataTableProps) {
  return (
    <div
      className={`table-wrapper ${
        embedded
          ? "table-embedded bg-transparent"
          : "rounded-xl border border-surface-border bg-surface"
      } ${className}`}
      tabIndex={0}
      role="region"
      aria-label={ariaLabel}
    >
      <table
        className={`w-full text-left border-collapse text-[13px] ${
          responsiveStack ? "responsive-stack" : ""
        }`}
      >
        {children}
      </table>
    </div>
  );
}
