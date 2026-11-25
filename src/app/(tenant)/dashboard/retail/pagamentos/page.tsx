import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, CreditCard, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  buildSpeculativeRlsTenantContext,
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { RetailModuleInactive } from "@/modules/retail/components/retail-module-inactive";
import { RetailPaymentService } from "@/modules/retail/services/retail-payment-service";
import { RetailPaymentsTable } from "@/modules/retail/components/retail-payments-table";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";
import type {
  RetailPaymentMethod,
  RetailPaymentStatus,
} from "@/modules/retail/types/retail.types";

export const metadata: Metadata = {
  title: "Pagamentos & Recebimentos | DevEssent Platform",
  description:
    "Gestão de recebimentos, conciliação financeira e transações online da loja.",
};

interface RetailPaymentsPageProps {
  searchParams: Promise<{
    status?: string;
    method?: string;
    period?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function RetailPaymentsPage({
  searchParams,
}: RetailPaymentsPageProps) {
  const [{ status, method, period, q, page }, supabase] = await Promise.all([
    searchParams,
    createClient(),
  ]);

  const periodDaysNum =
    period === "all" ? undefined : Math.max(1, Number(period || "30") || 30);
  const parsedPage = Math.max(1, Number(page) || 1);
  const cleanSearch = q?.trim() || undefined;
  const paymentFilters = {
    status: (status as RetailPaymentStatus | "all") || "all",
    paymentMethod: (method as RetailPaymentMethod | "all") || "all",
    periodDays: periodDaysNum,
    search: cleanSearch,
    page: parsedPage,
    pageSize: 20,
  };

  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;
  const speculativeCtx = hintTenantId
    ? buildSpeculativeRlsTenantContext(hintTenantId)
    : null;

  const [workspace, prefetchedPayments, prefetchedStats, prefetchedConnection] =
    await Promise.all([
      resolveWorkspaceSession(),
      speculativeCtx
        ? RetailPaymentService.listPayments({
            supabase,
            context: speculativeCtx,
            filters: paymentFilters,
          }).catch(() => null)
        : Promise.resolve(null),
      speculativeCtx
        ? RetailPaymentService.getPaymentStats({
            supabase,
            context: speculativeCtx,
          }).catch(() => null)
        : Promise.resolve(null),
      speculativeCtx
        ? RetailPaymentService.getConnectionSummary({
            supabase,
            context: speculativeCtx,
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/retail/pagamentos");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { activeContext, activeRetailStore: store } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
  }

  if (
    !RetailPermissionService.hasPermission(
      activeContext.role,
      "view_retail_payments"
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

  const [paymentsResult, stats, connection] = await Promise.all([
    hintMatched && prefetchedPayments !== null
      ? Promise.resolve(prefetchedPayments)
      : RetailPaymentService.listPayments({
          supabase,
          context: activeContext,
          filters: paymentFilters,
        }),
    hintMatched && prefetchedStats !== null
      ? Promise.resolve(prefetchedStats)
      : RetailPaymentService.getPaymentStats({
          supabase,
          context: activeContext,
        }),
    hintMatched && prefetchedConnection !== null
      ? Promise.resolve(prefetchedConnection)
      : RetailPaymentService.getConnectionSummary({
          supabase,
          context: activeContext,
        }),
  ]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-[#CFC5FA] dark:border-[#2E2556] bg-gradient-to-br from-[#FBF9FF] via-[#F2EEFC] to-[#E5DDFB] dark:from-[#0E101E] dark:via-[#14132C] dark:to-[#221445] p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-[0_12px_32px_-16px_rgba(91,70,229,0.25)]">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-[0.14em] bg-white/80 dark:bg-white/10 border border-[#CFC5FA] dark:border-white/15 text-[#5B46E5] dark:text-[#B9A4FF]">
            <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Recebimentos & Checkout · {store.storeName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#111022] dark:text-white tracking-tight">
            Pagamentos & Recebimentos
          </h1>
          <p className="text-xs sm:text-sm text-[#413B5C] dark:text-[#C5C0DD] leading-relaxed">
            Acompanhe os pagamentos recebidos diretamente na conta do seu estabelecimento, audite conciliações via webhook e gerencie estornos confirmados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/dashboard/retail/pedidos"
            prefetch={false}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white/85 dark:bg-white/[0.08] border border-[#CFC5FA] dark:border-white/15 text-[#111022] dark:text-white hover:bg-white dark:hover:bg-white/15 transition-colors"
          >
            <ClipboardList className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Pedidos Comerciais</span>
          </Link>
          <Link
            href="/dashboard/retail"
            prefetch={false}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white/85 dark:bg-white/[0.08] border border-[#CFC5FA] dark:border-white/15 text-[#111022] dark:text-white hover:bg-white dark:hover:bg-white/15 transition-colors"
          >
            <Store className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Painel Retail</span>
          </Link>
        </div>
      </section>

      <RetailPaymentsTable
        items={paymentsResult.payments}
        totalCount={paymentsResult.totalCount}
        page={paymentsResult.page}
        totalPages={paymentsResult.totalPages}
        stats={stats}
        connection={connection}
        initialStatusFilter={status || "all"}
        initialMethodFilter={method || "all"}
        initialPeriodDays={period || "30"}
        initialSearch={cleanSearch || ""}
      />
    </div>
  );
}
