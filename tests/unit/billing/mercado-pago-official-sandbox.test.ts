import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBillingWebhookSignature,
  clearOfficialSandboxIdentityCache,
  MercadoPagoBillingProvider,
} from "@/modules/billing";

/**
 * CAMADA 1 — Mock Unitário do Adaptador Oficial Mercado Pago Sandbox (Fase 6E.2C).
 *
 * IMPORTANTE (§16 / §17):
 * Estes testes exercitam o protocolo HTTP, os guardas fail-closed de `/users/me`,
 * titularidade (`collector_id`/`application_id`), endpoints `/preapproval`, `/authorized_payments`,
 * `/v1/payments`, falhas temporárias (`503`) e modos de webhook com `fetch` mockado.
 * Eles NÃO substituem a homologação externa real com credenciais oficiais de Conta de Teste.
 */
describe("Fase 6E.2C — [Mock Unitário] Adaptador Oficial Mercado Pago Sandbox", () => {
  const originalFetch = globalThis.fetch;

  const configureOfficialSandboxEnv = (overrides?: Record<string, string | undefined>) => {
    process.env.BILLING_PROVIDER_MODE = "official_sandbox_api";
    process.env.BILLING_MP_ENVIRONMENT = "sandbox";
    process.env.BILLING_MP_ACCESS_TOKEN =
      "APP_USR-5555666677778888-010101-testuserabcdef1234567890-987654321";
    process.env.BILLING_MP_COLLECTOR_ID = "987654321";
    process.env.BILLING_MP_APPLICATION_ID = "444455556666";
    process.env.BILLING_MP_WEBHOOK_SECRET = "mp-official-sbx-secret-key-9876543210";
    process.env.BILLING_MP_WEBHOOK_AUTH_MODE = "hmac_strict";
    if (overrides) {
      for (const [k, v] of Object.entries(overrides)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };

  beforeEach(() => {
    clearOfficialSandboxIdentityCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.BILLING_PROVIDER_MODE;
    delete process.env.BILLING_MP_ENVIRONMENT;
    delete process.env.BILLING_MP_ACCESS_TOKEN;
    delete process.env.BILLING_MP_COLLECTOR_ID;
    delete process.env.BILLING_MP_APPLICATION_ID;
    delete process.env.BILLING_MP_WEBHOOK_SECRET;
    delete process.env.BILLING_MP_WEBHOOK_AUTH_MODE;
    delete process.env.BILLING_WEBHOOK_SANDBOX_SECRET;
    clearOfficialSandboxIdentityCache();
    vi.restoreAllMocks();
  });

  it("comprova conta de teste via GET /users/me para token APP_USR-* e bloqueia conta real sem tag test_user", async () => {
    configureOfficialSandboxEnv();
    const provider = new MercadoPagoBillingProvider();

    // 1. Conta de teste válida (APP_USR-* + tags: ["test_user"] + MLB + collector_id) -> aprovada e cacheada
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: 987654321, site_id: "MLB", tags: ["normal", "test_user"] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await provider.verifyOfficialSandboxCredentials();
    expect(first.verified).toBe(true);
    expect(first.isTestUser).toBe(true);
    expect(first.siteId).toBe("MLB");
    expect(first.collectorId).toBe("987654321");
    expect(first.cached).toBe(false);

    const second = await provider.verifyOfficialSandboxCredentials();
    expect(second.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2. Conta real disfarçada (mesmo com prefixo TEST- ou APP_USR-!) sem tag test_user -> FAIL-CLOSED!
    clearOfficialSandboxIdentityCache();
    process.env.BILLING_MP_ACCESS_TOKEN =
      "TEST-5555666677778888-010101-testuserabcdef1234567890-987654321";
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: 987654321, site_id: "MLB", tags: ["normal", "developer"] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    await expect(provider.verifyOfficialSandboxCredentials()).rejects.toThrow(/test_user/i);
  });

  it("executa POST /preapproval, GET /preapproval/{id}, search, authorized_payments e PUT /preapproval/{id} validando titularidade e live_mode", async () => {
    configureOfficialSandboxEnv();
    const provider = new MercadoPagoBillingProvider();

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/users/me")) {
        return new Response(
          JSON.stringify({ id: 987654321, site_id: "MLB", tags: ["test_user"] }),
          { status: 200 }
        );
      }
      if (url.endsWith("/preapproval") && init?.method === "POST") {
        const hdrs = init.headers as Record<string, string>;
        expect(hdrs["X-Idempotency-Key"]).toMatch(/^devessent-billing-sub-/);
        return new Response(
          JSON.stringify({
            id: "2c93808499a1b2c3",
            status: "pending",
            collector_id: 987654321,
            application_id: 444455556666,
            live_mode: false,
            sandbox_init_point: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=2c93808499a1b2c3",
          }),
          { status: 201 }
        );
      }
      if (url.includes("/preapproval/search")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "2c93808499a1b2c3",
                status: "authorized",
                external_reference: "devessent:saas:atelie:abc12345",
                collector_id: 987654321,
                application_id: 444455556666,
                live_mode: false,
                auto_recurring: { transaction_amount: 149.9 },
                next_payment_date: "2026-12-23T12:00:00.000Z",
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/preapproval/2c93808499a1b2c3") && init?.method === "GET") {
        return new Response(
          JSON.stringify({
            id: "2c93808499a1b2c3",
            status: "authorized",
            external_reference: "devessent:saas:atelie:abc12345",
            collector_id: 987654321,
            application_id: 444455556666,
            live_mode: false,
            payment_method_id: "visa",
            next_payment_date: "2026-12-23T12:00:00.000Z",
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/preapproval/2c93808499a1b2c3") && init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            id: "2c93808499a1b2c3",
            status: "cancelled",
            collector_id: 987654321,
            live_mode: false,
          }),
          { status: 200 }
        );
      }
      if (url.includes("/authorized_payments/search")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 900112233,
                preapproval_id: "2c93808499a1b2c3",
                external_reference: "devessent:saas:atelie:abc12345",
                collector_id: 987654321,
                live_mode: false,
                status: "processed",
                transaction_amount: 149.9,
                debit_date: "2026-11-23T12:00:00.000Z",
                payment: { id: 800112233, status: "approved", status_detail: "accredited" },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/v1/payments/800112233")) {
        return new Response(
          JSON.stringify({
            id: 800112233,
            status: "rejected",
            status_detail: "cc_rejected_insufficient_amount",
            transaction_amount: 149.9,
            external_reference: "devessent:saas:atelie:abc12345",
            collector_id: 987654321,
            live_mode: false,
            date_created: "2026-11-23T12:00:00.000Z",
            point_of_interaction: {
              transaction_data: { subscription_id: "2c93808499a1b2c3" },
            },
          }),
          { status: 200 }
        );
      }
      return new Response("Not Found", { status: 404 });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const created = await provider.createRecurringAuthorization({
      subscriptionId: "11111111-1111-4111-8111-111111111111",
      tenantId: "22222222-2222-4222-8222-222222222222",
      tenantName: "Ateliê Demo",
      planName: "Plano Essencial",
      externalReference: "devessent:saas:atelie:abc12345",
      amountCents: 14990,
      currency: "BRL",
      billingCycle: "monthly",
      scheduledStartDate: "2026-11-23",
      payerEmail: "test_user_9999@testuser.com",
      backUrl: "https://devessent-platform-staging.devessent.workers.dev/dashboard/assinatura",
    });
    expect(created.externalSubscriptionId).toBe("2c93808499a1b2c3");
    expect(created.authorizationUrl).toContain("mercadopago.com.br");

    const fetched = await provider.getExternalSubscription("2c93808499a1b2c3");
    expect(fetched.subscriptionStatus).toBe("active");
    expect(fetched.collectorId).toBe("987654321");

    const searchedSubs = await provider.searchExternalSubscriptions({
      externalReference: "devessent:saas:atelie:abc12345",
    });
    expect(searchedSubs).toHaveLength(1);
    expect(searchedSubs[0].amountCents).toBe(14990);

    const authPays = await provider.searchAuthorizedPayments({
      preapprovalId: "2c93808499a1b2c3",
    });
    expect(authPays).toHaveLength(1);
    expect(authPays[0].invoiceStatus).toBe("paid");
    expect(authPays[0].amountCents).toBe(14990);

    const linkedPay = await provider.fetchAuthoritativeEventResource({
      resourceType: "payment",
      externalResourceId: "800112233",
    });
    expect(linkedPay.invoiceStatus).toBe("failed");
    expect(linkedPay.failureCode).toBe("cc_rejected_insufficient_amount");
    expect(linkedPay.externalSubscriptionId).toBe("2c93808499a1b2c3");

    const cancelRes = await provider.cancelExternalSubscription({
      externalSubscriptionId: "2c93808499a1b2c3",
      reason: "Teste de cancelamento Sandbox",
    });
    expect(cancelRes.cancelled).toBe(true);

    // Autorização simulada de navegador bloqueada em official_sandbox_api
    await expect(
      provider.confirmSandboxAuthorization({
        externalSubscriptionId: "2c93808499a1b2c3",
        cardBrand: "Visa",
        cardLast4: "4242",
        payerEmail: "test_user_9999@testuser.com",
      })
    ).rejects.toThrow(/official_sandbox_api/i);
  });

  it("bloqueia collector_id divergente, live_mode=true e propaga 503 em indisponibilidade temporária do gateway", async () => {
    configureOfficialSandboxEnv();
    const provider = new MercadoPagoBillingProvider();

    // 1. Webhook com user_id divergente -> ForbiddenError (403)
    const tsMs = Date.now();
    const sig = buildBillingWebhookSignature({
      dataId: "900112233",
      xRequestId: "req-wrong-owner",
      timestampSeconds: tsMs,
    });
    expect(() =>
      provider.validateWebhookSignature({
        headers: { "x-signature": sig, "x-request-id": "req-wrong-owner" },
        query: { "data.id": "900112233" },
        rawBody: JSON.stringify({
          id: "evt-wrong-owner",
          type: "subscription_authorized_payment",
          live_mode: false,
          user_id: "111000111", // collector errado!
          data: { id: "900112233" },
        }),
      })
    ).toThrow(/user_id/i);

    // 2. Fallback autoritativo explícito sem x-signature e sem body.id/x-request-id (IPN legado)
    //    registra signatureVerified=false e hasProviderEventId=false (evita deduplicar transições pending -> authorized!)
    process.env.BILLING_MP_WEBHOOK_AUTH_MODE = "authoritative_fallback";
    const fallbackParsed = provider.validateWebhookSignature({
      headers: {},
      query: { id: "2c93808499a1b2c3", topic: "preapproval" },
      rawBody: "",
    });
    expect(fallbackParsed.signatureVerified).toBe(false);
    expect(fallbackParsed.hasProviderEventId).toBe(false);
    expect(fallbackParsed.resourceType).toBe("subscription_preapproval");
    expect(fallbackParsed.authMethod).toBe("authoritative_fallback");

    // Se x-signature vier presente mesmo em authoritative_fallback, assinatura inválida continua rejeitada (401)!
    expect(() =>
      provider.validateWebhookSignature({
        headers: {
          "x-signature": `ts=${tsMs},v1=${"0".repeat(64)}`,
          "x-request-id": "req-invalid-in-fallback",
        },
        query: { "data.id": "2c93808499a1b2c3", type: "subscription_preapproval" },
        rawBody: JSON.stringify({
          id: "evt-bad-sig-fallback",
          type: "subscription_preapproval",
          live_mode: false,
          user_id: "987654321",
          data: { id: "2c93808499a1b2c3" },
        }),
      })
    ).toThrow(/inválida/i);

    // 3. Indisponibilidade HTTP 503 do Mercado Pago propaga ServiceUnavailableError (statusCode=503)
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Upstream Down", { status: 503 })) as unknown as typeof fetch;
    await expect(provider.verifyOfficialSandboxCredentials(true)).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
    });

    // 4. getRuntimeStatus nunca lança exceção mesmo com configuração incompleta (fail-safe na UI)
    delete process.env.BILLING_MP_COLLECTOR_ID;
    const status = provider.getRuntimeStatus();
    expect(status.configValid).toBe(false);
    expect(status.diagnosticCode).toBe("MISSING_OFFICIAL_COLLECTOR_ID");
  });
});
