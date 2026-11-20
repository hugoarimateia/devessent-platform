"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DevEssentLogo } from "./DevEssentLogo";
import { SideNavigation } from "./SideNavigation";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 z-40 transition-all duration-300 ${
          isScrolled
            ? "border-b border-[#E9E7DF]/10 bg-[#0B0B0B]/82 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:h-20 sm:px-8 lg:px-12">
          {/* Esquerda: Logotipo DevEssent */}
          <Link
            href="/#inicio"
            aria-label="DevEssent — Ir para o início"
            className="group inline-flex items-center gap-3 py-1.5"
          >
            <DevEssentLogo
              variant="navbar"
              className="transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </Link>

          {/* Direita: Botão Fale Conosco + Ícone discreto para abrir o menu lateral */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3.5">
            <a
              href="/contato"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#B695FF]/55 bg-[#161124]/75 px-3 py-1.5 text-[11px] font-medium tracking-[0.03em] whitespace-nowrap text-[#E9E7DF] shadow-[0_0_20px_rgba(167,130,255,0.16)] transition-all duration-200 hover:border-[#B695FF] hover:bg-[#A782FF] hover:text-[#0B0B0B] sm:min-h-[42px] sm:gap-2 sm:px-5 sm:py-2 sm:text-sm"
            >
              <span>Fale Conosco</span>
              <svg
                className="h-3 w-3 shrink-0 opacity-80 sm:h-3.5 sm:w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </a>

            <button
              ref={menuTriggerRef}
              type="button"
              onClick={() => setIsMenuOpen(true)}
              aria-expanded={isMenuOpen}
              aria-controls="devessent-side-menu"
              aria-label="Abrir menu de navegação"
              className="group inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#E9E7DF]/18 bg-[#1A1A1A]/55 text-[#E9E7DF] transition-all duration-200 hover:border-[#A782FF]/65 hover:bg-[#161124]/80 hover:text-[#B695FF] sm:h-[42px] sm:w-[42px]"
            >
              <span className="sr-only">Menu</span>
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path
                  d="M4 8h16"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
                <path d="M8 12h12" />
                <path
                  d="M6 16h14"
                  className="transition-transform duration-200 group-hover:-translate-x-0.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <SideNavigation
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        triggerRef={menuTriggerRef}
      />
    </>
  );
}
