"use client";

import React, { useEffect, useState } from "react";

interface ExploreArrowProps {
  targetId?: string;
  label?: string;
}

/**
 * Indicador "EXPLORAR" da primeira dobra.
 * - Área clicável ampla (>= 48px de altura, adequada para mobile e teclado)
 * - Animação vertical discreta de 7px em 2.1s sem clipping em nenhum viewport
 * - Desaparecimento progressivo ao rolar para fora do hero:
 *   • CSS Scroll-Driven Animation nativa (de-explore-scroll-fade) quando suportada
 *   • Fallback leve via requestAnimationFrame passivo em navegadores sem SDA
 * - Respeita integralmente prefers-reduced-motion
 */
export function ExploreArrow({
  targetId = "nossa-essencia",
  label = "EXPLORAR",
}: ExploreArrowProps) {
  const [fallbackOpacity, setFallbackOpacity] = useState<number | null>(null);

  useEffect(() => {
    const prefersMotion = window.matchMedia(
      "(prefers-reduced-motion: no-preference)"
    ).matches;
    if (!prefersMotion) return;

    const supportsSda =
      typeof CSS !== "undefined" &&
      CSS.supports("(animation-timeline: scroll()) and (animation-range: 0% 100%)");

    if (supportsSda) return;

    let rafId = 0;
    const updateOpacity = () => {
      rafId = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / 240));
      setFallbackOpacity(Number((1 - progress).toFixed(3)));
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateOpacity);
      }
    };

    updateOpacity();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);
    if (!target) return;

    e.preventDefault();
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const navbarOffset = 72;
    const elementPosition = target.getBoundingClientRect().top + window.scrollY;
    const offsetPosition = Math.max(0, elementPosition - navbarOffset);

    window.scrollTo({
      top: offsetPosition,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

    target.focus({ preventScroll: true });
  };

  return (
    <div
      className="de-explore-scroll-fade relative z-20 flex justify-center py-1"
      style={
        fallbackOpacity !== null
          ? {
              opacity: fallbackOpacity,
              transform: `translate3d(0, ${((1 - fallbackOpacity) * -10).toFixed(1)}px, 0)`,
              pointerEvents: fallbackOpacity < 0.08 ? "none" : "auto",
            }
          : undefined
      }
    >
      <a
        href={`#${targetId}`}
        onClick={handleClick}
        aria-label="Explorar a seção Nossa Essência"
        className="group inline-flex min-h-[54px] min-w-[132px] flex-col items-center justify-center gap-2 rounded-full px-5 py-2 text-center transition-colors duration-300"
      >
        <span className="font-tech text-[10px] tracking-[0.34em] text-[#BAB5C5]/85 uppercase transition-colors duration-300 group-hover:text-[#E9E7DF]">
          {label}
        </span>

        {/* Pílula orbital vertical com folga interna generosa para o movimento de 7px sem corte */}
        <span className="relative flex h-9 w-7 items-center justify-center rounded-full border border-[#A782FF]/40 bg-[#161124]/75 text-[#B695FF] transition-all duration-300 group-hover:border-[#B695FF] group-hover:bg-[#A782FF]/15">
          <svg
            className="h-3.5 w-3.5 animate-explore-float"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 3v8.5" />
            <path d="M4.2 8.3 8 12.2l3.8-3.9" />
          </svg>
        </span>
      </a>
    </div>
  );
}
