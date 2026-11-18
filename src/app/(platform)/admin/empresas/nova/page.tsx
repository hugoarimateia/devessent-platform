import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/core/auth/services/auth-service";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { NewTenantForm } from "@/components/admin/new-tenant-form";

export const metadata: Metadata = {
  title: "Novo Estabelecimento | DevEssent Admin",
  description: "Provisionamento atômico de estabelecimento SaaS multiempresa.",
};

export default async function NovaEmpresaPage() {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  return (
    <AppShell user={sessionUser!} contextMode="platform">
      <PageHeader
        breadcrumbs={[
          { label: "Console Central", href: "/admin" },
          { label: "Empresas", href: "/admin/empresas" },
          { label: "Nova Empresa" },
        ]}
        eyebrow="Provisionamento Transacional"
        title="Cadastrar Novo Estabelecimento"
        description="Criação atômica de estabelecimento, configurações padrão e vínculo irrevogável do proprietário inicial."
      />

      <NewTenantForm />
    </AppShell>
  );
}
