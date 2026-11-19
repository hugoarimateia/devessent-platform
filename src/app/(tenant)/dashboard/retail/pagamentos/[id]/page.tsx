import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants";
import { NotFoundError, TenantSuspendedError } from "@/core/errors/app-error";
import { AppShell } from "@/components/layout/app-shell";
import { SuspendedTenantState } from "@/components/ui/suspended-tenant-state";
import {
  RetailPaymentDetail,
  RetailPaymentService,
  RetailPermissionService,
} from "@/modules/retail";

export const metadata: Metadata = {
  title: "Detalhe da Transação | DevEssent Platform",
  description:
    "Auditoria de tentativas de checkout, webhooks autenticados e conciliação financeira.",
};

interface RetailPaymentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RetailPaymentDetailPage({
  params,
}: RetailPaymentDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/retail/pagamentos/${id}`);
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

  let payment;
  try {
    payment = await RetailPaymentService.getPaymentWithDetails({
      supabase,
      context: activeContext,
      paymentId: id,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  const canManagePayments = RetailPermissionService.hasPermission(
    activeContext.role,
    "manage_retail_payments"
  );

  return (
    <AppShell
      user={sessionUser}
      contextMode="tenant"
      tenants={userTenants}
      activeTenantId={activeContext.tenantId}
      activeRole={activeContext.role}
    >
      <RetailPaymentDetail
        tenantId={activeContext.tenantId}
        payment={payment}
        canManagePayments={canManagePayments}
      />
    </AppShell>
  );
}
