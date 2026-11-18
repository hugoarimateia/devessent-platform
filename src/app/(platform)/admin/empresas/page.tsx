import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TenantsManager } from "@/components/admin/tenants-manager";
import { PlusCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Gerenciamento de Empresas | DevEssent Admin",
  description: "Controle de estabelecimentos cadastrados na plataforma DevEssent.",
};

export default async function AdminEmpresasPage() {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  const adminSupabase = createAdminClient();
  const tenants = await TenantService.listAllTenants(
    adminSupabase,
    sessionUser!.id
  );

  return (
    <AppShell user={sessionUser!} contextMode="platform">
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
    </AppShell>
  );
}
