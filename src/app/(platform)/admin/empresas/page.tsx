import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSessionUserCached } from "@/lib/workspace/workspace-context";
import { TenantService } from "@/core/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { TenantsManager } from "@/components/admin/tenants-manager";
import { PlusCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Gerenciamento de Empresas | DevEssent Admin",
  description: "Controle de estabelecimentos cadastrados na plataforma DevEssent.",
};

export default async function AdminEmpresasPage() {
  const sessionUser = await resolveSessionUserCached();

  if (!sessionUser) {
    redirect("/login?redirect=/admin/empresas");
  }
  if (!sessionUser.isPlatformAdmin) {
    redirect("/forbidden");
  }

  const adminSupabase = createAdminClient();
  const tenants = await TenantService.listAllTenants(
    adminSupabase,
    sessionUser.id
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Console Central", href: "/admin" },
          { label: "Empresas" },
        ]}
        eyebrow="Governança Multiempresa"
        title="Gestão de Estabelecimentos SaaS"
        description="Administração global de unidades, controle de status operacional, filtros e auditoria de proprietários."
        actions={
          <Link
            href="/admin/empresas/nova"
            className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-[10px] bg-[#10131C] text-white dark:bg-accent hover:bg-[#1E2436] dark:hover:bg-accent-secondary text-[13px] font-semibold transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Empresa</span>
          </Link>
        }
      />

      <TenantsManager tenants={tenants} />
    </>
  );
}
