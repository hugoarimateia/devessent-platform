import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSessionUserCached } from "@/lib/workspace/workspace-context";
import { RetailPaymentService } from "@/modules/retail/services/retail-payment-service";
import { RetailStoreService } from "@/modules/retail/services/retail-store-service";
import type { RetailPaymentConnectionSummary } from "@/modules/retail/types/retail.types";
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

export default async function AdminSitesPage({
  searchParams,
}: AdminSitesPageProps) {
  const [{ tenantId }, supabase, sessionUser] = await Promise.all([
    searchParams,
    createClient(),
    resolveSessionUserCached(),
  ]);

  if (!sessionUser) {
    redirect("/login?redirect=/admin/sites");
  }
  if (!sessionUser.isPlatformAdmin) {
    redirect("/forbidden");
  }

  const adminSupabase = createAdminClient();
  const stores = await RetailStoreService.listAllStoresForAdmin(
    adminSupabase,
    "platform_admin"
  );

  // Elimina loop N+1 sequencial: consulta todas as conexões em paralelo
  const connectionEntries = await Promise.all(
    stores.map(async (s) => {
      const summary = await RetailPaymentService.getConnectionSummary({
        supabase,
        context: {
          userId: sessionUser.id,
          tenantId: s.tenantId,
          tenantName: s.tenantName,
          slug: s.slug,
          status: "active",
          role: "platform_admin",
        },
      });
      return [s.tenantId, summary] as const;
    })
  );

  const paymentConnections: Record<string, RetailPaymentConnectionSummary> =
    Object.fromEntries(connectionEntries);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Console Global", href: "/admin" },
          { label: "Customização de Sites" },
        ]}
        eyebrow="Engenharia de Vitrines & Integrações · Exclusivo DevEssent"
        title="Customização Técnica & Pagamentos"
        description="Área interna para definir template, paleta visual, hero institucional e credenciais Sandbox de recebimento das lojas dos clientes sem expor segredos ou controles estruturais no painel operacional."
      />

      <SiteCustomizationManager
        stores={stores}
        initialTenantId={tenantId}
        paymentConnections={paymentConnections}
      />
    </div>
  );
}
