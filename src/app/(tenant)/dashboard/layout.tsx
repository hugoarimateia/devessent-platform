import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SuspendedTenantState } from "@/components/ui/suspended-tenant-state";
import { QuickTenantSwitcher } from "@/components/dashboard/quick-tenant-switcher";
import { resolveWorkspaceSession } from "@/lib/workspace/workspace-context";

/**
 * Layout persistente da Área de Trabalho (/dashboard/**).
 *
 * Mantém <AppShell> (<Sidebar>, <Topbar>, <TenantSelector>, <UserMenu>, <MobileNavigation>)
 * montado entre transições de abas no App Router, eliminando remontagens completas
 * e evitando re-execução do shell a cada navegação interna.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await resolveWorkspaceSession();

  if (!workspace.sessionUser) {
    redirect("/login");
  }

  const activeTenantId =
    workspace.activeContext?.tenantId ?? workspace.selectedTenant?.tenantId;
  const activeRole =
    workspace.activeContext?.role ?? workspace.selectedTenant?.role ?? "staff";

  return (
    <AppShell
      user={workspace.sessionUser}
      contextMode="tenant"
      tenants={workspace.userTenants}
      activeTenantId={activeTenantId}
      activeRole={activeRole}
    >
      {workspace.isSuspended && workspace.selectedTenant ? (
        <div className="space-y-6">
          <SuspendedTenantState tenantName={workspace.selectedTenant.name} />
          {workspace.userTenants.length > 1 && (
            <QuickTenantSwitcher
              tenants={workspace.userTenants}
              activeTenantId={workspace.selectedTenant.tenantId}
            />
          )}
        </div>
      ) : (
        children
      )}
    </AppShell>
  );
}
