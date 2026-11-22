import type { Json } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditService } from "@/core/audit/services/audit-service";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors/app-error";
import { env } from "@/lib/environment/env";
import { BillingInvariants } from "../domain/billing-invariants";
import {
  getDefaultBillingProvider,
  MercadoPagoBillingProvider,
  resolveDevEssentBillingCredentials,
} from "../providers/mercado-pago-billing.provider";
import type {
  BillingInvoiceStatus,
  BillingProviderName,
} from "../types/billing.types";

/**
 * Serviço exclusivo de Webhooks e Reconciliação do Billing SaaS (Fluxo B).
 *
 * REGRAS INEGOCIÁVEIS (§11, §12):
 * - Totalmente isolado do Retail Payments (nunca lê ou escreve em tabelas retail_*).
 * - Valida assinatura HMAC-SHA256 antes de qualquer alteração de estado.
 * - Consulta estado autoritativo no provedor (nunca confia apenas no payload cru).
 * - Executa reconciliação atômica e idempotente via `reconcile_billing_invoice_tx`.
 * - Nunca suspende automaticamente estabelecimentos (tenants.status intocado).
 */
export class BillingWebhookService {
  public static async processBillingWebhook(params: {
    providerName: BillingProviderName;
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
    rawBody: string;
  }): Promise<{
    outcome: string;
    subscriptionId: string | null;
    invoiceId: string | null;
    invoiceStatus: string | null;
    subscriptionStatus: string | null;
  }> {
    const provider = getDefaultBillingProvider();
    const admin = createAdminClient();

    let rawBodyObj: Record<string, unknown> = {};
    try {
      rawBodyObj = params.rawBody
        ? (JSON.parse(params.rawBody) as Record<string, unknown>)
        : {};
    } catch {
      throw new ValidationError("Payload JSON de webhook Billing malformado.");
    }

    // 1. Validação criptográfica HMAC-SHA256 + janela de tempo (±5 min) + bloqueio live_mode=true
    let verifiedHeader;
    try {
      verifiedHeader = provider.validateWebhookSignature({
        headers: params.headers,
        query: params.query,
        rawBody: params.rawBody,
      });
    } catch (err) {
      // Registra tentativa com assinatura inválida para auditoria de segurança sem vazar secrets
      const fallbackEvtId = `rejected:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      await admin.from("billing_webhook_events").insert({
        provider: params.providerName,
        environment: "sandbox",
        external_event_id: fallbackEvtId,
        event_type: String(rawBodyObj.action || rawBodyObj.type || "unknown"),
        resource_type: "unknown",
        external_resource_id: params.query["data.id"] ?? null,
        signature_verified: false,
        processing_status: "rejected_signature",
        error_message: err instanceof Error ? err.message : "Assinatura inválida",
        payload_summary: { rejected: true } as Json,
        processed_at: new Date().toISOString(),
      });
      throw err instanceof UnauthorizedError
        ? err
        : new UnauthorizedError(
            err instanceof Error ? err.message : "Assinatura de webhook Billing inválida."
          );
    }

    // 2. Suporte stateless no Cloudflare Workers para modo simulador interno sandbox:
    //    somente em Staging/Dev, somente após assinatura HMAC-SHA256 com segredo exclusivo
    //    BILLING_WEBHOOK_SANDBOX_SECRET e exclusivamente quando credenciais oficiais não estão ativas.
    const creds = resolveDevEssentBillingCredentials();
    if (!creds.isOfficialSandboxApi && env.NEXT_PUBLIC_APP_ENV === "production") {
      throw new ForbiddenError(
        "FAIL-CLOSED: Modo simulador interno Billing bloqueado em ambiente de produção."
      );
    }

    if (
      !creds.isOfficialSandboxApi &&
      !MercadoPagoBillingProvider.getSimulatedResource(verifiedHeader.externalResourceId)
    ) {
      const hintSubId =
        params.query["subscription_id"] ||
        (typeof rawBodyObj.subscription_id === "string" ? rawBodyObj.subscription_id : undefined);

      if (hintSubId) {
        const { data: hintedSub } = await admin
          .from("billing_subscriptions")
          .select("*")
          .eq("id", hintSubId)
          .maybeSingle();

        if (hintedSub) {
          const requestedStatusRaw =
            typeof rawBodyObj.sandbox_outcome === "string"
              ? rawBodyObj.sandbox_outcome
              : "processing";
          const allowedStatelessStatuses = new Set<BillingInvoiceStatus>([
            "pending",
            "processing",
            "paid",
            "failed",
            "overdue",
            "refunded",
          ]);
          const safeStatus: BillingInvoiceStatus = allowedStatelessStatuses.has(
            requestedStatusRaw as BillingInvoiceStatus
          )
            ? (requestedStatusRaw as BillingInvoiceStatus)
            : "processing";

          const cycleKey =
            typeof rawBodyObj.billing_cycle_key === "string" && rawBodyObj.billing_cycle_key
              ? rawBodyObj.billing_cycle_key
              : BillingInvariants.buildBillingCycleKey(
                  hintedSub.next_billing_date || hintedSub.scheduled_start_date
                );

          const preapprovalSubStatus =
            rawBodyObj.sandbox_subscription_status === "cancelled"
              ? "cancelled"
              : rawBodyObj.sandbox_subscription_status === "past_due"
                ? "past_due"
                : "active";

          MercadoPagoBillingProvider.seedSimulatedResource({
            externalResourceId: verifiedHeader.externalResourceId,
            resourceType: verifiedHeader.resourceType,
            externalSubscriptionId:
              hintedSub.external_subscription_id || `MP-PREAPP-SBX-${hintedSub.id.slice(0, 8)}`,
            externalReference: hintedSub.external_reference,
            invoiceStatus:
              verifiedHeader.resourceType === "subscription_authorized_payment" ? safeStatus : null,
            subscriptionStatus:
              verifiedHeader.resourceType === "subscription_preapproval"
                ? preapprovalSubStatus
                : null,
            amountCents: hintedSub.contracted_amount_cents,
            currency: "BRL",
            dueDate: hintedSub.next_billing_date || hintedSub.scheduled_start_date,
            billingCycleKey: cycleKey,
            paymentMethodLabel: hintedSub.payment_method_label || "Cartão de Crédito (Sandbox)",
            failureCode:
              safeStatus === "failed" || safeStatus === "overdue" ? "cc_rejected_insufficient_amount" : null,
            failureReason:
              safeStatus === "failed" || safeStatus === "overdue"
                ? typeof rawBodyObj.failure_reason === "string"
                  ? rawBodyObj.failure_reason
                  : "Cobrança recorrente recusada pelo emissor (Sandbox)."
                : null,
          });
        }
      }
    }

    // 3. Consulta autoritativa no provedor (nunca confiar apenas no payload cru)
    const authoritative = await provider.fetchAuthoritativeEventResource({
      resourceType: verifiedHeader.resourceType,
      externalResourceId: verifiedHeader.externalResourceId,
      rawBodyObj,
    });

    const taggedSummary: Record<string, unknown> = {
      ...(authoritative.rawSummary ?? {}),
      providerOrigin: creds.providerOrigin,
    };

    // 4. Localizar assinatura alvo exclusivamente na tabela billing_subscriptions
    let subRow:
      | {
          id: string;
          tenant_id: string;
          contracted_amount_cents: number;
          status: string;
          scheduled_start_date: string;
          next_billing_date: string | null;
          authorized_at: string | null;
          activation_confirmed_at: string | null;
          activated_at: string | null;
          payment_method_type: string;
          payment_method_label: string | null;
        }
      | null = null;

    const subSelectColumns =
      "id, tenant_id, contracted_amount_cents, status, scheduled_start_date, next_billing_date, authorized_at, activation_confirmed_at, activated_at, payment_method_type, payment_method_label";

    if (authoritative.externalSubscriptionId) {
      const { data } = await admin
        .from("billing_subscriptions")
        .select(subSelectColumns)
        .eq("external_subscription_id", authoritative.externalSubscriptionId)
        .maybeSingle();
      subRow = data;
    }

    if (!subRow && authoritative.externalReference) {
      const { data } = await admin
        .from("billing_subscriptions")
        .select(subSelectColumns)
        .eq("external_reference", authoritative.externalReference)
        .maybeSingle();
      subRow = data;
    }

    if (!subRow && !creds.isOfficialSandboxApi && params.query["subscription_id"]) {
      const { data } = await admin
        .from("billing_subscriptions")
        .select(subSelectColumns)
        .eq("id", params.query["subscription_id"])
        .maybeSingle();
      subRow = data;
    }

    if (!subRow) {
      throw new NotFoundError("Assinatura SaaS correspondente ao webhook Billing não localizada.");
    }

    // 5. Tratamento autoritativo e idempotente de evento de contrato (`subscription_preapproval`)
    if (authoritative.resourceType === "subscription_preapproval") {
      const { data: existingEvt } = await admin
        .from("billing_webhook_events")
        .select("id")
        .eq("provider", params.providerName)
        .eq("external_event_id", verifiedHeader.externalEventId)
        .maybeSingle();

      if (existingEvt) {
        return {
          outcome: "duplicate",
          subscriptionId: subRow.id,
          invoiceId: null,
          invoiceStatus: null,
          subscriptionStatus: subRow.status,
        };
      }

      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      let nextSubStatus = subRow.status;

      if (authoritative.subscriptionStatus === "active" && subRow.status !== "cancelled") {
        // Autorização confirmada no provedor: só ativa se marco contratual + data agendada já atingidos!
        const canActivateNow =
          Boolean(subRow.activation_confirmed_at) && subRow.scheduled_start_date <= today;
        nextSubStatus =
          subRow.status === "active" || subRow.status === "cancel_scheduled"
            ? subRow.status
            : canActivateNow
              ? "active"
              : "awaiting_activation";

        await admin
          .from("billing_subscriptions")
          .update({
            status: nextSubStatus,
            authorized_at: subRow.authorized_at ?? nowIso,
            activated_at: nextSubStatus === "active" ? subRow.activated_at ?? nowIso : subRow.activated_at,
            payment_method_type:
              subRow.payment_method_type === "unconfigured"
                ? "credit_card"
                : subRow.payment_method_type,
            payment_method_label:
              subRow.payment_method_label ||
              authoritative.paymentMethodLabel ||
              "Cartão de Crédito (Mercado Pago Sandbox)",
            next_billing_date: authoritative.dueDate || subRow.next_billing_date,
          })
          .eq("id", subRow.id);
      } else if (authoritative.subscriptionStatus === "cancelled" && subRow.status !== "cancelled") {
        nextSubStatus = "cancelled";
        await admin
          .from("billing_subscriptions")
          .update({
            status: "cancelled",
            cancelled_at: nowIso,
            next_billing_date: null,
            cancellation_reason: "Cancelamento confirmado via webhook autoritativo do provedor.",
          })
          .eq("id", subRow.id);
      } else if (
        authoritative.subscriptionStatus === "past_due" &&
        subRow.status !== "cancelled" &&
        subRow.status !== "past_due"
      ) {
        // Pausa/atraso no provedor NUNCA suspende a loja (tenants.status intocado)
        nextSubStatus = "past_due";
        await admin
          .from("billing_subscriptions")
          .update({
            status: "past_due",
            delinquent_since: nowIso,
          })
          .eq("id", subRow.id);
      }

      if (nextSubStatus !== subRow.status) {
        await admin.from("billing_subscription_history").insert({
          subscription_id: subRow.id,
          tenant_id: subRow.tenant_id,
          event_type:
            nextSubStatus === "cancelled"
              ? "cancelled"
              : nextSubStatus === "past_due"
                ? "delinquency_flagged"
                : "authorized",
          previous_status: subRow.status,
          new_status: nextSubStatus,
          reason: `Evento autoritativo subscription_preapproval reconciliado (${creds.providerOrigin}).`,
          metadata: taggedSummary as Json,
        });

        await AuditService.recordEvent({
          supabase: admin,
          tenantId: subRow.tenant_id,
          actorUserId: null,
          action:
            nextSubStatus === "cancelled"
              ? "billing.subscription_cancelled"
              : "billing.subscription_authorized",
          resourceType: "billing_subscription",
          resourceId: subRow.id,
          metadata: {
            previousStatus: subRow.status,
            newStatus: nextSubStatus,
            externalResourceId: authoritative.externalResourceId,
            providerOrigin: creds.providerOrigin,
          },
        });
      }

      await admin.from("billing_webhook_events").insert({
        provider: params.providerName,
        environment: "sandbox",
        external_event_id: verifiedHeader.externalEventId,
        event_type: verifiedHeader.eventType,
        resource_type: "subscription_preapproval",
        external_resource_id: authoritative.externalResourceId,
        subscription_id: subRow.id,
        tenant_id: subRow.tenant_id,
        signature_verified: true,
        processing_status: "processed",
        payload_summary: taggedSummary as Json,
        processed_at: nowIso,
      });

      return {
        outcome: "processed",
        subscriptionId: subRow.id,
        invoiceId: null,
        invoiceStatus: null,
        subscriptionStatus: nextSubStatus,
      };
    }

    // 6. Reconciliação atômica e idempotente de cobrança recorrente (`subscription_authorized_payment`)
    const dueDate =
      authoritative.dueDate ||
      subRow.next_billing_date ||
      subRow.scheduled_start_date ||
      new Date().toISOString().slice(0, 10);

    const cycleKey =
      authoritative.billingCycleKey || BillingInvariants.buildBillingCycleKey(dueDate);
    const amountCents = authoritative.amountCents || subRow.contracted_amount_cents;
    const invoiceStatus = authoritative.invoiceStatus || "pending";

    const { data: rpcData, error: rpcErr } = await admin.rpc("reconcile_billing_invoice_tx", {
      p_subscription_id: subRow.id,
      p_provider: params.providerName,
      p_external_event_id: verifiedHeader.externalEventId,
      p_event_type: verifiedHeader.eventType,
      p_signature_verified: true,
      p_billing_cycle_key: cycleKey,
      p_external_payment_id: authoritative.externalResourceId,
      p_authoritative_status: invoiceStatus,
      p_amount_cents: amountCents,
      p_currency: "BRL",
      p_due_date: dueDate,
      p_payment_method_type: subRow.payment_method_type || "credit_card",
      p_payment_method_label: authoritative.paymentMethodLabel || subRow.payment_method_label || undefined,
      p_failure_code: authoritative.failureCode || undefined,
      p_failure_reason: authoritative.failureReason || undefined,
      p_payload_summary: taggedSummary as Json,
    });

    if (rpcErr) {
      throw new Error(`Falha na reconciliação atômica Billing SaaS: ${rpcErr.message}`);
    }

    const resObj = (rpcData ?? {}) as {
      outcome?: string;
      invoiceId?: string;
      invoiceNumber?: string;
      invoiceStatus?: string;
      subscriptionId?: string;
      subscriptionStatus?: string;
    };

    if (resObj.outcome === "processed" && (invoiceStatus === "paid" || invoiceStatus === "failed" || invoiceStatus === "overdue")) {
      await AuditService.recordEvent({
        supabase: admin,
        tenantId: subRow.tenant_id,
        actorUserId: null,
        action: invoiceStatus === "paid" ? "billing.invoice_paid" : "billing.invoice_failed",
        resourceType: "billing_invoice",
        resourceId: resObj.invoiceId ?? null,
        metadata: {
          subscriptionId: subRow.id,
          invoiceNumber: resObj.invoiceNumber ?? null,
          billingCycleKey: cycleKey,
          amountCents,
          invoiceStatus,
          subscriptionStatus: resObj.subscriptionStatus ?? subRow.status,
          externalPaymentId: authoritative.externalResourceId,
          providerOrigin: creds.providerOrigin,
        },
      });
    }

    return {
      outcome: resObj.outcome ?? "processed",
      subscriptionId: resObj.subscriptionId ?? subRow.id,
      invoiceId: resObj.invoiceId ?? null,
      invoiceStatus: resObj.invoiceStatus ?? invoiceStatus,
      subscriptionStatus: resObj.subscriptionStatus ?? subRow.status,
    };
  }
}
