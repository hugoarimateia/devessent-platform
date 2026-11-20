import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Store, ExternalLink, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  buildSpeculativeRlsTenantContext,
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { RetailModuleInactive } from "@/modules/retail/components/retail-module-inactive";
import { RetailOrderService } from "@/modules/retail/services/retail-order-service";
import { RetailOrdersTable } from "@/modules/retail/components/retail-orders-table";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";
import type { RetailOrderStatus } from "@/modules/retail/types/retail.types";

export const metadata: Metadata = {
  title: "Pedidos | DevEssent Platform",
  description: "Gestão de solicitações de pedidos, confirmação e estoque da loja.",
};

const VALID_STATUS_SET = new Set<string>([
  "requested",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

interface RetailOrdersPageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function RetailOrdersPage({
  searchParams,
}: RetailOrdersPageProps) {
  const [{ status, search, page }, supabase] = await Promise.all([
    searchParams,
    createClient(),
  ]);

  const activeStatus: RetailOrderStatus | "all" =
    status && VALID_STATUS_SET.has(status) ? (status as RetailOrderStatus) : "all";
  const parsedPage = Math.max(1, Number(page) || 1);
  const cleanSearch = search?.trim() || undefined;

  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;
  const speculativeCtx = hintTenantId
    ? buildSpeculativeRlsTenantContext(hintTenantId)
    : null;

  const [workspace, prefetchedOrders, prefetchedStats] = await Promise.all([
    resolveWorkspaceSession(),
    speculativeCtx
      ? RetailOrderService.listOrders(supabase, speculativeCtx, {
          status: activeStatus,
          search: cleanSearch,
          page: parsedPage,
          pageSize: 20,
        }).catch(() => null)
      : Promise.resolve(null),
    speculativeCtx
      ? RetailOrderService.getOrderStats(supabase, speculativeCtx).catch(
          () => null
        )
      : Promise.resolve(null),
  ]);

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/retail/pedidos");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { activeContext, activeRetailStore: store } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
  }

  // Staff NÃO possui acesso irrestrito à gestão de pedidos
  if (
    !RetailPermissionService.hasPermission(
      activeContext.role,
      "view_retail_orders"
    )
  ) {
    redirect("/forbidden");
  }

  if (!store || !store.isActive) {
    return (
      <RetailModuleInactive
        tenantId={activeContext.tenantId}
        tenantName={activeContext.tenantName}
        userRole={activeContext.role}
      />
    );
  }

  const hintMatched = Boolean(
    hintTenantId && activeContext.tenantId === hintTenantId
  );

  const [ordersResult, stats] = await Promise.all([
    hintMatched && prefetchedOrders !== null
      ? Promise.resolve(prefetchedOrders)
      : RetailOrderService.listOrders(supabase, activeContext, {
          status: activeStatus,
          search: cleanSearch,
          page: parsedPage,
          pageSize: 20,
        }),
    hintMatched && prefetchedStats !== null
      ? Promise.resolve(prefetchedStats)
      : RetailOrderService.getOrderStats(supabase, activeContext),
  ]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-[#CFC5FA] dark:border-[#2E2556] bg-gradient-to-br from-[#FBF9FF] via-[#F2EEFC] to-[#E5DDFB] dark:from-[#0E101E] dark:via-[#14132C] dark:to-[#221445] p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-[0_12px_32px_-16px_rgba(91,70,229,0.25)]">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-[0.14em] bg-white/80 dark:bg-white/10 border border-[#CFC5FA] dark:border-white/15 text-[#5B46E5] dark:text-[#B9A4FF]">
            <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Pedidos Comerciais · {store.storeName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#111022] dark:text-white tracking-tight">
            Gestão de Pedidos
          </h1>
          <p className="text-xs sm:text-sm text-[#413B5C] dark:text-[#C5C0DD] leading-relaxed">
            Analise solicitações recebidas da vitrine, confirme disponibilidade com baixa transacional de estoque e acompanhe cada etapa até a entrega.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/dashboard/retail"
            prefetch={false}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white/85 dark:bg-white/[0.08] border border-[#CFC5FA] dark:border-white/15 text-[#111022] dark:text-white hover:bg-white dark:hover:bg-white/15 transition-colors"
          >
            <Store className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Painel Retail</span>
          </Link>
          {store.slug && store.isActive && (
            <a
              href={`/loja/${store.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white/85 dark:bg-white/[0.08] border border-[#CFC5FA] dark:border-white/15 text-[#111022] dark:text-white hover:bg-white dark:hover:bg-white/15 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Abrir Vitrine</span>
            </a>
          )}
        </div>
      </section>

      <RetailOrdersTable
        orders={ordersResult.orders}
        stats={stats}
        currency={store.currency}
        totalCount={ordersResult.totalCount}
        page={ordersResult.page}
        totalPages={ordersResult.totalPages}
        activeStatus={activeStatus}
        activeSearch={cleanSearch || ""}
      />
    </div>
  );
}
