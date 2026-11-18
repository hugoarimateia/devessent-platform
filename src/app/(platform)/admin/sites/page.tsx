import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthService } from "@/core/auth/services/auth-service";
import { RetailStoreService } from "@/modules/retail";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { SiteCustomizationManager } from "@/components/admin/site-customization-manager";

export const metadata: Metadata = {
  title: "Customização de Sites | DevEssent Admin",
  description:
    "Console técnico exclusivo da equipe DevEssent para arquitetura visual e templates de vitrines.",
};

interface AdminSitesPageProps {
  searchParams: Promise<{ tenantId?: string }>;
}

export default async function AdminSitesPage({ searchParams }: AdminSitesPageProps) {
  const { tenantId } = await searchParams;
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  const adminSupabase = createAdminClient();
  const stores = await RetailStoreService.listAllStoresForAdmin(
    adminSupabase,
    "platform_admin"
  );

  return (
    <AppShell user={sessionUser!} contextMode="platform">
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: "Console Global", href: "/admin" },
            { label: "Customização de Sites" },
          ]}
          eyebrow="Engenharia de Vitrines · Exclusivo DevEssent"
          title="Customização Técnica de Sites"
          description="Área interna para definir template, paleta visual, hero institucional e pré-visualizações das lojas dos clientes sem expor controles estruturais no painel operacional."
        />

        <SiteCustomizationManager stores={stores} initialTenantId={tenantId} />
      </div>
    </AppShell>
  );
}
