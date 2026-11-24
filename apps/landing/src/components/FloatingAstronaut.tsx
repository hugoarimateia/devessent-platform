"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { SITE_CONFIG } from "@/config/site";
import { EssentOctagonBadge, TechSlantedBars } from "./TechDecor";

/**
 * Astronauta Protagonista — Animação Flutuante Contínua + Parallax Discreto + Hover
 * - Preserva 100% o asset oficial da marca com fetchPriority="high" para LCP
 * - Camada externa de parallax ao scroll (CSS Scroll-Driven Animation compositor-only)
 * - Escala responsiva refinada para encaixar em notebooks 1280×720 sem empurrar EXPLORAR
 */
export function FloatingAstronaut() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !containerRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;

    setParallax({
      x: Number((relX * 8).toFixed(2)),
      y: Number((relY * 6).toFixed(2)),
    });
  };

  const handlePointerLeave = () => {
    setParallax({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="de-hero-parallax-astro group/astro relative mx-auto w-full max-w-[520px] select-none lg:mx-0 lg:max-w-[500px] xl:max-w-[540px] [@media(min-height:820px)]:xl:max-w-[640px]"
    >
      {/* Brilho atmosférico radial lilás controlado */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#A782FF]/14 blur-[64px] transition-all duration-700 ease-out group-hover/astro:scale-105 group-hover/astro:bg-[#B695FF]/22"
      />

      {/* Linhas orbitais sutis de fundo com leve deslocamento de profundidade */}
      <div
        aria-hidden="true"
        style={{
          transform: `translate3d(${parallax.x * -0.5}px, ${parallax.y * -0.5}px, 0)`,
        }}
        className="pointer-events-none absolute inset-0 transition-transform duration-500 ease-out"
      >
        <svg
          viewBox="0 0 770 504"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full opacity-55 transition-opacity duration-700 group-hover/astro:opacity-85"
        >
          <ellipse
            cx="370"
            cy="265"
            rx="245"
            ry="205"
            stroke="#A782FF"
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <path
            d="M 118 338 A 275 235 0 0 1 560 95"
            stroke="#B695FF"
            strokeOpacity="0.34"
            strokeWidth="1.2"
          />
          <circle
            cx="154"
            cy="242"
            r="3"
            fill="#B695FF"
            className="animate-hud-pulse"
          />
          <circle
            cx="522"
            cy="108"
            r="2.5"
            fill="#E9E7DF"
            fillOpacity="0.7"
          />
        </svg>
      </div>

      {/* WRAPPER 1 (EXTERNO): Flutuação contínua */}
      <div className="animate-astronaut-float relative aspect-[770/504] w-full overflow-visible">
        {/* WRAPPER 2 (INTERNO): Zoom suave no hover */}
        <div
          style={{
            transform:
              parallax.x !== 0 || parallax.y !== 0
                ? `translate3d(${parallax.x * 0.35}px, ${parallax.y * 0.35}px, 0)`
                : undefined,
          }}
          className="relative h-full w-full origin-center transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/astro:scale-[1.045]"
        >
          <Image
            src="/images/astronaut-hero.webp"
            alt="Astronauta em traje escuro com visor digital iluminado em tons de lilás e branco, protagonista visual da identidade DevEssent."
            width={770}
            height={504}
            priority
            fetchPriority="high"
            unoptimized
            sizes="(max-width: 768px) 92vw, (max-width: 1280px) 46vw, 650px"
            className="h-full w-full object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.78)] transition-[filter] duration-700 group-hover/astro:drop-shadow-[0_22px_48px_rgba(167,130,255,0.26)]"
          />

          {/* Luminosidade sutil no visor do astronauta */}
          <div
            aria-hidden="true"
            className="animate-visor-shimmer pointer-events-none absolute top-[18.5%] left-[34.5%] h-[29.5%] w-[27.5%] rounded-full bg-gradient-to-tr from-[#A782FF]/20 via-transparent to-[#E9E7DF]/24 mix-blend-screen blur-md transition-opacity duration-700 group-hover/astro:opacity-60"
          />
        </div>

        {/* HUD Superior Esquerdo: Marcador Técnico [782] */}
        <div
          aria-hidden="true"
          style={{
            transform: `translate3d(${parallax.x * 0.45}px, ${parallax.y * 0.45}px, 0)`,
          }}
          className="absolute top-[4.8%] left-[12.5%] flex items-center justify-center rounded-[4px] border border-[#E9E7DF]/60 bg-[#0E0C16]/90 px-1.5 py-2 shadow-[0_0_12px_rgba(167,130,255,0.2)] transition-transform duration-500 ease-out"
        >
          <span className="animate-hud-pulse font-tech text-[0.58rem] leading-none font-semibold tracking-[0.18em] text-[#E9E7DF] [writing-mode:vertical-rl] rotate-180 sm:text-[0.64rem]">
            782
          </span>
        </div>

        {/* Coluna HUD Direita: Selo Octogonal 本質 / ESSENT + Barras ////// + Indicadores */}
        <div
          style={{
            transform: `translate3d(${parallax.x * 0.55}px, ${parallax.y * 0.55}px, 0)`,
          }}
          className="absolute top-[6%] right-[1%] z-20 flex origin-top-right scale-[0.66] flex-col items-start transition-transform duration-500 ease-out sm:top-[8.5%] sm:right-[2%] sm:scale-[0.86] xl:scale-95"
        >
          <EssentOctagonBadge
            subtitle="ESSENT"
            className="h-[118px] w-[108px] sm:h-[130px] sm:w-[120px] lg:h-[138px] lg:w-[128px]"
          />

          <div className="mt-2.5 pl-1 sm:mt-3">
            <TechSlantedBars
              variant="all-filled"
              className="h-2 w-auto opacity-90 sm:h-2.5"
            />
          </div>

          <ul
            aria-label="Áreas de atuação técnica"
            className="mt-2.5 space-y-1 pl-1 sm:mt-3 sm:space-y-1.5"
          >
            {SITE_CONFIG.heroTechList.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 font-sans text-[0.64rem] font-medium tracking-[0.18em] text-[#E9E7DF]/90 uppercase sm:text-[0.7rem]"
              >
                <span
                  aria-hidden="true"
                  className="font-semibold text-[#B695FF]"
                >
                  {"//"}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
