import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/core/errors/app-error";
import { BillingInvariants } from "../domain/billing-invariants";
import type {
  BillingCycle,
  BillingInvoiceStatus,
  BillingProviderRuntimeStatus,
  BillingSubscriptionStatus,
} from "../types/billing.types";
import type {
  AuthoritativeBillingEvent,
  AuthorizeExternalSubscriptionInput,
  BillingProvider,
  CreatedExternalSubscription,
  CreateExternalSubscriptionInput,
  UpdateExternalPaymentMethodInput,
} from "./billing-provider.interface";

const MP_API_BASE_URL = "https://api.mercadopago.com";

export interface SimulatedBillingResource {
  externalResourceId: string;
  resourceType: "subscription_preapproval" | "subscription_authorized_payment";
  externalSubscriptionId: string;
  externalReference: string;
  invoiceStatus: BillingInvoiceStatus | null;
  subscriptionStatus: BillingSubscriptionStatus | null;
  amountCents: number;
  currency: "BRL";
  dueDate: string;
  billingCycleKey: string;
  paymentMethodLabel: string | null;
  failureCode: string | null;
  failureReason: string | null;
}

const globalForBillingSim = globalThis as unknown as {
  __devessentBillingSimStore?: Map<string, SimulatedBillingResource>;
};

const billingSimStore =
  globalForBillingSim.__devessentBillingSimStore ??
  (globalForBillingSim.__devessentBillingSimStore = new Map<string, SimulatedBillingResource>());

function mapCycleToMpFrequency(cycle: BillingCycle): { frequency: number; frequency_type: "months" } {
  if (cycle === "quarterly") return { frequency: 3, frequency_type: "months" };
  if (cycle === "semiannual") return { frequency: 6, frequency_type: "months" };
  if (cycle === "annual") return { frequency: 12, frequency_type: "months" };
  return { frequency: 1, frequency_type: "months" };
}

function mapMpAuthorizedPaymentStatus(mpStatus: string | undefined): BillingInvoiceStatus {
  const s = (mpStatus || "").toLowerCase().trim();
  if (s === "approved" || s === "processed") return "paid";
  if (s === "rejected" || s === "cancelled") return "failed";
  if (s === "refunded") return "refunded";
  if (s === "in_process" || s === "authorized") return "processing";
  return "pending";
}

function mapMpPreapprovalStatus(mpStatus: string | undefined): BillingSubscriptionStatus {
  const s = (mpStatus || "").toLowerCase().trim();
  if (s === "authorized") return "active";
  if (s === "cancelled") return "cancelled";
  if (s === "paused") return "past_due";
  return "awaiting_authorization";
}

const MIN_SIMULATOR_SECRET_LENGTH = 32;
const MIN_OFFICIAL_WEBHOOK_SECRET_LENGTH = 16;
const PREDICTABLE_SECRET_FRAGMENTS = [
  "devessent-billing-sandbox-local",
  "changeme",
  "default-secret",
  "test-secret",
  "secret123",
  "password",
  "12345678",
];

function assertStrongExclusiveSecret(
  candidate: string,
  minLen: number,
  envVarName: string
): void {
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.length < minLen) {
    throw new ForbiddenError(
      `FAIL-CLOSED: ${envVarName} obrigatório e exclusivo para Billing SaaS (mínimo ${minLen} caracteres). Nenhum fallback previsível é permitido.`
    );
  }
  const lower = trimmed.toLowerCase();
  if (PREDICTABLE_SECRET_FRAGMENTS.some((frag) => lower.includes(frag))) {
    throw new ForbiddenError(
      `FAIL-CLOSED: ${envVarName} contém padrão previsível rejeitado pela política de segurança.`
    );
  }

  // Nunca permitir reutilização de segredos de outros módulos (Auth / Service Role / Retail Payments)
  const forbiddenSharedSecrets = [
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    process.env.AUTH_BRIDGE_SECRET?.trim(),
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  ].filter((v): v is string => Boolean(v));

  if (forbiddenSharedSecrets.includes(trimmed)) {
    throw new ForbiddenError(
      `FAIL-CLOSED: ${envVarName} deve ser um segredo exclusivo do Billing SaaS e não pode reutilizar segredos de Auth, Supabase ou Retail.`
    );
  }
}

/**
 * Resolve credenciais exclusivas da conta recebedora da DevEssent para Billing SaaS.
 * NUNCA lê credenciais de estabelecimentos clientes (retail_payment_connections),
 * NUNCA reutiliza segredos de outros módulos e NUNCA usa fallback previsível em ambientes públicos.
 */
export function resolveDevEssentBillingCredentials(): {
  accessToken: string;
  webhookSecret: string;
  isOfficialSandboxApi: boolean;
  providerOrigin: "mercado_pago_official_sandbox" | "internal_sandbox_simulator";
} {
  const rawToken = process.env.BILLING_MP_ACCESS_TOKEN?.trim() || "";
  const rawMpWebhookSecret = process.env.BILLING_MP_WEBHOOK_SECRET?.trim() || "";
  const rawSimulatorSecret = process.env.BILLING_WEBHOOK_SANDBOX_SECRET?.trim() || "";

  // Bloqueio Fail-Closed: nunca aceitar credenciais de produção APP_USR-* na Fase 6E.2/6E.2B
  if (rawToken.startsWith("APP_USR-")) {
    throw new ForbiddenError(
      "FAIL-CLOSED: BILLING_MP_ACCESS_TOKEN de produção (APP_USR-) bloqueada. Utilize apenas credenciais Sandbox."
    );
  }

  const isOfficialSandboxApi =
    rawToken.startsWith("TEST-") && !rawToken.startsWith("TEST-DEVESSENT-BILLING-SANDBOX-");

  if (isOfficialSandboxApi) {
    assertStrongExclusiveSecret(
      rawMpWebhookSecret,
      MIN_OFFICIAL_WEBHOOK_SECRET_LENGTH,
      "BILLING_MP_WEBHOOK_SECRET"
    );
    return {
      accessToken: rawToken,
      webhookSecret: rawMpWebhookSecret,
      isOfficialSandboxApi: true,
      providerOrigin: "mercado_pago_official_sandbox",
    };
  }

  // Modo simulador interno sandbox: exige segredo exclusivo obrigatório (sem fallback previsível!)
  const exclusiveSimSecret = rawSimulatorSecret || rawMpWebhookSecret;
  assertStrongExclusiveSecret(
    exclusiveSimSecret,
    MIN_SIMULATOR_SECRET_LENGTH,
    "BILLING_WEBHOOK_SANDBOX_SECRET"
  );

  const derivedSandboxWebhookSecret = createHmac("sha256", exclusiveSimSecret)
    .update("devessent:saas_billing:webhook_sandbox:v2")
    .digest("hex");

  return {
    accessToken: "TEST-DEVESSENT-BILLING-SANDBOX-INTERNAL",
    webhookSecret: derivedSandboxWebhookSecret,
    isOfficialSandboxApi: false,
    providerOrigin: "internal_sandbox_simulator",
  };
}

/**
 * Calcula assinatura HMAC-SHA256 no padrão oficial do Mercado Pago para webhooks de assinaturas:
 * Manifest: `id:${dataId};request-id:${xRequestId};ts:${ts};`
 */
export function buildBillingWebhookSignature(params: {
  dataId: string;
  xRequestId: string;
  timestampSeconds: number;
  webhookSecret?: string;
}): string {
  const secret = params.webhookSecret ?? resolveDevEssentBillingCredentials().webhookSecret;
  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId};ts:${params.timestampSeconds};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${params.timestampSeconds},v1=${v1}`;
}

/**
 * Adaptador desacoplado de Assinaturas Recorrentes da DevEssent (Mercado Pago `/preapproval`).
 *
 * - Suporta API oficial do Mercado Pago em Sandbox quando `BILLING_MP_ACCESS_TOKEN` (TEST-*)
 *   e `BILLING_MP_WEBHOOK_SECRET` forem configurados nos secrets do servidor.
 * - Enquanto as credenciais oficiais de sandbox da conta DevEssent não estiverem configuradas,
 *   opera de forma explícita e transparente no modo `internal_sandbox_simulator`.
 */
export class MercadoPagoBillingProvider implements BillingProvider {
  public readonly providerName = "mercado_pago" as const;

  public static seedSimulatedResource(resource: SimulatedBillingResource): void {
    billingSimStore.set(resource.externalResourceId, { ...resource });
  }

  public static getSimulatedResource(
    externalResourceId: string
  ): SimulatedBillingResource | undefined {
    return billingSimStore.get(externalResourceId);
  }

  public getRuntimeStatus(): BillingProviderRuntimeStatus {
    let mode: "official_sandbox_api" | "internal_sandbox_simulator" = "internal_sandbox_simulator";
    let secretConfigured = false;
    try {
      const creds = resolveDevEssentBillingCredentials();
      mode = creds.isOfficialSandboxApi ? "official_sandbox_api" : "internal_sandbox_simulator";
      secretConfigured = true;
    } catch {
      const rawToken = process.env.BILLING_MP_ACCESS_TOKEN?.trim() || "";
      mode =
        rawToken.startsWith("TEST-") && !rawToken.startsWith("TEST-DEVESSENT-BILLING-SANDBOX-")
          ? "official_sandbox_api"
          : "internal_sandbox_simulator";
      secretConfigured = false;
    }

    return {
      provider: "mercado_pago",
      mode,
      environment: "sandbox",
      liveChargesEnabled: false,
      supportsCreditCardRecurring: true,
      supportsScheduledStartDate: true,
      supportsPixAutomatic: false, // Preparado arquiteturalmente; ativação futura mediante liberação PJ no provedor
      webhookEndpointPath: "/api/webhooks/billing/mercado_pago",
      statusNote:
        mode === "official_sandbox_api"
          ? secretConfigured
            ? "Conectado à API oficial de Assinaturas do Mercado Pago em modo Sandbox (conta DevEssent)."
            : "API oficial Sandbox detectada, porém BILLING_MP_WEBHOOK_SECRET exclusivo não configurado (fail-closed ativo)."
          : secretConfigured
            ? "Operando em Simulador Interno Sandbox com segredo HMAC exclusivo (credenciais oficiais BILLING_MP_ACCESS_TOKEN / BILLING_MP_WEBHOOK_SECRET da DevEssent ainda pendentes)."
            : "Simulador Interno Sandbox sem segredo exclusivo BILLING_WEBHOOK_SANDBOX_SECRET configurado (webhooks bloqueados fail-closed).",
    };
  }

  public async createRecurringAuthorization(
    input: CreateExternalSubscriptionInput
  ): Promise<CreatedExternalSubscription> {
    const creds = resolveDevEssentBillingCredentials();
    BillingInvariants.assertBillingSandboxOnly("sandbox", creds.accessToken);

    if (!creds.isOfficialSandboxApi) {
      const extSubId = `MP-PREAPP-SBX-${randomUUID().slice(0, 12).toUpperCase()}`;
      const sep = input.backUrl.includes("?") ? "&" : "?";
      return {
        provider: "mercado_pago",
        externalSubscriptionId: extSubId,
        externalPlanId: null,
        authorizationUrl: `${input.backUrl}${sep}billing_auth=1&sub=${encodeURIComponent(input.subscriptionId)}`,
        providerStatus: "pending",
        rawSummary: {
          mode: "internal_sandbox_simulator",
          externalReference: input.externalReference,
          scheduledStartDate: input.scheduledStartDate,
        },
      };
    }

    const freq = mapCycleToMpFrequency(input.billingCycle);
    const startDateIso = `${input.scheduledStartDate}T12:00:00.000Z`;
    const payload = {
      reason: `DevEssent Platform — ${input.planName} (${input.tenantName})`,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      status: "pending",
      auto_recurring: {
        frequency: freq.frequency,
        frequency_type: freq.frequency_type,
        start_date: startDateIso,
        transaction_amount: Number((input.amountCents / 100).toFixed(2)),
        currency_id: "BRL",
      },
    };

    const res = await fetch(`${MP_API_BASE_URL}/preapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `devessent-billing-sub-${input.subscriptionId}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new ValidationError(
        `Mercado Pago Sandbox recusou criação da assinatura (HTTP ${res.status}).`
      );
    }

    const data = (await res.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
      status?: string;
    };

    if (!data.id || !(data.sandbox_init_point || data.init_point)) {
      throw new ValidationError("Resposta incompleta do Mercado Pago ao criar pré-aprovação.");
    }

    return {
      provider: "mercado_pago",
      externalSubscriptionId: String(data.id),
      externalPlanId: null,
      authorizationUrl: String(data.sandbox_init_point || data.init_point),
      providerStatus: "pending",
      rawSummary: {
        mode: "official_sandbox_api",
        mpPreapprovalId: String(data.id),
        mpStatus: data.status || "pending",
      },
    };
  }

  public async confirmSandboxAuthorization(
    input: AuthorizeExternalSubscriptionInput
  ): Promise<{ authorized: boolean; paymentMethodLabel: string }> {
    const creds = resolveDevEssentBillingCredentials();
    BillingInvariants.assertBillingSandboxOnly("sandbox", creds.accessToken);
    const label = `${input.cardBrand.trim()} •••• ${input.cardLast4.trim()}`;
    return { authorized: true, paymentMethodLabel: label };
  }

  public async updatePaymentMethod(
    input: UpdateExternalPaymentMethodInput
  ): Promise<{ updated: boolean; paymentMethodLabel: string }> {
    const creds = resolveDevEssentBillingCredentials();
    BillingInvariants.assertBillingSandboxOnly("sandbox", creds.accessToken);
    const label = `${input.cardBrand.trim()} •••• ${input.cardLast4.trim()}`;
    return { updated: true, paymentMethodLabel: label };
  }

  public async cancelExternalSubscription(params: {
    externalSubscriptionId: string;
    reason: string;
  }): Promise<{ cancelled: boolean }> {
    const creds = resolveDevEssentBillingCredentials();
    BillingInvariants.assertBillingSandboxOnly("sandbox", creds.accessToken);

    if (!creds.isOfficialSandboxApi) {
      return { cancelled: true };
    }

    const res = await fetch(
      `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(params.externalSubscriptionId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      }
    );

    if (!res.ok) {
      throw new ValidationError(
        `Falha ao cancelar assinatura no Mercado Pago Sandbox (HTTP ${res.status}).`
      );
    }

    return { cancelled: true };
  }

  public validateWebhookSignature(params: {
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
    rawBody: string;
  }): {
    externalEventId: string;
    eventType: string;
    resourceType: "subscription_preapproval" | "subscription_authorized_payment";
    externalResourceId: string;
  } {
    const creds = resolveDevEssentBillingCredentials();
    const xSignature =
      params.headers["x-signature"] || params.headers["X-Signature"] || "";
    const xRequestId =
      params.headers["x-request-id"] || params.headers["X-Request-Id"] || "";

    if (!xSignature || !xRequestId) {
      throw new UnauthorizedError(
        "Cabeçalhos obrigatórios de assinatura de webhook Billing (x-signature / x-request-id) ausentes."
      );
    }

    let bodyObj: {
      id?: string | number;
      type?: string;
      action?: string;
      live_mode?: boolean;
      data?: { id?: string | number };
    } = {};

    try {
      bodyObj = params.rawBody ? (JSON.parse(params.rawBody) as typeof bodyObj) : {};
    } catch {
      throw new ValidationError("Payload JSON de webhook Billing malformado.");
    }

    if (bodyObj.live_mode === true) {
      throw new ForbiddenError(
        "FAIL-CLOSED: Notificações de produção (live_mode=true) rejeitadas no Billing Sandbox."
      );
    }

    const dataId =
      params.query["data.id"] ||
      params.query["id"] ||
      (bodyObj.data?.id !== undefined ? String(bodyObj.data.id) : "");

    if (!dataId) {
      throw new ValidationError("Identificador do recurso ausente no webhook Billing.");
    }

    let tsValue: string | null = null;
    let v1Value: string | null = null;
    for (const part of xSignature.split(",")) {
      const [k, v] = part.trim().split("=");
      if (k === "ts" && v) tsValue = v.trim();
      if (k === "v1" && v) v1Value = v.trim();
    }

    if (!tsValue || !v1Value || !/^\d+$/.test(tsValue) || !/^[0-9a-f]{64}$/i.test(v1Value)) {
      throw new UnauthorizedError("Formato do cabeçalho x-signature inválido.");
    }

    const tsSeconds = Number(tsValue);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - tsSeconds) > 300) {
      throw new UnauthorizedError("Timestamp do webhook Billing fora da janela segura (±5 min).");
    }

    const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${tsSeconds};`;
    const expectedHmac = createHmac("sha256", creds.webhookSecret)
      .update(manifest)
      .digest("hex");

    const receivedBuf = Buffer.from(v1Value.toLowerCase(), "utf-8");
    const expectedBuf = Buffer.from(expectedHmac.toLowerCase(), "utf-8");

    if (receivedBuf.length !== expectedBuf.length || !timingSafeEqual(receivedBuf, expectedBuf)) {
      throw new UnauthorizedError("Assinatura criptográfica HMAC-SHA256 do webhook Billing inválida.");
    }

    const rawType = (bodyObj.type || params.query["type"] || "subscription_authorized_payment")
      .toLowerCase()
      .trim();

    const resourceType: "subscription_preapproval" | "subscription_authorized_payment" =
      rawType.includes("preapproval") && !rawType.includes("authorized_payment")
        ? "subscription_preapproval"
        : "subscription_authorized_payment";

    const externalEventId = bodyObj.id
      ? String(bodyObj.id)
      : `${resourceType}:${dataId}:${xRequestId}`;

    return {
      externalEventId,
      eventType: bodyObj.action || rawType,
      resourceType,
      externalResourceId: dataId,
    };
  }

  public async fetchAuthoritativeEventResource(params: {
    resourceType: "subscription_preapproval" | "subscription_authorized_payment";
    externalResourceId: string;
    rawBodyObj?: Record<string, unknown>;
  }): Promise<AuthoritativeBillingEvent> {
    const creds = resolveDevEssentBillingCredentials();
    BillingInvariants.assertBillingSandboxOnly("sandbox", creds.accessToken);

    if (!creds.isOfficialSandboxApi) {
      const sim = billingSimStore.get(params.externalResourceId);
      if (!sim) {
        throw new ValidationError(
          `Recurso Billing Sandbox '${params.externalResourceId}' não localizado no simulador.`
        );
      }
      return {
        provider: "mercado_pago",
        externalEventId: `sim:${params.externalResourceId}`,
        eventType: sim.resourceType,
        resourceType: sim.resourceType,
        externalResourceId: sim.externalResourceId,
        externalSubscriptionId: sim.externalSubscriptionId,
        externalReference: sim.externalReference,
        invoiceStatus: sim.invoiceStatus,
        subscriptionStatus: sim.subscriptionStatus,
        amountCents: sim.amountCents,
        currency: sim.currency,
        dueDate: sim.dueDate,
        billingCycleKey: sim.billingCycleKey,
        paymentMethodLabel: sim.paymentMethodLabel,
        failureCode: sim.failureCode,
        failureReason: sim.failureReason,
        rawSummary: {
          mode: "internal_sandbox_simulator",
          providerOrigin: "internal_sandbox_simulator",
          externalResourceId: sim.externalResourceId,
          invoiceStatus: sim.invoiceStatus,
          subscriptionStatus: sim.subscriptionStatus,
        },
      };
    }

    const endpoint =
      params.resourceType === "subscription_preapproval"
        ? `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(params.externalResourceId)}`
        : `${MP_API_BASE_URL}/authorized_payments/${encodeURIComponent(params.externalResourceId)}`;

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Falha ao consultar recurso Billing '${params.externalResourceId}' no Mercado Pago Sandbox (HTTP ${res.status}).`
      );
    }

    const data = (await res.json()) as Record<string, unknown>;
    if (data.live_mode === true) {
      throw new ForbiddenError("FAIL-CLOSED: Recurso live_mode=true rejeitado em Billing Sandbox.");
    }

    if (params.resourceType === "subscription_preapproval") {
      const paymentMethodId =
        typeof data.payment_method_id === "string" && data.payment_method_id
          ? `Cartão (${data.payment_method_id.toUpperCase()} · Mercado Pago Sandbox)`
          : "Cartão de Crédito (Mercado Pago Sandbox)";
      return {
        provider: "mercado_pago",
        externalEventId: `mp:preapproval:${params.externalResourceId}`,
        eventType: "subscription_preapproval.updated",
        resourceType: "subscription_preapproval",
        externalResourceId: String(data.id ?? params.externalResourceId),
        externalSubscriptionId: String(data.id ?? params.externalResourceId),
        externalReference: typeof data.external_reference === "string" ? data.external_reference : null,
        invoiceStatus: null,
        subscriptionStatus: mapMpPreapprovalStatus(
          typeof data.status === "string" ? data.status : undefined
        ),
        amountCents: null,
        currency: "BRL",
        dueDate:
          typeof data.next_payment_date === "string" ? data.next_payment_date.slice(0, 10) : null,
        billingCycleKey: null,
        paymentMethodLabel: paymentMethodId,
        failureCode: null,
        failureReason: null,
        rawSummary: {
          mode: "official_sandbox_api",
          providerOrigin: "mercado_pago_official_sandbox",
          mpId: data.id,
          mpStatus: data.status,
          nextPaymentDate: data.next_payment_date ?? null,
        },
      };
    }

    const amountFloat = Number(data.transaction_amount ?? 0);
    const dateCreated =
      typeof data.date_created === "string"
        ? data.date_created.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const mpStatus = typeof data.status === "string" ? data.status : "pending";

    return {
      provider: "mercado_pago",
      externalEventId: `mp:authpay:${params.externalResourceId}`,
      eventType: "subscription_authorized_payment.updated",
      resourceType: "subscription_authorized_payment",
      externalResourceId: String(data.id ?? params.externalResourceId),
      externalSubscriptionId:
        typeof data.preapproval_id === "string" ? data.preapproval_id : null,
      externalReference:
        typeof data.external_reference === "string" ? data.external_reference : null,
      invoiceStatus: mapMpAuthorizedPaymentStatus(mpStatus),
      subscriptionStatus: null,
      amountCents: Math.round(amountFloat * 100),
      currency: "BRL",
      dueDate: dateCreated,
      billingCycleKey: BillingInvariants.buildBillingCycleKey(dateCreated),
      paymentMethodLabel: "Cartão de Crédito (Mercado Pago)",
      failureCode: mpStatus === "rejected" ? "mp_rejected" : null,
      failureReason: mpStatus === "rejected" ? "Cobrança recorrente recusada pelo emissor." : null,
      rawSummary: {
        mode: "official_sandbox_api",
        providerOrigin: "mercado_pago_official_sandbox",
        mpId: data.id,
        mpStatus,
        preapprovalId: data.preapproval_id,
      },
    };
  }
}

export function getDefaultBillingProvider(): BillingProvider {
  return new MercadoPagoBillingProvider();
}
