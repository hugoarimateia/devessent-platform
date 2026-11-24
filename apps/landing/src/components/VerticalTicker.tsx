"use client";

import React, { useState } from "react";
import { SITE_CONFIG } from "@/config/site";

export function VerticalTicker() {
  const [isPaused, setIsPaused] = useState(false);
  const phrases = SITE_CONFIG.tickerPhrases;

  return (
    <>
      {/* ====================================================================
          Desktop: Letreiro Lateral Vertical (Esquerda Editorial)
          Movimento contínuo, espaçamento amplo, pausa no hover + botão WCAG
          ==================================================================== */}
      <aside
        aria-label="Posicionamento institucional DevEssent"
        className="pointer-events-auto hidden lg:flex lg:flex-col lg:items-center lg:justify-between lg:border-r lg:border-[#E9E7DF]/10 lg:pr-4 xl:pr-5"
      >
        {/* Indicador superior do ticker */}
        <div className="flex flex-col items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full bg-[#A782FF] animate-hud-pulse"
            aria-hidden="true"
          />
          <span
            className="font-tech text-[9px] tracking-[0.28em] text-[#BAB5C5]/60 uppercase"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            FEED {"//"} DE-01
          </span>
          <span
            className="h-6 w-[1px] bg-gradient-to-b from-[#A782FF]/50 to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* Janela vertical animada (altura responsiva à altura do viewport para folga em notebooks 720p) */}
        <div
          className="relative my-2.5 h-[210px] w-6 overflow-hidden [@media(min-height:820px)]:my-3 [@media(min-height:820px)]:h-[320px]"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
          }}
        >
          <div
            className={`flex flex-col items-center animate-ticker-vertical ${
              isPaused ? "ticker-paused" : ""
            }`}
          >
            {/* Trilha principal acessível para tecnologias assistivas */}
            <ul className="flex flex-col items-center">
              {phrases.map((phrase) => (
                <li
                  key={phrase}
                  className="flex flex-col items-center py-5"
                >
                  <span
                    className="font-tech text-[10px] tracking-[0.28em] whitespace-nowrap text-[#BAB5C5]/80 uppercase transition-colors hover:text-[#E9E7DF]"
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                    }}
                  >
                    {phrase}
                  </span>
                  <span
                    className="mt-5 h-1 w-1 rotate-45 bg-[#A782FF]/75"
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>

            {/* Trilha duplicada apenas para loop visual infinito — oculta de leitores de tela */}
            <ul
              aria-hidden="true"
              className="flex flex-col items-center"
            >
              {phrases.map((phrase, idx) => (
                <li
                  key={`${phrase}-dup-${idx}`}
                  className="flex flex-col items-center py-5"
                >
                  <span
                    className="font-tech text-[10px] tracking-[0.28em] whitespace-nowrap text-[#BAB5C5]/80 uppercase"
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                    }}
                  >
                    {phrase}
                  </span>
                  <span className="mt-5 h-1 w-1 rotate-45 bg-[#A782FF]/75" />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Controle discreto de Pausa/Reprodução (WCAG 2.2.2) */}
        <button
          type="button"
          onClick={() => setIsPaused((prev) => !prev)}
          aria-label={
            isPaused
              ? "Retomar letreiro lateral institucional"
              : "Pausar letreiro lateral institucional"
          }
          title={isPaused ? "Retomar letreiro" : "Pausar letreiro"}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#E9E7DF]/14 bg-[#1A1A1A]/50 text-[#BAB5C5]/80 transition-colors hover:border-[#A782FF]/60 hover:text-[#B695FF]"
        >
          {isPaused ? (
            <svg
              className="h-2.5 w-2.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg
              className="h-2.5 w-2.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
            </svg>
          )}
        </button>
      </aside>

      {/* ====================================================================
          Mobile & Tablet (< lg): Faixa Horizontal Compacta
          Posicionada sem prejudicar o texto nem o astronauta
          ==================================================================== */}
      <div
        aria-label="Posicionamento institucional DevEssent"
        className="relative flex w-full items-center gap-2 border-y border-[#E9E7DF]/10 bg-[#0B0B0B]/70 py-1.5 px-2 lg:hidden"
      >
        <div
          className="relative flex-1 overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          }}
        >
          <div
            className={`flex w-max items-center animate-ticker-horizontal ${
              isPaused ? "ticker-paused" : ""
            }`}
          >
            {/* Trilha principal */}
            <ul className="flex items-center">
              {phrases.map((phrase) => (
                <li
                  key={`mob-${phrase}`}
                  className="flex items-center"
                >
                  <span className="px-3.5 font-tech text-[9px] tracking-[0.24em] whitespace-nowrap text-[#BAB5C5]/85 uppercase">
                    {phrase}
                  </span>
                  <span
                    className="h-1 w-1 rotate-45 bg-[#A782FF]/75"
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>

            {/* Trilha duplicada oculta de tecnologias assistivas */}
            <ul
              aria-hidden="true"
              className="flex items-center"
            >
              {phrases.map((phrase, idx) => (
                <li
                  key={`mob-dup-${idx}`}
                  className="flex items-center"
                >
                  <span className="px-3.5 font-tech text-[9px] tracking-[0.24em] whitespace-nowrap text-[#BAB5C5]/85 uppercase">
                    {phrase}
                  </span>
                  <span className="h-1 w-1 rotate-45 bg-[#A782FF]/75" />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsPaused((prev) => !prev)}
          aria-label={
            isPaused
              ? "Retomar faixa institucional"
              : "Pausar faixa institucional"
          }
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#E9E7DF]/15 bg-[#1A1A1A]/60 text-[#BAB5C5]"
        >
          {isPaused ? (
            <svg
              className="h-2.5 w-2.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg
              className="h-2.5 w-2.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}

