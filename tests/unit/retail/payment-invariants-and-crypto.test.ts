import { describe, expect, it } from "vitest";
import { PaymentInvariants } from "@/modules/retail/domain/payment-invariants";
import {
  createSignedOAuthState,
  decryptPaymentSecret,
  encryptPaymentSecret,
  generatePkceChallenge,
  verifyPkceChallenge,
  verifySignedOAuthState,
} from "@/modules/retail/payments/payment-crypto";
import {
  buildMercadoPagoWebhookSignature,
  mapMercadoPagoMethod,
  mapMercadoPagoStatus,
  MercadoPagoSandboxProvider,
} from "@/modules/retail/payments/providers/mercado-pago-sandbox.provider";

describe("Fase 6D — PaymentInvariants & Governança Sandbox Fail-Closed", () => {
  const activeConn = {
    status: "connected" as const,
    environment: "sandbox" as const,
    sellerAccountId: "MP-SELLER-SANDBOX-001",
  };

  it("bloqueia qualquer ambiente diferente de sandbox ou credenciais live (Fail-Closed)", () => {
    expect(() =>
      PaymentInvariants.assertSandboxOnlyMode("sandbox", "TEST-1234567890-SANDBOX")
    ).not.toThrow();

    expect(() => PaymentInvariants.assertSandboxOnlyMode("live")).toThrow(
      /FAIL-CLOSED/i
    );
    expect(() => PaymentInvariants.assertSandboxOnlyMode("production")).toThrow(
      /FAIL-CLOSED/i
    );
    expect(() =>
      PaymentInvariants.assertSandboxOnlyMode("sandbox", "APP_USR_LIVE_99887766")
    ).toThrow(/FAIL-CLOSED/i);
    expect(() =>
      PaymentInvariants.assertSandboxOnlyMode("sandbox", "PROD_SECRET_TOKEN")
    ).toThrow(/FAIL-CLOSED/i);
  });

  it("impede criação de pagamento para pedido em estado requested, completed ou cancelled", () => {
    const baseOrder = {
      paymentStatus: "not_started" as const,
      deliveryMode: "pickup" as const,
      subtotalCents: 15000,
      shippingFeeCents: 0,
      discountCents: 0,
      totalCents: 15000,
      currency: "BRL",
    };

    const requested = PaymentInvariants.evaluateOrderPaymentEligibility(
      { ...baseOrder, status: "requested" },
      activeConn
    );
    expect(requested.eligible).toBe(false);
    expect(requested.reason).toMatch(/aguarda confirmação/i);

    const completed = PaymentInvariants.evaluateOrderPaymentEligibility(
      { ...baseOrder, status: "completed" },
      activeConn
    );
    expect(completed.eligible).toBe(false);

    const cancelled = PaymentInvariants.evaluateOrderPaymentEligibility(
      { ...baseOrder, status: "cancelled" },
      activeConn
    );
    expect(cancelled.eligible).toBe(false);
  });

  it("impede criação de pagamento para pedido delivery sem frete determinístico definido", () => {
    const res = PaymentInvariants.evaluateOrderPaymentEligibility(
      {
        status: "confirmed",
        paymentStatus: "not_started",
        deliveryMode: "delivery",
        subtotalCents: 20000,
        shippingFeeCents: null,
        discountCents: 0,
        totalCents: 20000,
        currency: "BRL",
      },
      activeConn
    );

    expect(res.eligible).toBe(false);
    expect(res.reason).toMatch(/frete/i);
  });

  it("permite pagamento para pedido confirmado com frete definido e conexão ativa, inclusive re-tentativa após recusa/expiração", () => {
    const deliveryWithShipping = PaymentInvariants.evaluateOrderPaymentEligibility(
      {
        status: "confirmed",
        paymentStatus: "not_started",
        deliveryMode: "delivery",
        subtotalCents: 20000,
        shippingFeeCents: 2500,
        discountCents: 0,
        totalCents: 22500,
        currency: "BRL",
      },
      activeConn
    );
    expect(deliveryWithShipping.eligible).toBe(true);

    const retryAfterFailed = PaymentInvariants.evaluateOrderPaymentEligibility(
      {
        status: "preparing",
        paymentStatus: "failed",
        deliveryMode: "pickup",
        subtotalCents: 15000,
        shippingFeeCents: 0,
        discountCents: 0,
        totalCents: 15000,
        currency: "BRL",
      },
      activeConn
    );
    expect(retryAfterFailed.eligible).toBe(true);
  });

  it("bloqueia pagamento duplicado quando pedido já está paid ou refunded", () => {
    const alreadyPaid = PaymentInvariants.evaluateOrderPaymentEligibility(
      {
        status: "confirmed",
        paymentStatus: "paid",
        deliveryMode: "pickup",
        subtotalCents: 15000,
        shippingFeeCents: 0,
        discountCents: 0,
        totalCents: 15000,
        currency: "BRL",
      },
      activeConn
    );
    expect(alreadyPaid.eligible).toBe(false);
  });

  it("protege contra eventos fora de ordem (ex.: pending ou failed após paid)", () => {
    expect(PaymentInvariants.isOutOfOrderTransition("paid", "pending")).toBe(true);
    expect(PaymentInvariants.isOutOfOrderTransition("paid", "processing")).toBe(true);
    expect(PaymentInvariants.isOutOfOrderTransition("paid", "failed")).toBe(true);
    expect(PaymentInvariants.isOutOfOrderTransition("paid", "expired")).toBe(true);
    expect(PaymentInvariants.isOutOfOrderTransition("refunded", "paid")).toBe(true);

    expect(PaymentInvariants.isOutOfOrderTransition("pending", "paid")).toBe(false);
    expect(PaymentInvariants.isOutOfOrderTransition("processing", "paid")).toBe(false);
    expect(PaymentInvariants.isOutOfOrderTransition("paid", "refunded")).toBe(false);
  });

  it("constrói e valida external_reference canônico e minimiza dados pessoais (LGPD)", () => {
    const tenantId = "11111111-2222-3333-4444-555555555555";
    const orderId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const ref = PaymentInvariants.buildCanonicalExternalReference({
      tenantId,
      orderId,
      orderNumber: "PED-2026-00042",
    });

    expect(ref).toBe(
      "devessent:t:11111111-2222-3333-4444-555555555555:o:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:n:PED-2026-00042"
    );

    const parsed = PaymentInvariants.parseCanonicalExternalReference(ref);
    expect(parsed).toEqual({
      tenantId,
      orderId,
      orderNumber: "PED-2026-00042",
    });

    expect(PaymentInvariants.minimizeCustomerName("Mariana Costa Albuquerque")).toBe(
      "Mariana A."
    );
    expect(PaymentInvariants.maskEmail("mariana.costa@exemplo.com.br")).toBe(
      "ma***@exemplo.com.br"
    );
  });
});

describe("Fase 6D — Criptografia AES-256-GCM com AAD por Tenant, PKCE e OAuth State", () => {
  const tenantA = "10000000-0000-4000-8000-000000000001";
  const tenantB = "20000000-0000-4000-8000-000000000002";

  it("criptografa e descriptografa segredo vinculado ao tenant e bloqueia descriptografia cruzada entre tenants", () => {
    const rawToken = "TEST-DEVESSENT-SANDBOX-SELLER-TOKEN-998877";
    const encrypted = encryptPaymentSecret(rawToken, tenantA);

    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain(rawToken);

    const decryptedA = decryptPaymentSecret(encrypted, tenantA);
    expect(decryptedA).toBe(rawToken);

    // Tentativa de descriptografar o ciphertext do Tenant A usando o contexto do Tenant B falha (AAD mismatch)
    expect(() => decryptPaymentSecret(encrypted, tenantB)).toThrow();
  });

  it("gera e valida par PKCE S256 corretamente", () => {
    const pkce = generatePkceChallenge();
    expect(pkce.codeChallengeMethod).toBe("S256");
    expect(verifyPkceChallenge(pkce.codeVerifier, pkce.codeChallenge)).toBe(true);
    expect(verifyPkceChallenge("verifier-invalido", pkce.codeChallenge)).toBe(false);
  });

  it("assina e valida OAuth state anti-CSRF vinculado ao tenantId e actorUserId", () => {
    const actorId = "90000000-0000-4000-8000-000000000099";
    const storeId = "30000000-0000-4000-8000-000000000003";
    const pkce = generatePkceChallenge();
    const state = createSignedOAuthState({
      tenantId: tenantA,
      storeId,
      actorUserId: actorId,
      provider: "mercado_pago",
      codeChallenge: pkce.codeChallenge,
    });

    const verified = verifySignedOAuthState({
      rawState: state,
      expectedTenantId: tenantA,
      expectedActorUserId: actorId,
      codeVerifier: pkce.codeVerifier,
    });
    expect(verified.tenantId).toBe(tenantA);
    expect(verified.actorUserId).toBe(actorId);

    // Rejeita quando o tenant esperado é diferente
    expect(() =>
      verifySignedOAuthState({
        rawState: state,
        expectedTenantId: tenantB,
        expectedActorUserId: actorId,
        codeVerifier: pkce.codeVerifier,
      })
    ).toThrow(/VIOLAÇÃO MULTIEMPRESA/i);
  });
});

describe("Fase 6D — MercadoPagoSandboxProvider & Assinatura de Webhook HMAC-SHA256", () => {
  const webhookSecret = "sandbox_hmac_test_secret_devessent_6d";
  const provider = new MercadoPagoSandboxProvider();

  it("valida assinatura x-signature HMAC-SHA256 autêntica e rejeita assinatura adulterada ou replay expirado", () => {
    const dataId = "mp_pay_sbx_123456789";
    const xRequestId = "req_abc_987654";
    const nowSec = Math.floor(Date.now() / 1000);

    const validHeader = buildMercadoPagoWebhookSignature({
      dataId,
      xRequestId,
      timestampSeconds: nowSec,
      webhookSecret,
    });

    const validCheck = provider.validateWebhookNotification({
      headers: {
        "x-signature": validHeader,
        "x-request-id": xRequestId,
      },
      query: { "data.id": dataId },
      rawBody: JSON.stringify({ data: { id: dataId }, action: "payment.updated" }),
      webhookSecret,
    });
    expect(validCheck.verified).toBe(true);
    expect(validCheck.externalPaymentId).toBe(dataId);

    // Assinatura com secret incorreto
    expect(() =>
      provider.validateWebhookNotification({
        headers: {
          "x-signature": validHeader,
          "x-request-id": xRequestId,
        },
        query: { "data.id": dataId },
        rawBody: JSON.stringify({ data: { id: dataId } }),
        webhookSecret: "sandbox_hmac_wrong_secret",
      })
    ).toThrow(/HMAC-SHA256/i);

    // Replay attack (timestamp de 30 minutos atrás)
    const expiredHeader = buildMercadoPagoWebhookSignature({
      dataId,
      xRequestId,
      timestampSeconds: nowSec - 1800,
      webhookSecret,
    });
    expect(() =>
      provider.validateWebhookNotification({
        headers: {
          "x-signature": expiredHeader,
          "x-request-id": xRequestId,
        },
        query: { "data.id": dataId },
        rawBody: JSON.stringify({ data: { id: dataId } }),
        webhookSecret,
      })
    ).toThrow(/anti-replay/i);
  });

  it("mapeia corretamente status e métodos do Mercado Pago para estados canônicos da DevEssent", () => {
    expect(mapMercadoPagoStatus("approved")).toBe("paid");
    expect(mapMercadoPagoStatus("in_process")).toBe("processing");
    expect(mapMercadoPagoStatus("pending")).toBe("pending");
    expect(mapMercadoPagoStatus("rejected")).toBe("failed");
    expect(mapMercadoPagoStatus("expired")).toBe("expired");
    expect(mapMercadoPagoStatus("cancelled")).toBe("cancelled");
    expect(mapMercadoPagoStatus("refunded", 5000, 10000)).toBe("partially_refunded");
    expect(mapMercadoPagoStatus("refunded", 10000, 10000)).toBe("refunded");
    expect(mapMercadoPagoStatus("charged_back")).toBe("disputed");

    expect(mapMercadoPagoMethod("bank_transfer", "pix")).toBe("pix");
    expect(mapMercadoPagoMethod("credit_card", "visa")).toBe("credit_card");
    expect(mapMercadoPagoMethod("ticket", "bolbradesco")).toBe("boleto");
  });
});
