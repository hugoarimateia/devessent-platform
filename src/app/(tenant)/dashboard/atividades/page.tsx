import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  buildSpeculativeRlsTenantContext,
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import {
  AuditService,
  AUDIT_FILTER_ACTION_OPTIONS,
  type AuditPeriodFilter,
} from "@/core/audit";
import {
  getVisibleTenantAuditActions,
  hasPermission,
} from "@/core/permissions/policies/role-matrix";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/ui/role-badge";
import { AccessDeniedState } from "@/components/ui/access-denied-state";
import { AuditLogViewer } from "@/components/audit/audit-log-viewer";

export const metadata: Metadata = {
  title: "Histórico de Atividades | DevEssent Platform",
  description:
    "Trilha auditável de alterações operacionais, equipe, convites e configurações do estabelecimento ativo.",
};

interface DashboardAtividadesPageProps {
  searchParams: Promise<{
    action?: string;
    period?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: string;
  }>;
}

const VALID_PERIODS = new Set(["7d", "30d", "90d", "all"]);

export default async function DashboardAtividadesPage({
  searchParams,
}: DashboardAtividadesPageProps) {
  const [params, supabase] = await Promise.all([searchParams, createClient()]);

  const period: AuditPeriodFilter = VALID_PERIODS.has(params.period ?? "")
    ? (params.period as AuditPeriodFilter)
    : "30d";
  const parsedPage = Math.max(1, Number(params.page) || 1);

  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;
  const speculativeCtx = hintTenantId
    ? buildSpeculativeRlsTenantContext(hintTenantId)
    : null;

  const [workspace, prefetchedAudit] = await Promise.all([
    resolveWorkspaceSession(),
    speculativeCtx
      ? AuditService.listTenantAuditLogs(
          supabase,
          "",
          speculativeCtx.tenantId,
          {
            action: params.action,
            period,
            from: params.from,
            to: params.to,
            search: params.search,
            page: parsedPage,
            pageSize: 15,
          },
          speculativeCtx
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/atividades");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { sessionUser, activeContext } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
  }

  if (!hasPermission(activeContext.role, "view_tenant_audit_logs")) {
    return (
      <div className="py-6 flex justify-center">
        <AccessDeniedState
          title="Auditoria Restrita à Gestão"
          description="Seu papel operacional atual (Equipe) não inclui visualização da trilha de auditoria deste estabelecimento."
          returnHref="/dashboard"
          returnLabel="Voltar ao Painel"
        />
      </div>
    );
  }

  const visibleActions = getVisibleTenantAuditActions(activeContext.role);
  const allowedActionOptions = visibleActions
    ? AUDIT_FILTER_ACTION_OPTIONS.filter((opt) =>
        visibleActions.includes(opt.value)
      )
    : AUDIT_FILTER_ACTION_OPTIONS;

  const canReusePrefetched =
    hintTenantId !== null &&
    activeContext.tenantId === hintTenantId &&
    prefetchedAudit !== null &&
    (activeContext.role === "owner" || activeContext.role === "platform_admin");

  const auditResult = canReusePrefetched
    ? prefetchedAudit!
    : await AuditService.listTenantAuditLogs(
        supabase,
        sessionUser.id,
        activeContext.tenantId,
        {
          action: params.action,
          period,
          from: params.from,
          to: params.to,
          search: params.search,
          page: parsedPage,
          pageSize: 15,
        },
        activeContext
      );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: activeContext.tenantName, href: "/dashboard" },
          { label: "Atividades" },
        ]}
        eyebrow="Auditoria do Estabelecimento"
        title="Histórico de Atividades"
        description={
          activeContext.role === "manager" ? (
            <>
              Eventos operacionais de equipe, convites e configurações em{" "}
              <strong className="text-foreground">{activeContext.tenantName}</strong>{" "}
              conforme sua alçada de gestão.
            </>
          ) : (
            <>
              Registro cronológico auditável dos eventos administrativos e operacionais em{" "}
              <strong className="text-foreground">{activeContext.tenantName}</strong>.
            </>
          )
        }
        actions={<RoleBadge role={activeContext.role} showPrefix />}
      />

      <AuditLogViewer
        mode="tenant"
        items={auditResult.items}
        totalCount={auditResult.totalCount}
        page={auditResult.page}
        totalPages={auditResult.totalPages}
        pageSize={auditResult.pageSize}
        actionOptions={allowedActionOptions}
        initialFilters={{
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
