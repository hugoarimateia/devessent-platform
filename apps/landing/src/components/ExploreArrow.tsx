"use client";

import React from "react";

interface ExploreArrowProps {
  targetId?: string;
  label?: string;
}

export function ExploreArrow({
  targetId = "nossa-essencia",
  label = "EXPLORAR",
}: ExploreArrowProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);
    if (!target) return;

    e.preventDefault();
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const navbarOffset = 76;
    const elementPosition = target.getBoundingClientRect().top + window.scrollY;
    const offsetPosition = Math.max(0, elementPosition - navbarOffset);

    window.scrollTo({
      top: offsetPosition,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

    target.focus({ preventScroll: true });
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      aria-label="Explorar o conteúdo abaixo da primeira dobra"
      className="group inline-flex flex-col items-center gap-1.5 rounded-full px-4 py-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-[#A782FF]"
    >
      <span className="font-tech text-[10px] tracking-[0.32em] text-[#BAB5C5]/80 uppercase transition-colors duration-300 group-hover:text-[#E9E7DF]">
        {label}
      </span>

      <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-[#A782FF]/35 bg-[#161124]/60 text-[#B695FF] transition-all duration-300 group-hover:border-[#B695FF] group-hover:bg-[#A782FF]/20 group-hover:shadow-[0_0_18px_rgba(167,130,255,0.35)]">
        <svg
          className="h-3.5 w-3.5 animate-explore-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </a>
  );
}

