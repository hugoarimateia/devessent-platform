import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService, MembershipService, InvitationService } from "@/core/tenants";
import { TenantSuspendedError } from "@/core/errors/app-error";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/ui/role-badge";
import { SuspendedTenantState } from "@/components/ui/suspended-tenant-state";
import { MembersManager } from "@/components/dashboard/members-manager";

export const metadata: Metadata = {
  title: "Gestão de Membros | DevEssent Platform",
  description: "Gerencie permissões, papéis e convites de membros do estabelecimento.",
};

export default async function MembrosPage() {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/membros");
  }

  const userTenants = await TenantService.listUserTenants(supabase, sessionUser.id);
  const cookieStore = await cookies();
  const activeTenantCookie = cookieStore.get(getActiveTenantCookieName())?.value;

  let selectedTenant = userTenants.find(
    (t) => t.tenantId === activeTenantCookie || t.slug === activeTenantCookie
  );

  if (!selectedTenant && userTenants.length > 0) {
    selectedTenant = userTenants[0];
  }

  if (!selectedTenant) {
    redirect("/dashboard");
  }

  let activeContext;
  try {
    activeContext = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      selectedTenant.tenantId
    );
  } catch (err: unknown) {
    if (err instanceof TenantSuspendedError) {
      return (
        <AppShell
          user={sessionUser}
          contextMode="tenant"
          tenants={userTenants}
          activeTenantId={selectedTenant.tenantId}
          activeRole={selectedTenant.role}
        >
          <SuspendedTenantState tenantName={selectedTenant.name} />
        </AppShell>
      );
    }
    throw err;
  }

  const canManageInvitations =
    activeContext.role === "owner" ||
    activeContext.role === "manager" ||
    activeContext.role === "platform_admin";

  const [members, invitations] = await Promise.all([
    MembershipService.listMembers(supabase, activeContext),
    canManageInvitations
      ? InvitationService.listInvitations(supabase, activeContext, {
          includeHistory: true,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <AppShell
      user={sessionUser}
      contextMode="tenant"
      tenants={userTenants}
      activeTenantId={activeContext.tenantId}
      activeRole={activeContext.role}
    >
      <PageHeader
        breadcrumbs={[
          { label: activeContext.tenantName, href: "/dashboard" },
          { label: "Membros" },
        ]}
        eyebrow="Governança de Equipe e Acesso"
        title="Membros do Estabelecimento"
        description={
          <>
            Controle de integrantes, papéis operacionais e convites em{" "}
            <strong className="text-foreground">{activeContext.tenantName}</strong>
          </>
        }
        actions={<RoleBadge role={activeContext.role} showPrefix />}
      />

      <MembersManager
        tenantId={activeContext.tenantId}
        currentUserId={sessionUser.id}
        currentUserRole={activeContext.role}
        members={members}
        invitations={invitations}
      />
    </AppShell>
  );
}
