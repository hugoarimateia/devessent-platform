import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  buildSpeculativeRlsTenantContext,
  getActiveTenantHintUuid,
  resolveWorkspaceSession,
} from "@/lib/workspace/workspace-context";
import { NotFoundError } from "@/core/errors/app-error";
import { RetailPaymentDetail } from "@/modules/retail/components/retail-payment-detail";
import { RetailPaymentService } from "@/modules/retail/services/retail-payment-service";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";

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
  const [{ id }, supabase] = await Promise.all([params, createClient()]);

  const hintTenantId =
    process.env.NODE_ENV === "production" || !isXamppTestMode()
      ? await getActiveTenantHintUuid()
      : null;
  const speculativeCtx = hintTenantId
    ? buildSpeculativeRlsTenantContext(hintTenantId)
    : null;

  const [workspace, prefetchedPayment] = await Promise.all([
    resolveWorkspaceSession(),
    speculativeCtx
      ? RetailPaymentService.getPaymentWithDetails({
          supabase,
          context: speculativeCtx,
          paymentId: id,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!workspace.sessionUser) {
    redirect(`/login?redirect=/dashboard/retail/pagamentos/${id}`);
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { activeContext } = workspace;
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

  const hintMatched = Boolean(
    hintTenantId && activeContext.tenantId === hintTenantId
  );

  let payment = hintMatched ? prefetchedPayment : null;
  if (!payment) {
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
  }

  const canManagePayments = RetailPermissionService.hasPermission(
    activeContext.role,
    "manage_retail_payments"
  );

  return (
    <RetailPaymentDetail
      tenantId={activeContext.tenantId}
      payment={payment}
      canManagePayments={canManagePayments}
    />
  );
}
