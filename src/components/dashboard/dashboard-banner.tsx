import * as React from "react";
import Link from "next/link";
import {
  Plus,
  ExternalLink,
  Users,
  UserPlus,
  Settings,
  Store,
  Package,
  Building2,
} from "lucide-react";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import type { MembershipRole } from "@/types/database.types";

interface DashboardBannerProps {
  tenantName: string;
  tenantSlug: string;
  monogram: string;
  segmentTag: string;
  role: "platform_admin" | MembershipRole;
  userFirstName: string;
  brandFillColor: string;
  retailActive: boolean;
  storeSlug?: string;
  publishedProductsCount: number;
  totalProductsCount: number;
  membersCount: number;
  tenantsCount: number;
  canManageProducts: boolean;
  canManageTeam: boolean;
}

/**
 * Banner Principal HORIZON adaptado ao ambiente operacional administrativo (Fase 6B.1).
 * Utiliza horizonte abstrato em ondas violetas sutis e gradiente controlado nos modos Claro e Escuro,
 * mantendo 100% dos dados vinculados ao tenant ativo sem astronautas nem números fictícios.
 */
export function DashboardBanner({
  tenantName,
  tenantSlug,
  monogram,
  segmentTag,
  role,
  userFirstName,
  brandFillColor,
  retailActive,
  storeSlug,
  publishedProductsCount,
  totalProductsCount,
  membersCount,
  tenantsCount,
  canManageProducts,
  canManageTeam,
}: DashboardBannerProps) {
  return (
    <section
      aria-label="Resumo executivo do estabelecimento"
      className="relative overflow-hidden rounded-2xl border border-[#CFC5FA] dark:border-[#2E2556] bg-gradient-to-br from-[#FBF9FF] via-[#F2EEFC] to-[#E5DDFB] dark:from-[#0E101E] dark:via-[#14132C] dark:to-[#221445] text-[#111022] dark:text-white shadow-[0_12px_36px_-14px_rgba(91,70,229,0.18)] dark:shadow-[0_18px_42px_-16px_rgba(0,0,0,0.65)]"
    >
      {/* Camada atmosférica HORIZON com ondas violetas abstratas (sem astronauta) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      >
        <div className="absolute -top-24 -right-16 w-[380px] h-[380px] rounded-full bg-[radial-gradient(circle,rgba(124,92,250,0.16)_0%,transparent_68%)] dark:bg-[radial-gradient(circle,rgba(167,130,255,0.22)_0%,transparent_70%)]" />
        <svg
          viewBox="0 0 1200 320"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full opacity-75 dark:opacity-65"
        >
          <defs>
            <linearGradient id="horizon-wave-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B6DFF" stopOpacity="0.06" />
              <stop offset="55%" stopColor="#A782FF" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#6D4AFF" stopOpacity="0.28" />
            </linearGradient>
            <linearGradient id="horizon-wave-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A782FF" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#A782FF" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#C8B2FF" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <path
            d="M0,250 C260,210 460,275 720,185 C920,115 1060,150 1200,90 L1200,320 L0,320 Z"
            fill="url(#horizon-wave-fill)"
          />
          <path
            d="M0,272 C320,235 540,295 820,210 C985,160 1100,195 1200,152"
            fill="none"
            stroke="url(#horizon-wave-stroke)"
            strokeWidth="1.5"
          />
          <path
            d="M280,320 C490,260 680,245 920,192 C1045,165 1135,172 1200,140"
            fill="none"
            stroke="url(#horizon-wave-stroke)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
        </svg>
      </div>

      <div className="relative z-10 p-5 sm:p-7 space-y-5">
        {/* Linha 1: Eyebrow técnico + Badges de Contexto Real */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2.5">
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5B46E5] dark:text-[#B9A4FF]">
              {segmentTag} · Operação Multiempresa
            </span>
            <span
              aria-hidden="true"
              className="hidden sm:inline-block h-[2px] w-8 rounded-full bg-[#7C5CFA]/60 dark:bg-[#A782FF]/70"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <StatusBadge status="active" label="Estabelecimento Ativo" />
            <RoleBadge role={role} showPrefix />
          </div>
        </div>

        {/* Linha 2: Identidade da Empresa Ativa + Subtítulo Operacional */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-mono text-sm sm:text-base font-bold text-white shrink-0 shadow-sm ring-2 ring-white/40 dark:ring-white/15"
              style={{ backgroundColor: brandFillColor }}
            >
              {monogram}
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex items-baseline flex-wrap gap-x-2.5 gap-y-1">
                <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-[-0.03em] text-[#111022] dark:text-white leading-[1.08] truncate">
                  {tenantName}
                </h1>
                <span className="font-mono text-xs text-[#5B5575] dark:text-[#A9A4C4]">
                  /{tenantSlug}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#413B5C] dark:text-[#C5C0DD] leading-relaxed max-w-[66ch]">
                Olá, <strong className="font-semibold text-[#111022] dark:text-white">{userFirstName}</strong>. Seu negócio, sob controle — acompanhe indicadores reais do catálogo, equipe e atividades da unidade em um só lugar.
              </p>
            </div>
          </div>

          {/* Ações Contextuais Reais (condicionais à permissão e módulos ativos) */}
          <div className="flex items-center flex-wrap gap-2.5 shrink-0">
            {retailActive && canManageProducts && (
              <Link
                href="/dashboard/retail/produtos/novo"
                className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-[#6C4EF2] to-[#5638DC] dark:from-[#9F7EFF] dark:to-[#7D5CFA] text-white dark:text-[#110D22] text-xs sm:text-[13px] font-semibold shadow-[0_6px_18px_-6px_rgba(91,70,229,0.55)] hover:brightness-105 transition-all"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Novo Produto</span>
              </Link>
            )}

            {retailActive && storeSlug && (
              <a
                href={`/loja/${storeSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border border-[#CFC5FA] dark:border-white/15 bg-white/85 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/15 text-xs sm:text-[13px] font-semibold text-[#111022] dark:text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#5B46E5] dark:text-[#B9A4FF]" aria-hidden="true" />
                <span>Ver Vitrine</span>
              </a>
            )}

            {canManageTeam && (
              <Link
                href="/dashboard/membros"
                className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border border-[#CFC5FA] dark:border-white/15 bg-white/85 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/15 text-xs sm:text-[13px] font-semibold text-[#111022] dark:text-white transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#5B46E5] dark:text-[#B9A4FF]" aria-hidden="true" />
                <span>Gerenciar Equipe</span>
              </Link>
            )}

            {!retailActive && canManageTeam && (
              <Link
                href="/dashboard/configuracoes"
                className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border border-[#CFC5FA] dark:border-white/15 bg-white/85 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/15 text-xs sm:text-[13px] font-semibold text-[#111022] dark:text-white transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-[#5B46E5] dark:text-[#B9A4FF]" aria-hidden="true" />
                <span>Ajustes da Unidade</span>
              </Link>
            )}
          </div>
        </div>

        {/* Linha 3: Faixa Compacta de Contexto Real (3 pilares funcionais existentes) */}
        <div className="pt-4 border-t border-[#D8D0F7] dark:border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 text-xs">
          <Link
            href="/dashboard/retail"
            className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white/65 dark:bg-white/[0.04] hover:bg-white/95 dark:hover:bg-white/[0.08] border border-white/60 dark:border-white/10 transition-colors"
          >
            <span className="w-8 h-8 rounded-lg bg-[#5B46E5]/10 dark:bg-[#A782FF]/15 text-[#5B46E5] dark:text-[#B9A4FF] flex items-center justify-center shrink-0">
              {retailActive ? <Package className="w-4 h-4" /> : <Store className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[#111022] dark:text-white truncate">
                {retailActive ? "Comercial (Retail)" : "Módulo Retail"}
              </p>
              <p className="text-[11px] text-[#5B5575] dark:text-[#A9A4C4] truncate">
                {retailActive
                  ? `${publishedProductsCount} publicados de ${totalProductsCount} produtos`
                  : "Catálogo comercial inativo"}
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/membros"
            className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white/65 dark:bg-white/[0.04] hover:bg-white/95 dark:hover:bg-white/[0.08] border border-white/60 dark:border-white/10 transition-colors"
          >
            <span className="w-8 h-8 rounded-lg bg-[#5B46E5]/10 dark:bg-[#A782FF]/15 text-[#5B46E5] dark:text-[#B9A4FF] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[#111022] dark:text-white truncate">
                Equipe da Unidade
              </p>
              <p className="text-[11px] text-[#5B5575] dark:text-[#A9A4C4] truncate">
                {membersCount} {membersCount === 1 ? "integrante ativo" : "integrantes ativos"}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white/65 dark:bg-white/[0.04] border border-white/60 dark:border-white/10">
            <span className="w-8 h-8 rounded-lg bg-[#5B46E5]/10 dark:bg-[#A782FF]/15 text-[#5B46E5] dark:text-[#B9A4FF] flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[#111022] dark:text-white truncate">
                Escopo Multiempresa
              </p>
              <p className="text-[11px] text-[#5B5575] dark:text-[#A9A4C4] truncate">
                {tenantsCount} {tenantsCount === 1 ? "unidade vinculada" : "unidades vinculadas"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
