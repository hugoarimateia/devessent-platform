import * as React from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-[100svh] bg-surface dark:bg-[#0D1018] text-foreground flex flex-col lg:grid lg:grid-cols-[1.24fr_1fr]">
      {/* Alternador único de aparência posicionado no topo direito em desktop e mobile */}
      <div className="absolute top-5 right-5 lg:top-6 lg:right-8 z-30 rounded-lg bg-surface/95 backdrop-blur-sm lg:bg-transparent">
        <ThemeToggle compact />
      </div>

      {/* Coluna esquerda — Painel editorial escuro com assinatura geométrica DevEssent */}
      <aside className="relative overflow-hidden bg-[#0B0D14] text-white flex flex-col justify-between px-6 py-6 sm:px-10 sm:py-8 lg:px-12 lg:py-11 border-b lg:border-b-0 lg:border-r border-[#1F2436]">
        {/* Grade arquitetônica e refração sutil de luz violeta */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden select-none"
        >
          <div
            className="absolute -top-32 -right-24 w-[460px] h-[460px] rounded-full opacity-35"
            style={{
              background:
                "radial-gradient(circle, rgba(133, 117, 242, 0.34) 0%, rgba(11, 13, 20, 0) 70%)",
            }}
          />
          <svg
            className="absolute inset-0 h-full w-full opacity-[0.12]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="devessent-auth-grid"
                width="64"
                height="64"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 64 0 L 0 0 0 64"
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth="0.75"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#devessent-auth-grid)" />
          </svg>
        </div>

        {/* Cabeçalho do painel escuro */}
        <div className="relative z-10 flex items-center justify-between gap-4 pr-28 lg:pr-0">
          <BrandLogo inverted size="lg" />
        </div>

        {/* Manifesto editorial — compacto no mobile, imponente no desktop */}
        <div className="relative z-10 my-7 lg:my-auto py-1 lg:py-8 max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#A99DFF] mb-3 lg:mb-5">
            Arquitetura Operacional Multiempresa
          </p>

          <h2 className="font-display font-bold tracking-[-0.035em] leading-[1.03] text-[1.75rem] sm:text-[2.25rem] lg:text-[3.125rem] xl:text-[3.5rem] text-white">
            Seu negócio.
            <br />
            Sua operação.
            <br />
            <span className="text-[#9E90FF]">Seu espaço.</span>
          </h2>

          <p className="mt-4 lg:mt-6 text-sm lg:text-[15px] text-[#A9B2C7] leading-relaxed max-w-[44ch]">
            Governança central, alternância instantânea entre estabelecimentos e isolamento estrito de dados em um único núcleo administrativo.
          </p>

          <div className="hidden lg:grid grid-cols-3 gap-6 mt-12 pt-7 border-t border-white/12">
            <div>
              <p className="font-mono text-[11px] text-[#9E90FF] tracking-wider uppercase">
                01 · Isolamento
              </p>
              <p className="mt-1.5 text-xs text-white/80 leading-relaxed">
                Fronteiras validadas por políticas Row-Level Security no banco.
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] text-[#9E90FF] tracking-wider uppercase">
                02 · Contexto Ativo
              </p>
              <p className="mt-1.5 text-xs text-white/80 leading-relaxed">
                Identidade visual e alçadas aplicadas por unidade em sessão.
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] text-[#9E90FF] tracking-wider uppercase">
                03 · Auditoria
              </p>
              <p className="mt-1.5 text-xs text-white/80 leading-relaxed">
                Rastreabilidade completa de ações administrativas e convites.
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé técnico discreto apenas no desktop */}
        <div className="relative z-10 hidden lg:flex items-center justify-between text-[11px] font-mono text-white/50 pt-4 border-t border-white/10">
          <span>DevEssent Engineering</span>
          <span>PostgreSQL RLS · SSR Session</span>
        </div>
      </aside>

      {/* Coluna direita — Superfície limpa e direta para autenticação (sem cartão flutuante) */}
      <div className="flex-1 flex flex-col bg-surface dark:bg-[#0F121B]">
        <main className="flex-1 flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14 lg:pt-20">
          <div className="w-full max-w-[388px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
