import { afterEach, describe, expect, it } from "vitest";
import {
  BillingInvariants,
  BillingPermissionService,
  buildBillingWebhookSignature,
  MercadoPagoBillingProvider,
  resolveDevEssentBillingCredentials,
} from "@/modules/billing";

describe("Fase 6E.2 — Billing SaaS, Contratos 50/50, RBAC e Webhooks HMAC", () => {
  it("calcula divisão 50/50 em centavos inteiros sem perda de centavo em valores ímpares", () => {
    const standard = BillingInvariants.calculateImplementationSplit(300_000, 50);
    expect(standard).toEqual({
      entryPercent: 50,
      balancePercent: 50,
      entryCents: 150_000,
      balanceCents: 150_000,
    });

    // Valor ímpar em centavos: R$ 2.500,01 -> entrada 125000 + saldo 125001 = 250001
    const odd = BillingInvariants.calculateImplementationSplit(250_001, 50);
    expect(odd.entryCents + odd.balanceCents).toBe(250_001);

    // Condição excepcional negociada (40% / 60%)
    const custom = BillingInvariants.calculateImplementationSplit(200_000, 40);
    expect(custom).toEqual({
      entryPercent: 40,
      balancePercent: 60,
      entryCents: 80_000,
      balanceCents: 120_000,
    });

    expect(BillingInvariants.formatCentsToBrl(14990)).toBe("R$ 149,90");
    expect(BillingInvariants.formatCentsToBrl(200000)).toBe("R$ 2.000,00");
    expect(BillingInvariants.parseReaisToCents("R$ 1.500,50")).toBe(150_050);
  });

  it("normaliza MRR por ciclo e bloqueia cobranças reais (fail-closed Sandbox)", () => {
    expect(BillingInvariants.calculateMonthlyEquivalentCents(14990, "monthly")).toBe(14990);
    expect(BillingInvariants.calculateMonthlyEquivalentCents(45000, "quarterly")).toBe(15000);
    expect(BillingInvariants.calculateMonthlyEquivalentCents(120000, "annual")).toBe(10000);

    expect(() => BillingInvariants.assertBillingSandboxOnly("sandbox")).not.toThrow();
    expect(() => BillingInvariants.assertBillingSandboxOnly("production")).toThrow(/FAIL-CLOSED/i);
    expect(() =>
      BillingInvariants.assertBillingSandboxOnly("sandbox", "APP_USR-1234567890")
    ).toThrow(/APP_USR/i);
  });

  it("exige autorização financeira válida, marco de ativação e data agendada antes de cobrar (§8)", () => {
    // Sem autorização e sem ativação -> bloqueado
    const r1 = BillingInvariants.evaluateBillingStartReadiness({
      status: "awaiting_authorization",
      authorizedAt: null,
      activationConfirmedAt: null,
      scheduledStartDate: "2026-11-21",
      todayIsoDate: "2026-11-21",
    });
    expect(r1.canCharge).toBe(false);
    expect(r1.reasons.length).toBeGreaterThanOrEqual(2);

    // Autorizado e ativado, mas data agendada no futuro -> bloqueado!
    const r2 = BillingInvariants.evaluateBillingStartReadiness({
      status: "awaiting_activation",
      authorizedAt: "2026-11-21T10:00:00Z",
      activationConfirmedAt: "2026-11-21T11:00:00Z",
      scheduledStartDate: "2026-12-01",
      todayIsoDate: "2026-11-21",
    });
    expect(r2.canCharge).toBe(false);
    expect(r2.reasons[0]).toMatch(/2026-12-01/);

    // Autorizado, ativado e data atingida -> liberado
    const r3 = BillingInvariants.evaluateBillingStartReadiness({
      status: "active",
      authorizedAt: "2026-11-21T10:00:00Z",
      activationConfirmedAt: "2026-11-21T11:00:00Z",
      scheduledStartDate: "2026-11-21",
      todayIsoDate: "2026-11-21",
    });
    expect(r3.canCharge).toBe(true);
  });

  it("impõe matriz RBAC estrita: apenas platform_admin gere Billing global; manager/staff bloqueados", () => {
    expect(BillingPermissionService.hasPermission("platform_admin", "view_global_billing")).toBe(true);
    expect(BillingPermissionService.hasPermission("platform_admin", "manage_billing_plans")).toBe(true);
    expect(BillingPermissionService.hasPermission("platform_admin", "manage_implementation_contracts")).toBe(true);

    // Owner consulta e autoriza apenas a própria empresa; NUNCA gerencia planos/contratos globais
    expect(BillingPermissionService.hasPermission("owner", "view_own_tenant_billing")).toBe(true);
    expect(BillingPermissionService.hasPermission("owner", "authorize_own_tenant_subscription")).toBe(true);
    expect(BillingPermissionService.hasPermission("owner", "update_own_payment_method")).toBe(true);
    expect(BillingPermissionService.hasPermission("owner", "view_global_billing")).toBe(false);
    expect(BillingPermissionService.hasPermission("owner", "manage_billing_plans")).toBe(false);
    expect(BillingPermissionService.hasPermission("owner", "manage_implementation_contracts")).toBe(false);

    // Manager e Staff não acessam contratos nem mensalidades SaaS da DevEssent
    expect(BillingPermissionService.hasPermission("manager", "view_own_tenant_billing")).toBe(false);
    expect(BillingPermissionService.hasPermission("manager", "authorize_own_tenant_subscription")).toBe(false);
    expect(BillingPermissionService.hasPermission("staff", "view_own_tenant_billing")).toBe(false);
    expect(BillingPermissionService.hasPermission("staff", "update_own_payment_method")).toBe(false);
  });

  it("valida comprovantes de implantação 50/50 por assinatura binária real (PDF/PNG) e rejeita falsificações", () => {
    const validPdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n", "utf-8");
    const pdfRes = BillingInvariants.validateReceiptFileBuffer(validPdf, "comprovante-pix.pdf");
    expect(pdfRes.mimeType).toBe("application/pdf");
    expect(pdfRes.sha256).toHaveLength(64);

    const fakePdf = Buffer.from("<script>alert('xss')</script>".repeat(2), "utf-8");
    expect(() => BillingInvariants.validateReceiptFileBuffer(fakePdf, "evil.pdf")).toThrow(
      /assinatura binária/i
    );
  });

  afterEach(() => {
    delete process.env.BILLING_WEBHOOK_SANDBOX_SECRET;
    delete process.env.BILLING_MP_ACCESS_TOKEN;
    delete process.env.BILLING_MP_WEBHOOK_SECRET;
    delete process.env.AUTH_BRIDGE_SECRET;
  });

  it("exige segredo exclusivo obrigatório no Billing (sem fallback previsível e sem reuso de segredos de outros módulos)", () => {
    delete process.env.BILLING_WEBHOOK_SANDBOX_SECRET;
    delete process.env.BILLING_MP_ACCESS_TOKEN;
    delete process.env.BILLING_MP_WEBHOOK_SECRET;

    // 1. Sem segredo exclusivo -> FAIL-CLOSED (nenhum fallback hardcoded permitido!)
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/FAIL-CLOSED/i);

    // 2. Segredo curto ou previsível -> FAIL-CLOSED
    process.env.BILLING_WEBHOOK_SANDBOX_SECRET = "curto-demais";
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/FAIL-CLOSED/i);

    process.env.BILLING_WEBHOOK_SANDBOX_SECRET =
      "devessent-billing-sandbox-local-hmac-secret-previsivel";
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/previsível/i);

    // 3. Reutilizar AUTH_BRIDGE_SECRET -> FAIL-CLOSED
    const sharedSecret = "a".repeat(64);
    process.env.AUTH_BRIDGE_SECRET = sharedSecret;
    process.env.BILLING_WEBHOOK_SANDBOX_SECRET = sharedSecret;
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/reutilizar/i);

    // 4. Segredo exclusivo forte -> libera modo internal_sandbox_simulator
    process.env.BILLING_WEBHOOK_SANDBOX_SECRET = "9f4c82d1e7a03b56c4d9e8f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5";
    const simCreds = resolveDevEssentBillingCredentials();
    expect(simCreds.isOfficialSandboxApi).toBe(false);
    expect(simCreds.providerOrigin).toBe("internal_sandbox_simulator");

    // 5. Credencial oficial Sandbox TEST-* exige BILLING_MP_WEBHOOK_SECRET obrigatório
    process.env.BILLING_MP_ACCESS_TOKEN = "TEST-1111222233334444-010101-abcdef1234567890-999999";
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/BILLING_MP_WEBHOOK_SECRET/i);

    process.env.BILLING_MP_WEBHOOK_SECRET = "mp-sbx-exclusive-wh-secret-7a8b9c0d1e2f";
    const officialCreds = resolveDevEssentBillingCredentials();
    expect(officialCreds.isOfficialSandboxApi).toBe(true);
    expect(officialCreds.providerOrigin).toBe("mercado_pago_official_sandbox");

    // 6. Credencial de produção APP_USR-* -> bloqueada fail-closed
    process.env.BILLING_MP_ACCESS_TOKEN = "APP_USR-9999999999999999-live-blocked";
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/APP_USR-/i);
  });

  it("valida assinatura HMAC-SHA256 dos webhooks exclusivos Billing e rejeita live_mode ou assinaturas forjadas", () => {
    process.env.BILLING_WEBHOOK_SANDBOX_SECRET =
      "4b7e1c9d0a2f58e3b6c1d4a7e9f20358a6c9d1e4f7b2a5c8d0e3f6a9b1c4d7e2";
    const provider = new MercadoPagoBillingProvider();
    const dataId = "MP-AUTHPAY-SBX-001";
    const xRequestId = "req-billing-test-01";
    const ts = Math.floor(Date.now() / 1000);
    const sig = buildBillingWebhookSignature({
      dataId,
      xRequestId,
      timestampSeconds: ts,
    });

    const body = JSON.stringify({
      id: "evt-billing-001",
      type: "subscription_authorized_payment",
      action: "payment.approved",
      live_mode: false,
      data: { id: dataId },
    });

    const verified = provider.validateWebhookSignature({
      headers: { "x-signature": sig, "x-request-id": xRequestId },
      query: { "data.id": dataId },
      rawBody: body,
    });
    expect(verified.externalEventId).toBe("evt-billing-001");
    expect(verified.resourceType).toBe("subscription_authorized_payment");

    // Assinatura adulterada -> rejeitada
    expect(() =>
      provider.validateWebhookSignature({
        headers: { "x-signature": `ts=${ts},v1=${"0".repeat(64)}`, "x-request-id": xRequestId },
        query: { "data.id": dataId },
        rawBody: body,
      })
    ).toThrow(/inválida/i);

    // live_mode=true -> bloqueado fail-closed
    expect(() =>
      provider.validateWebhookSignature({
        headers: { "x-signature": sig, "x-request-id": xRequestId },
        query: { "data.id": dataId },
        rawBody: JSON.stringify({ id: "evt-live", live_mode: true, data: { id: dataId } }),
      })
    ).toThrow(/live_mode/i);
  });
});
