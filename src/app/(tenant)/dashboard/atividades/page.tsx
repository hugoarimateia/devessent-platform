import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import {
  AuditService,
  AUDIT_FILTER_ACTION_OPTIONS,
  type AuditPeriodFilter,
} from "@/core/audit";
import { TenantService } from "@/core/tenants";
import { TenantSuspendedError } from "@/core/errors/app-error";
import {
  getVisibleTenantAuditActions,
  hasPermission,
} from "@/core/permissions/policies/role-matrix";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/ui/role-badge";
import { SuspendedTenantState } from "@/components/ui/suspended-tenant-state";
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
  const params = await searchParams;
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/atividades");
  }

  const userTenants = await TenantService.listUserTenants(
    supabase,
    sessionUser.id
  );
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

  if (!hasPermission(activeContext.role, "view_tenant_audit_logs")) {
    return (
      <AppShell
        user={sessionUser}
        contextMode="tenant"
        tenants={userTenants}
        activeTenantId={activeContext.tenantId}
        activeRole={activeContext.role}
      >
        <div className="py-6 flex justify-center">
          <AccessDeniedState
            title="Auditoria Restrita à Gestão"
            description="Seu papel operacional atual (Equipe) não inclui visualização da trilha de auditoria deste estabelecimento."
            returnHref="/dashboard"
            returnLabel="Voltar ao Painel"
          />
        </div>
      </AppShell>
    );
  }

  const period: AuditPeriodFilter = VALID_PERIODS.has(params.period ?? "")
    ? (params.period as AuditPeriodFilter)
    : "30d";

  const parsedPage = Math.max(1, Number(params.page) || 1);
  const visibleActions = getVisibleTenantAuditActions(activeContext.role);
  const allowedActionOptions = visibleActions
    ? AUDIT_FILTER_ACTION_OPTIONS.filter((opt) =>
        visibleActions.includes(opt.value)
      )
    : AUDIT_FILTER_ACTION_OPTIONS;

  const auditResult = await AuditService.listTenantAuditLogs(
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
    }
  );

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
    </AppShell>
  );
}

