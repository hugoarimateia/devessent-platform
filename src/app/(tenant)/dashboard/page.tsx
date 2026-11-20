import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  buildSpeculativeRlsTenantContext,
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { AuditService, type AuditLogViewItem } from "@/core/audit";
import {
  MembershipService,
  InvitationService,
  type TenantMemberItem,
  type TenantInvitationItem,
} from "@/core/tenants";
import { hasPermission } from "@/core/permissions/policies/role-matrix";
import { RetailProductService } from "@/modules/retail/services/retail-product-service";
import { RetailOrderService } from "@/modules/retail/services/retail-order-service";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";
import type {
  RetailDashboardSummary,
  RetailOrderStats,
} from "@/modules/retail/types/retail.types";
import { RoleBadge } from "@/components/ui/role-badge";
import { DataTable } from "@/components/ui/data-table";
import { QuickTenantSwitcher } from "@/components/dashboard/quick-tenant-switcher";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  CategoryDistributionChart,
  CatalogStatusDonutChart,
} from "@/components/dashboard/dashboard-charts";
import { resolveTenantBrand, ROLE_DISPLAY_MAP } from "@/lib/theme/tenant-brand";
import {
  Users,
  Settings,
  ArrowRight,
  ArrowUpRight,
  ShieldAlert,
  Globe,
  Mail,
  RefreshCw,
  Package,
  Store,
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  Plus,
  ExternalLink,
  Activity,
  ChevronRight,
  Shield,
  SlidersHorizontal,
  UserPlus,
  ClipboardList,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Área de Trabalho | DevEssent Platform",
  description: "Painel operacional do estabelecimento.",
};

function getAuditCategoryIcon(category: AuditLogViewItem["actionCategory"]) {
  switch (category) {
    case "comercial":
      return <Package className="w-3.5 h-3.5 text-accent" aria-hidden="true" />;
    case "equipe":
      return <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />;
    case "convites":
      return <Mail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />;
    case "configuracao":
      return <Settings className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />;
    default:
      return <Activity className="w-3.5 h-3.5 text-foreground-muted" aria-hidden="true" />;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;
  const speculativeCtx = hintTenantId
    ? buildSpeculativeRlsTenantContext(hintTenantId)
    : null;

  // 1 único roundtrip paralelo: bootstrap consolidado do workspace + leituras protegidas por RLS
  const [
    workspace,
    prefetchedMembers,
    prefetchedInvitations,
    prefetchedSummary,
    prefetchedOrderStats,
    prefetchedAudits,
  ] = await Promise.all([
    resolveWorkspaceSession(),
    speculativeCtx
      ? MembershipService.listMembers(supabase, speculativeCtx).catch(() => null)
      : Promise.resolve(null),
    speculativeCtx
      ? InvitationService.listInvitations(supabase, speculativeCtx).catch(() => null)
      : Promise.resolve(null),
    hintTenantId
      ? RetailProductService.getDashboardSummary(supabase, hintTenantId).catch(
          () => null
        )
      : Promise.resolve(null),
    speculativeCtx
      ? RetailOrderService.getOrderStats(supabase, speculativeCtx).catch(() => null)
      : Promise.resolve(null),
    speculativeCtx
      ? AuditService.listTenantAuditLogs(
          supabase,
          "",
          speculativeCtx.tenantId,
          { period: "all", page: 1, pageSize: 5 },
          speculativeCtx
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!workspace.sessionUser) {
    redirect("/login");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const {
    sessionUser,
    userTenants,
    selectedTenant,
    activeContext,
    activeTenantSettings: tenantSettings,
    activeRetailStore: retailStore,
  } = workspace;

  let members: TenantMemberItem[] = [];
  let invitations: TenantInvitationItem[] = [];
  let recentAudits: AuditLogViewItem[] = [];
  let retailSummary: RetailDashboardSummary | null = null;
  let orderStats: RetailOrderStats | null = null;

  if (activeContext) {
    const canManageInvitations =
      activeContext.role === "owner" ||
      activeContext.role === "manager" ||
      activeContext.role === "platform_admin";
    const canViewAudit = hasPermission(activeContext.role, "view_tenant_audit_logs");
    const canFetchOrders = RetailPermissionService.hasPermission(
      activeContext.role,
      "view_retail_orders"
    );
    const retailActiveNow = Boolean(retailStore?.isActive);
    const hintMatched = Boolean(
      hintTenantId && activeContext.tenantId === hintTenantId
    );
    // Para manager, aplicamos o escopo restrito de ações via serviço; owner/admin veem todas as ações
    const canReusePrefetchedAudits =
      hintMatched &&
      canViewAudit &&
      prefetchedAudits !== null &&
      (activeContext.role === "owner" || activeContext.role === "platform_admin");

    const [membersRes, invitationsRes, auditsRes, summaryRes, orderStatsRes] =
      await Promise.all([
        hintMatched && prefetchedMembers !== null
          ? Promise.resolve(prefetchedMembers)
          : MembershipService.listMembers(supabase, activeContext).catch(() => []),
        canManageInvitations
          ? hintMatched && prefetchedInvitations !== null
            ? Promise.resolve(prefetchedInvitations)
            : InvitationService.listInvitations(supabase, activeContext).catch(
                () => []
              )
          : Promise.resolve([]),
        canViewAudit
          ? canReusePrefetchedAudits
            ? Promise.resolve(prefetchedAudits!)
            : AuditService.listTenantAuditLogs(
                supabase,
                sessionUser.id,
                activeContext.tenantId,
                { period: "all", page: 1, pageSize: 5 },
                activeContext
              ).catch(() => ({
                items: [] as AuditLogViewItem[],
                totalCount: 0,
                page: 1,
                pageSize: 5,
              }))
          : Promise.resolve({
              items: [] as AuditLogViewItem[],
              totalCount: 0,
              page: 1,
              pageSize: 5,
            }),
        retailActiveNow
          ? hintMatched && prefetchedSummary !== null
            ? Promise.resolve(prefetchedSummary)
            : RetailProductService.getDashboardSummary(
                supabase,
                activeContext.tenantId
              ).catch(() => null)
          : Promise.resolve(null),
        retailActiveNow && canFetchOrders
          ? hintMatched && prefetchedOrderStats !== null
            ? Promise.resolve(prefetchedOrderStats)
            : RetailOrderService.getOrderStats(supabase, activeContext).catch(
                () => null
              )
          : Promise.resolve(null),
      ]);

    members = membersRes;
    invitations = invitationsRes;
    recentAudits = auditsRes.items;
    retailSummary = summaryRes;
    orderStats = orderStatsRes;
  }

  const brand = resolveTenantBrand({
    slug: activeContext?.slug || selectedTenant?.slug,
    name: activeContext?.tenantName || selectedTenant?.name,
    displayName: tenantSettings?.display_name || selectedTenant?.displayName,
    segmentLabel: tenantSettings?.segment_label || selectedTenant?.segmentLabel,
    primaryColor: tenantSettings?.primary_color || selectedTenant?.primaryColor,
    monogram: tenantSettings?.monogram || selectedTenant?.monogram,
    brandDescription:
      tenantSettings?.brand_description || selectedTenant?.brandDescription,
  });

  const effectiveRole = activeContext?.role || selectedTenant?.role || "staff";
  const roleInfo = ROLE_DISPLAY_MAP[effectiveRole] || ROLE_DISPLAY_MAP.staff;
  const canManageTeam =
    effectiveRole === "owner" ||
    effectiveRole === "manager" ||
    effectiveRole === "platform_admin";
  const canViewAudit = hasPermission(effectiveRole, "view_tenant_audit_logs");
  const canManageProducts = RetailPermissionService.hasPermission(
    effectiveRole,
    "manage_products"
  );
  const canViewOrders = RetailPermissionService.hasPermission(
    effectiveRole,
    "view_retail_orders"
  );

  const ownersCount = members.filter((m) => m.role === "owner").length;
  const managersCount = members.filter((m) => m.role === "manager").length;
  const staffCount = members.filter((m) => m.role === "staff").length;

  const userFirstName =
    sessionUser.fullName.replace(/\s*\([^)]*\)\s*/g, "").trim().split(" ")[0] ||
    sessionUser.fullName;

  const retailActive = Boolean(retailStore?.isActive);
  const stats = retailSummary?.stats || {
    totalProducts: 0,
    publishedProducts: 0,
    draftProducts: 0,
    archivedProducts: 0,
    outOfStockProducts: 0,
    totalCategories: 0,
  };
  const lowStockProducts = retailSummary?.lowStockProducts || 0;
  const totalStockUnits = retailSummary?.totalStockUnits || 0;
  const categoryDistribution = retailSummary?.categoryDistribution || [];

  // Pendências operacionais estritamente reais
  const attentionItems: Array<{
    key: string;
    label: string;
    count: number;
    href: string;
    tone: "warning" | "danger" | "info";
    icon: React.ReactNode;
  }> = [];

  if (retailActive && canViewOrders && orderStats && orderStats.requestedOrders > 0) {
    attentionItems.push({
      key: "requested-orders",
      label: "Pedidos aguardando confirmação",
      count: orderStats.requestedOrders,
      href: "/dashboard/retail/pedidos?status=requested",
      tone: "warning",
      icon: <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />,
    });
  }
  if (canManageTeam && invitations.length > 0) {
    attentionItems.push({
      key: "invitations",
      label: "Convites aguardando aceitação",
      count: invitations.length,
      href: "/dashboard/membros",
      tone: "info",
      icon: <Mail className="w-3.5 h-3.5" aria-hidden="true" />,
    });
  }
  if (retailActive && canManageProducts && stats.draftProducts > 0) {
    attentionItems.push({
      key: "drafts",
      label: "Produtos em rascunho",
      count: stats.draftProducts,
      href: "/dashboard/retail/produtos?status=draft",
      tone: "warning",
      icon: <FileEdit className="w-3.5 h-3.5" aria-hidden="true" />,
    });
  }
  if (
    retailActive &&
    retailStore?.inventoryMode === "track_quantity" &&
    stats.outOfStockProducts > 0
  ) {
    attentionItems.push({
      key: "out-of-stock",
      label: "Produtos sem estoque",
      count: stats.outOfStockProducts,
      href: "/dashboard/retail/produtos",
      tone: "danger",
      icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />,
    });
  }
  if (
    retailActive &&
    retailStore?.inventoryMode === "track_quantity" &&
    lowStockProducts > 0
  ) {
    attentionItems.push({
      key: "low-stock",
      label: "Estoque baixo (≤ 5 un)",
      count: lowStockProducts,
      href: "/dashboard/retail/produtos",
      tone: "warning",
      icon: <Package className="w-3.5 h-3.5" aria-hidden="true" />,
    });
  }

  // Ações rápidas reais e condicionais às permissões
  const quickActions: Array<{
    key: string;
    label: string;
    href: string;
    external?: boolean;
    icon: React.ReactNode;
  }> = [];

  if (retailActive && canViewOrders) {
    quickActions.push({
      key: "orders",
      label: "Pedidos",
      href: "/dashboard/retail/pedidos",
      icon: <ClipboardList className="w-4 h-4 text-accent" aria-hidden="true" />,
    });
  }
  if (retailActive && canManageProducts) {
    quickActions.push({
      key: "new-product",
      label: "Novo Produto",
      href: "/dashboard/retail/produtos/novo",
      icon: <Plus className="w-4 h-4 text-accent" aria-hidden="true" />,
    });
  }
  if (retailActive) {
    quickActions.push({
      key: "catalog",
      label: "Catálogo Retail",
      href: "/dashboard/retail/produtos",
      icon: <Package className="w-4 h-4 text-accent" aria-hidden="true" />,
    });
  }
  if (retailActive && retailStore?.slug) {
    quickActions.push({
      key: "storefront",
      label: "Ver Vitrine",
      href: `/loja/${retailStore.slug}`,
      external: true,
      icon: <ExternalLink className="w-4 h-4 text-accent" aria-hidden="true" />,
    });
  }
  if (canManageTeam) {
    quickActions.push({
      key: "team",
      label: "Convidar Equipe",
      href: "/dashboard/membros",
      icon: <UserPlus className="w-4 h-4 text-accent" aria-hidden="true" />,
    });
  }
  if (!retailActive) {
    quickActions.push({
      key: "retail-panel",
      label: "Painel Retail",
      href: "/dashboard/retail",
      icon: <Store className="w-4 h-4 text-accent" aria-hidden="true" />,
    });
  }
  if (canViewAudit && quickActions.length < 4) {
    quickActions.push({
      key: "activities",
      label: "Atividades",
      href: "/dashboard/atividades",
      icon: <Activity className="w-4 h-4 text-accent" aria-hidden="true" />,
    });
  }
  if (canManageTeam && quickActions.length < 4) {
    quickActions.push({
      key: "settings",
      label: "Configurações",
      href: "/dashboard/configuracoes",
      icon: <SlidersHorizontal className="w-4 h-4 text-accent" aria-hidden="true" />,
    });
  }

  return (
    <>
      {/* CENÁRIO 1: Estabelecimento Ativo e Operacional */}
      {activeContext && (
        <div className="space-y-6">
          {/* A — Novo Banner Principal HORIZON Administrativo */}
          <DashboardBanner
            tenantName={activeContext.tenantName}
            tenantSlug={activeContext.slug}
            monogram={brand.monogram}
            segmentTag={brand.segmentTag}
            role={activeContext.role}
            userFirstName={userFirstName}
            brandFillColor={brand.fillLight}
            retailActive={retailActive}
            storeSlug={retailStore?.slug}
            publishedProductsCount={stats.publishedProducts}
            totalProductsCount={stats.totalProducts}
            membersCount={members.length}
            tenantsCount={userTenants.length}
            canManageProducts={canManageProducts}
            canManageTeam={canManageTeam}
          />

          {/* B — Faixa de KPIs Compactos e Reais (1 card violeta destaque + 3 neutros em largura total) */}
          <section
            aria-label="Indicadores operacionais da unidade"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {retailActive ? (
              <KpiCard
                highlighted
                title="Produtos Publicados"
                value={stats.publishedProducts}
                unit="ativos"
                icon={<Package className="w-4 h-4" />}
                badge={{
                  label: `${stats.totalProducts} no catálogo`,
                  tone: "accent",
                }}
                description="Itens visíveis na vitrine pública"
                tooltip="Quantidade real de produtos publicados em /loja e elegíveis para visualização pública."
                href="/dashboard/retail/produtos?status=published"
              />
            ) : (
              <KpiCard
                highlighted
                title="Integrantes Ativos"
                value={members.length}
                unit={members.length === 1 ? "pessoa" : "pessoas"}
                icon={<Users className="w-4 h-4" />}
                description={`${ownersCount} prop. · ${managersCount} gest. · ${staffCount} equipe`}
                tooltip="Total de usuários credenciados com vínculo ativo nesta empresa."
                href="/dashboard/membros"
              />
            )}

            {retailActive ? (
              <KpiCard
                title="Integrantes Ativos"
                value={members.length}
                unit={members.length === 1 ? "membro" : "membros"}
                icon={<Users className="w-4 h-4" />}
                description={`${ownersCount} prop. · ${managersCount} gest. · ${staffCount} equipe`}
                tooltip="Membros vinculados à unidade respeitando controle RBAC."
                href="/dashboard/membros"
              />
            ) : (
              <KpiCard
                title="Módulo Retail"
                value="Inativo"
                icon={<Store className="w-4 h-4" />}
                badge={{ label: "Catálogo", tone: "neutral" }}
                description="Ative para gerenciar produtos"
                href="/dashboard/retail"
              />
            )}

            {retailActive && canViewOrders && orderStats ? (
              <KpiCard
                title="Pedidos Recebidos"
                value={orderStats.totalOrders}
                unit="pedidos"
                icon={<ClipboardList className="w-4 h-4" />}
                badge={
                  orderStats.requestedOrders > 0
                    ? {
                        label: `${orderStats.requestedOrders} pendente(s)`,
                        tone: "warning",
                      }
                    : { label: "Em dia", tone: "success" }
                }
                description={`${orderStats.inProgressOrders} confirmados/em preparo · ${orderStats.completedOrders} concluídos`}
                tooltip="Solicitações e pedidos reais registrados na loja (sem cobrança online)."
                href="/dashboard/retail/pedidos"
              />
            ) : canManageTeam ? (
              <KpiCard
                title="Convites Abertos"
                value={invitations.length}
                icon={<Mail className="w-4 h-4" />}
                badge={
                  invitations.length > 0
                    ? { label: "Pendentes", tone: "warning" }
                    : { label: "Em dia", tone: "success" }
                }
                description={
                  invitations.length > 0
                    ? "Aguardando aceite do integrante"
                    : "Nenhum convite pendente"
                }
                tooltip="Convites corporativos emitidos que ainda não foram aceitos ou expiraram."
                href="/dashboard/membros"
              />
            ) : (
              <KpiCard
                title="Categorias Ativas"
                value={retailActive ? categoryDistribution.length : 0}
                icon={<Store className="w-4 h-4" />}
                description="Linhas disponíveis no catálogo"
                href="/dashboard/retail/categorias"
              />
            )}

            {retailActive ? (
              <KpiCard
                title="Estoque Consolidado"
                value={
                  retailStore?.inventoryMode === "track_quantity"
                    ? totalStockUnits
                    : "Livre"
                }
                unit={
                  retailStore?.inventoryMode === "track_quantity" ? "un" : undefined
                }
                icon={<AlertTriangle className="w-4 h-4" />}
                badge={
                  retailStore?.inventoryMode === "track_quantity"
                    ? stats.outOfStockProducts > 0
                      ? {
                          label: `${stats.outOfStockProducts} zerado(s)`,
                          tone: "danger",
                        }
                      : { label: "Regular", tone: "success" }
                    : { label: "Sem trava", tone: "neutral" }
                }
                description={`${categoryDistribution.length} categorias ativas`}
                tooltip="Soma real das unidades em estoque nas variantes cadastradas desta loja."
                href="/dashboard/retail/produtos"
              />
            ) : (
              <KpiCard
                title="Sua Alçada"
                value={roleInfo.shortLabel}
                icon={<Shield className="w-4 h-4" />}
                badge={{
                  label: `${userTenants.length} ${
                    userTenants.length === 1 ? "unidade" : "unidades"
                  }`,
                  tone: "accent",
                }}
                description="Papel operacional ativo"
              />
            )}
          </section>

          {/* C — Layout Assimétrico Premium: Gráficos & Tabela (Esquerda) + Ações, Pendências & Atividades (Direita) */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_336px] gap-6 items-start">
            {/* Coluna Principal */}
            <div className="space-y-6 min-w-0">

              {/* 2. Seção de Gráficos Reais (Distribuição por Categoria + Status do Catálogo/Equipe) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <CategoryDistributionChart
                  items={categoryDistribution}
                  totalProducts={stats.totalProducts}
                  retailActive={retailActive}
                />

                {retailActive ? (
                  <CatalogStatusDonutChart
                    title="Status do Catálogo"
                    subtitle="Composição real dos produtos cadastrados"
                    centerLabel="produtos"
                    href="/dashboard/retail/produtos"
                    tooltip="Distribuição entre produtos publicados na vitrine, rascunhos internos e itens arquivados."
                    slices={[
                      {
                        label: "Publicados",
                        count: stats.publishedProducts,
                        color: "#6E52F4",
                      },
                      {
                        label: "Rascunhos",
                        count: stats.draftProducts,
                        color: "#A782FF",
                      },
                      {
                        label: "Arquivados",
                        count: stats.archivedProducts,
                        color: "#64748B",
                      },
                    ]}
                  />
                ) : (
                  <CatalogStatusDonutChart
                    title="Composição da Equipe"
                    subtitle="Distribuição de papéis no estabelecimento"
                    centerLabel="membros"
                    href="/dashboard/membros"
                    tooltip="Proporção real entre proprietários, gestores e integrantes operacionais da unidade."
                    slices={[
                      {
                        label: "Proprietários",
                        count: ownersCount,
                        color: "#6E52F4",
                      },
                      {
                        label: "Gestores",
                        count: managersCount,
                        color: "#A782FF",
                      },
                      {
                        label: "Equipe",
                        count: staffCount,
                        color: "#94A3B8",
                      },
                    ]}
                  />
                )}
              </div>

              {/* 3. Tabela Operacional Unificada: Equipe do Estabelecimento */}
              <section
                aria-label="Integrantes da unidade"
                className="rounded-2xl border border-surface-border bg-surface overflow-hidden shadow-[var(--shadow-card)]"
              >
                <div className="px-5 py-4 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-base font-bold text-foreground tracking-tight">
                        {canManageTeam
                          ? "Equipe do Estabelecimento"
                          : "Diretório da Equipe"}
                      </h2>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-muted border border-surface-border text-foreground tabular-nums">
                        {members.length}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      {canManageTeam
                        ? "Profissionais credenciados com acesso ativo às rotinas operacionais."
                        : "Integrantes e lideranças responsáveis por esta unidade."}
                    </p>
                  </div>

                  <Link
                    href="/dashboard/membros"
                    prefetch={false}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline self-start sm:self-auto"
                  >
                    <span>
                      {canManageTeam ? "Convidar ou gerenciar" : "Ver relação completa"}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>

                <DataTable
                  embedded
                  ariaLabel="Integrantes ativos do estabelecimento"
                >
                  <thead>
                    <tr className="border-b border-surface-border bg-surface-muted/40 text-foreground-muted text-[11px] uppercase tracking-[0.08em]">
                      <th className="py-3 px-5 font-semibold">Integrante</th>
                      <th className="py-3 px-4 font-semibold">Papel</th>
                      <th className="py-3 px-4 font-semibold">Escopo</th>
                      <th className="py-3 px-5 font-semibold text-right">Ingresso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border text-xs">
                    {members.slice(0, 6).map((member) => {
                      const isSelf = member.userId === sessionUser.id;
                      const mCleanName =
                        member.fullName.replace(/\s*\([^)]*\)\s*/g, "").trim() ||
                        member.fullName;
                      const mInitials = mCleanName
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join("");

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-surface-muted/40 transition-colors"
                        >
                          <td data-label="Integrante" className="py-3.5 px-5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-surface-muted border border-surface-border flex items-center justify-center font-mono font-bold text-[10px] text-foreground shrink-0">
                                {mInitials || "U"}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground">
                                  {member.fullName}
                                </span>
                                {isSelf && (
                                  <span
                                    className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                                    style={{
                                      backgroundColor: "var(--t-badge-bg)",
                                      color: "var(--t-badge-text)",
                                    }}
                                  >
                                    você
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td data-label="Papel" className="py-3.5 px-4">
                            <RoleBadge role={member.role} />
                          </td>
                          <td data-label="Escopo" className="py-3.5 px-4 text-foreground-muted">
                            {member.role === "owner"
                              ? "Governança integral da unidade"
                              : member.role === "manager"
                              ? "Gestão de equipe e catálogo"
                              : "Operação e consulta"}
                          </td>
                          <td
                            data-label="Ingresso"
                            className="py-3.5 px-5 text-right font-mono text-foreground-muted tabular-nums"
                          >
                            {new Date(member.createdAt).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>

                <div className="px-5 py-3 border-t border-surface-border bg-surface-muted/35 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-foreground-muted">
                    Exibindo {Math.min(members.length, 6)} de {members.length}{" "}
                    integrantes vinculados
                  </span>
                  <div className="flex items-center gap-4">
                    <Link
                      href="/dashboard/membros"
                      prefetch={false}
                      className="font-semibold text-foreground hover:text-accent transition-colors"
                    >
                      Abrir lista de membros
                    </Link>
                    {canManageTeam && (
                      <Link
                        href="/dashboard/configuracoes"
                        prefetch={false}
                        className="font-semibold text-foreground-muted hover:text-foreground transition-colors"
                      >
                        Configurações da unidade
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Coluna Lateral Direita: Ações Rápidas, Painel de Atenção, Atividades & Unidade */}
            <aside className="space-y-5">
              {/* 1. Ações Rápidas */}
              {quickActions.length > 0 && (
                <section
                  aria-label="Ações rápidas"
                  className="rounded-2xl border border-surface-border bg-surface p-5 space-y-3.5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-sm font-bold text-foreground tracking-tight">
                      Ações Rápidas
                    </h2>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-muted">
                      Atalhos
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {quickActions.slice(0, 4).map((action) =>
                      action.external ? (
                        <a
                          key={action.key}
                          href={action.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-surface-border bg-surface-muted/35 hover:bg-accent/10 hover:border-accent/35 text-center transition-colors"
                        >
                          <span className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center">
                            {action.icon}
                          </span>
                          <span className="text-xs font-semibold text-foreground leading-tight">
                            {action.label}
                          </span>
                        </a>
                      ) : (
                        <Link
                          key={action.key}
                          href={action.href}
                          prefetch={false}
                          className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-surface-border bg-surface-muted/35 hover:bg-accent/10 hover:border-accent/35 text-center transition-colors"
                        >
                          <span className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center">
                            {action.icon}
                          </span>
                          <span className="text-xs font-semibold text-foreground leading-tight">
                            {action.label}
                          </span>
                        </Link>
                      )
                    )}
                  </div>
                </section>
              )}

              {/* 2. Painel de Atenção (Pendências Operacionais Reais) */}
              <section
                aria-label="Painel de atenção operacional"
                className="rounded-2xl border border-surface-border bg-surface overflow-hidden shadow-[var(--shadow-card)]"
              >
                <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-bold text-foreground tracking-tight">
                    Painel de Atenção
                  </h2>
                  <span
                    className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                      attentionItems.length > 0
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {attentionItems.length > 0
                      ? `${attentionItems.length} pendência(s)`
                      : "Em dia"}
                  </span>
                </div>

                {attentionItems.length === 0 ? (
                  <div className="px-5 py-4 flex items-center gap-3 text-xs text-foreground-muted">
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Nenhuma pendência operacional identificada agora.</span>
                  </div>
                ) : (
                  <ul className="divide-y divide-surface-border">
                    {attentionItems.map((item) => {
                      const badgeTone =
                        item.tone === "danger"
                          ? "bg-red-500/15 text-red-700 dark:text-red-300"
                          : item.tone === "warning"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-accent/15 text-accent";

                      return (
                        <li key={item.key}>
                          <Link
                            href={item.href}
                            prefetch={false}
                            className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-surface-muted/45 transition-colors"
                          >
                            <span className="flex items-center gap-2.5 min-w-0 text-xs font-medium text-foreground">
                              <span className="text-foreground-muted shrink-0">
                                {item.icon}
                              </span>
                              <span className="truncate">{item.label}</span>
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${badgeTone}`}
                              >
                                {item.count}
                              </span>
                              <ChevronRight
                                className="w-3.5 h-3.5 text-foreground-muted"
                                aria-hidden="true"
                              />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* 3. Atividades Recentes (Auditoria Real do Tenant) */}
              {canViewAudit ? (
                <section
                  aria-label="Atividades recentes do estabelecimento"
                  className="rounded-2xl border border-surface-border bg-surface overflow-hidden shadow-[var(--shadow-card)]"
                >
                  <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-bold text-foreground tracking-tight">
                      Atividades Recentes
                    </h2>
                    <Link
                      href="/dashboard/atividades"
                      prefetch={false}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      <span>Ver histórico</span>
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>

                  {recentAudits.length === 0 ? (
                    <p className="px-5 py-4 text-xs text-foreground-muted">
                      Nenhuma atividade recente registrada nesta unidade.
                    </p>
                  ) : (
                    <ul className="divide-y divide-surface-border text-xs">
                      {recentAudits.map((event) => (
                        <li key={event.id} className="px-5 py-3 flex items-start gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-surface-muted border border-surface-border flex items-center justify-center shrink-0 mt-0.5">
                            {getAuditCategoryIcon(event.actionCategory)}
                          </span>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground truncate">
                                {event.actionLabel}
                              </span>
                              <span className="font-mono text-[10px] text-foreground-muted tabular-nums shrink-0">
                                {new Date(event.createdAt).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            <p className="text-[11px] text-foreground-muted truncate">
                              {event.actorName ? `${event.actorName} · ` : ""}
                              {event.summary}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : (
                <div className="rounded-2xl border border-surface-border bg-surface px-5 py-4 space-y-1.5 shadow-[var(--shadow-card)]">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                    Permissões de Acesso
                  </p>
                  <p className="text-xs text-foreground-muted leading-relaxed">
                    Seu acesso atual (<strong className="text-foreground">{roleInfo.label}</strong>) é voltado às operações diárias. Alterações cadastrais e convites são gerenciados pelos gestores da unidade.
                  </p>
                </div>
              )}

              {/* 4. Alternador Multiempresa (quando > 1 unidade) */}
              {userTenants.length > 1 && (
                <QuickTenantSwitcher
                  tenants={userTenants}
                  activeTenantId={activeContext.tenantId}
                />
              )}

              {/* 5. Ficha Técnica Compacta da Unidade */}
              <section
                aria-label="Ficha técnica da unidade"
                className="rounded-2xl border border-surface-border bg-surface overflow-hidden shadow-[var(--shadow-card)]"
              >
                <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-bold text-foreground tracking-tight">
                    Ficha da Unidade
                  </h2>
                  {canManageTeam && (
                    <Link
                      href="/dashboard/configuracoes"
                      prefetch={false}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Editar
                    </Link>
                  )}
                </div>

                <dl className="divide-y divide-surface-border text-xs">
                  <div className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-foreground-muted">Nome Fantasia</dt>
                    <dd className="font-semibold text-foreground text-right truncate">
                      {tenantSettings?.display_name || activeContext.tenantName}
                    </dd>
                  </div>
                  <div className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-foreground-muted">Slug</dt>
                    <dd className="font-mono text-foreground text-right truncate">
                      {activeContext.slug}
                    </dd>
                  </div>
                  <div className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-foreground-muted flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-foreground-muted" aria-hidden="true" />
                      <span>Contato</span>
                    </dt>
                    <dd className="font-mono text-[11px] text-foreground text-right truncate">
                      {tenantSettings?.contact_email || "Não informado"}
                    </dd>
                  </div>
                  <div className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-foreground-muted flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-foreground-muted" aria-hidden="true" />
                      <span>Região</span>
                    </dt>
                    <dd className="font-medium text-foreground text-right truncate">
                      {tenantSettings?.locale || "pt-BR"} ·{" "}
                      {tenantSettings?.timezone?.replace("America/", "") || "Sao_Paulo"}
                    </dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        </div>
      )}

      {/* CENÁRIO 3: Onboarding Corporativo para Usuário Sem Empresa */}
      {userTenants.length === 0 && !sessionUser.isPlatformAdmin && (
        <div className="space-y-8">
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pb-6 border-b border-surface-border">
            <div className="space-y-2 max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                Olá, {sessionUser.fullName} · Onboarding Corporativo
              </p>
              <h1 className="font-display text-[1.875rem] sm:text-[2.375rem] font-bold tracking-[-0.03em] text-foreground leading-[1.06]">
                Nenhum Estabelecimento Vinculado
              </h1>
              <p className="text-sm text-foreground-muted leading-relaxed">
                Sua conta ainda não está associada a nenhuma empresa na plataforma. Solicite um convite ao proprietário ou gestor do estabelecimento para liberar os módulos operacionais.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl border border-surface-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition-colors self-start sm:self-end shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-foreground-muted" aria-hidden="true" />
              <span>Verificar vínculos</span>
            </Link>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="pt-4 border-t-2 border-accent space-y-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                  01 · Solicitação
                </span>
                <h2 className="font-display text-sm font-bold text-foreground">
                  Informe seu e-mail
                </h2>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Compartilhe seu endereço corporativo com o administrador da empresa.
                </p>
              </div>

              <div className="pt-4 border-t-2 border-surface-border space-y-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  02 · Convite
                </span>
                <h2 className="font-display text-sm font-bold text-foreground">
                  Aceite o link seguro
                </h2>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  O gestor emitirá um link único definindo seu papel na unidade.
                </p>
              </div>

              <div className="pt-4 border-t-2 border-surface-border space-y-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  03 · Operação
                </span>
                <h2 className="font-display text-sm font-bold text-foreground">
                  Liberação imediata
                </h2>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Ao confirmar o convite, o ambiente operacional abrirá automaticamente.
                </p>
              </div>
            </div>

            <section
              aria-label="Dados da conta"
              className="lg:col-span-5 rounded-2xl border border-surface-border bg-surface overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-surface-border">
                <h3 className="font-display text-sm font-bold text-foreground">
                  Dados da Sua Conta
                </h3>
              </div>
              <dl className="divide-y divide-surface-border text-xs">
                <div className="px-5 py-3 flex items-center justify-between gap-3">
                  <dt className="text-foreground-muted">Titular</dt>
                  <dd className="font-semibold text-foreground text-right truncate">
                    {sessionUser.fullName}
                  </dd>
                </div>
                <div className="px-5 py-3 flex items-center justify-between gap-3">
                  <dt className="text-foreground-muted">E-mail de Acesso</dt>
                  <dd className="font-mono text-[11px] text-foreground text-right truncate">
                    {sessionUser.email}
                  </dd>
                </div>
                <div className="px-5 py-3 flex items-center justify-between gap-3">
                  <dt className="text-foreground-muted">Situação</dt>
                  <dd className="font-semibold text-amber-700 dark:text-amber-300 text-right">
                    Aguardando convite
                  </dd>
                </div>
                <div className="px-5 py-3 flex items-center justify-between gap-3">
                  <dt className="text-foreground-muted">Empresas Vinculadas</dt>
                  <dd className="font-semibold text-foreground text-right">
                    Nenhum vínculo
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      )}

      {/* CENÁRIO 4: Ponte Executiva do Administrador Global */}
      {sessionUser.isPlatformAdmin && (
        <div className="space-y-6">
          {!activeContext && (
            <header className="pb-5 border-b border-surface-border">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                Administração Central · {sessionUser.email}
              </p>
              <h1 className="font-display text-[1.875rem] sm:text-[2.375rem] font-bold tracking-[-0.03em] text-foreground leading-[1.06] mt-1">
                Olá, {sessionUser.fullName}
              </h1>
            </header>
          )}

          <div className="rounded-2xl border border-[#232A3E] bg-gradient-to-r from-[#0F111E] via-[#131329] to-[#1D153A] text-white p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#B9A4FF]">
                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Administrador Global DevEssent</span>
              </div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">
                Console Central de Governança SaaS
              </h2>
              <p className="text-xs sm:text-sm text-[#B8C0D6] leading-relaxed">
                Supervisione empresas cadastradas, provisione novos estabelecimentos e configure a identidade visual das vitrines no módulo técnico.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/admin/sites"
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-xl border border-white/15 bg-white/10 text-white text-xs font-semibold hover:bg-white/15 transition-colors"
              >
                <span>Customização de Sites</span>
              </Link>
              <Link
                href="/admin"
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-secondary transition-colors"
              >
                <span>Acessar Console Global</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
