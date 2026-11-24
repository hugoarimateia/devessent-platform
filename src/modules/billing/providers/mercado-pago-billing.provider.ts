import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  ForbiddenError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors/app-error";
import { BillingInvariants } from "../domain/billing-invariants";
import type {
  BillingCycle,
  BillingInvoiceStatus,
  BillingProviderMode,
  BillingProviderRuntimeStatus,
  BillingSubscriptionStatus,
  BillingWebhookAuthMode,
  OfficialSandboxIdentityVerification,
} from "../types/billing.types";
import type {
  AuthoritativeBillingEvent,
  AuthorizeExternalSubscriptionInput,
  BillingProvider,
  BillingWebhookResourceType,
  CreatedExternalSubscription,
  CreateExternalSubscriptionInput,
  UpdateExternalPaymentMethodInput,
  VerifiedBillingWebhookHeader,
} from "./billing-provider.interface";

const MP_API_BASE_URL = "https://api.mercadopago.com";
const MP_FETCH_TIMEOUT_MS = 10_000;
const OFFICIAL_IDENTITY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min por isolate

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

export interface SimulatedBillingResource {
  externalResourceId: string;
  resourceType: BillingWebhookResourceType;
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
  providerUpdatedAt?: string | null;
}

export interface ResolvedBillingCredentials {
  mode: BillingProviderMode;
  modeExplicitlyConfigured: boolean;
  accessToken: string;
  webhookSecret: string | null;
  webhookAuthMode: BillingWebhookAuthMode;
  collectorId: string | null;
  applicationId: string | null;
  isOfficialSandboxApi: boolean;
  providerOrigin: "mercado_pago_official_sandbox" | "internal_sandbox_simulator";
}

interface CachedOfficialIdentity {
  fingerprint: string;
  expiresAtMs: number;
  verification: OfficialSandboxIdentityVerification;
}

const globalForBillingProvider = globalThis as unknown as {
  __devessentBillingSimStore?: Map<string, SimulatedBillingResource>;
  __devessentOfficialIdentityCache?: CachedOfficialIdentity | null;
};

const billingSimStore =
  globalForBillingProvider.__devessentBillingSimStore ??
  (globalForBillingProvider.__devessentBillingSimStore = new Map<string, SimulatedBillingResource>());

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
  if (s === "refunded" || s === "charged_back") return "refunded";
  if (s === "in_process" || s === "authorized" || s === "recycling") return "processing";
  if (s === "scheduled") return "scheduled";
  return "pending";
}

function mapMpPreapprovalStatus(mpStatus: string | undefined): BillingSubscriptionStatus {
  const s = (mpStatus || "").toLowerCase().trim();
  if (s === "authorized") return "active";
  if (s === "cancelled") return "cancelled";
  if (s === "paused") return "past_due";
  return "awaiting_authorization";
}

function getForbiddenSharedSecrets(): string[] {
  return [
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    process.env.AUTH_BRIDGE_SECRET?.trim(),
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  ].filter((v): v is string => Boolean(v));
}

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
  if (getForbiddenSharedSecrets().includes(trimmed)) {
    throw new ForbiddenError(
      `FAIL-CLOSED: ${envVarName} deve ser um segredo exclusivo do Billing SaaS e não pode reutilizar segredos de Auth, Supabase ou Retail.`
    );
  }
}

function resolveExplicitProviderMode(): {
  mode: BillingProviderMode;
  modeExplicitlyConfigured: boolean;
} {
  const rawMode = process.env.BILLING_PROVIDER_MODE?.trim().toLowerCase() || "";
  if (!rawMode) {
    // Nunca alternar automaticamente para API oficial apenas pela presença de tokens:
    // o modo padrão seguro é sempre o simulador interno até seleção explícita.
    return { mode: "internal_sandbox_simulator", modeExplicitlyConfigured: false };
  }
  if (rawMode === "internal_sandbox_simulator" || rawMode === "official_sandbox_api") {
    return { mode: rawMode, modeExplicitlyConfigured: true };
  }
  throw new ForbiddenError(
    `FAIL-CLOSED: BILLING_PROVIDER_MODE inválido ('${rawMode}'). Valores permitidos: 'internal_sandbox_simulator' ou 'official_sandbox_api'.`
  );
}

function resolveWebhookAuthMode(): BillingWebhookAuthMode {
  const raw = process.env.BILLING_MP_WEBHOOK_AUTH_MODE?.trim().toLowerCase() || "hmac_strict";
  if (raw === "hmac_strict" || raw === "authoritative_fallback") {
    return raw;
  }
  throw new ForbiddenError(
    `FAIL-CLOSED: BILLING_MP_WEBHOOK_AUTH_MODE inválido ('${raw}'). Valores permitidos: 'hmac_strict' ou 'authoritative_fallback'.`
  );
}

/**
 * Resolve configuração e credenciais exclusivas da conta recebedora da DevEssent para Billing SaaS.
 *
 * REGRAS INEGOCIÁVEIS (Fase 6E.2C — §4 e §6):
 * - Seleção do modo é EXPLICITAMENTE controlada por `BILLING_PROVIDER_MODE` (nunca auto-switch implícito).
 * - Nunca presume ambiente apenas pelo prefixo do token (`APP_USR-*` pode ser conta de teste e `TEST-*`
 *   sozinho não comprova sandbox): em `official_sandbox_api`, exige também `BILLING_MP_ENVIRONMENT=sandbox`,
 *   `BILLING_MP_COLLECTOR_ID` numérico e confirmação autoritativa em `GET /users/me` (`tags: ["test_user"]`).
 * - Nunca lê credenciais de estabelecimentos clientes (`retail_payment_connections`),
 *   nunca reutiliza segredos de outros módulos e nunca usa fallback previsível.
 */
export function resolveDevEssentBillingCredentials(): ResolvedBillingCredentials {
  const { mode, modeExplicitlyConfigured } = resolveExplicitProviderMode();
  const billingMpEnv = (process.env.BILLING_MP_ENVIRONMENT?.trim() || "sandbox").toLowerCase();
  BillingInvariants.assertBillingSandboxOnly(billingMpEnv);

  const rawToken = process.env.BILLING_MP_ACCESS_TOKEN?.trim() || "";
  const rawMpWebhookSecret = process.env.BILLING_MP_WEBHOOK_SECRET?.trim() || "";
  const rawSimulatorSecret = process.env.BILLING_WEBHOOK_SANDBOX_SECRET?.trim() || "";
  const rawCollectorId = process.env.BILLING_MP_COLLECTOR_ID?.trim() || "";
  const rawApplicationId = process.env.BILLING_MP_APPLICATION_ID?.trim() || "";
  const webhookAuthMode = resolveWebhookAuthMode();

  if (mode === "official_sandbox_api") {
    BillingInvariants.assertValidMercadoPagoTokenFormat(rawToken);
    if (getForbiddenSharedSecrets().includes(rawToken)) {
      throw new ForbiddenError(
        "FAIL-CLOSED: BILLING_MP_ACCESS_TOKEN não pode reutilizar segredos de Auth, Supabase ou Retail."
      );
    }
    if (!rawCollectorId || !/^\d+$/.test(rawCollectorId)) {
      throw new ForbiddenError(
        "FAIL-CLOSED: BILLING_MP_COLLECTOR_ID numérico da Conta Vendedora de Teste DevEssent é obrigatório no modo official_sandbox_api."
      );
    }
    if (rawApplicationId && !/^\d+$/.test(rawApplicationId)) {
      throw new ForbiddenError(
        "FAIL-CLOSED: BILLING_MP_APPLICATION_ID deve ser um identificador numérico válido quando informado."
      );
    }

    if (webhookAuthMode === "hmac_strict") {
      assertStrongExclusiveSecret(
        rawMpWebhookSecret,
        MIN_OFFICIAL_WEBHOOK_SECRET_LENGTH,
        "BILLING_MP_WEBHOOK_SECRET"
      );
    } else if (rawMpWebhookSecret) {
      assertStrongExclusiveSecret(
        rawMpWebhookSecret,
        MIN_OFFICIAL_WEBHOOK_SECRET_LENGTH,
        "BILLING_MP_WEBHOOK_SECRET"
      );
    }

    return {
      mode: "official_sandbox_api",
      modeExplicitlyConfigured,
      accessToken: rawToken,
      webhookSecret: rawMpWebhookSecret || null,
      webhookAuthMode,
      collectorId: rawCollectorId,
      applicationId: rawApplicationId || null,
      isOfficialSandboxApi: true,
      providerOrigin: "mercado_pago_official_sandbox",
    };
  }

  // Modo internal_sandbox_simulator: exige segredo exclusivo obrigatório (sem fallback previsível!)
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
    mode: "internal_sandbox_simulator",
    modeExplicitlyConfigured,
    accessToken: "TEST-DEVESSENT-BILLING-SANDBOX-INTERNAL",
    webhookSecret: derivedSandboxWebhookSecret,
    webhookAuthMode: "hmac_strict",
    collectorId: null,
    applicationId: null,
    isOfficialSandboxApi: false,
    providerOrigin: "internal_sandbox_simulator",
  };
}

/**
 * Limpa o cache em memória da verificação autoritativa `/users/me` (útil em testes e diagnósticos).
 */
export function clearOfficialSandboxIdentityCache(): void {
  globalForBillingProvider.__devessentOfficialIdentityCache = null;
}

/**
 * Monta o manifesto oficial HMAC-SHA256 do Mercado Pago para webhooks de assinaturas:
 * `id:${dataId};request-id:${xRequestId};ts:${ts};`
 * (Omitindo segmentos ausentes conforme especificação oficial do Mercado Pago.)
 */
export function buildBillingWebhookManifest(params: {
  dataId?: string;
  xRequestId?: string;
  timestampRaw: string | number;
}): string {
  const parts: string[] = [];
  if (params.dataId && params.dataId.trim()) {
    parts.push(`id:${params.dataId.trim().toLowerCase()};`);
  }
  if (params.xRequestId && params.xRequestId.trim()) {
    parts.push(`request-id:${params.xRequestId.trim()};`);
  }
  parts.push(`ts:${String(params.timestampRaw).trim()};`);
  return parts.join("");
}

/**
 * Calcula assinatura HMAC-SHA256 no padrão oficial do Mercado Pago para webhooks de assinaturas.
 * Suporta timestamp em segundos (10 dígitos) ou milissegundos (13 dígitos).
 */
export function buildBillingWebhookSignature(params: {
  dataId: string;
  xRequestId?: string;
  timestampSeconds: number | string;
  webhookSecret?: string;
}): string {
  const resolvedSecret = params.webhookSecret ?? resolveDevEssentBillingCredentials().webhookSecret;
  if (!resolvedSecret) {
    throw new ForbiddenError(
      "FAIL-CLOSED: Segredo de assinatura HMAC não configurado para construir assinatura de webhook Billing."
    );
  }
  const tsStr = String(params.timestampSeconds).trim();
  const manifest = buildBillingWebhookManifest({
    dataId: params.dataId,
    xRequestId: params.xRequestId,
    timestampRaw: tsStr,
  });
  const v1 = createHmac("sha256", resolvedSecret).update(manifest).digest("hex");
  return `ts=${tsStr},v1=${v1}`;
}

async function mpApiFetch(
  pathWithQuery: string,
  options: {
    method: "GET" | "POST" | "PUT";
    accessToken: string;
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  }
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MP_FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    };
    if (options.idempotencyKey) {
      headers["X-Idempotency-Key"] = options.idempotencyKey;
    }
    const res = await fetch(`${MP_API_BASE_URL}${pathWithQuery}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    if (res.status >= 500 || res.status === 429) {
      throw new ServiceUnavailableError(
        `API Mercado Pago Sandbox temporariamente indisponível (HTTP ${res.status}).`
      );
    }
    return res;
  } catch (err) {
    if (err instanceof ServiceUnavailableError) throw err;
    throw new ServiceUnavailableError(
      `Falha de comunicação com a API Mercado Pago Sandbox: ${
        err instanceof Error ? err.message : "erro de rede/timeout"
      }`
    );
  } finally {
    clearTimeout(timer);
  }
}

function assertMpResourceOwnershipAndSandbox(
  data: Record<string, unknown>,
  creds: ResolvedBillingCredentials,
  resourceLabel: string
): void {
  if (data.live_mode === true) {
    throw new ForbiddenError(
      `FAIL-CLOSED: Recurso '${resourceLabel}' retornou live_mode=true e foi bloqueado em Billing Sandbox.`
    );
  }
  if (creds.collectorId && data.collector_id !== undefined && data.collector_id !== null) {
    const receivedCollector = String(data.collector_id).trim();
    if (receivedCollector && receivedCollector !== creds.collectorId) {
      throw new ForbiddenError(
        `FAIL-CLOSED: Conta recebedora divergente em '${resourceLabel}' (collector_id='${receivedCollector}', esperado='${creds.collectorId}').`
      );
    }
  }
  if (creds.applicationId && data.application_id !== undefined && data.application_id !== null) {
    const receivedApp = String(data.application_id).trim();
    if (receivedApp && receivedApp !== creds.applicationId) {
      throw new ForbiddenError(
        `FAIL-CLOSED: Aplicação Mercado Pago divergente em '${resourceLabel}' (application_id='${receivedApp}', esperado='${creds.applicationId}').`
      );
    }
  }
}

function mapMpPreapprovalPayloadToEvent(
  data: Record<string, unknown>,
  fallbackId: string
): AuthoritativeBillingEvent {
  const id = String(data.id ?? fallbackId);
  const autoRecurring = (data.auto_recurring ?? {}) as Record<string, unknown>;
  const amountFloat = Number(autoRecurring.transaction_amount ?? 0);
  const paymentMethodId =
    typeof data.payment_method_id === "string" && data.payment_method_id
      ? `Cartão (${data.payment_method_id.toUpperCase()} · Mercado Pago Sandbox)`
      : "Cartão de Crédito (Mercado Pago Sandbox)";

  const providerUpdatedAt =
    typeof data.last_modified === "string" && data.last_modified
      ? data.last_modified
      : typeof data.date_last_updated === "string" && data.date_last_updated
        ? data.date_last_updated
        : typeof data.date_created === "string" && data.date_created
          ? data.date_created
          : null;

  return {
    provider: "mercado_pago",
    externalEventId: `mp:preapproval:${id}`,
    eventType: "subscription_preapproval.updated",
    resourceType: "subscription_preapproval",
    externalResourceId: id,
    externalSubscriptionId: id,
    externalReference: typeof data.external_reference === "string" ? data.external_reference : null,
    providerUpdatedAt,
    collectorId:
      data.collector_id !== undefined && data.collector_id !== null
        ? String(data.collector_id)
        : null,
    applicationId:
      data.application_id !== undefined && data.application_id !== null
        ? String(data.application_id)
        : null,
    invoiceStatus: null,
    subscriptionStatus: mapMpPreapprovalStatus(
      typeof data.status === "string" ? data.status : undefined
    ),
    amountCents: amountFloat > 0 ? Math.round(amountFloat * 100) : null,
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
      mpId: id,
      mpStatus: data.status ?? null,
      collectorId: data.collector_id ?? null,
      applicationId: data.application_id ?? null,
      nextPaymentDate: data.next_payment_date ?? null,
      payerId: data.payer_id ?? null,
    },
  };
}

function mapMpAuthorizedPaymentPayloadToEvent(
  data: Record<string, unknown>,
  fallbackId: string
): AuthoritativeBillingEvent {
  const id = String(data.id ?? fallbackId);
  const nestedPayment = (data.payment ?? {}) as Record<string, unknown>;
  const rawStatus =
    typeof nestedPayment.status === "string" && nestedPayment.status
      ? nestedPayment.status
      : typeof data.status === "string"
        ? data.status
        : "pending";
  const amountFloat = Number(data.transaction_amount ?? nestedPayment.transaction_amount ?? 0);
  const dateIso =
    typeof data.debit_date === "string" && data.debit_date
      ? data.debit_date.slice(0, 10)
      : typeof data.date_created === "string" && data.date_created
        ? data.date_created.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
  const statusDetail =
    typeof nestedPayment.status_detail === "string" ? nestedPayment.status_detail : null;
  const mappedStatus = mapMpAuthorizedPaymentStatus(rawStatus);

  const providerUpdatedAt =
    typeof data.last_modified === "string" && data.last_modified
      ? data.last_modified
      : typeof nestedPayment.date_last_updated === "string" && nestedPayment.date_last_updated
        ? nestedPayment.date_last_updated
        : typeof data.date_created === "string" && data.date_created
          ? data.date_created
          : null;

  return {
    provider: "mercado_pago",
    externalEventId: `mp:authpay:${id}`,
    eventType: "subscription_authorized_payment.updated",
    resourceType: "subscription_authorized_payment",
    externalResourceId: id,
    externalSubscriptionId:
      typeof data.preapproval_id === "string" ? data.preapproval_id : null,
    externalReference:
      typeof data.external_reference === "string" ? data.external_reference : null,
    providerUpdatedAt,
    collectorId:
      data.collector_id !== undefined && data.collector_id !== null
        ? String(data.collector_id)
        : null,
    applicationId:
      data.application_id !== undefined && data.application_id !== null
        ? String(data.application_id)
        : null,
    invoiceStatus: mappedStatus,
    subscriptionStatus: null,
    amountCents: amountFloat > 0 ? Math.round(amountFloat * 100) : null,
    currency: "BRL",
    dueDate: dateIso,
    billingCycleKey: BillingInvariants.buildBillingCycleKey(dateIso),
    paymentMethodLabel: "Cartão de Crédito (Mercado Pago Sandbox)",
    failureCode: mappedStatus === "failed" ? statusDetail || "mp_rejected" : null,
    failureReason:
      mappedStatus === "failed"
        ? `Cobrança recorrente recusada pelo Mercado Pago Sandbox (${statusDetail || rawStatus}).`
        : null,
    rawSummary: {
      mode: "official_sandbox_api",
      providerOrigin: "mercado_pago_official_sandbox",
      mpId: id,
      mpStatus: rawStatus,
      mpStatusDetail: statusDetail,
      preapprovalId: data.preapproval_id ?? null,
      linkedPaymentId: nestedPayment.id ?? null,
      type: data.type ?? null,
    },
  };
}

function mapMpPaymentPayloadToEvent(
  data: Record<string, unknown>,
  fallbackId: string
): AuthoritativeBillingEvent {
  const id = String(data.id ?? fallbackId);
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const poi = (data.point_of_interaction ?? {}) as Record<string, unknown>;
  const txData = (poi.transaction_data ?? {}) as Record<string, unknown>;
  const rawStatus = typeof data.status === "string" ? data.status : "pending";
  const statusDetail = typeof data.status_detail === "string" ? data.status_detail : null;
  const amountFloat = Number(data.transaction_amount ?? 0);
  const dateIso =
    typeof data.date_created === "string" && data.date_created
      ? data.date_created.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const mappedStatus = mapMpAuthorizedPaymentStatus(rawStatus);
  const preapprovalId =
    typeof metadata.preapproval_id === "string"
      ? metadata.preapproval_id
      : typeof txData.subscription_id === "string"
        ? txData.subscription_id
        : typeof data.preapproval_id === "string"
          ? data.preapproval_id
          : null;

  const providerUpdatedAt =
    typeof data.date_last_updated === "string" && data.date_last_updated
      ? data.date_last_updated
      : typeof data.date_approved === "string" && data.date_approved
        ? data.date_approved
        : typeof data.date_created === "string" && data.date_created
          ? data.date_created
          : null;

  return {
    provider: "mercado_pago",
    externalEventId: `mp:payment:${id}`,
    eventType: "payment.updated",
    resourceType: "payment",
    externalResourceId: id,
    externalSubscriptionId: preapprovalId,
    externalReference:
      typeof data.external_reference === "string" ? data.external_reference : null,
    providerUpdatedAt,
    collectorId:
      data.collector_id !== undefined && data.collector_id !== null
        ? String(data.collector_id)
        : null,
    applicationId:
      data.application_id !== undefined && data.application_id !== null
        ? String(data.application_id)
        : null,
    invoiceStatus: mappedStatus,
    subscriptionStatus: null,
    amountCents: amountFloat > 0 ? Math.round(amountFloat * 100) : null,
    currency: "BRL",
    dueDate: dateIso,
    billingCycleKey: BillingInvariants.buildBillingCycleKey(dateIso),
    paymentMethodLabel:
      typeof data.payment_method_id === "string"
        ? `Cartão (${data.payment_method_id.toUpperCase()} · Mercado Pago Sandbox)`
        : "Cartão de Crédito (Mercado Pago Sandbox)",
    failureCode: mappedStatus === "failed" ? statusDetail || "mp_payment_rejected" : null,
    failureReason:
      mappedStatus === "failed"
        ? `Pagamento vinculado recusado pelo Mercado Pago Sandbox (${statusDetail || rawStatus}).`
        : null,
    rawSummary: {
      mode: "official_sandbox_api",
      providerOrigin: "mercado_pago_official_sandbox",
      mpPaymentId: id,
      mpStatus: rawStatus,
      mpStatusDetail: statusDetail,
      preapprovalId,
      collectorId: data.collector_id ?? null,
    },
  };
}

/**
 * Adaptador oficial e desacoplado de Assinaturas Recorrentes da DevEssent (Mercado Pago Subscriptions).
 *
 * Modos explícitos (`BILLING_PROVIDER_MODE`):
 * - `internal_sandbox_simulator` (padrão seguro): exercita HMAC-SHA256 com segredo exclusivo
 *   `BILLING_WEBHOOK_SANDBOX_SECRET` sem tráfego para `api.mercadopago.com`.
 * - `official_sandbox_api`: integra os endpoints oficiais `/users/me`, `/preapproval`,
 *   `/preapproval/{id}`, `/preapproval/search`, `/authorized_payments/{id}`,
 *   `/authorized_payments/search` e `/v1/payments/{id}`, exigindo prova autoritativa de
 *   Conta de Teste (`tags: ["test_user"]`, `site_id: "MLB"`, `collector_id` esperado).
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
    const rawMode = process.env.BILLING_PROVIDER_MODE?.trim().toLowerCase() || "";
    const modeExplicitlyConfigured = Boolean(rawMode);
    const collectorIdConfigured = /^\d+$/.test(process.env.BILLING_MP_COLLECTOR_ID?.trim() || "");
    const rawWebhookAuthMode =
      process.env.BILLING_MP_WEBHOOK_AUTH_MODE?.trim().toLowerCase() === "authoritative_fallback"
        ? "authoritative_fallback"
        : "hmac_strict";

    try {
      const creds = resolveDevEssentBillingCredentials();
      return {
        provider: "mercado_pago",
        mode: creds.mode,
        modeExplicitlyConfigured: creds.modeExplicitlyConfigured,
        configValid: true,
        diagnosticCode:
          creds.mode === "official_sandbox_api"
            ? "OFFICIAL_SANDBOX_CONFIG_READY"
            : "SIMULATOR_READY",
        environment: "sandbox",
        liveChargesEnabled: false,
        webhookAuthMode: creds.webhookAuthMode,
        collectorIdConfigured: Boolean(creds.collectorId),
        supportsCreditCardRecurring: true,
        supportsScheduledStartDate: true,
        supportsPixAutomatic: false,
        webhookEndpointPath: "/api/webhooks/billing/mercado_pago",
        statusNote:
          creds.mode === "official_sandbox_api"
            ? `Modo explícito official_sandbox_api ativo (Conta Vendedora de Teste #${creds.collectorId}; validação /users/me + tags=test_user aplicada antes de cada operação).`
            : "Operando em Simulador Interno Sandbox com segredo HMAC exclusivo (modo explícito official_sandbox_api pendente de credenciais da Conta de Teste DevEssent).",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de configuração Billing Sandbox.";
      const fallbackMode: BillingProviderMode =
        rawMode === "official_sandbox_api" ? "official_sandbox_api" : "internal_sandbox_simulator";

      let diagnosticCode: BillingProviderRuntimeStatus["diagnosticCode"] =
        "MISSING_EXCLUSIVE_SIMULATOR_SECRET";
      if (msg.includes("BILLING_PROVIDER_MODE")) diagnosticCode = "INVALID_PROVIDER_MODE";
      else if (msg.includes("Cobranças reais estão desabilitadas"))
        diagnosticCode = "PRODUCTION_BLOCKED_FAIL_CLOSED";
      else if (msg.includes("reutilizar")) diagnosticCode = "SHARED_SECRET_FORBIDDEN";
      else if (msg.includes("BILLING_MP_ACCESS_TOKEN")) diagnosticCode = "MISSING_OFFICIAL_TOKEN";
      else if (msg.includes("BILLING_MP_COLLECTOR_ID"))
        diagnosticCode = "MISSING_OFFICIAL_COLLECTOR_ID";
      else if (msg.includes("BILLING_MP_WEBHOOK_SECRET"))
        diagnosticCode = "MISSING_OFFICIAL_WEBHOOK_SECRET";

      return {
        provider: "mercado_pago",
        mode: fallbackMode,
        modeExplicitlyConfigured,
        configValid: false,
        diagnosticCode,
        environment: "sandbox",
        liveChargesEnabled: false,
        webhookAuthMode: rawWebhookAuthMode,
        collectorIdConfigured,
        supportsCreditCardRecurring: true,
        supportsScheduledStartDate: true,
        supportsPixAutomatic: false,
        webhookEndpointPath: "/api/webhooks/billing/mercado_pago",
        statusNote: `${msg} Operações financeiras bloqueadas (fail-closed) sem impactar o restante da plataforma.`,
      };
    }
  }

  /**
   * Comprova de forma autoritativa junto a `GET /users/me` que a credencial configurada
   * (`APP_USR-*` ou `TEST-*`) pertence de fato a uma Conta de Teste do Brasil (MLB)
   * e ao `BILLING_MP_COLLECTOR_ID` autorizado da DevEssent.
   */
  public async verifyOfficialSandboxCredentials(
    forceRefresh = false
  ): Promise<OfficialSandboxIdentityVerification> {
    const creds = resolveDevEssentBillingCredentials();
    const nowIso = new Date().toISOString();

    if (!creds.isOfficialSandboxApi) {
      return {
        verified: false,
        provider: "mercado_pago",
        mode: "internal_sandbox_simulator",
        collectorId: null,
        siteId: null,
        isTestUser: false,
        checkedAt: nowIso,
        cached: false,
        diagnosticMessage:
          "Modo atual é internal_sandbox_simulator. Ative BILLING_PROVIDER_MODE=official_sandbox_api com credenciais da Conta de Teste DevEssent para validar /users/me.",
      };
    }

    const fingerprint = createHash("sha256")
      .update(`${creds.accessToken}:${creds.collectorId ?? ""}`)
      .digest("hex");

    const cached = globalForBillingProvider.__devessentOfficialIdentityCache;
    if (!forceRefresh && cached && cached.fingerprint === fingerprint && cached.expiresAtMs > Date.now()) {
      return { ...cached.verification, cached: true };
    }

    const res = await mpApiFetch("/users/me", {
      method: "GET",
      accessToken: creds.accessToken,
    });

    if (res.status === 401 || res.status === 403) {
      throw new UnauthorizedError(
        `Mercado Pago recusou BILLING_MP_ACCESS_TOKEN em GET /users/me (HTTP ${res.status}).`
      );
    }
    if (!res.ok) {
      throw new ValidationError(
        `Não foi possível validar titularidade da credencial em GET /users/me (HTTP ${res.status}).`
      );
    }

    const userData = (await res.json()) as {
      id?: string | number;
      site_id?: string;
      tags?: unknown;
    };

    const identity = BillingInvariants.assertOfficialSandboxUserIdentity({
      userId: userData.id,
      siteId: userData.site_id,
      tags: userData.tags,
      expectedCollectorId: creds.collectorId || "",
    });

    const verification: OfficialSandboxIdentityVerification = {
      verified: true,
      provider: "mercado_pago",
      mode: "official_sandbox_api",
      collectorId: identity.collectorId,
      siteId: identity.siteId,
      isTestUser: true,
      checkedAt: nowIso,
      cached: false,
      diagnosticMessage: `Credencial verificada via GET /users/me como Conta de Teste oficial Brasil (MLB · collector #${identity.collectorId}).`,
    };

    globalForBillingProvider.__devessentOfficialIdentityCache = {
      fingerprint,
      expiresAtMs: Date.now() + OFFICIAL_IDENTITY_CACHE_TTL_MS,
      verification,
    };

    return verification;
  }

  public async createRecurringAuthorization(
    input: CreateExternalSubscriptionInput
  ): Promise<CreatedExternalSubscription> {
    const creds = resolveDevEssentBillingCredentials();

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
          providerOrigin: "internal_sandbox_simulator",
          externalReference: input.externalReference,
          scheduledStartDate: input.scheduledStartDate,
        },
      };
    }

    // Comprovação autoritativa obrigatória de Conta de Teste antes de criar qualquer assinatura externa
    await this.verifyOfficialSandboxCredentials();

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

    const res = await mpApiFetch("/preapproval", {
      method: "POST",
      accessToken: creds.accessToken,
      body: payload,
      idempotencyKey: `devessent-billing-sub-${input.subscriptionId}`,
    });

    if (!res.ok) {
      let mpMessage = "";
      try {
        const errBody = (await res.json()) as { message?: string; error?: string };
        mpMessage = errBody.message || errBody.error || "";
      } catch {
        // ignora parse de erro
      }
      throw new ValidationError(
        `Mercado Pago Sandbox recusou criação da assinatura (HTTP ${res.status}${mpMessage ? `: ${mpMessage}` : ""}).`
      );
    }

    const data = (await res.json()) as Record<string, unknown>;
    assertMpResourceOwnershipAndSandbox(data, creds, "POST /preapproval");

    const id = typeof data.id === "string" || typeof data.id === "number" ? String(data.id) : "";
    const authUrl =
      typeof data.sandbox_init_point === "string" && data.sandbox_init_point
        ? data.sandbox_init_point
        : typeof data.init_point === "string" && data.init_point
          ? data.init_point
          : "";

    if (!id || !authUrl) {
      throw new ValidationError("Resposta incompleta do Mercado Pago ao criar pré-aprovação.");
    }

    return {
      provider: "mercado_pago",
      externalSubscriptionId: id,
      externalPlanId: typeof data.preapproval_plan_id === "string" ? data.preapproval_plan_id : null,
      authorizationUrl: authUrl,
      providerStatus: "pending",
      rawSummary: {
        mode: "official_sandbox_api",
        providerOrigin: "mercado_pago_official_sandbox",
        mpPreapprovalId: id,
        mpStatus: typeof data.status === "string" ? data.status : "pending",
        collectorId: data.collector_id ?? creds.collectorId,
        applicationId: data.application_id ?? creds.applicationId,
      },
    };
  }

  public async getExternalSubscription(
    externalSubscriptionId: string
  ): Promise<AuthoritativeBillingEvent> {
    return this.fetchAuthoritativeEventResource({
      resourceType: "subscription_preapproval",
      externalResourceId: externalSubscriptionId,
    });
  }

  public async searchExternalSubscriptions(params: {
    externalReference?: string;
    payerEmail?: string;
    limit?: number;
  }): Promise<AuthoritativeBillingEvent[]> {
    const creds = resolveDevEssentBillingCredentials();
    if (!creds.isOfficialSandboxApi) {
      return [];
    }

    await this.verifyOfficialSandboxCredentials();

    const qs = new URLSearchParams();
    if (params.externalReference) qs.set("external_reference", params.externalReference);
    if (params.payerEmail) qs.set("payer_email", params.payerEmail);
    qs.set("limit", String(Math.min(Math.max(params.limit ?? 10, 1), 50)));

    const res = await mpApiFetch(`/preapproval/search?${qs.toString()}`, {
      method: "GET",
      accessToken: creds.accessToken,
    });

    if (!res.ok) {
      throw new ValidationError(
        `Falha ao consultar GET /preapproval/search no Mercado Pago Sandbox (HTTP ${res.status}).`
      );
    }

    const body = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const results = Array.isArray(body.results) ? body.results : [];
    const mapped: AuthoritativeBillingEvent[] = [];
    for (const item of results) {
      assertMpResourceOwnershipAndSandbox(item, creds, "GET /preapproval/search");
      mapped.push(mapMpPreapprovalPayloadToEvent(item, String(item.id ?? "")));
    }
    return mapped;
  }

  public async getAuthorizedPayment(
    authorizedPaymentId: string
  ): Promise<AuthoritativeBillingEvent> {
    return this.fetchAuthoritativeEventResource({
      resourceType: "subscription_authorized_payment",
      externalResourceId: authorizedPaymentId,
    });
  }

  public async searchAuthorizedPayments(params: {
    preapprovalId?: string;
    externalReference?: string;
    limit?: number;
  }): Promise<AuthoritativeBillingEvent[]> {
    const creds = resolveDevEssentBillingCredentials();
    if (!creds.isOfficialSandboxApi) {
      return [];
    }

    await this.verifyOfficialSandboxCredentials();

    const qs = new URLSearchParams();
    if (params.preapprovalId) qs.set("preapproval_id", params.preapprovalId);
    if (params.externalReference) qs.set("external_reference", params.externalReference);
    qs.set("limit", String(Math.min(Math.max(params.limit ?? 20, 1), 50)));

    const res = await mpApiFetch(`/authorized_payments/search?${qs.toString()}`, {
      method: "GET",
      accessToken: creds.accessToken,
    });

    if (!res.ok) {
      throw new ValidationError(
        `Falha ao consultar GET /authorized_payments/search no Mercado Pago Sandbox (HTTP ${res.status}).`
      );
    }

    const body = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const results = Array.isArray(body.results) ? body.results : [];
    const mapped: AuthoritativeBillingEvent[] = [];
    for (const item of results) {
      assertMpResourceOwnershipAndSandbox(item, creds, "GET /authorized_payments/search");
      mapped.push(mapMpAuthorizedPaymentPayloadToEvent(item, String(item.id ?? "")));
    }
    return mapped;
  }

  public async updateExternalSubscription(params: {
    externalSubscriptionId: string;
    status?: "paused" | "authorized" | "cancelled";
    reason?: string;
    autoRecurringAmountCents?: number;
  }): Promise<{ updated: boolean; providerStatus: string }> {
    const creds = resolveDevEssentBillingCredentials();

    if (!creds.isOfficialSandboxApi) {
      return { updated: true, providerStatus: params.status ?? "authorized" };
    }

    await this.verifyOfficialSandboxCredentials();

    const body: Record<string, unknown> = {};
    if (params.status) body.status = params.status;
    if (params.reason) body.reason = params.reason;
    if (params.autoRecurringAmountCents !== undefined) {
      body.auto_recurring = {
        transaction_amount: Number((params.autoRecurringAmountCents / 100).toFixed(2)),
        currency_id: "BRL",
      };
    }

    const res = await mpApiFetch(
      `/preapproval/${encodeURIComponent(params.externalSubscriptionId)}`,
      {
        method: "PUT",
        accessToken: creds.accessToken,
        body,
      }
    );

    if (!res.ok) {
      throw new ValidationError(
        `Falha ao atualizar assinatura no Mercado Pago Sandbox via PUT /preapproval/${params.externalSubscriptionId} (HTTP ${res.status}).`
      );
    }

    const data = (await res.json()) as Record<string, unknown>;
    assertMpResourceOwnershipAndSandbox(data, creds, "PUT /preapproval/{id}");

    return {
      updated: true,
      providerStatus: typeof data.status === "string" ? data.status : params.status ?? "updated",
    };
  }

  public async confirmSandboxAuthorization(
    input: AuthorizeExternalSubscriptionInput
  ): Promise<{ authorized: boolean; paymentMethodLabel: string }> {
    const creds = resolveDevEssentBillingCredentials();
    if (creds.isOfficialSandboxApi) {
      throw new ForbiddenError(
        "No modo official_sandbox_api, a autorização deve ser concluída no fluxo oficial do Mercado Pago e confirmada por webhook ou consulta autoritativa."
      );
    }
    const label = `${input.cardBrand.trim()} •••• ${input.cardLast4.trim()}`;
    return { authorized: true, paymentMethodLabel: label };
  }

  public async updatePaymentMethod(
    input: UpdateExternalPaymentMethodInput
  ): Promise<{ updated: boolean; paymentMethodLabel: string }> {
    resolveDevEssentBillingCredentials();
    const label = `${input.cardBrand.trim()} •••• ${input.cardLast4.trim()}`;
    return { updated: true, paymentMethodLabel: label };
  }

  public async cancelExternalSubscription(params: {
    externalSubscriptionId: string;
    reason: string;
  }): Promise<{ cancelled: boolean }> {
    await this.updateExternalSubscription({
      externalSubscriptionId: params.externalSubscriptionId,
      status: "cancelled",
      reason: params.reason,
    });
    return { cancelled: true };
  }

  public validateWebhookSignature(params: {
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
    rawBody: string;
  }): VerifiedBillingWebhookHeader {
    const creds = resolveDevEssentBillingCredentials();
    const xSignature =
      params.headers["x-signature"] || params.headers["X-Signature"] || "";
    const xRequestId =
      params.headers["x-request-id"] || params.headers["X-Request-Id"] || "";

    let bodyObj: {
      id?: string | number;
      type?: string;
      topic?: string;
      action?: string;
      live_mode?: boolean;
      application_id?: string | number;
      user_id?: string | number;
      data?: { id?: string | number };
      resource?: string;
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

    // Verificação preliminar de titularidade quando informada no envelope do webhook oficial
    if (creds.isOfficialSandboxApi) {
      if (
        creds.collectorId &&
        bodyObj.user_id !== undefined &&
        String(bodyObj.user_id).trim() !== creds.collectorId
      ) {
        throw new ForbiddenError(
          `FAIL-CLOSED: Webhook recebido para user_id '${String(bodyObj.user_id)}' divergente da conta DevEssent configurada.`
        );
      }
      if (
        creds.applicationId &&
        bodyObj.application_id !== undefined &&
        String(bodyObj.application_id).trim() !== creds.applicationId
      ) {
        throw new ForbiddenError(
          `FAIL-CLOSED: Webhook recebido para application_id '${String(bodyObj.application_id)}' divergente da aplicação DevEssent configurada.`
        );
      }
    }

    const rawType = (
      bodyObj.type ||
      bodyObj.topic ||
      params.query["type"] ||
      params.query["topic"] ||
      "subscription_authorized_payment"
    )
      .toLowerCase()
      .trim();

    let resourceType: BillingWebhookResourceType = "subscription_authorized_payment";
    if (rawType === "subscription_preapproval_plan" || rawType.includes("preapproval_plan")) {
      resourceType = "subscription_preapproval_plan";
    } else if (rawType.includes("preapproval") && !rawType.includes("authorized_payment")) {
      resourceType = "subscription_preapproval";
    } else if (rawType === "payment" || rawType.startsWith("payment.")) {
      resourceType = "payment";
    } else {
      resourceType = "subscription_authorized_payment";
    }

    // Extrai data.id da query string, do JSON ou da URL IPN (`resource`)
    const resourceUrlTail =
      typeof bodyObj.resource === "string" && bodyObj.resource.includes("/")
        ? bodyObj.resource.split("/").filter(Boolean).pop() || ""
        : "";
    const dataId =
      params.query["data.id"] ||
      params.query["id"] ||
      (bodyObj.data?.id !== undefined ? String(bodyObj.data.id) : "") ||
      resourceUrlTail;

    if (!dataId) {
      throw new ValidationError("Identificador do recurso ausente no webhook Billing.");
    }

    const hasProviderEventId = Boolean(bodyObj.id || xRequestId);
    const externalEventId = bodyObj.id
      ? String(bodyObj.id)
      : `${resourceType}:${dataId}:${xRequestId || "ipn-trigger"}`;

    // Modo fallback autoritativo (somente quando explicitamente habilitado em official_sandbox_api
    // E o provedor não enviou x-signature): nunca finge que HMAC foi validado!
    if (!xSignature) {
      if (creds.isOfficialSandboxApi && creds.webhookAuthMode === "authoritative_fallback") {
        return {
          externalEventId,
          hasProviderEventId,
          eventType: bodyObj.action || rawType,
          resourceType,
          externalResourceId: dataId,
          signatureVerified: false,
          authMethod: "authoritative_fallback",
        };
      }
      throw new UnauthorizedError(
        "Cabeçalho obrigatório de assinatura HMAC (x-signature) ausente no webhook Billing."
      );
    }

    if (!creds.webhookSecret) {
      throw new ForbiddenError(
        "FAIL-CLOSED: Cabeçalho x-signature recebido, mas segredo HMAC do webhook não está configurado."
      );
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

    // Suporta timestamp do Mercado Pago tanto em segundos (10 dígitos) quanto milissegundos (13 dígitos)
    const tsNum = Number(tsValue);
    const tsNormalizedSeconds = tsValue.length >= 13 ? Math.floor(tsNum / 1000) : tsNum;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - tsNormalizedSeconds) > 300) {
      throw new UnauthorizedError("Timestamp do webhook Billing fora da janela segura (±5 min).");
    }

    // No simulador interno e em webhooks padrão com x-request-id, exige x-request-id
    if (!creds.isOfficialSandboxApi && !xRequestId) {
      throw new UnauthorizedError(
        "Cabeçalho obrigatório x-request-id ausente no webhook Billing Sandbox."
      );
    }

    const manifest = buildBillingWebhookManifest({
      dataId,
      xRequestId: xRequestId || undefined,
      timestampRaw: tsValue,
    });

    const expectedHmac = createHmac("sha256", creds.webhookSecret)
      .update(manifest)
      .digest("hex");

    const receivedBuf = Buffer.from(v1Value.toLowerCase(), "utf-8");
    const expectedBuf = Buffer.from(expectedHmac.toLowerCase(), "utf-8");

    if (receivedBuf.length !== expectedBuf.length || !timingSafeEqual(receivedBuf, expectedBuf)) {
      throw new UnauthorizedError("Assinatura criptográfica HMAC-SHA256 do webhook Billing inválida.");
    }

    return {
      externalEventId,
      hasProviderEventId,
      eventType: bodyObj.action || rawType,
      resourceType,
      externalResourceId: dataId,
      signatureVerified: true,
      authMethod: "hmac_sha256",
    };
  }

  public async fetchAuthoritativeEventResource(params: {
    resourceType: BillingWebhookResourceType;
    externalResourceId: string;
    rawBodyObj?: Record<string, unknown>;
  }): Promise<AuthoritativeBillingEvent> {
    const creds = resolveDevEssentBillingCredentials();

    if (params.resourceType === "subscription_preapproval_plan") {
      return {
        provider: "mercado_pago",
        externalEventId: `mp:plan:${params.externalResourceId}`,
        eventType: "subscription_preapproval_plan.ignored",
        resourceType: "subscription_preapproval_plan",
        externalResourceId: params.externalResourceId,
        externalSubscriptionId: null,
        externalReference: null,
        invoiceStatus: null,
        subscriptionStatus: null,
        amountCents: null,
        currency: "BRL",
        dueDate: null,
        billingCycleKey: null,
        paymentMethodLabel: null,
        failureCode: null,
        failureReason: null,
        rawSummary: {
          mode: creds.mode,
          providerOrigin: creds.providerOrigin,
          ignoredTopic: "subscription_preapproval_plan",
          note: "Planos comerciais individuais são controlados localmente pela DevEssent Platform.",
        },
      };
    }

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
        providerUpdatedAt: sim.providerUpdatedAt ?? null,
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

    // Comprovação obrigatória da Conta de Teste em /users/me antes de reconciliar recursos oficiais
    await this.verifyOfficialSandboxCredentials();

    const endpointPath =
      params.resourceType === "subscription_preapproval"
        ? `/preapproval/${encodeURIComponent(params.externalResourceId)}`
        : params.resourceType === "payment"
          ? `/v1/payments/${encodeURIComponent(params.externalResourceId)}`
          : `/authorized_payments/${encodeURIComponent(params.externalResourceId)}`;

    const res = await mpApiFetch(endpointPath, {
      method: "GET",
      accessToken: creds.accessToken,
    });

    if (res.status === 404) {
      throw new ValidationError(
        `Recurso Billing '${params.externalResourceId}' (${params.resourceType}) não localizado no Mercado Pago Sandbox.`
      );
    }
    if (!res.ok) {
      throw new ServiceUnavailableError(
        `Falha ao consultar recurso Billing '${params.externalResourceId}' no Mercado Pago Sandbox (HTTP ${res.status}).`
      );
    }

    const data = (await res.json()) as Record<string, unknown>;
    assertMpResourceOwnershipAndSandbox(data, creds, `GET ${endpointPath}`);

    if (params.resourceType === "subscription_preapproval") {
      return mapMpPreapprovalPayloadToEvent(data, params.externalResourceId);
    }
    if (params.resourceType === "payment") {
      return mapMpPaymentPayloadToEvent(data, params.externalResourceId);
    }
    return mapMpAuthorizedPaymentPayloadToEvent(data, params.externalResourceId);
  }
}

export function getDefaultBillingProvider(): BillingProvider {
  return new MercadoPagoBillingProvider();
}
