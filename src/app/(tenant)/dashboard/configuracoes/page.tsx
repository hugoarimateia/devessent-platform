import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceSession } from "@/lib/workspace/workspace-context";
import { TenantService } from "@/core/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/ui/role-badge";
import { SettingsForm } from "@/components/dashboard/settings-form";

export const metadata: Metadata = {
  title: "Configurações | DevEssent Platform",
  description: "Configurações operacionais e regionais do estabelecimento.",
};

export default async function ConfiguracoesPage() {
  const workspace = await resolveWorkspaceSession();

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/configuracoes");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { activeContext } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
  }

  // Reutiliza configurações já trazidas no bootstrap consolidado (0 roundtrip extra)
  const settings =
    workspace.activeTenantSettings ??
    (await TenantService.getSettings(await createClient(), activeContext));

  const canEdit =
    activeContext.role === "owner" ||
    activeContext.role === "manager" ||
    activeContext.role === "platform_admin";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: activeContext.tenantName, href: "/dashboard" },
          { label: "Configurações" },
        ]}
        eyebrow="Identidade & Parâmetros Operacionais"
        title="Configurações do Estabelecimento"
        description={
          <>
            Parâmetros cadastrais, identidade de exibição e preferências regionais de{" "}
            <strong className="text-foreground">{activeContext.tenantName}</strong>
          </>
        }
        actions={<RoleBadge role={activeContext.role} showPrefix />}
      />

      <SettingsForm
        tenantId={activeContext.tenantId}
        tenantSlug={activeContext.slug}
        tenantName={activeContext.tenantName}
        initialSettings={settings}
        canEdit={canEdit}
      />
    </>
  );
}
