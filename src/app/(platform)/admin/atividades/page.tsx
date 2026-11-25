import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSessionUserCached } from "@/lib/workspace/workspace-context";
import {
  AuditService,
  AUDIT_FILTER_ACTION_OPTIONS,
  type AuditPeriodFilter,
} from "@/core/audit";
import { TenantService } from "@/core/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { AuditLogViewer } from "@/components/audit/audit-log-viewer";
import { Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Histórico de Atividades | DevEssent Admin",
  description:
    "Trilha consolidada de auditoria global multiempresa para administradores da plataforma.",
};

interface AdminAtividadesPageProps {
  searchParams: Promise<{
    tenantId?: string;
    action?: string;
    period?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: string;
  }>;
}

const VALID_PERIODS = new Set(["7d", "30d", "90d", "all"]);

export default async function AdminAtividadesPage({
  searchParams,
}: AdminAtividadesPageProps) {
  const [params, supabase, sessionUser] = await Promise.all([
    searchParams,
    createClient(),
    resolveSessionUserCached(),
  ]);

  if (!sessionUser) {
    redirect("/login?redirect=/admin/atividades");
  }

  if (!sessionUser.isPlatformAdmin) {
    redirect("/forbidden");
  }

  const adminSupabase = createAdminClient();
  const period: AuditPeriodFilter = VALID_PERIODS.has(params.period ?? "")
    ? (params.period as AuditPeriodFilter)
    : "30d";

  const parsedPage = Math.max(1, Number(params.page) || 1);

  const [tenants, auditResult] = await Promise.all([
    TenantService.listAllTenants(adminSupabase, sessionUser.id),
    AuditService.listPlatformAuditLogs(supabase, sessionUser.id, {
      tenantId: params.tenantId,
      action: params.action,
      period,
      from: params.from,
      to: params.to,
      search: params.search,
      page: parsedPage,
      pageSize: 15,
    }),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Visão Global", href: "/admin" },
          { label: "Atividades" },
        ]}
        eyebrow="Auditoria & Governança Global"
        title="Histórico Global de Atividades"
        description="Inspeção consolidada de criação de estabelecimentos, alterações de status, convites, vínculos e configurações em toda a plataforma."
        actions={
          <Link
            href="/admin/empresas"
            className="inline-flex items-center gap-2 min-h-[38px] px-3.5 rounded-[10px] border border-surface-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 text-foreground-muted" />
            <span>Empresas ({tenants.length})</span>
          </Link>
        }
      />

      <AuditLogViewer
        mode="platform"
        items={auditResult.items}
        totalCount={auditResult.totalCount}
        page={auditResult.page}
        totalPages={auditResult.totalPages}
        pageSize={auditResult.pageSize}
        actionOptions={AUDIT_FILTER_ACTION_OPTIONS}
        tenantOptions={tenants.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
        }))}
        initialFilters={{
          tenantId: params.tenantId,
          action: params.action,
          period,
          from: params.from,
          to: params.to,
          search: params.search,
        }}
      />
    </>
  );
}
