import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  buildSpeculativeRlsTenantContext,
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { MembershipService, InvitationService } from "@/core/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/ui/role-badge";
import { MembersManager } from "@/components/dashboard/members-manager";

export const metadata: Metadata = {
  title: "Gestão de Membros | DevEssent Platform",
  description: "Gerencie permissões, papéis e convites de membros do estabelecimento.",
};

export default async function MembrosPage() {
  const supabase = await createClient();
  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;
  const speculativeCtx = hintTenantId
    ? buildSpeculativeRlsTenantContext(hintTenantId)
    : null;

  const [workspace, prefetchedMembers, prefetchedInvitations] =
    await Promise.all([
      resolveWorkspaceSession(),
      speculativeCtx
        ? MembershipService.listMembers(supabase, speculativeCtx).catch(() => null)
        : Promise.resolve(null),
      speculativeCtx
        ? InvitationService.listInvitations(supabase, speculativeCtx, {
            includeHistory: true,
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/membros");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { sessionUser, activeContext } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
  }

  const canManageInvitations =
    activeContext.role === "owner" ||
    activeContext.role === "manager" ||
    activeContext.role === "platform_admin";
  const hintMatched = Boolean(
    hintTenantId && activeContext.tenantId === hintTenantId
  );

  const [members, invitations] = await Promise.all([
    hintMatched && prefetchedMembers !== null
      ? Promise.resolve(prefetchedMembers)
      : MembershipService.listMembers(supabase, activeContext),
    canManageInvitations
      ? hintMatched && prefetchedInvitations !== null
        ? Promise.resolve(prefetchedInvitations)
        : InvitationService.listInvitations(supabase, activeContext, {
            includeHistory: true,
          }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <>
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
    </>
  );
}
