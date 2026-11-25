import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NewTenantForm } from "@/components/admin/new-tenant-form";

export const metadata: Metadata = {
  title: "Novo Estabelecimento | DevEssent Admin",
  description: "Provisionamento atômico de estabelecimento SaaS multiempresa.",
};

export default function NovaEmpresaPage() {
  return (
    <>
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
    </>
  );
}
