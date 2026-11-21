import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import {
  BillingPermissionService,
  BillingSubscriptionService,
} from "@/modules/billing";
import { TenantSubscriptionPanel } from "@/modules/billing/components/tenant-subscription-panel";

export const metadata: Metadata = {
  title: "Minha Assinatura | DevEssent Platform",
  description:
    "Consulta contratual da assinatura SaaS e histórico de mensalidades do estabelecimento junto à DevEssent.",
};

export const dynamic = "force-dynamic";

export default async function TenantAssinaturaPage() {
  const [supabase, hintTenantId] = await Promise.all([
    createClient(),
    getActiveTenantHintUuid(),
  ]);

  // Pré-busca paralela RLS-enforced (Fase 6D.2): só utilizada se hintTenantId coincidir com activeContext
  // e após confirmação explícita da permissão RBAC do usuário.
  const [workspace, prefetchedView] = await Promise.all([
    resolveWorkspaceSession(),
    hintTenantId
      ? BillingSubscriptionService.getTenantOwnerBillingView({
          supabase,
          actorRole: "owner",
          tenantId: hintTenantId,
          tenantName: "",
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/assinatura");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { activeContext } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
  }

  // Restrição estrita (§7, §12): apenas owner do estabelecimento (ou platform_admin) pode acessar
  if (!BillingPermissionService.hasPermission(activeContext.role, "view_own_tenant_billing")) {
    redirect("/forbidden");
  }

  const billingView =
    prefetchedView && hintTenantId === activeContext.tenantId
      ? { ...prefetchedView, tenantName: activeContext.tenantName }
      : await BillingSubscriptionService.getTenantOwnerBillingView({
          supabase,
          actorRole: activeContext.role,
          tenantId: activeContext.tenantId,
          tenantName: activeContext.tenantName,
        });

  return (
    <TenantSubscriptionPanel
      view={billingView}
      ownerEmail={workspace.sessionUser.email}
      ownerName={workspace.sessionUser.fullName || workspace.sessionUser.email}
    />
  );
}
