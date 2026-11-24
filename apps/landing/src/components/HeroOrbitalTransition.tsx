import React from "react";

/**
 * Transição Orbital Contínua — Hero (#inicio) → 01 Nossa Essência (#nossa-essencia)
 * Substitui a linha poligonal rígida e o corte abrupto de container por uma
 * curva geométrica Bézier ultrafina em lilás de baixa intensidade, com
 * dissolução atmosférica contínua e traçado sincronizado ao scroll.
 */
export function HeroOrbitalTransition() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative z-10 -mt-4 h-24 w-full overflow-x-clip sm:-mt-6 sm:h-28 lg:h-32"
    >
      {/* Ponte atmosférica contínua entre o fundo espacial do Hero e Nossa Essência */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 68% 72% at 50% 48%, rgba(167, 130, 255, 0.08) 0%, rgba(22, 17, 36, 0.18) 45%, transparent 78%)",
        }}
      />

      {/* Curva Orbital Bézier Contínua + Arco Secundário de Profundidade */}
      <svg
        viewBox="0 0 1440 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="de-orbit-main" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#A782FF" stopOpacity="0" />
            <stop offset="18%" stopColor="#A782FF" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#B695FF" stopOpacity="0.58" />
            <stop offset="82%" stopColor="#A782FF" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#A782FF" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="de-orbit-echo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E9E7DF" stopOpacity="0" />
            <stop offset="32%" stopColor="#E9E7DF" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#A782FF" stopOpacity="0.22" />
            <stop offset="68%" stopColor="#E9E7DF" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#E9E7DF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Arco secundário muito suave (eco orbital) */}
        <path
          d="M 0 112 C 340 44, 1100 44, 1440 112"
          stroke="url(#de-orbit-echo)"
          strokeWidth="1"
          strokeDasharray="3 7"
        />

        {/* Curva Bézier principal animada no scroll (estática em reduced-motion) */}
        <path
          d="M 0 28 C 320 118, 600 94, 720 74 C 840 54, 1120 30, 1440 114"
          stroke="url(#de-orbit-main)"
          strokeWidth="1.25"
          className="de-orbital-stroke"
        />
      </svg>

      {/* Nó Orbital Central e Guia Vertical Fino conduzindo à Seção 01 */}
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <span className="h-5 w-[1px] bg-gradient-to-b from-transparent to-[#A782FF]/50" />
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-full border border-[#B695FF]/75 bg-[#161124]" />
          <span className="absolute h-1 w-1 rounded-full bg-[#B695FF] animate-hud-pulse" />
        </span>
        <span className="h-9 w-[1px] bg-gradient-to-b from-[#A782FF]/55 to-transparent" />
      </div>
    </div>
  );
}
