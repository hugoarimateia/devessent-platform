"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Shield, Building2 } from "lucide-react";
import { TenantSelector } from "@/components/dashboard/tenant-selector";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserMenu } from "./user-menu";
import type { SessionUser } from "@/core/auth/types/auth.types";
import type { UserTenantSummary } from "@/core/tenants";

interface TopbarProps {
  user: SessionUser;
  contextMode: "platform" | "tenant";
  tenants?: UserTenantSummary[];
  activeTenantId?: string;
  activeRole?: string;
  onOpenMobileMenu: () => void;
}

export function Topbar({
  user,
  contextMode,
  tenants = [],
  activeTenantId,
  activeRole = "staff",
  onOpenMobileMenu,
}: TopbarProps) {
  return (
    <header className="w-full h-14 border-b border-surface-border bg-surface/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-2 sm:gap-4">
        {/* Esquerda: Menu mobile + Marca compacta no mobile + Seletor canônico de estabelecimento */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Abrir menu de navegação"
            className="lg:hidden p-2 rounded-lg border border-surface-border bg-surface text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors shrink-0 cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>

          <Link
            href={contextMode === "platform" ? "/admin" : "/dashboard"}
            className="hidden sm:flex lg:hidden items-center shrink-0 pr-1.5"
            aria-label="Início DevEssent"
          >
            <BrandLogo size="sm" />
          </Link>

          {contextMode === "platform" ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-muted/70 border border-surface-border text-foreground text-xs font-semibold min-w-0">
              <Shield className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="truncate">Console Global</span>
            </div>
          ) : tenants.length > 0 && activeTenantId ? (
            <TenantSelector
              tenants={tenants}
              activeTenantId={activeTenantId}
              activeRole={activeRole}
            />
          ) : (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-muted/70 border border-surface-border text-foreground-muted text-xs font-medium min-w-0">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Onboarding</span>
            </div>
          )}
        </div>

        {/* Direita: Alternador de Tema + Menu interativo da conta */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <ThemeToggle compact />
          <UserMenu
            user={user}
            contextMode={contextMode}
            activeRole={contextMode === "platform" ? "platform_admin" : activeRole}
            hasTenants={tenants.length > 0}
          />
        </div>
      </div>
    </header>
  );
}
