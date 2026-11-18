"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNavigation } from "./mobile-navigation";
import { resolveTenantBrand } from "@/lib/theme/tenant-brand";
import type { SessionUser } from "@/core/auth/types/auth.types";
import type { UserTenantSummary } from "@/core/tenants";

interface AppShellProps {
  user: SessionUser;
  contextMode?: "platform" | "tenant";
  tenants?: UserTenantSummary[];
  activeTenantId?: string;
  activeRole?: string;
  children: React.ReactNode;
}

export function AppShell({
  user,
  contextMode = "tenant",
  tenants = [],
  activeTenantId,
  activeRole = "staff",
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  const activeTenant =
    contextMode === "tenant"
      ? tenants.find((t) => t.tenantId === activeTenantId) || tenants[0]
      : undefined;

  const tenantBrand = React.useMemo(() => {
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

  return (
    <div
      style={
        tenantBrand ? (tenantBrand.cssVariables as React.CSSProperties) : undefined
      }
      className="min-h-screen bg-background text-foreground flex"
    >
      <Sidebar
        user={user}
        contextMode={contextMode}
        tenants={tenants}
        activeTenantId={activeTenantId}
        activeRole={activeRole}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          user={user}
          contextMode={contextMode}
          tenants={tenants}
          activeTenantId={activeTenantId}
          activeRole={activeRole}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
          {children}
        </main>
      </div>

      <MobileNavigation
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        contextMode={contextMode}
        tenants={tenants}
        activeTenantId={activeTenantId}
        activeRole={activeRole}
      />
    </div>
  );
}
