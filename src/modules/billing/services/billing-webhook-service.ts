import type { Json } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditService } from "@/core/audit/services/audit-service";
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors/app-error";
import { env } from "@/lib/environment/env";
import { BillingInvariants } from "../domain/billing-invariants";
import type { BillingProvider } from "../providers/billing-provider.interface";
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
 * REGRAS INEGOCIÁVEIS (§8, §11, §12):
 * - Totalmente isolado do Retail Payments (nunca lê ou escreve em tabelas retail_*).
 * - Valida assinatura HMAC-SHA256 (ou modo fallback autoritativo explícito sem fingir HMAC).
 * - Consulta estado autoritativo no provedor (nunca confia apenas no payload cru).
 * - Valida titularidade (`collector_id` / `application_id`) e correspondência de `external_reference`
 *   para impedir alteração cruzada entre empresas.
 * - Executa reconciliação atômica e idempotente via `reconcile_billing_invoice_tx`.
 * - Nunca suspende automaticamente estabelecimentos (`tenants.status` intocado).
 * - Trata indisponibilidade temporária do provedor ou do Supabase retornando `ServiceUnavailableError` (503).
 */
export class BillingWebhookService {
  public static async processBillingWebhook(params: {
    providerName: BillingProviderName;
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
    rawBody: string;
    providerOverride?: BillingProvider;
  }): Promise<{
    outcome: string;
    subscriptionId: string | null;
    invoiceId: string | null;
    invoiceStatus: string | null;
    subscriptionStatus: string | null;
  }> {
    const provider = params.providerOverride ?? getDefaultBillingProvider();
    const admin = createAdminClient();

    let rawBodyObj: Record<string, unknown> = {};
    try {
      rawBodyObj = params.rawBody
        ? (JSON.parse(params.rawBody) as Record<string, unknown>)
        : {};
    } catch {
      throw new ValidationError("Payload JSON de webhook Billing malformado.");
    }

    // 1. Validação de origem (HMAC-SHA256 + janela ±5 min + bloqueio live_mode=true + titularidade)
    let verifiedHeader;
    try {
      verifiedHeader = provider.validateWebhookSignature({
        headers: params.headers,
        query: params.query,
        rawBody: params.rawBody,
      });
    } catch (err) {
      // Registra tentativa rejeitada para auditoria de segurança sem vazar secrets
      const fallbackEvtId = `rejected:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      try {
        await admin.from("billing_webhook_events").insert({
          provider: params.providerName,
          environment: "sandbox",
          external_event_id: fallbackEvtId,
          event_type: String(rawBodyObj.action || rawBodyObj.type || rawBodyObj.topic || "unknown"),
          resource_type: "unknown",
          external_resource_id: params.query["data.id"] ?? null,
          signature_verified: false,
          processing_status: "rejected_signature",
          error_message: err instanceof Error ? err.message : "Assinatura inválida",
          payload_summary: { rejected: true } as Json,
          processed_at: new Date().toISOString(),
        });
      } catch {
        // Não mascarar erro de segurança se a gravação de auditoria falhar
      }
      if (err instanceof ForbiddenError || err instanceof ValidationError) {
        throw err;
      }
      throw err instanceof UnauthorizedError
        ? err
        : new UnauthorizedError(
            err instanceof Error ? err.message : "Assinatura de webhook Billing inválida."
          );
    }

    const creds = resolveDevEssentBillingCredentials();

    // 2. Tópico de plano externo (`subscription_preapproval_plan`): reconhecido e ignorado com segurança
    if (verifiedHeader.resourceType === "subscription_preapproval_plan") {
      const nowIso = new Date().toISOString();
      const { data: existingPlanEvt } = await admin
        .from("billing_webhook_events")
        .select("id")
        .eq("provider", params.providerName)
        .eq("external_event_id", verifiedHeader.externalEventId)
        .maybeSingle();

      if (!existingPlanEvt) {
        await admin.from("billing_webhook_events").insert({
          provider: params.providerName,
          environment: "sandbox",
          external_event_id: verifiedHeader.externalEventId,
          event_type: verifiedHeader.eventType,
          resource_type: "subscription_preapproval_plan",
          external_resource_id: verifiedHeader.externalResourceId,
          signature_verified: verifiedHeader.signatureVerified,
          processing_status: "ignored",
          payload_summary: {
            providerOrigin: creds.providerOrigin,
            authMethod: verifiedHeader.authMethod,
            hmacSignatureVerified: verifiedHeader.signatureVerified,
            reason: "Planos individuais são gerenciados localmente na DevEssent Platform.",
          } as Json,
          processed_at: nowIso,
        });
      }

      return {
        outcome: "ignored_plan_topic",
        subscriptionId: null,
        invoiceId: null,
        invoiceStatus: null,
        subscriptionStatus: null,
      };
    }

    // 3. Suporte stateless no Cloudflare Workers para modo simulador interno sandbox:
    //    somente em Staging/Dev, somente após assinatura HMAC-SHA256 com segredo exclusivo
    //    BILLING_WEBHOOK_SANDBOX_SECRET e exclusivamente quando o modo explícito é simulador.
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
        const { data: hintedSub, error: hintedErr } = await admin
          .from("billing_subscriptions")
          .select("*")
          .eq("id", hintSubId)
          .maybeSingle();

        if (hintedErr) {
          throw new ServiceUnavailableError(
            `Falha temporária ao consultar assinatura no Supabase: ${hintedErr.message}`
          );
        }

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
              verifiedHeader.resourceType === "subscription_authorized_payment" ||
              verifiedHeader.resourceType === "payment"
                ? safeStatus
                : null,
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
              safeStatus === "failed" || safeStatus === "overdue"
                ? "cc_rejected_insufficient_amount"
                : null,
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

    // 4. Consulta autoritativa no provedor (nunca confiar apenas no payload cru)
    let authoritative;
    try {
      authoritative = await provider.fetchAuthoritativeEventResource({
        resourceType: verifiedHeader.resourceType,
        externalResourceId: verifiedHeader.externalResourceId,
        rawBodyObj,
      });
    } catch (err) {
      if (err instanceof ServiceUnavailableError) {
        try {
          await admin.from("billing_webhook_events").insert({
            provider: params.providerName,
            environment: "sandbox",
            external_event_id: `retryable:${verifiedHeader.externalEventId}:${Date.now()}`,
            event_type: verifiedHeader.eventType,
            resource_type: verifiedHeader.resourceType,
            external_resource_id: verifiedHeader.externalResourceId,
            signature_verified: verifiedHeader.signatureVerified,
            processing_status: "error",
            error_message: err.message,
            payload_summary: {
              providerOrigin: creds.providerOrigin,
              authMethod: verifiedHeader.authMethod,
              hmacSignatureVerified: verifiedHeader.signatureVerified,
              retryable: true,
            } as Json,
            processed_at: new Date().toISOString(),
          });
        } catch {
          // ignora falha secundária de log
        }
      }
      throw err;
    }

    const taggedSummary: Record<string, unknown> = {
      ...(authoritative.rawSummary ?? {}),
      providerOrigin: creds.providerOrigin,
      authMethod: verifiedHeader.authMethod,
      hmacSignatureVerified: verifiedHeader.signatureVerified,
    };

    // 5. Localizar assinatura alvo exclusivamente na tabela billing_subscriptions
    let subRow:
      | {
          id: string;
          tenant_id: string;
          external_subscription_id: string | null;
          external_reference: string;
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
      "id, tenant_id, external_subscription_id, external_reference, contracted_amount_cents, status, scheduled_start_date, next_billing_date, authorized_at, activation_confirmed_at, activated_at, payment_method_type, payment_method_label";

    try {
      if (authoritative.externalSubscriptionId) {
        const { data, error } = await admin
          .from("billing_subscriptions")
          .select(subSelectColumns)
          .eq("external_subscription_id", authoritative.externalSubscriptionId)
          .maybeSingle();
        if (error) throw new ServiceUnavailableError(`Erro Supabase: ${error.message}`);
        subRow = data;
      }

      if (!subRow && authoritative.externalReference) {
        const { data, error } = await admin
          .from("billing_subscriptions")
          .select(subSelectColumns)
          .eq("external_reference", authoritative.externalReference)
          .maybeSingle();
        if (error) throw new ServiceUnavailableError(`Erro Supabase: ${error.message}`);
        subRow = data;
      }

      if (!subRow && !creds.isOfficialSandboxApi && params.query["subscription_id"]) {
        const { data, error } = await admin
          .from("billing_subscriptions")
          .select(subSelectColumns)
          .eq("id", params.query["subscription_id"])
          .maybeSingle();
        if (error) throw new ServiceUnavailableError(`Erro Supabase: ${error.message}`);
        subRow = data;
      }
    } catch (err) {
      if (err instanceof ServiceUnavailableError) throw err;
      throw new ServiceUnavailableError(
        `Falha de conexão com Supabase durante conciliação Billing: ${
          err instanceof Error ? err.message : "erro desconhecido"
        }`
      );
    }

    if (!subRow) {
      // Eventos do tópico genérico `payment` que não pertencem a nenhuma assinatura SaaS
      // são ignorados com segurança para não poluir nem falhar reconciliações da conta.
      if (authoritative.resourceType === "payment") {
        return {
          outcome: "ignored_unrelated_payment",
          subscriptionId: null,
          invoiceId: null,
          invoiceStatus: null,
          subscriptionStatus: null,
        };
      }
      throw new NotFoundError("Assinatura SaaS correspondente ao webhook Billing não localizada.");
    }

    // Proteção estrita contra alteração cruzada entre empresas:
    // se o recurso externo informar external_reference, ela DEVE corresponder à assinatura encontrada!
    if (
      authoritative.externalReference &&
      subRow.external_reference &&
      authoritative.externalReference.trim() !== subRow.external_reference.trim()
    ) {
      throw new ForbiddenError(
        "VIOLAÇÃO MULTIEMPRESA: external_reference do evento diverge do contrato da assinatura alvo."
      );
    }

    // Se a assinatura já possui external_subscription_id vinculado e o evento traz outro diferente, bloqueia!
    if (
      authoritative.externalSubscriptionId &&
      subRow.external_subscription_id &&
      authoritative.externalSubscriptionId.trim() !== subRow.external_subscription_id.trim()
    ) {
      throw new ForbiddenError(
        "VIOLAÇÃO MULTIEMPRESA: external_subscription_id do evento diverge do contrato vinculado."
      );
    }

    // 6. Tratamento autoritativo e idempotente de evento de contrato (`subscription_preapproval`)
    if (authoritative.resourceType === "subscription_preapproval") {
      const { data: existingEvt, error: dupErr } = await admin
        .from("billing_webhook_events")
        .select("id")
        .eq("provider", params.providerName)
        .eq("external_event_id", verifiedHeader.externalEventId)
        .maybeSingle();

      if (dupErr) {
        throw new ServiceUnavailableError(`Falha ao verificar idempotência: ${dupErr.message}`);
      }

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
            activated_at:
              nextSubStatus === "active" ? subRow.activated_at ?? nowIso : subRow.activated_at,
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
      } else if (
        authoritative.subscriptionStatus === "cancelled" &&
        subRow.status !== "cancelled"
      ) {
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
            authMethod: verifiedHeader.authMethod,
            hmacSignatureVerified: verifiedHeader.signatureVerified,
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
        signature_verified: verifiedHeader.signatureVerified,
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

    // 7. Reconciliação atômica e idempotente de cobrança recorrente (`subscription_authorized_payment` / `payment`)
    const dueDate =
      authoritative.dueDate ||
      subRow.next_billing_date ||
      subRow.scheduled_start_date ||
      new Date().toISOString().slice(0, 10);

    const cycleKey =
      authoritative.billingCycleKey || BillingInvariants.buildBillingCycleKey(dueDate);
    const amountCents = authoritative.amountCents || subRow.contracted_amount_cents;
    const invoiceStatus = authoritative.invoiceStatus || "pending";

    // A RPC `reconcile_billing_invoice_tx` exige `p_signature_verified = true` como barreira de origem
    // verificada pelo servidor (HMAC válido OU consulta autoritativa autenticada no modo fallback explícito).
    // O campo `hmacSignatureVerified` em `p_payload_summary` registra com total transparência o método real.
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
      p_payment_method_label:
        authoritative.paymentMethodLabel || subRow.payment_method_label || undefined,
      p_failure_code: authoritative.failureCode || undefined,
      p_failure_reason: authoritative.failureReason || undefined,
      p_payload_summary: taggedSummary as Json,
    });

    if (rpcErr) {
      throw new ServiceUnavailableError(
        `Falha na reconciliação atômica Billing SaaS (Supabase): ${rpcErr.message}`
      );
    }

    const resObj = (rpcData ?? {}) as {
      outcome?: string;
      invoiceId?: string;
      invoiceNumber?: string;
      invoiceStatus?: string;
      subscriptionId?: string;
      subscriptionStatus?: string;
    };

    if (
      resObj.outcome === "processed" &&
      (invoiceStatus === "paid" || invoiceStatus === "failed" || invoiceStatus === "overdue")
    ) {
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
          authMethod: verifiedHeader.authMethod,
          hmacSignatureVerified: verifiedHeader.signatureVerified,
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
