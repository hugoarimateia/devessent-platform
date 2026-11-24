import { createHash, randomBytes, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditService } from "@/core/audit/services/audit-service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/core/errors/app-error";
import type { RoleOrAdmin } from "@/core/permissions/policies/role-matrix";
import { env } from "@/lib/environment/env";
import { BillingInvariants } from "../domain/billing-invariants";
import { BillingPermissionService } from "../permissions/billing-permissions";
import {
  buildBillingWebhookSignature,
  getDefaultBillingProvider,
  MercadoPagoBillingProvider,
  resolveDevEssentBillingCredentials,
} from "../providers/mercado-pago-billing.provider";
import {
  authorizeSubscriptionPaymentSchema,
  cancelBillingSubscriptionSchema,
  createBillingSubscriptionSchema,
  simulateSandboxChargeSchema,
  updateSubscriptionContractSchema,
  updateSubscriptionPaymentMethodSchema,
  type AuthorizeSubscriptionPaymentInput,
  type CancelBillingSubscriptionInput,
  type CreateBillingSubscriptionInput,
  type SimulateSandboxChargeInput,
  type UpdateSubscriptionContractInput,
  type UpdateSubscriptionPaymentMethodInput,
} from "../schemas/billing.schema";
import type {
  BillingCycle,
  BillingInvoice,
  BillingInvoiceStatus,
  BillingPaymentMethodType,
  BillingPlan,
  BillingProviderName,
  BillingSubscription,
  BillingSubscriptionHistoryItem,
  BillingSubscriptionStatus,
  BillingSubscriptionSyncResult,
  BillingWebhookEventView,
  GlobalBillingOverview,
  OfficialSandboxIdentityVerification,
  TenantOwnerBillingView,
} from "../types/billing.types";
import { BillingPlanService } from "./billing-plan-service";
import { BillingWebhookService } from "./billing-webhook-service";
import { ImplementationContractService } from "./implementation-contract-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;
type SubRow = Database["public"]["Tables"]["billing_subscriptions"]["Row"];
type InvRow = Database["public"]["Tables"]["billing_invoices"]["Row"];
type SubHistRow = Database["public"]["Tables"]["billing_subscription_history"]["Row"];
type WebhookRow = Database["public"]["Tables"]["billing_webhook_events"]["Row"];

function mapSubscription(
  row: SubRow,
  tenantMeta?: { name: string; slug: string }
): BillingSubscription {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: tenantMeta?.name,
    tenantSlug: tenantMeta?.slug,
    planId: row.plan_id,
    planNameSnapshot: row.plan_name_snapshot,
    planVersionSnapshot: row.plan_version_snapshot,
    contractedAmountCents: row.contracted_amount_cents,
    currency: "BRL",
    billingCycle: row.billing_cycle as BillingCycle,
    status: row.status as BillingSubscriptionStatus,
    environment: "sandbox",
    provider: row.provider as BillingProviderName,
    externalPlanId: row.external_plan_id,
    externalSubscriptionId: row.external_subscription_id,
    externalReference: row.external_reference,
    paymentMethodType: row.payment_method_type as BillingPaymentMethodType,
    paymentMethodLabel: row.payment_method_label,
    paymentMethodBrand: row.payment_method_brand,
    paymentMethodLast4: row.payment_method_last4,
    authorizationUrl: row.authorization_url,
    authorizationExpiresAt: row.authorization_expires_at,
    authorizedAt: row.authorized_at,
    contractAcceptedAt: row.contract_accepted_at,
    contractAcceptedByName: row.contract_accepted_by_name,
    activationConfirmedAt: row.activation_confirmed_at,
    activationConfirmedBy: row.activation_confirmed_by,
    scheduledStartDate: row.scheduled_start_date,
    activatedAt: row.activated_at,
    nextBillingDate: row.next_billing_date,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    gracePeriodDays: row.grace_period_days,
    delinquentSince: row.delinquent_since,
    consecutiveFailedCharges: row.consecutive_failed_charges,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    cancellationRequestedAt: row.cancellation_requested_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvoice(row: InvRow, tenantName?: string): BillingInvoice {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    tenantId: row.tenant_id,
    tenantName,
    invoiceNumber: row.invoice_number,
    billingCycleKey: row.billing_cycle_key,
    environment: "sandbox",
    provider: row.provider as BillingProviderName,
    externalPaymentId: row.external_payment_id,
    amountCents: row.amount_cents,
    refundedAmountCents: row.refunded_amount_cents,
    currency: "BRL",
    status: row.status as BillingInvoiceStatus,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    failedAt: row.failed_at,
    refundedAt: row.refunded_at,
    failureCode: row.failure_code,
    failureReason: row.failure_reason,
    paymentMethodType: row.payment_method_type as BillingPaymentMethodType | null,
    paymentMethodLabel: row.payment_method_label,
    attemptCount: row.attempt_count,
    lastReconciledAt: row.last_reconciled_at,
    createdAt: row.created_at,
  };
}

function mapSubHistory(row: SubHistRow): BillingSubscriptionHistoryItem {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    tenantId: row.tenant_id,
    eventType: row.event_type,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    previousAmountCents: row.previous_amount_cents,
    newAmountCents: row.new_amount_cents,
    actorUserId: row.actor_user_id,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function mapWebhook(row: WebhookRow): BillingWebhookEventView {
  return {
    id: row.id,
    provider: row.provider as BillingProviderName,
    environment: "sandbox",
    externalEventId: row.external_event_id,
    eventType: row.event_type,
    resourceType: row.resource_type,
    externalResourceId: row.external_resource_id,
    subscriptionId: row.subscription_id,
    invoiceId: row.invoice_id,
    tenantId: row.tenant_id,
    signatureVerified: row.signature_verified,
    processingStatus: row.processing_status,
    errorMessage: row.error_message,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
  };
}

export class BillingSubscriptionService {
  /**
   * 1. Visão Global Consolidada da DevEssent (/admin/comercial) — Exclusiva Platform Admin
   */
  public static async getGlobalBillingOverview(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
  }): Promise<GlobalBillingOverview> {
    BillingPermissionService.assertPermission(params.actorRole, "view_global_billing");

    const provider = getDefaultBillingProvider();
    const [plans, implContracts, subsRes, invRes, whRes, tenantsRes] = await Promise.all([
      BillingPlanService.listPlans({
        supabase: params.supabase,
        actorRole: params.actorRole,
        includeInactive: true,
      }),
      ImplementationContractService.listGlobalContracts({
        supabase: params.supabase,
        actorRole: params.actorRole,
      }),
      params.supabase
        .from("billing_subscriptions")
        .select("*")
        .order("created_at", { ascending: false }),
      params.supabase
        .from("billing_invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      params.supabase
        .from("billing_webhook_events")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(50),
      params.supabase
        .from("tenants")
        .select("id, name, slug, status")
        .order("name", { ascending: true }),
    ]);

    const tenants = tenantsRes.data ?? [];
    const tenantMap = new Map(tenants.map((t) => [t.id, { name: t.name, slug: t.slug }]));

    const subscriptions = (subsRes.data ?? []).map((s) =>
      mapSubscription(s, tenantMap.get(s.tenant_id))
    );
    const recentInvoices = (invRes.data ?? []).map((inv) =>
      mapInvoice(inv, tenantMap.get(inv.tenant_id)?.name)
    );
    const recentWebhooks = (whRes.data ?? []).map(mapWebhook);

    // Métricas estritas (§5.3, §6): nunca contabiliza pendentes como receita recebida
    const activeSubs = subscriptions.filter(
      (s) => s.status === "active" || s.status === "cancel_scheduled"
    );
    const pendingSetupSubs = subscriptions.filter(
      (s) => s.status === "awaiting_authorization" || s.status === "awaiting_activation"
    );
    const delinquentSubs = subscriptions.filter(
      (s) =>
        s.status === "past_due" ||
        s.status === "pending_payment" ||
        s.status === "in_regularization"
    );
    const cancelledSubs = subscriptions.filter((s) => s.status === "cancelled");

    const mrrActiveCents = activeSubs.reduce(
      (sum, s) =>
        sum +
        BillingInvariants.calculateMonthlyEquivalentCents(
          s.contractedAmountCents,
          s.billingCycle
        ),
      0
    );

    const paidInvoicesPeriodCents = recentInvoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + (i.amountCents - i.refundedAmountCents), 0);

    const pendingInvoicesCents = recentInvoices
      .filter((i) => i.status === "pending" || i.status === "processing" || i.status === "scheduled")
      .reduce((sum, i) => sum + i.amountCents, 0);

    const overdueInvoicesCents = recentInvoices
      .filter((i) => i.status === "failed" || i.status === "overdue")
      .reduce((sum, i) => sum + i.amountCents, 0);

    const activeImplContracts = implContracts.filter(
      (c) => c.status !== "cancelled" && c.status !== "completed"
    );
    const allInstallments = implContracts
      .filter((c) => c.status !== "cancelled")
      .flatMap((c) => c.installments);

    const pendingImplementationCents = allInstallments
      .filter((i) => i.status === "pending" || i.status === "receipt_attached")
      .reduce((sum, i) => sum + i.amountCents, 0);

    const confirmedImplementationCents = allInstallments
      .filter((i) => i.status === "confirmed")
      .reduce((sum, i) => sum + i.amountCents, 0);

    const distinctContractedTenants = new Set<string>([
      ...subscriptions.filter((s) => s.status !== "cancelled").map((s) => s.tenantId),
      ...implContracts.filter((c) => c.status !== "cancelled").map((c) => c.tenantId),
    ]);

    return {
      environmentLabel: env.NEXT_PUBLIC_APP_ENV,
      providerStatus: provider.getRuntimeStatus(),
      metrics: {
        contractedCompaniesCount: distinctContractedTenants.size,
        activeSubscriptionsCount: activeSubs.length,
        pendingSetupSubscriptionsCount: pendingSetupSubs.length,
        delinquentSubscriptionsCount: delinquentSubs.length,
        cancelledSubscriptionsCount: cancelledSubs.length,
        mrrActiveCents,
        paidInvoicesPeriodCents,
        pendingInvoicesCents,
        overdueInvoicesCents,
        activeImplementationContractsCount: activeImplContracts.length,
        pendingImplementationCents,
        confirmedImplementationCents,
      },
      plans,
      subscriptions,
      recentInvoices,
      recentWebhooks,
      implementationContracts: implContracts,
      tenantsDirectory: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
      })),
    };
  }

  /**
   * 2. Visão Restrita do Empresário (/dashboard/assinatura) — Exclusiva Owner / Platform Admin
   */
  public static async getTenantOwnerBillingView(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    tenantId: string;
    tenantName: string;
  }): Promise<TenantOwnerBillingView> {
    BillingPermissionService.assertPermission(
      params.actorRole,
      "view_own_tenant_billing",
      "Apenas o proprietário do estabelecimento pode consultar os dados contratuais da assinatura DevEssent."
    );

    const provider = getDefaultBillingProvider();

    const [subsRes, invRes, histRes, notifRes, implContracts] = await Promise.all([
      params.supabase
        .from("billing_subscriptions")
        .select("*")
        .eq("tenant_id", params.tenantId)
        .order("created_at", { ascending: false })
        .limit(1),
      params.supabase
        .from("billing_invoices")
        .select("*")
        .eq("tenant_id", params.tenantId)
        .order("due_date", { ascending: false })
        .limit(36),
      params.supabase
        .from("billing_subscription_history")
        .select("*")
        .eq("tenant_id", params.tenantId)
        .order("created_at", { ascending: false })
        .limit(20),
      params.supabase
        .from("billing_notifications_queue")
        .select("id, notification_type, status, created_at")
        .eq("tenant_id", params.tenantId)
        .order("created_at", { ascending: false })
        .limit(10),
      ImplementationContractService.listTenantContracts({
        supabase: params.supabase,
        actorRole: params.actorRole,
        tenantId: params.tenantId,
      }),
    ]);

    const latestSubRow = subsRes.data?.[0] ?? null;
    const subscription = latestSubRow ? mapSubscription(latestSubRow) : null;

    let plan: BillingPlan | null = null;
    if (latestSubRow) {
      const { data: planRow } = await params.supabase
        .from("billing_plans")
        .select("*")
        .eq("id", latestSubRow.plan_id)
        .maybeSingle();
      if (planRow) {
        const services = Array.isArray(planRow.included_services) ? planRow.included_services : [];
        plan = {
          id: planRow.id,
          code: planRow.code,
          name: planRow.name,
          description: planRow.description,
          version: planRow.version,
          amountCents: planRow.amount_cents,
          currency: "BRL",
          billingCycle: planRow.billing_cycle as BillingCycle,
          includedServices: services.filter((s: unknown): s is string => typeof s === "string"),
          isActive: planRow.is_active,
          isDemo: planRow.is_demo,
          archivedAt: planRow.archived_at,
          createdAt: planRow.created_at,
          updatedAt: planRow.updated_at,
        };
      }
    }

    return {
      tenantId: params.tenantId,
      tenantName: params.tenantName,
      environmentLabel: env.NEXT_PUBLIC_APP_ENV,
      providerStatus: provider.getRuntimeStatus(),
      subscription,
      plan,
      invoices: (invRes.data ?? []).map((i) => mapInvoice(i, params.tenantName)),
      history: (histRes.data ?? []).map(mapSubHistory),
      implementationContracts: implContracts,
      notifications: (notifRes.data ?? []).map((n) => ({
        id: n.id,
        notificationType: n.notification_type,
        status: n.status,
        createdAt: n.created_at,
      })),
    };
  }

  /**
   * 3. Vincular empresa a um plano comercial (cria assinatura em `awaiting_authorization`)
   *    Nunca inicia cobrança sem autorização válida + marco contratual (§8).
   */
  public static async createSubscription(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    input: CreateBillingSubscriptionInput;
  }): Promise<BillingSubscription> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_billing_subscriptions");
    const parsed = createBillingSubscriptionSchema.parse(params.input);

    const [{ data: tenant }, { data: plan }, { data: existingOpen }] = await Promise.all([
      params.supabase
        .from("tenants")
        .select("id, name, slug")
        .eq("id", parsed.tenantId)
        .maybeSingle(),
      params.supabase
        .from("billing_plans")
        .select("*")
        .eq("id", parsed.planId)
        .maybeSingle(),
      params.supabase
        .from("billing_subscriptions")
        .select("id, status")
        .eq("tenant_id", parsed.tenantId)
        .neq("status", "cancelled")
        .maybeSingle(),
    ]);

    if (!tenant) throw new NotFoundError("Empresa contratante não encontrada.");
    if (!plan) throw new NotFoundError("Plano comercial não encontrado.");
    if (!plan.is_active) {
      throw new ValidationError("Não é possível vincular nova assinatura a um plano desativado.");
    }
    if (existingOpen) {
      throw new ConflictError(
        "Esta empresa já possui uma assinatura SaaS em andamento. Cancele ou edite o contrato atual."
      );
    }

    const contractedAmountCents = parsed.contractedAmountCents ?? plan.amount_cents;
    const subId = randomUUID();
    const externalReference = `devessent:saas:${tenant.slug}:${subId.slice(0, 8)}`;

    // Localiza e-mail do proprietário da empresa apenas para preparar a pré-aprovação sandbox
    const admin = createAdminClient();
    const { data: ownerMember } = await admin
      .from("tenant_memberships")
      .select("user_id, profiles(email)")
      .eq("tenant_id", tenant.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    const ownerProfile = ownerMember?.profiles as { email?: string } | null | undefined;
    const payerEmail =
      parsed.sandboxPayerEmail?.trim() ||
      ownerProfile?.email ||
      `financeiro+${tenant.slug}@devessent.test`;

    const provider = getDefaultBillingProvider();
    const backUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/dashboard/assinatura`;
    const externalSub = await provider.createRecurringAuthorization({
      subscriptionId: subId,
      tenantId: tenant.id,
      tenantName: tenant.name,
      planName: plan.name,
      externalReference,
      amountCents: contractedAmountCents,
      currency: "BRL",
      billingCycle: plan.billing_cycle as BillingCycle,
      scheduledStartDate: parsed.scheduledStartDate,
      payerEmail,
      backUrl,
    });

    const rawAuthToken = randomBytes(24).toString("base64url");
    const authTokenHash = createHash("sha256").update(rawAuthToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: created, error } = await params.supabase
      .from("billing_subscriptions")
      .insert({
        id: subId,
        tenant_id: tenant.id,
        plan_id: plan.id,
        plan_name_snapshot: plan.name,
        plan_version_snapshot: plan.version,
        contracted_amount_cents: contractedAmountCents,
        currency: "BRL",
        billing_cycle: plan.billing_cycle,
        status: "awaiting_authorization",
        environment: "sandbox",
        provider: externalSub.provider,
        external_plan_id: externalSub.externalPlanId,
        external_subscription_id: externalSub.externalSubscriptionId,
        external_reference: externalReference,
        payment_method_type: "unconfigured",
        authorization_token_hash: authTokenHash,
        authorization_expires_at: expiresAt,
        authorization_url: externalSub.authorizationUrl,
        contract_accepted_at: parsed.contractAcceptedByName ? new Date().toISOString() : null,
        contract_accepted_by_name: parsed.contractAcceptedByName ?? null,
        scheduled_start_date: parsed.scheduledStartDate,
        next_billing_date: parsed.scheduledStartDate,
        grace_period_days: parsed.gracePeriodDays,
        admin_notes: parsed.adminNotes ?? null,
        metadata: externalSub.rawSummary as Json,
        created_by: params.actorUserId,
      })
      .select("*")
      .single();

    if (error || !created) {
      throw new Error(`Falha ao criar assinatura SaaS: ${error?.message ?? "desconhecido"}`);
    }

    await Promise.all([
      params.supabase.from("billing_subscription_history").insert({
        subscription_id: created.id,
        tenant_id: tenant.id,
        event_type: "created",
        previous_status: null,
        new_status: "awaiting_authorization",
        new_amount_cents: contractedAmountCents,
        actor_user_id: params.actorUserId,
        reason: `Plano ${plan.name} (v${plan.version}) vinculado com início agendado para ${parsed.scheduledStartDate}.`,
      }),
      params.supabase.from("billing_notifications_queue").insert({
        tenant_id: tenant.id,
        subscription_id: created.id,
        notification_type: "authorization_requested",
        channel: "in_app",
        status: "logged_sandbox",
        payload: {
          planName: plan.name,
          contractedAmountCents,
          scheduledStartDate: parsed.scheduledStartDate,
        } as Json,
      }),
      AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: tenant.id,
        actorUserId: params.actorUserId,
        action: "billing.subscription_created",
        resourceType: "billing_subscription",
        resourceId: created.id,
        metadata: {
          planId: plan.id,
          planCode: plan.code,
          contractedAmountCents,
          scheduledStartDate: parsed.scheduledStartDate,
        },
      }),
    ]);

    return mapSubscription(created, { name: tenant.name, slug: tenant.slug });
  }

  /**
   * 4. Autorização do meio de pagamento recorrente pelo Owner (ou Admin em homologação Sandbox).
   *    Armazena apenas metadados seguros (bandeira + últimos 4 dígitos), NUNCA PAN/CVV (§8).
   */
  public static async authorizeSubscriptionPayment(params: {
    actorRole: RoleOrAdmin;
    actorUserId: string;
    actorTenantId: string | null;
    input: AuthorizeSubscriptionPaymentInput;
  }): Promise<BillingSubscription> {
    BillingPermissionService.assertPermission(
      params.actorRole,
      "authorize_own_tenant_subscription",
      "Apenas o proprietário do estabelecimento pode autorizar o meio de pagamento da assinatura."
    );
    const parsed = authorizeSubscriptionPaymentSchema.parse(params.input);

    const admin = createAdminClient();
    const { data: sub, error } = await admin
      .from("billing_subscriptions")
      .select("*")
      .eq("id", parsed.subscriptionId)
      .maybeSingle();

    if (error || !sub) {
      throw new NotFoundError("Assinatura SaaS não encontrada.");
    }

    // Isolamento estrito multiempresa: Owner só autoriza assinatura do próprio tenant!
    if (params.actorRole !== "platform_admin" && sub.tenant_id !== params.actorTenantId) {
      throw new ForbiddenError(
        "VIOLAÇÃO MULTIEMPRESA: você não tem permissão para autorizar assinatura de outra empresa."
      );
    }

    if (sub.status === "cancelled") {
      throw new ConflictError("Assinatura cancelada não pode ser autorizada.");
    }

    const provider = getDefaultBillingProvider();
    const authRes = await provider.confirmSandboxAuthorization({
      externalSubscriptionId: sub.external_subscription_id || sub.id,
      cardBrand: parsed.cardBrand,
      cardLast4: parsed.cardLast4,
      payerEmail: parsed.payerEmail,
    });

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const nextStatus: BillingSubscriptionStatus =
      sub.activation_confirmed_at && sub.scheduled_start_date <= today
        ? "active"
        : "awaiting_activation";

    const { data: updated, error: updErr } = await admin
      .from("billing_subscriptions")
      .update({
        status: nextStatus,
        payment_method_type: parsed.paymentMethodType,
        payment_method_brand: parsed.cardBrand,
        payment_method_last4: parsed.cardLast4,
        payment_method_label: authRes.paymentMethodLabel,
        authorized_at: nowIso,
        contract_accepted_at: sub.contract_accepted_at ?? nowIso,
        contract_accepted_by_name: parsed.acceptedByName,
        activated_at: nextStatus === "active" ? sub.activated_at ?? nowIso : sub.activated_at,
      })
      .eq("id", sub.id)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(`Falha ao registrar autorização de pagamento: ${updErr?.message ?? ""}`);
    }

    await Promise.all([
      admin.from("billing_subscription_history").insert({
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        event_type: "authorized",
        previous_status: sub.status,
        new_status: nextStatus,
        actor_user_id: params.actorUserId,
        reason: `Recorrência autorizada por ${parsed.acceptedByName} (${authRes.paymentMethodLabel}).`,
      }),
      AuditService.recordEvent({
        supabase: admin,
        tenantId: sub.tenant_id,
        actorUserId: params.actorUserId,
        action: "billing.subscription_authorized",
        resourceType: "billing_subscription",
        resourceId: sub.id,
        metadata: {
          paymentMethodLabel: authRes.paymentMethodLabel,
          acceptedByName: parsed.acceptedByName,
          nextStatus,
        },
      }),
    ]);

    return mapSubscription(updated);
  }

  /**
   * 5. Confirmação do marco contratual de ativação pela DevEssent (Platform Admin ONLY).
   *    Respeita `scheduled_start_date` e exige autorização financeira prévia antes de ativar cobranças (§8).
   */
  public static async confirmActivationMilestone(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    subscriptionId: string;
    note?: string;
  }): Promise<BillingSubscription> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_billing_subscriptions");

    const { data: sub, error } = await params.supabase
      .from("billing_subscriptions")
      .select("*")
      .eq("id", params.subscriptionId)
      .maybeSingle();

    if (error || !sub) throw new NotFoundError("Assinatura não localizada.");
    if (sub.status === "cancelled") {
      throw new ConflictError("Assinatura cancelada não pode ser ativada.");
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    // Só ativa efetivamente quando já há autorização do pagador E a data agendada foi atingida
    const canBecomeActiveNow = Boolean(sub.authorized_at) && sub.scheduled_start_date <= today;
    const nextStatus: BillingSubscriptionStatus = !sub.authorized_at
      ? "awaiting_authorization"
      : canBecomeActiveNow
      ? "active"
      : "awaiting_activation";

    const { data: updated, error: updErr } = await params.supabase
      .from("billing_subscriptions")
      .update({
        activation_confirmed_at: sub.activation_confirmed_at ?? nowIso,
        activation_confirmed_by: params.actorUserId,
        status: nextStatus,
        activated_at: canBecomeActiveNow ? sub.activated_at ?? nowIso : sub.activated_at,
        next_billing_date: sub.next_billing_date ?? sub.scheduled_start_date,
      })
      .eq("id", sub.id)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(`Erro ao confirmar ativação da assinatura: ${updErr?.message ?? ""}`);
    }

    await Promise.all([
      params.supabase.from("billing_subscription_history").insert({
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        event_type: canBecomeActiveNow ? "activated" : "activation_confirmed",
        previous_status: sub.status,
        new_status: nextStatus,
        actor_user_id: params.actorUserId,
        reason:
          params.note ||
          (canBecomeActiveNow
            ? "Marco contratual confirmado e assinatura ativada."
            : `Marco contratual confirmado. Início agendado para ${sub.scheduled_start_date}.`),
      }),
      AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: sub.tenant_id,
        actorUserId: params.actorUserId,
        action: "billing.subscription_activated",
        resourceType: "billing_subscription",
        resourceId: sub.id,
        metadata: {
          previousStatus: sub.status,
          nextStatus,
          scheduledStartDate: sub.scheduled_start_date,
          hasAuthorization: Boolean(sub.authorized_at),
        },
      }),
    ]);

    return mapSubscription(updated);
  }

  /**
   * 6. Atualização segura do método de pagamento pelo Owner (ou Admin em homologação).
   *    Nunca altera preço, plano ou status financeiro manualmente!
   */
  public static async updatePaymentMethod(params: {
    actorRole: RoleOrAdmin;
    actorUserId: string;
    actorTenantId: string | null;
    input: UpdateSubscriptionPaymentMethodInput;
  }): Promise<BillingSubscription> {
    BillingPermissionService.assertPermission(params.actorRole, "update_own_payment_method");
    const parsed = updateSubscriptionPaymentMethodSchema.parse(params.input);

    const admin = createAdminClient();
    const { data: sub, error } = await admin
      .from("billing_subscriptions")
      .select("*")
      .eq("id", parsed.subscriptionId)
      .maybeSingle();

    if (error || !sub) throw new NotFoundError("Assinatura não localizada.");
    if (params.actorRole !== "platform_admin" && sub.tenant_id !== params.actorTenantId) {
      throw new ForbiddenError("VIOLAÇÃO MULTIEMPRESA: acesso negado a assinatura de outro tenant.");
    }
    if (sub.status === "cancelled") {
      throw new ConflictError("Assinatura cancelada não aceita atualização de método de pagamento.");
    }

    const provider = getDefaultBillingProvider();
    const updRes = await provider.updatePaymentMethod({
      externalSubscriptionId: sub.external_subscription_id || sub.id,
      cardBrand: parsed.cardBrand,
      cardLast4: parsed.cardLast4,
    });

    // Se estava em atraso, sinaliza "Em regularização" (nunca marca fatura como paga sem webhook/reconciliação!)
    const nextStatus: BillingSubscriptionStatus =
      sub.status === "past_due" || sub.status === "pending_payment"
        ? "in_regularization"
        : (sub.status as BillingSubscriptionStatus);

    const { data: updated, error: updErr } = await admin
      .from("billing_subscriptions")
      .update({
        payment_method_type: "credit_card",
        payment_method_brand: parsed.cardBrand,
        payment_method_last4: parsed.cardLast4,
        payment_method_label: updRes.paymentMethodLabel,
        authorized_at: sub.authorized_at ?? new Date().toISOString(),
        status: nextStatus,
      })
      .eq("id", sub.id)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(`Erro ao atualizar método de pagamento: ${updErr?.message ?? ""}`);
    }

    await Promise.all([
      admin.from("billing_subscription_history").insert({
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        event_type: "payment_method_updated",
        previous_status: sub.status,
        new_status: nextStatus,
        actor_user_id: params.actorUserId,
        reason: `Método de pagamento atualizado para ${updRes.paymentMethodLabel}.`,
      }),
      AuditService.recordEvent({
        supabase: admin,
        tenantId: sub.tenant_id,
        actorUserId: params.actorUserId,
        action: "billing.subscription_updated",
        resourceType: "billing_subscription",
        resourceId: sub.id,
        metadata: {
          paymentMethodLabel: updRes.paymentMethodLabel,
          previousStatus: sub.status,
          nextStatus,
        },
      }),
    ]);

    return mapSubscription(updated);
  }

  /**
   * 7. Ajuste contratual auditado (valor/data/tolerância/observação) — Platform Admin ONLY
   */
  public static async updateSubscriptionContract(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    input: UpdateSubscriptionContractInput;
  }): Promise<BillingSubscription> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_billing_subscriptions");
    const parsed = updateSubscriptionContractSchema.parse(params.input);

    const { data: sub, error } = await params.supabase
      .from("billing_subscriptions")
      .select("*")
      .eq("id", parsed.subscriptionId)
      .maybeSingle();

    if (error || !sub) throw new NotFoundError("Assinatura não encontrada.");

    const nextAmount = parsed.contractedAmountCents ?? sub.contracted_amount_cents;
    const nextStart = parsed.scheduledStartDate ?? sub.scheduled_start_date;

    const { data: updated, error: updErr } = await params.supabase
      .from("billing_subscriptions")
      .update({
        contracted_amount_cents: nextAmount,
        scheduled_start_date: nextStart,
        grace_period_days: parsed.gracePeriodDays ?? sub.grace_period_days,
        admin_notes: parsed.adminNotes !== undefined ? parsed.adminNotes : sub.admin_notes,
      })
      .eq("id", sub.id)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(`Falha ao ajustar condições da assinatura: ${updErr?.message ?? ""}`);
    }

    await Promise.all([
      params.supabase.from("billing_subscription_history").insert({
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        event_type:
          nextAmount !== sub.contracted_amount_cents
            ? "contract_amount_updated"
            : "admin_exception_recorded",
        previous_status: sub.status,
        new_status: updated.status,
        previous_amount_cents: sub.contracted_amount_cents,
        new_amount_cents: nextAmount,
        actor_user_id: params.actorUserId,
        reason: parsed.reason,
      }),
      AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: sub.tenant_id,
        actorUserId: params.actorUserId,
        action: "billing.subscription_updated",
        resourceType: "billing_subscription",
        resourceId: sub.id,
        metadata: {
          previousAmountCents: sub.contracted_amount_cents,
          newAmountCents: nextAmount,
          scheduledStartDate: nextStart,
          reason: parsed.reason,
        },
      }),
    ]);

    return mapSubscription(updated);
  }

  /**
   * 8. Agendar ou efetivar cancelamento — Platform Admin ONLY
   */
  public static async cancelSubscription(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    input: CancelBillingSubscriptionInput;
  }): Promise<BillingSubscription> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_billing_subscriptions");
    const parsed = cancelBillingSubscriptionSchema.parse(params.input);

    const { data: sub, error } = await params.supabase
      .from("billing_subscriptions")
      .select("*")
      .eq("id", parsed.subscriptionId)
      .maybeSingle();

    if (error || !sub) throw new NotFoundError("Assinatura não encontrada.");
    if (sub.status === "cancelled") {
      throw new ConflictError("Esta assinatura já está cancelada.");
    }

    const nowIso = new Date().toISOString();
    const isImmediate = parsed.mode === "immediate";

    if (isImmediate && sub.external_subscription_id) {
      const provider = getDefaultBillingProvider();
      await provider.cancelExternalSubscription({
        externalSubscriptionId: sub.external_subscription_id,
        reason: parsed.reason,
      });
    }

    const nextStatus: BillingSubscriptionStatus = isImmediate ? "cancelled" : "cancel_scheduled";

    const { data: updated, error: updErr } = await params.supabase
      .from("billing_subscriptions")
      .update({
        status: nextStatus,
        cancel_at_period_end: !isImmediate,
        cancellation_requested_at: sub.cancellation_requested_at ?? nowIso,
        cancelled_at: isImmediate ? nowIso : null,
        cancellation_reason: parsed.reason,
        next_billing_date: isImmediate ? null : sub.next_billing_date,
      })
      .eq("id", sub.id)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(`Erro ao cancelar assinatura: ${updErr?.message ?? ""}`);
    }

    await Promise.all([
      params.supabase.from("billing_subscription_history").insert({
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        event_type: isImmediate ? "cancelled" : "cancellation_scheduled",
        previous_status: sub.status,
        new_status: nextStatus,
        actor_user_id: params.actorUserId,
        reason: parsed.reason,
      }),
      params.supabase.from("billing_notifications_queue").insert({
        tenant_id: sub.tenant_id,
        subscription_id: sub.id,
        notification_type: "cancellation_confirmed",
        channel: "in_app",
        status: "logged_sandbox",
        payload: { mode: parsed.mode, reason: parsed.reason } as Json,
      }),
      AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: sub.tenant_id,
        actorUserId: params.actorUserId,
        action: "billing.subscription_cancelled",
        resourceType: "billing_subscription",
        resourceId: sub.id,
        metadata: { mode: parsed.mode, previousStatus: sub.status, nextStatus, reason: parsed.reason },
      }),
    ]);

    return mapSubscription(updated);
  }

  /**
   * 9. Simulação controlada de ciclo recorrente Sandbox (Platform Admin ONLY).
   *    Exercita o MESMO pipeline real de webhook HMAC-SHA256 + consulta autoritativa + RPC atômica.
   *    Bloqueado se a assinatura ainda não possui autorização válida + marco de ativação (§8)!
   */
  public static async simulateSandboxRecurringCharge(params: {
    actorRole: RoleOrAdmin;
    actorUserId: string;
    input: SimulateSandboxChargeInput;
  }): Promise<{
    outcome: string;
    invoiceId: string | null;
    invoiceStatus: string | null;
    subscriptionStatus: string | null;
    externalEventId: string;
  }> {
    BillingPermissionService.assertPermission(params.actorRole, "simulate_billing_sandbox");

    if (env.NEXT_PUBLIC_APP_ENV === "production") {
      throw new ForbiddenError(
        "FAIL-CLOSED: Simulação interna de cobrança recorrente é proibida em ambiente de produção."
      );
    }

    const creds = resolveDevEssentBillingCredentials();
    if (creds.isOfficialSandboxApi) {
      throw new ConflictError(
        "O simulador interno está desabilitado enquanto a API Oficial Mercado Pago Sandbox estiver ativa. Dispare eventos diretamente pelo Mercado Pago Sandbox."
      );
    }

    const parsed = simulateSandboxChargeSchema.parse(params.input);

    const admin = createAdminClient();
    const { data: sub, error } = await admin
      .from("billing_subscriptions")
      .select("*")
      .eq("id", parsed.subscriptionId)
      .maybeSingle();

    if (error || !sub) throw new NotFoundError("Assinatura não localizada.");

    BillingInvariants.assertBillingSandboxOnly(sub.environment);

    const readiness = BillingInvariants.evaluateBillingStartReadiness({
      status: sub.status as BillingSubscriptionStatus,
      authorizedAt: sub.authorized_at,
      activationConfirmedAt: sub.activation_confirmed_at,
      scheduledStartDate: sub.scheduled_start_date,
    });
    if (!readiness.canCharge) {
      throw new ConflictError(
        `Cobrança recorrente bloqueada pelas regras contratuais: ${readiness.reasons.join(" ")}`
      );
    }

    const dueDate = sub.next_billing_date || sub.scheduled_start_date;
    const cycleKey =
      parsed.billingCycleKey || BillingInvariants.buildBillingCycleKey(dueDate);
    const externalPaymentId = `MP-AUTHPAY-SBX-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const externalEventId = `evt-billing-sbx-${Date.now()}-${randomBytes(4).toString("hex")}`;

    MercadoPagoBillingProvider.seedSimulatedResource({
      externalResourceId: externalPaymentId,
      resourceType: "subscription_authorized_payment",
      externalSubscriptionId: sub.external_subscription_id || sub.id,
      externalReference: sub.external_reference,
      invoiceStatus: parsed.outcome,
      subscriptionStatus: null,
      amountCents: sub.contracted_amount_cents,
      currency: "BRL",
      dueDate,
      billingCycleKey: cycleKey,
      paymentMethodLabel: sub.payment_method_label || "Cartão de Crédito (Sandbox)",
      failureCode:
        parsed.outcome === "failed" || parsed.outcome === "overdue"
          ? "cc_rejected_insufficient_amount"
          : null,
      failureReason:
        parsed.outcome === "failed" || parsed.outcome === "overdue"
          ? parsed.failureReason || "Cobrança recorrente recusada pelo emissor no Sandbox."
          : null,
    });

    const tsSec = Math.floor(Date.now() / 1000);
    const xRequestId = `req-billing-sim-${randomBytes(6).toString("hex")}`;
    const xSignature = buildBillingWebhookSignature({
      dataId: externalPaymentId,
      xRequestId,
      timestampSeconds: tsSec,
    });

    const rawBody = JSON.stringify({
      id: externalEventId,
      type: "subscription_authorized_payment",
      action: `payment.${parsed.outcome}`,
      live_mode: false,
      subscription_id: sub.id,
      billing_cycle_key: cycleKey,
      sandbox_outcome: parsed.outcome,
      data: { id: externalPaymentId },
    });

    const res = await BillingWebhookService.processBillingWebhook({
      providerName: "mercado_pago",
      headers: {
        "x-signature": xSignature,
        "x-request-id": xRequestId,
      },
      query: {
        "data.id": externalPaymentId,
        type: "subscription_authorized_payment",
        subscription_id: sub.id,
      },
      rawBody,
    });

    return {
      ...res,
      externalEventId,
    };
  }

  /**
   * 10. Diagnóstico autoritativo sob demanda das credenciais Mercado Pago Sandbox (Platform Admin ONLY).
   *     Nunca executado automaticamente durante a navegação das páginas (§13).
   */
  public static async runOfficialProviderDiagnostic(params: {
    actorRole: RoleOrAdmin;
  }): Promise<OfficialSandboxIdentityVerification> {
    BillingPermissionService.assertPermission(params.actorRole, "view_global_billing");
    const provider = getDefaultBillingProvider();
    return provider.verifyOfficialSandboxCredentials(true);
  }

  /**
   * 11. Sincronização autoritativa sob demanda de assinatura + pagamentos autorizados junto ao
   *     Mercado Pago Sandbox (`GET /preapproval/{id}` + `GET /authorized_payments/search`).
   *     Platform Admin ONLY; idempotente e sem polling em navegação.
   */
  public static async syncSubscriptionFromProvider(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    subscriptionId: string;
  }): Promise<BillingSubscriptionSyncResult> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_billing_subscriptions");

    const creds = resolveDevEssentBillingCredentials();
    if (!creds.isOfficialSandboxApi) {
      throw new ValidationError(
        "A sincronização externa requer BILLING_PROVIDER_MODE=official_sandbox_api configurado com credenciais da Conta de Teste DevEssent."
      );
    }

    const admin = createAdminClient();
    const { data: sub, error } = await admin
      .from("billing_subscriptions")
      .select("*")
      .eq("id", params.subscriptionId)
      .maybeSingle();

    if (error || !sub) throw new NotFoundError("Assinatura não localizada.");
    if (!sub.external_subscription_id) {
      throw new ValidationError(
        "Esta assinatura não possui external_subscription_id vinculado no Mercado Pago."
      );
    }

    const provider = getDefaultBillingProvider();
    const checkedAt = new Date().toISOString();

    // 1. Consultar estado autoritativo da assinatura (`GET /preapproval/{id}`)
    const extSub = await provider.getExternalSubscription(sub.external_subscription_id);
    if (extSub.externalReference && extSub.externalReference !== sub.external_reference) {
      throw new ForbiddenError(
        "VIOLAÇÃO MULTIEMPRESA: external_reference retornada pelo Mercado Pago diverge do contrato."
      );
    }

    const today = checkedAt.slice(0, 10);
    const prevStatus = sub.status as BillingSubscriptionStatus;
    let newStatus: BillingSubscriptionStatus = prevStatus;
    const existingMeta =
      sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata)
        ? (sub.metadata as Record<string, unknown>)
        : {};
    const mergedMeta: Json = {
      ...existingMeta,
      ...(extSub.providerUpdatedAt ? { lastProviderUpdatedAt: extSub.providerUpdatedAt } : {}),
      lastManualSyncAt: checkedAt,
    } as Json;

    if (extSub.subscriptionStatus === "active" && prevStatus !== "cancelled") {
      const canActivateNow = Boolean(sub.activation_confirmed_at) && sub.scheduled_start_date <= today;
      newStatus =
        prevStatus === "active" || prevStatus === "cancel_scheduled"
          ? prevStatus
          : canActivateNow
            ? "active"
            : "awaiting_activation";

      await admin
        .from("billing_subscriptions")
        .update({
          status: newStatus,
          authorized_at: sub.authorized_at ?? checkedAt,
          activated_at: newStatus === "active" ? sub.activated_at ?? checkedAt : sub.activated_at,
          payment_method_type:
            sub.payment_method_type === "unconfigured" ? "credit_card" : sub.payment_method_type,
          payment_method_label:
            sub.payment_method_label ||
            extSub.paymentMethodLabel ||
            "Cartão de Crédito (Mercado Pago Sandbox)",
          next_billing_date: extSub.dueDate || sub.next_billing_date,
          metadata: mergedMeta,
        })
        .eq("id", sub.id);
    } else if (extSub.subscriptionStatus === "cancelled" && prevStatus !== "cancelled") {
      newStatus = "cancelled";
      await admin
        .from("billing_subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: checkedAt,
          next_billing_date: null,
          cancellation_reason: "Cancelamento confirmado por consulta autoritativa no Mercado Pago.",
          metadata: mergedMeta,
        })
        .eq("id", sub.id);
    } else if (
      extSub.subscriptionStatus === "past_due" &&
      prevStatus !== "cancelled" &&
      prevStatus !== "past_due"
    ) {
      newStatus = "past_due";
      await admin
        .from("billing_subscriptions")
        .update({
          status: "past_due",
          delinquent_since: sub.delinquent_since ?? checkedAt,
          metadata: mergedMeta,
        })
        .eq("id", sub.id);
    } else if (extSub.providerUpdatedAt) {
      await admin
        .from("billing_subscriptions")
        .update({ metadata: mergedMeta })
        .eq("id", sub.id);
    }

    if (newStatus !== prevStatus) {
      await admin.from("billing_subscription_history").insert({
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        event_type:
          newStatus === "cancelled"
            ? "cancelled"
            : newStatus === "past_due"
              ? "delinquency_flagged"
              : "authorized",
        previous_status: prevStatus,
        new_status: newStatus,
        actor_user_id: params.actorUserId,
        reason: "Sincronização autoritativa manual via GET /preapproval/{id} (Mercado Pago Sandbox).",
        metadata: extSub.rawSummary as Json,
      });
    }

    // 2. Consultar pagamentos autorizados (`GET /authorized_payments/search`, limite máximo MP = 12) e reconciliar idempotentemente
    const authorizedPayments = await provider.searchAuthorizedPayments({
      preapprovalId: sub.external_subscription_id,
      limit: 12,
    });

    let syncedCount = 0;
    for (const ap of authorizedPayments) {
      const dueDate = ap.dueDate || sub.next_billing_date || sub.scheduled_start_date;
      const cycleKey = ap.billingCycleKey || BillingInvariants.buildBillingCycleKey(dueDate);
      const status = ap.invoiceStatus || "pending";
      const amountCents = ap.amountCents || sub.contracted_amount_cents;
      const syncEventId = `sync:mp:authpay:${ap.externalResourceId}:${status}`;

      const { data: rpcRes } = await admin.rpc("reconcile_billing_invoice_tx", {
        p_subscription_id: sub.id,
        p_provider: "mercado_pago",
        p_external_event_id: syncEventId,
        p_event_type: "subscription_authorized_payment.admin_sync",
        p_signature_verified: true,
        p_billing_cycle_key: cycleKey,
        p_external_payment_id: ap.externalResourceId,
        p_authoritative_status: status,
        p_amount_cents: amountCents,
        p_currency: "BRL",
        p_due_date: dueDate,
        p_payment_method_type: sub.payment_method_type || "credit_card",
        p_payment_method_label: ap.paymentMethodLabel || sub.payment_method_label || undefined,
        p_failure_code: ap.failureCode || undefined,
        p_failure_reason: ap.failureReason || undefined,
        p_payload_summary: {
          ...ap.rawSummary,
          providerOrigin: "mercado_pago_official_sandbox",
          authMethod: "admin_authoritative_sync",
          hmacSignatureVerified: false,
        } as Json,
      });

      const rpcObj = (rpcRes ?? {}) as { outcome?: string; subscriptionStatus?: string };
      if (rpcObj.outcome === "processed") {
        syncedCount++;
      }
      if (rpcObj.subscriptionStatus) {
        newStatus = rpcObj.subscriptionStatus as BillingSubscriptionStatus;
      }
    }

    await AuditService.recordEvent({
      supabase: admin,
      tenantId: sub.tenant_id,
      actorUserId: params.actorUserId,
      action: "billing.subscription_updated",
      resourceType: "billing_subscription",
      resourceId: sub.id,
      metadata: {
        syncType: "official_mp_sandbox_manual_sync",
        externalSubscriptionId: sub.external_subscription_id,
        previousStatus: prevStatus,
        newStatus,
        authorizedPaymentsFound: authorizedPayments.length,
        authorizedPaymentsSynced: syncedCount,
      },
    });

    const rawStatus =
      typeof extSub.rawSummary?.mpStatus === "string" ? extSub.rawSummary.mpStatus : null;

    return {
      subscriptionId: sub.id,
      externalSubscriptionId: sub.external_subscription_id,
      previousStatus: prevStatus,
      newStatus,
      providerStatusRaw: rawStatus,
      authorizedPaymentsSynced: syncedCount,
      providerOrigin: "mercado_pago_official_sandbox",
      checkedAt,
    };
  }
}
