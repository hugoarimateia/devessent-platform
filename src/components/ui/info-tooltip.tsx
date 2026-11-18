"use client";

import * as React from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  label: string;
  content: string;
  className?: string;
}

/**
 * Toggletip informativo acessível para KPIs, gráficos e rótulos operacionais.
 * Segue WCAG 1.4.13: acionável por hover, foco de teclado e clique/toque,
 * com descarte via Escape ou clique externo.
 */
export function InfoTooltip({ label, content, className = "" }: InfoTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const tooltipId = React.useId();
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-current/60 hover:text-current hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full right-0 mb-2 w-56 sm:w-64 rounded-xl border border-surface-border bg-surface-elevated text-foreground shadow-elevated px-3 py-2 text-[11px] leading-relaxed z-40 pointer-events-auto"
        >
          {content}
        </div>
      )}
    </div>
  );
}
