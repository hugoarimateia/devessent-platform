import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants";
import { TenantSuspendedError } from "@/core/errors/app-error";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/ui/role-badge";
import { SuspendedTenantState } from "@/components/ui/suspended-tenant-state";
import { SettingsForm } from "@/components/dashboard/settings-form";

export const metadata: Metadata = {
  title: "Configurações | DevEssent Platform",
  description: "Configurações operacionais e regionais do estabelecimento.",
};

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/configuracoes");
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

  const settings = await TenantService.getSettings(supabase, activeContext);
  const canEdit =
    activeContext.role === "owner" ||
    activeContext.role === "manager" ||
    activeContext.role === "platform_admin";

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
    </AppShell>
  );
}
