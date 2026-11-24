import { afterEach, describe, expect, it } from "vitest";
import {
  BillingInvariants,
  BillingPermissionService,
  buildBillingWebhookSignature,
  clearOfficialSandboxIdentityCache,
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

  it("normaliza MRR por ciclo, bloqueia produção e valida formato estrutural sem presumir sandbox por prefixo (§4)", () => {
    expect(BillingInvariants.calculateMonthlyEquivalentCents(14990, "monthly")).toBe(14990);
    expect(BillingInvariants.calculateMonthlyEquivalentCents(45000, "quarterly")).toBe(15000);
    expect(BillingInvariants.calculateMonthlyEquivalentCents(120000, "annual")).toBe(10000);

    expect(() => BillingInvariants.assertBillingSandboxOnly("sandbox")).not.toThrow();
    expect(() => BillingInvariants.assertBillingSandboxOnly("production")).toThrow(/FAIL-CLOSED/i);

    // Fase 6E.2C: tanto TEST-* quanto APP_USR-* de contas de teste são formatos válidos estruturalmente
    // (a comprovação real de Sandbox ocorre exclusivamente em /users/me com tags: ["test_user"])
    expect(() =>
      BillingInvariants.assertBillingSandboxOnly(
        "sandbox",
        "APP_USR-1234567890123456-010101-abcdef1234567890-999999"
      )
    ).not.toThrow();
    expect(() =>
      BillingInvariants.assertBillingSandboxOnly(
        "sandbox",
        "TEST-1234567890123456-010101-abcdef1234567890-999999"
      )
    ).not.toThrow();
    expect(() => BillingInvariants.assertBillingSandboxOnly("sandbox", "token-invalido")).toThrow(
      /FAIL-CLOSED/i
    );

    // Verificação autoritativa de /users/me rejeita conta sem tag test_user, país != MLB ou collector divergente
    expect(
      BillingInvariants.assertOfficialSandboxUserIdentity({
        userId: 987654321,
        siteId: "MLB",
        tags: ["normal", "test_user"],
        expectedCollectorId: "987654321",
      })
    ).toEqual({ collectorId: "987654321", siteId: "MLB", isTestUser: true });

    expect(() =>
      BillingInvariants.assertOfficialSandboxUserIdentity({
        userId: 987654321,
        siteId: "MLB",
        tags: ["normal"],
        expectedCollectorId: "987654321",
      })
    ).toThrow(/test_user/i);

    expect(() =>
      BillingInvariants.assertOfficialSandboxUserIdentity({
        userId: 987654321,
        siteId: "MLA",
        tags: ["test_user"],
        expectedCollectorId: "987654321",
      })
    ).toThrow(/MLB/i);

    expect(() =>
      BillingInvariants.assertOfficialSandboxUserIdentity({
        userId: 111111111,
        siteId: "MLB",
        tags: ["test_user"],
        expectedCollectorId: "987654321",
      })
    ).toThrow(/divergente/i);
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
    delete process.env.BILLING_PROVIDER_MODE;
    delete process.env.BILLING_MP_ENVIRONMENT;
    delete process.env.BILLING_MP_COLLECTOR_ID;
    delete process.env.BILLING_MP_APPLICATION_ID;
    delete process.env.BILLING_MP_WEBHOOK_AUTH_MODE;
    delete process.env.BILLING_WEBHOOK_SANDBOX_SECRET;
    delete process.env.BILLING_MP_ACCESS_TOKEN;
    delete process.env.BILLING_MP_WEBHOOK_SECRET;
    delete process.env.AUTH_BRIDGE_SECRET;
    clearOfficialSandboxIdentityCache();
  });

  it("exige seleção explícita de modo e segredo exclusivo obrigatório (sem auto-switch nem fallback previsível)", () => {
    delete process.env.BILLING_PROVIDER_MODE;
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

    // 4. Segredo exclusivo forte sem BILLING_PROVIDER_MODE -> mantém simulador mesmo se MP token existir (sem auto-switch!)
    process.env.BILLING_WEBHOOK_SANDBOX_SECRET =
      "9f4c82d1e7a03b56c4d9e8f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5";
    process.env.BILLING_MP_ACCESS_TOKEN =
      "TEST-1111222233334444-010101-abcdef1234567890-999999";
    process.env.BILLING_MP_WEBHOOK_SECRET = "mp-sbx-exclusive-wh-secret-7a8b9c0d1e2f";
    const simCreds = resolveDevEssentBillingCredentials();
    expect(simCreds.isOfficialSandboxApi).toBe(false);
    expect(simCreds.providerOrigin).toBe("internal_sandbox_simulator");

    // 5. BILLING_PROVIDER_MODE inválido -> FAIL-CLOSED
    process.env.BILLING_PROVIDER_MODE = "modo_desconhecido";
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/BILLING_PROVIDER_MODE/i);

    // 6. BILLING_PROVIDER_MODE=official_sandbox_api exige BILLING_MP_COLLECTOR_ID numérico + BILLING_MP_WEBHOOK_SECRET
    process.env.BILLING_PROVIDER_MODE = "official_sandbox_api";
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/BILLING_MP_COLLECTOR_ID/i);

    process.env.BILLING_MP_COLLECTOR_ID = "1234567890";
    delete process.env.BILLING_MP_WEBHOOK_SECRET;
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/BILLING_MP_WEBHOOK_SECRET/i);

    // 7. Aceita tanto TEST-* quanto APP_USR-* de conta de teste com configuração completa em sandbox
    process.env.BILLING_MP_WEBHOOK_SECRET = "mp-sbx-exclusive-wh-secret-7a8b9c0d1e2f";
    process.env.BILLING_MP_ACCESS_TOKEN =
      "APP_USR-1111222233334444-010101-abcdef1234567890-999999";
    const officialCreds = resolveDevEssentBillingCredentials();
    expect(officialCreds.isOfficialSandboxApi).toBe(true);
    expect(officialCreds.providerOrigin).toBe("mercado_pago_official_sandbox");
    expect(officialCreds.collectorId).toBe("1234567890");

    // 8. BILLING_MP_ENVIRONMENT=production -> bloqueado fail-closed!
    process.env.BILLING_MP_ENVIRONMENT = "production";
    expect(() => resolveDevEssentBillingCredentials()).toThrow(/FAIL-CLOSED/i);
  });

  it("valida assinatura HMAC-SHA256 (ts em segundos e milissegundos) e rejeita live_mode ou assinaturas forjadas", () => {
    process.env.BILLING_PROVIDER_MODE = "internal_sandbox_simulator";
    process.env.BILLING_WEBHOOK_SANDBOX_SECRET =
      "4b7e1c9d0a2f58e3b6c1d4a7e9f20358a6c9d1e4f7b2a5c8d0e3f6a9b1c4d7e2";
    const provider = new MercadoPagoBillingProvider();
    const dataId = "MP-AUTHPAY-SBX-001";
    const xRequestId = "req-billing-test-01";
    const tsSec = Math.floor(Date.now() / 1000);
    const sigSec = buildBillingWebhookSignature({
      dataId,
      xRequestId,
      timestampSeconds: tsSec,
    });

    const body = JSON.stringify({
      id: "evt-billing-001",
      type: "subscription_authorized_payment",
      action: "payment.approved",
      live_mode: false,
      data: { id: dataId },
    });

    const verifiedSec = provider.validateWebhookSignature({
      headers: { "x-signature": sigSec, "x-request-id": xRequestId },
      query: { "data.id": dataId },
      rawBody: body,
    });
    expect(verifiedSec.externalEventId).toBe("evt-billing-001");
    expect(verifiedSec.resourceType).toBe("subscription_authorized_payment");
    expect(verifiedSec.signatureVerified).toBe(true);

    // Fase 6E.2C: timestamp em milissegundos (13 dígitos, padrão oficial Mercado Pago)
    const tsMs = Date.now();
    const sigMs = buildBillingWebhookSignature({
      dataId,
      xRequestId,
      timestampSeconds: tsMs,
    });
    const verifiedMs = provider.validateWebhookSignature({
      headers: { "x-signature": sigMs, "x-request-id": xRequestId },
      query: { "data.id": dataId },
      rawBody: body,
    });
    expect(verifiedMs.signatureVerified).toBe(true);
    expect(verifiedMs.authMethod).toBe("hmac_sha256");

    // Assinatura adulterada -> rejeitada
    expect(() =>
      provider.validateWebhookSignature({
        headers: { "x-signature": `ts=${tsSec},v1=${"0".repeat(64)}`, "x-request-id": xRequestId },
        query: { "data.id": dataId },
        rawBody: body,
      })
    ).toThrow(/inválida/i);

    // live_mode=true -> bloqueado fail-closed
    expect(() =>
      provider.validateWebhookSignature({
        headers: { "x-signature": sigSec, "x-request-id": xRequestId },
        query: { "data.id": dataId },
        rawBody: JSON.stringify({ id: "evt-live", live_mode: true, data: { id: dataId } }),
      })
    ).toThrow(/live_mode/i);
  });
});
