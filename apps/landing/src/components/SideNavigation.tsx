"use client";

import React, { useEffect, useRef } from "react";
import { DevEssentLogo } from "./DevEssentLogo";
import { SITE_CONFIG } from "@/config/site";

interface SideNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function SideNavigation({
  isOpen,
  onClose,
  triggerRef,
}: SideNavigationProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mainEl = document.querySelector("main");
    const footerEl = document.querySelector("footer");

    if (isOpen) {
      document.body.style.overflow = "hidden";
      mainEl?.setAttribute("inert", "");
      footerEl?.setAttribute("inert", "");

      const timer = window.setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 60);

      return () => {
        window.clearTimeout(timer);
      };
    } else {
      document.body.style.overflow = "";
      mainEl?.removeAttribute("inert");
      footerEl?.removeAttribute("inert");
    }

    return () => {
      document.body.style.overflow = "";
      mainEl?.removeAttribute("inert");
      footerEl?.removeAttribute("inert");
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, triggerRef]);

  const handleClose = () => {
    onClose();
    triggerRef.current?.focus();
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-visibility ${
        isOpen
          ? "pointer-events-auto visible"
          : "pointer-events-none invisible delay-300"
      }`}
      aria-hidden={!isOpen}
    >
      {/* Overlay escuro translúcido sobre o restante da página */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-black/78 backdrop-blur-xs transition-opacity duration-300 ease-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Painel Off-Canvas lateral direito (250ms–400ms -> 320ms) */}
      <aside
        ref={drawerRef}
        id="devessent-side-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação DevEssent"
        className={`fixed top-0 right-0 bottom-0 z-10 flex w-full max-w-[400px] flex-col justify-between border-l border-[#E9E7DF]/14 bg-[#0B0B0B] px-6 py-6 shadow-[-24px_0_60px_rgba(0,0,0,0.85)] transition-transform duration-320 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-8 sm:py-8 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Linha de acento superior lilás */}
        <div
          className="pointer-events-none absolute top-0 right-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-[#A782FF]/55 to-transparent"
          aria-hidden="true"
        />

        {/* Cabeçalho do Menu Lateral */}
        <div className="flex items-center justify-between gap-3 border-b border-[#E9E7DF]/10 pb-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <DevEssentLogo variant="sidebar" />
            <span className="font-tech text-[10px] tracking-[0.22em] whitespace-nowrap text-[#B695FF]/80 uppercase">
              {"// NAV"}
            </span>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label="Fechar menu de navegação"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#E9E7DF]/16 bg-[#1A1A1A]/70 text-[#E9E7DF] transition-colors hover:border-[#A782FF]/60 hover:bg-[#161124] hover:text-[#B695FF]"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Lista de Navegação Editorial */}
        <nav
          aria-label="Seções da página"
          className="my-auto py-6"
        >
          <p className="mb-4 font-tech text-[10px] tracking-[0.28em] text-[#BAB5C5]/65 uppercase">
            EXPLORAÇÃO DE CONTEÚDO
          </p>

          <ul className="space-y-1.5">
            {SITE_CONFIG.navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={onClose}
                  className="group flex items-center justify-between rounded-[10px] border border-transparent px-3.5 py-3 text-[#E9E7DF]/90 transition-all duration-200 hover:border-[#A782FF]/30 hover:bg-[#161124]/65 hover:text-[#E9E7DF]"
                >
                  <span className="flex items-center gap-3.5">
                    <span className="font-tech text-[11px] tracking-[0.2em] text-[#B695FF]/70 transition-colors group-hover:text-[#B695FF]">
                      {item.code}
                    </span>
                    <span className="font-display text-base font-medium tracking-[0.02em] sm:text-[17px]">
                      {item.label}
                    </span>
                  </span>
                  <span
                    className="font-tech text-xs text-[#BAB5C5]/40 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#B695FF]"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </a>
              </li>
            ))}

            {/* Item 7: Fale Conosco abrindo a página dedicada /contato em nova guia */}
            <li className="pt-2">
              <a
                href="/contato"
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="group flex items-center justify-between rounded-[10px] border border-[#A782FF]/40 bg-[#161124]/70 px-3.5 py-3 text-[#E9E7DF] transition-all duration-200 hover:border-[#B695FF] hover:bg-[#A782FF]/20"
              >
                <span className="flex items-center gap-3.5">
                  <span className="font-tech text-[11px] tracking-[0.2em] text-[#B695FF]">
                    07
                  </span>
                  <span className="font-display text-base font-semibold tracking-[0.02em] text-[#E9E7DF] sm:text-[17px]">
                    Fale Conosco
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-tech text-[10px] tracking-[0.18em] text-[#B695FF] uppercase">
                  <span>/CONTATO</span>
                  <svg
                    className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
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
                </span>
              </a>
            </li>
          </ul>
        </nav>

        {/* Rodapé técnico do Menu Lateral */}
        <div className="border-t border-[#E9E7DF]/10 pt-5">
          <div className="mb-4 flex items-center justify-between text-xs text-[#BAB5C5]">
            <span className="font-tech text-[10px] tracking-[0.22em] text-[#B695FF] uppercase">
              {SITE_CONFIG.conceptKanji} {"//"} {SITE_CONFIG.conceptLabel}
            </span>
            <span className="font-tech text-[10px] tracking-[0.18em] text-[#BAB5C5]/70 uppercase">
              SOFTWARE HOUSE
            </span>
          </div>

          <a
            href="/contato"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#B695FF]/70 bg-[#A782FF] px-5 py-3 text-sm font-semibold tracking-[0.04em] text-[#0B0B0B] shadow-[0_0_24px_rgba(167,130,255,0.28)] transition-all duration-200 hover:bg-[#B695FF]"
          >
            <span>Iniciar conversa com a DevEssent</span>
            <svg
              className="h-4 w-4"
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
        </div>
      </aside>
    </div>
  );
}

