"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  LayoutDashboard,
  Users,
  Settings,
  Building2,
  PlusCircle,
  Shield,
  Activity,
  Layers,
  LogOut,
  Store,
  Package,
  Tag,
  SlidersHorizontal,
  Palette,
  ClipboardList,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { logoutAction } from "@/app/actions/auth.actions";
import type { SessionUser } from "@/core/auth/types/auth.types";
import type { UserTenantSummary } from "@/core/tenants";

interface MobileNavigationProps {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
  contextMode: "platform" | "tenant";
  tenants?: UserTenantSummary[];
  activeTenantId?: string;
  activeRole?: string;
}

export function MobileNavigation({
  open,
  onClose,
  user,
  contextMode,
  tenants = [],
  activeTenantId,
  activeRole = "staff",
}: MobileNavigationProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [isLoggingOut, startTransition] = React.useTransition();

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  React.useEffect(() => {
    if (open) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleLogout = () => {
    onClose();
    startTransition(async () => {
      await logoutAction();
    });
  };

  const activeTenant =
    tenants.find((t) => t.tenantId === activeTenantId) || tenants[0];

  const canViewAudit =
    activeRole === "platform_admin" ||
    activeRole === "owner" ||
    activeRole === "manager";

  const canManageRetailSettings =
    activeRole === "platform_admin" ||
    activeRole === "owner" ||
    activeRole === "manager";

  const operationItems = [
    { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
    { href: "/dashboard/membros", label: "Membros", icon: Users },
    ...(canViewAudit
      ? [{ href: "/dashboard/atividades", label: "Atividades", icon: Activity }]
      : []),
  ];

  const retailItems = [
    { href: "/dashboard/retail", label: "Painel Retail", icon: Store },
    ...(canManageRetailSettings
      ? [{ href: "/dashboard/retail/pedidos", label: "Pedidos", icon: ClipboardList }]
      : []),
    { href: "/dashboard/retail/produtos", label: "Produtos", icon: Package },
    { href: "/dashboard/retail/categorias", label: "Categorias", icon: Tag },
    ...(canManageRetailSettings
      ? [{ href: "/dashboard/retail/configuracoes", label: "Loja & Operação", icon: SlidersHorizontal }]
      : []),
  ];

  const settingsItems = [
    { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
  ];

  const platformNavItems = [
    { href: "/admin", label: "Visão Global", icon: Shield },
    { href: "/admin/empresas", label: "Empresas", icon: Building2 },
    { href: "/admin/empresas/nova", label: "Nova Empresa", icon: PlusCircle },
    { href: "/admin/sites", label: "Customização de Sites", icon: Palette },
    { href: "/admin/atividades", label: "Atividades", icon: Activity },
  ];

  const renderMobileLink = (
    href: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    isActive: boolean
  ) => (
    <Link
      key={href}
      href={href}
      prefetch={false}
      onClick={onClose}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors ${
        isActive
          ? "bg-accent/10 text-foreground dark:bg-accent/20 dark:text-white ring-1 ring-accent/25 font-semibold"
          : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-accent" : ""}`} />
      <span>{label}</span>
    </Link>
  );

  return (
    <dialog
      ref={dialogRef}
      aria-label="Menu de navegação móvel"
      onClose={onClose}
      onClick={handleBackdropClick}
      className="overscroll-contain m-0 mr-auto h-[100svh] max-h-[100svh] w-[min(85vw,310px)] rounded-none rounded-r-2xl p-0 bg-surface text-foreground border-r border-surface-border shadow-elevated"
    >
      {open && (
        <div className="flex flex-col h-full">
          <div className="h-14 px-4 flex items-center justify-between border-b border-surface-border">
            <BrandLogo size="md" />

            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label="Fechar menu de navegação"
              className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-5">
            {contextMode === "platform" ? (
              <nav aria-label="Navegação administrativa móvel" className="space-y-1">
                <p className="px-2.5 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Governança SaaS
                </p>
                {platformNavItems.map(({ href, label, icon }) =>
                  renderMobileLink(href, label, icon, pathname === href)
                )}
              </nav>
            ) : (
              <>
                <nav aria-label="Navegação operacional móvel" className="space-y-1">
                  <p className="px-2.5 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted truncate">
                    {activeTenant ? `${activeTenant.name} · Operação` : "Operação"}
                  </p>
                  {operationItems.map(({ href, label, icon }) => {
                    if (!activeTenant && href !== "/dashboard") return null;
                    return renderMobileLink(href, label, icon, pathname === href);
                  })}
                </nav>

                {activeTenant && (
                  <nav aria-label="Navegação Retail móvel" className="space-y-1">
                    <p className="px-2.5 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                      Comercial · Retail
                    </p>
                    {retailItems.map(({ href, label, icon }) =>
                      renderMobileLink(
                        href,
                        label,
                        icon,
                        pathname === href ||
                          (href === "/dashboard/retail/produtos" &&
                            pathname.startsWith("/dashboard/retail/produtos"))
                      )
                    )}
                  </nav>
                )}

                {activeTenant && (
                  <nav aria-label="Configurações móveis" className="space-y-1">
                    <p className="px-2.5 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                      Configurações
                    </p>
                    {settingsItems.map(({ href, label, icon }) =>
                      renderMobileLink(href, label, icon, pathname === href)
                    )}
                  </nav>
                )}
              </>
            )}

            {user.isPlatformAdmin && (
              <div className="pt-3 border-t border-surface-border space-y-1">
                <p className="px-2.5 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Alternar Contexto
                </p>
                {contextMode === "platform" ? (
                  <Link
                    href="/dashboard"
                    prefetch={false}
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted"
                  >
                    <Layers className="w-4 h-4 text-accent" />
                    Área de Trabalho
                  </Link>
                ) : (
                  <Link
                    href="/admin"
                    prefetch={false}
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-semibold text-accent hover:bg-accent/10"
                  >
                    <Shield className="w-4 h-4" />
                    Console Global
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-surface-border space-y-3 bg-surface-muted/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground-muted">Aparência</span>
              <ThemeToggle compact />
            </div>
            <div className="text-[11px] font-mono text-foreground-muted truncate">
              {user.email}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center gap-2 min-h-[40px] rounded-[10px] border border-surface-border bg-surface text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isLoggingOut ? "Encerrando..." : "Encerrar Sessão"}</span>
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
