"use client";

import * as React from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  Building2,
  PlusCircle,
  Shield,
  Activity,
  ArrowUpRight,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  Package,
  Tag,
  SlidersHorizontal,
  Palette,
  ClipboardList,
  CreditCard,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { resolveTenantBrand } from "@/lib/theme/tenant-brand";
import type { SessionUser } from "@/core/auth/types/auth.types";
import type { UserTenantSummary } from "@/core/tenants";

export interface SidebarProps {
  user: SessionUser;
  contextMode: "platform" | "tenant";
  tenants?: UserTenantSummary[];
  activeTenantId?: string;
  activeRole?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function SidebarNavItemContent({
  label,
  Icon,
  isActive,
  collapsed,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  collapsed: boolean;
}) {
  const { pending } = useLinkStatus();
  const isHighlighted = isActive || pending;

  return (
    <span
      data-nav-pending={pending ? "true" : undefined}
      className={`group relative flex items-center w-full ${
        collapsed ? "justify-center px-2" : "px-3 gap-2.5"
      } py-2 rounded-[10px] text-[13px] font-medium transition-all ${
        isHighlighted
          ? "bg-accent/10 text-foreground dark:bg-gradient-to-r dark:from-accent/25 dark:to-accent/10 dark:text-white ring-1 ring-accent/25 dark:ring-accent/35 font-semibold shadow-2xs"
          : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
      }`}
    >
      {isHighlighted && !collapsed && (
        <span
          aria-hidden="true"
          className={`w-1 h-4 rounded-full shrink-0 bg-accent ${
            pending ? "animate-pulse" : ""
          }`}
        />
      )}
      <Icon
        className={`w-4 h-4 shrink-0 ${
          isHighlighted ? "text-accent dark:text-[#B9A4FF]" : ""
        }`}
        aria-hidden="true"
      />
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {pending && !collapsed && (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full bg-accent animate-ping shrink-0"
        />
      )}
    </span>
  );
}

export function Sidebar({
  user,
  contextMode,
  tenants = [],
  activeTenantId,
  activeRole = "staff",
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();

  const activeTenant =
    tenants.find((t) => t.tenantId === activeTenantId) || tenants[0];

  const activeBrand = React.useMemo(() => {
    if (!activeTenant) return null;
    return resolveTenantBrand({
      slug: activeTenant.slug,
      name: activeTenant.name,
      displayName: activeTenant.displayName,
      segmentLabel: activeTenant.segmentLabel,
      primaryColor: activeTenant.primaryColor,
      monogram: activeTenant.monogram,
      brandDescription: activeTenant.brandDescription,
    });
  }, [activeTenant]);

  const canViewAudit =
    activeRole === "platform_admin" ||
    activeRole === "owner" ||
    activeRole === "manager";

  const canManageRetailSettings =
    activeRole === "platform_admin" ||
    activeRole === "owner" ||
    activeRole === "manager";

  const tenantMainItems = [
    { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
    { href: "/dashboard/membros", label: "Membros", icon: Users },
    ...(canViewAudit
      ? [{ href: "/dashboard/atividades", label: "Atividades", icon: Activity }]
      : []),
  ];

  const retailNavItems = [
    { href: "/dashboard/retail", label: "Painel Retail", icon: Store },
    ...(canManageRetailSettings
      ? [
          { href: "/dashboard/retail/pedidos", label: "Pedidos", icon: ClipboardList },
          { href: "/dashboard/retail/pagamentos", label: "Pagamentos", icon: CreditCard },
        ]
      : []),
    { href: "/dashboard/retail/produtos", label: "Produtos", icon: Package },
    { href: "/dashboard/retail/categorias", label: "Categorias", icon: Tag },
    ...(canManageRetailSettings
      ? [{ href: "/dashboard/retail/configuracoes", label: "Loja & Operação", icon: SlidersHorizontal }]
      : []),
  ];

  const tenantWorkspaceItems = [
    { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
  ];

  const platformNavItems = [
    { href: "/admin", label: "Visão Global", icon: Shield },
    { href: "/admin/empresas", label: "Empresas", icon: Building2 },
    { href: "/admin/empresas/nova", label: "Nova Empresa", icon: PlusCircle },
    { href: "/admin/sites", label: "Customização de Sites", icon: Palette },
    { href: "/admin/atividades", label: "Atividades", icon: Activity },
  ];

  const renderNavLink = (
    href: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    isActive: boolean
  ) => (
    <Link
      key={href}
      href={href}
      prefetch={false}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? label : undefined}
      className="block rounded-[10px]"
    >
      <SidebarNavItemContent
        label={label}
        Icon={Icon}
        isActive={isActive}
        collapsed={collapsed}
      />
    </Link>
  );

  return (
    <aside
      aria-label="Navegação principal"
      className={`hidden lg:flex lg:flex-col lg:shrink-0 border-r border-surface-border bg-surface-sidebar select-none transition-[width] duration-200 overscroll-contain ${
        collapsed ? "lg:w-[68px]" : "lg:w-[244px]"
      }`}
    >
      {/* Topo da barra lateral: Logotipo oficial DevEssent + toggle colapsar */}
      <div
        className={`h-14 border-b border-surface-border flex items-center ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        <Link
          href={contextMode === "platform" ? "/admin" : "/dashboard"}
          prefetch={false}
          className="min-w-0 inline-flex items-center"
          aria-label="DevEssent"
        >
          <BrandLogo compact={collapsed} size="md" />
        </Link>

        {onToggleCollapse && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Recolher barra lateral"
            title="Recolher navegação"
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Bloco compacto de Tenant Ativo na sidebar */}
      {!collapsed && contextMode === "tenant" && activeTenant && activeBrand && (
        <div className="px-3 pt-3.5 pb-1">
          <Link
            href="/dashboard"
            prefetch={false}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-surface-border bg-surface/80 hover:bg-surface transition-colors"
          >
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: activeBrand.fillLight }}
            >
              {activeBrand.monogram}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground-muted leading-none">
                Unidade Ativa
              </p>
              <p className="text-xs font-semibold text-foreground truncate mt-0.5">
                {activeTenant.name}
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* Navegação agrupada por módulos reais existentes */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6">
        {contextMode === "platform" ? (
          <nav aria-label="Menu de governança global" className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                Governança SaaS
              </div>
            )}
            {platformNavItems.map(({ href, label, icon }) =>
              renderNavLink(
                href,
                label,
                icon,
                pathname === href || (href !== "/admin" && pathname.startsWith(href))
              )
            )}
          </nav>
        ) : (
          <>
            <nav aria-label="Menu operacional do estabelecimento" className="space-y-1">
              {!collapsed && (
                <div className="px-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Operação
                </div>
              )}
              {tenantMainItems.map(({ href, label, icon }) => {
                if (!activeTenant && href !== "/dashboard") return null;
                return renderNavLink(href, label, icon, pathname === href);
              })}
            </nav>

            {activeTenant && (
              <nav aria-label="Menu comercial Retail" className="space-y-1">
                {!collapsed && (
                  <div className="px-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                    Comercial · Retail
                  </div>
                )}
                {retailNavItems.map(({ href, label, icon }) =>
                  renderNavLink(
                    href,
                    label,
                    icon,
                    pathname === href ||
                      (href !== "/dashboard/retail" && pathname.startsWith(href))
                  )
                )}
              </nav>
            )}

            {activeTenant && (
              <nav aria-label="Menu de configurações" className="space-y-1">
                {!collapsed && (
                  <div className="px-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                    Configurações
                  </div>
                )}
                {tenantWorkspaceItems.map(({ href, label, icon }) =>
                  renderNavLink(href, label, icon, pathname === href)
                )}
              </nav>
            )}
          </>
        )}

        {user.isPlatformAdmin && (
          <div className="pt-4 border-t border-surface-border space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                Administração Técnica
              </div>
            )}
            {contextMode === "platform" ? (
              <Link
                href="/dashboard"
                prefetch={false}
                title={collapsed ? "Área de Trabalho" : undefined}
                className={`flex items-center ${
                  collapsed ? "justify-center px-2" : "justify-between px-3"
                } py-2 rounded-[10px] text-[13px] font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Layers className="w-4 h-4 text-accent shrink-0" />
                  {!collapsed && <span className="truncate">Área de Trabalho</span>}
                </span>
                {!collapsed && <ArrowUpRight className="w-3.5 h-3.5 opacity-60 shrink-0" />}
              </Link>
            ) : (
              <Link
                href="/admin"
                prefetch={false}
                title={collapsed ? "Console Global" : undefined}
                className={`flex items-center ${
                  collapsed ? "justify-center px-2" : "justify-between px-3"
                } py-2 rounded-[10px] text-[13px] font-semibold text-accent hover:bg-accent/10 transition-colors`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Shield className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">Console Global</span>}
                </span>
                {!collapsed && <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Rodapé enxuto */}
      <div className="p-2.5 border-t border-surface-border">
        {collapsed ? (
          onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expandir barra lateral"
              title="Expandir navegação"
              className="w-full p-2 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          ) : null
        ) : contextMode === "platform" ? (
          <Link
            href="/admin/empresas/nova"
            prefetch={false}
            className="flex items-center justify-between px-3 py-2.5 rounded-[10px] bg-[#10131C] text-white dark:bg-[#191E2E] hover:opacity-95 transition-opacity text-xs font-semibold"
          >
            <span>Nova Empresa</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#A99DFF]" />
          </Link>
        ) : activeTenant ? (
          <Link
            href="/dashboard/configuracoes"
            prefetch={false}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <span className="truncate font-medium">Dados da unidade</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
          </Link>
        ) : (
          <p className="px-2 py-1 text-[11px] text-foreground-muted leading-snug">
            Aguardando vinculação empresarial.
          </p>
        )}
      </div>
    </aside>
  );
}
