"use client";

import * as React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeMode } from "./theme-provider";

interface ThemeToggleProps {
  compact?: boolean;
  onDarkSurface?: boolean;
  variant?: "default" | "horizon";
}

export function ThemeToggle({
  compact = false,
  onDarkSurface = false,
  variant = "default",
}: ThemeToggleProps) {
  const { mode, setMode } = useTheme();

  const options: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  if (variant === "horizon") {
    return (
      <div
        role="group"
        aria-label="Alternar tema de aparência"
        className="inline-flex items-center gap-1 p-1 rounded-full border border-[#7C5CFA]/25 dark:border-white/15 bg-white/75 dark:bg-[#121024]/70 backdrop-blur-md shadow-[0_4px_24px_rgba(11,11,18,0.18)]"
      >
        {options.map(({ value, label, icon: Icon }) => {
          const isActive = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={isActive}
              aria-label={`Tema ${label}`}
              title={`Tema ${label}`}
              className={`inline-flex items-center justify-center w-8 h-7 sm:w-9 sm:h-7 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A782FF] ${
                isActive
                  ? "bg-[#7C5CFA] dark:bg-[#7B58EB] text-white shadow-[0_0_14px_rgba(167,130,255,0.65)]"
                  : "text-[#4A4568] dark:text-white/65 hover:text-[#121024] dark:hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Alternar tema de aparência"
      className={`inline-flex items-center p-0.5 rounded-lg border ${
        onDarkSurface
          ? "border-white/15 bg-white/8"
          : "border-surface-border bg-surface-muted/75"
      }`}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const isActive = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={isActive}
            aria-label={`Tema ${label}`}
            title={`Tema ${label}`}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[12px] font-medium transition-colors ${
              isActive
                ? onDarkSurface
                  ? "bg-white/15 text-white shadow-sm"
                  : "bg-surface text-foreground shadow-sm border border-surface-border/70"
                : onDarkSurface
                ? "text-white/65 hover:text-white border border-transparent"
                : "text-foreground-muted hover:text-foreground border border-transparent"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {!compact && <span className="hidden sm:inline">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
