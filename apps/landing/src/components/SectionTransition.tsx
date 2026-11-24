import React from "react";

interface SectionTransitionProps {
  number: string;
  code: string;
  label: string;
}

/**
 * Índice Editorial Discreto de Seção (substitui divisores pesados e evita cabeçalhos duplicados).
 */
export function SectionTransition({
  number,
  code,
  label,
}: SectionTransitionProps) {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#A782FF]/45 bg-[#161124]/85 font-tech text-[10px] font-bold text-[#B695FF]">
          {number}
        </span>
        <span className="font-tech text-[10px] tracking-[0.28em] text-[#B695FF]/90 uppercase">
          {code}
        </span>
      </div>

      <div className="h-[1px] flex-1 bg-gradient-to-r from-[#A782FF]/35 via-[#E9E7DF]/10 to-transparent" />

      <span className="hidden font-tech text-[10px] tracking-[0.24em] text-[#BAB5C5]/55 uppercase sm:inline">
        {label}
      </span>
    </div>
  );
}
