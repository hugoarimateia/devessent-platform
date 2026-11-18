import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function HomePage() {
  return (
    <div className="horizon-backdrop relative min-h-[100dvh] w-full overflow-hidden text-[#121024] dark:text-[#F8F7FC] flex flex-col justify-between select-none">
      {/* Camada atmosférica sutil para proteção de contraste tipográfico e profundidade */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_65%_at_24%_44%,rgba(244,242,250,0.72)_0%,rgba(244,242,250,0.22)_55%,transparent_100%)] dark:bg-[radial-gradient(75%_62%_at_24%_44%,rgba(11,11,18,0.62)_0%,rgba(11,11,18,0.20)_58%,transparent_100%)]"
      />

      {/* Brilho atmosférico sutil sobre o horizonte planetário inferior */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] bg-[radial-gradient(55%_65%_at_47%_76%,rgba(167,130,255,0.22)_0%,transparent_75%)] dark:bg-[radial-gradient(52%_60%_at_47%_74%,rgba(182,149,255,0.18)_0%,transparent_75%)]"
      />

      {/* Topo aberto — Elemento A (Logo Oficial) e Elemento D (Seletor de Tema Flutuante) */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20 pt-6 sm:pt-9 flex items-center justify-between gap-4">
        <BrandLogo size="lg" />
        <ThemeToggle variant="horizon" />
      </div>

      {/* Área central — Elemento B (Apresentação) e Elemento C (Ação Principal) */}
      <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20 flex items-center pb-24 sm:pb-32 lg:pb-36 pt-8 sm:pt-12">
        <div className="w-full max-w-[760px] lg:pl-8 xl:pl-14 space-y-8 sm:space-y-10 select-text">
          {/* Elemento B — Bloco principal de apresentação */}
          <div className="space-y-4 sm:space-y-5">
            {/* Eyebrow + traço horizontal lilás */}
            <div className="flex items-center gap-2.5 sm:gap-4">
              <span className="text-[9.5px] sm:text-xs font-medium uppercase tracking-[0.18em] sm:tracking-[0.26em] text-[#3E3856] dark:text-[#D5D1E8] whitespace-nowrap">
                PLATAFORMA OPERACIONAL MULTIEMPRESA
              </span>
              <span
                aria-hidden="true"
                className="inline-block h-[2px] w-7 sm:w-12 rounded-full bg-[#7C5CFA] dark:bg-[#A782FF] shrink-0"
              />
            </div>

            {/* Título principal */}
            <h1 className="font-display text-[2.5rem] sm:text-[3.5rem] lg:text-[4.25rem] font-extrabold tracking-[-0.03em] leading-[1.05] text-[#121024] dark:text-[#F8F7FC]">
              DevEssent{" "}
              <span className="text-[#7C5CFA] dark:text-[#A782FF] drop-shadow-[0_0_24px_rgba(167,130,255,0.28)]">
                Platform
              </span>
            </h1>

            {/* Texto descritivo */}
            <p className="text-base sm:text-lg lg:text-[1.35rem] font-normal text-[#3E3856] dark:text-[#D5D1E8] leading-[1.5] max-w-[52ch]">
              Um espaço para conectar negócios, pessoas e operações.
            </p>
          </div>

          {/* Elemento C — Ação principal e texto complementar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pt-1">
            <Link
              href="/login"
              className="horizon-cta-btn group inline-flex items-center justify-center gap-3.5 min-h-[50px] sm:min-h-[54px] px-7 sm:px-8 rounded-xl bg-gradient-to-r from-[#8E6BFF] via-[#7C5CFA] to-[#6D4AFF] text-white dark:from-[#B799FF] dark:via-[#A782FF] dark:to-[#956BFF] dark:text-[#110D22] text-sm sm:text-base font-semibold shadow-[0_8px_28px_rgba(124,92,250,0.32)] dark:shadow-[0_0_30px_rgba(167,130,255,0.38),inset_0_1px_1px_rgba(255,255,255,0.45)] hover:brightness-105 hover:shadow-[0_10px_34px_rgba(124,92,250,0.45)] dark:hover:shadow-[0_0_38px_rgba(182,149,255,0.55),inset_0_1px_1px_rgba(255,255,255,0.6)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A782FF]"
            >
              <span>Acessar plataforma</span>
              <ArrowRight className="w-4 h-4 sm:w-[18px] sm:h-[18px] transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>

            <span
              aria-hidden="true"
              className="hidden sm:inline-block h-8 w-px bg-[#121024]/15 dark:bg-white/15"
            />

            <span className="text-xs sm:text-sm text-[#5C5478] dark:text-[#B5B0CA]">
              Acesso para equipes e administradores.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
