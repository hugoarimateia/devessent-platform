import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { ClipboardList, CreditCard, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants";
import { TenantSuspendedError } from "@/core/errors/app-error";
import { AppShell } from "@/components/layout/app-shell";
import { SuspendedTenantState } from "@/components/ui/suspended-tenant-state";
import {
  RetailModuleInactive,
  RetailPaymentService,
  RetailPaymentsTable,
  RetailPermissionService,
  RetailStoreService,
  type RetailPaymentMethod,
  type RetailPaymentStatus,
} from "@/modules/retail";

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
  const { status, method, period, q, page } = await searchParams;
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/retail/pagamentos");
  }

  const userTenants = await TenantService.listUserTenants(supabase, sessionUser.id);
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

  if (!RetailPermissionService.hasPermission(activeContext.role, "view_retail_payments")) {
    redirect("/forbidden");
  }

  const store = await RetailStoreService.getStore(supabase, activeContext.tenantId);
  if (!store || !store.isActive) {
    return (
      <AppShell
        user={sessionUser}
        contextMode="tenant"
        tenants={userTenants}
        activeTenantId={activeContext.tenantId}
        activeRole={activeContext.role}
      >
        <RetailModuleInactive
          tenantId={activeContext.tenantId}
          tenantName={activeContext.tenantName}
          userRole={activeContext.role}
        />
      </AppShell>
    );
  }

  const periodDaysNum =
    period === "all" ? undefined : Math.max(1, Number(period || "30") || 30);
  const parsedPage = Math.max(1, Number(page) || 1);

  const [paymentsResult, stats, connection] = await Promise.all([
    RetailPaymentService.listPayments({
      supabase,
      context: activeContext,
      filters: {
        status: (status as RetailPaymentStatus | "all") || "all",
        paymentMethod: (method as RetailPaymentMethod | "all") || "all",
        periodDays: periodDaysNum,
        search: q?.trim() || undefined,
        page: parsedPage,
        pageSize: 20,
      },
    }),
    RetailPaymentService.getPaymentStats({
      supabase,
      context: activeContext,
    }),
    RetailPaymentService.getConnectionSummary({
      supabase,
      context: activeContext,
    }),
  ]);

  return (
    <AppShell
      user={sessionUser}
      contextMode="tenant"
      tenants={userTenants}
      activeTenantId={activeContext.tenantId}
      activeRole={activeContext.role}
    >
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
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white/85 dark:bg-white/[0.08] border border-[#CFC5FA] dark:border-white/15 text-[#111022] dark:text-white hover:bg-white dark:hover:bg-white/15 transition-colors"
            >
              <ClipboardList className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Pedidos Comerciais</span>
            </Link>
            <Link
              href="/dashboard/retail"
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
          initialSearch={q?.trim() || ""}
        />
      </div>
    </AppShell>
  );
}
