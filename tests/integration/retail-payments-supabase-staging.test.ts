import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { RetailPaymentService } from "@/modules/retail/services/retail-payment-service";
import {
  buildMercadoPagoWebhookSignature,
  MercadoPagoSandboxProvider,
} from "@/modules/retail/payments/providers/mercado-pago-sandbox.provider";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type AppClient = SupabaseClient<Database>;

const RUN_ID = `pay6d-${Date.now()}`;
const TEST_PASSWORD = "Pay6dStaging@2026!#";

function makeClient(): AppClient {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe("Fase 6D — Homologação PostgreSQL/Supabase Cloud Staging: Pagamentos, RLS, Webhooks, Conciliação e Estornos", () => {
  let adminClient: AppClient;
  let anonClient: AppClient;

  let tenantAId: string;
  let tenantBId: string;
  let storeAId: string;
  let storeASlug: string;
  let storeBId: string;
  let storeBSlug: string;
  let productAId: string;
  let variantAId: string;

  let ownerA: { id: string; client: AppClient };
  let managerA: { id: string; client: AppClient };
  let staffA: { id: string; client: AppClient };
  let ownerB: { id: string; client: AppClient };
  let platformAdmin: { id: string; client: AppClient };

  const cleanupUserIds: string[] = [];
  const cleanupTenantIds: string[] = [];

  const tenantAWebhookSecret = "sandbox_hmac_staging_tenant_a_2026";
  const tenantBWebhookSecret = "sandbox_hmac_staging_tenant_b_2026";

  async function createAndSignIn(email: string, fullName: string) {
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !created.user) {
      throw new Error(`Falha ao criar usuário ${email}: ${error?.message}`);
    }
    cleanupUserIds.push(created.user.id);

    const client = makeClient();
    const { error: signErr } = await client.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });
    if (signErr) {
      throw new Error(`Falha ao autenticar ${email}: ${signErr.message}`);
    }

    return { id: created.user.id, client };
  }

  beforeAll(async () => {
    adminClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonClient = makeClient();

    storeASlug = `pay-a-${RUN_ID}`;
    storeBSlug = `pay-b-${RUN_ID}`;

    const [{ data: tA, error: eA }, { data: tB, error: eB }] = await Promise.all([
      adminClient
        .from("tenants")
        .insert({ name: `Loja Pay A ${RUN_ID}`, slug: storeASlug, status: "active" })
        .select()
        .single(),
      adminClient
        .from("tenants")
        .insert({ name: `Loja Pay B ${RUN_ID}`, slug: storeBSlug, status: "active" })
        .select()
        .single(),
    ]);

    if (eA || !tA || eB || !tB) {
      throw new Error(
        `Falha ao criar tenants de homologação 6D: eA=${eA?.message} eB=${eB?.message} url=${SUPABASE_URL}`
      );
    }

    tenantAId = tA.id;
    tenantBId = tB.id;
    cleanupTenantIds.push(tenantAId, tenantBId);

    [ownerA, managerA, staffA, ownerB, platformAdmin] = await Promise.all([
      createAndSignIn(`owner.a.${RUN_ID}@test.local`, "Owner Loja A"),
      createAndSignIn(`manager.a.${RUN_ID}@test.local`, "Manager Loja A"),
      createAndSignIn(`staff.a.${RUN_ID}@test.local`, "Staff Loja A"),
      createAndSignIn(`owner.b.${RUN_ID}@test.local`, "Owner Loja B"),
      createAndSignIn(`padmin.${RUN_ID}@test.local`, "Platform Admin DevEssent"),
    ]);

    await adminClient.from("platform_admins").insert({ user_id: platformAdmin.id });

    await adminClient.from("tenant_memberships").insert([
      { tenant_id: tenantAId, user_id: ownerA.id, role: "owner" },
      { tenant_id: tenantAId, user_id: managerA.id, role: "manager" },
      { tenant_id: tenantAId, user_id: staffA.id, role: "staff" },
      { tenant_id: tenantBId, user_id: ownerB.id, role: "owner" },
    ]);

    const [{ data: sA }, { data: sB }] = await Promise.all([
      adminClient
        .from("retail_stores")
        .insert({
          tenant_id: tenantAId,
          store_name: "Atelier A Finanças",
          slug: storeASlug,
          currency: "BRL",
          is_active: true,
          inventory_mode: "track_quantity",
        })
        .select()
        .single(),
      adminClient
        .from("retail_stores")
        .insert({
          tenant_id: tenantBId,
          store_name: "Botânica B Finanças",
          slug: storeBSlug,
          currency: "BRL",
          is_active: true,
          inventory_mode: "track_quantity",
        })
        .select()
        .single(),
    ]);

    storeAId = sA!.id;
    storeBId = sB!.id;

    const { data: prodA } = await adminClient
      .from("retail_products")
      .insert({
        tenant_id: tenantAId,
        name: "Casaco Alfaiataria 6D",
        slug: `casaco-6d-${RUN_ID}`,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    productAId = prodA!.id;

    const { data: vA } = await adminClient
      .from("retail_variants")
      .insert({
        tenant_id: tenantAId,
        product_id: productAId,
        sku: `SKU-6D-${RUN_ID}`,
        name: "Tamanho M",
        price_cents: 15000,
        stock_quantity: 5,
        is_available: true,
      })
      .select()
      .single();
    variantAId = vA!.id;
  }, 60000);

  afterAll(async () => {
    for (const tId of cleanupTenantIds) {
      await adminClient.from("retail_payment_events").delete().eq("tenant_id", tId);
      await adminClient.from("retail_payment_attempts").delete().eq("tenant_id", tId);
      await adminClient.from("retail_payments").delete().eq("tenant_id", tId);
      await adminClient.from("retail_payment_connections").delete().eq("tenant_id", tId);
      await adminClient.from("retail_orders").delete().eq("tenant_id", tId);
      await adminClient.from("tenants").delete().eq("id", tId);
    }
    if (platformAdmin?.id) {
      await adminClient.from("platform_admins").delete().eq("user_id", platformAdmin.id);
    }
    for (const uId of cleanupUserIds) {
      await adminClient.auth.admin.deleteUser(uId);
    }
  }, 60000);

  it("1. Isolamento de Credenciais e Conexão por Estabelecimento: apenas platform_admin conecta contas Sandbox e tokens criptografados jamais vazam via PostgREST", async () => {
    // Owner não pode conectar credenciais técnicas
    await expect(
      RetailPaymentService.connectSellerAccount({
        supabase: ownerA.client,
        actorUserId: ownerA.id,
        actorRole: "owner",
        rawInput: {
          tenantId: tenantAId,
          provider: "mercado_pago",
          environment: "sandbox",
          sellerAccountId: "MP-SELLER-A",
          sellerAccountLabel: "Atelier A Recebimentos",
          accessToken: "TEST-DEVESSENT-SANDBOX-TOKEN-LOJA-A-001",
          webhookSecret: tenantAWebhookSecret,
        },
      })
    ).rejects.toThrow(/DevEssent|Platform Admin/i);

    // Platform Admin tentando usar token live é bloqueado (Fail-Closed)
    await expect(
      RetailPaymentService.connectSellerAccount({
        supabase: platformAdmin.client,
        actorUserId: platformAdmin.id,
        actorRole: "platform_admin",
        rawInput: {
          tenantId: tenantAId,
          provider: "mercado_pago",
          environment: "sandbox",
          sellerAccountId: "MP-SELLER-A",
          sellerAccountLabel: "Atelier A Recebimentos",
          accessToken: "APP_USR_LIVE_999888777666555",
          webhookSecret: tenantAWebhookSecret,
        },
      })
    ).rejects.toThrow(/FAIL-CLOSED|produção/i);

    // Platform Admin conecta contas Sandbox isoladas para Loja A e Loja B
    const summaryA = await RetailPaymentService.connectSellerAccount({
      supabase: platformAdmin.client,
      actorUserId: platformAdmin.id,
      actorRole: "platform_admin",
      rawInput: {
        tenantId: tenantAId,
        provider: "mercado_pago",
        environment: "sandbox",
        sellerAccountId: "MP-SELLER-LOJA-A",
        sellerAccountLabel: "Atelier A Recebimentos",
        accessToken: "TEST-DEVESSENT-SANDBOX-TOKEN-LOJA-A-001",
        webhookSecret: tenantAWebhookSecret,
      },
    });
    expect(summaryA.status).toBe("connected");
    expect(summaryA.sellerAccountId).toBe("MP-SELLER-LOJA-A");

    const summaryB = await RetailPaymentService.connectSellerAccount({
      supabase: platformAdmin.client,
      actorUserId: platformAdmin.id,
      actorRole: "platform_admin",
      rawInput: {
        tenantId: tenantBId,
        provider: "mercado_pago",
        environment: "sandbox",
        sellerAccountId: "MP-SELLER-LOJA-B",
        sellerAccountLabel: "Botânica B Recebimentos",
        accessToken: "TEST-DEVESSENT-SANDBOX-TOKEN-LOJA-B-002",
        webhookSecret: tenantBWebhookSecret,
      },
    });
    expect(summaryB.status).toBe("connected");
    expect(summaryB.sellerAccountId).toBe("MP-SELLER-LOJA-B");

    // Leitura direta da tabela retail_payment_connections bloqueada para anon, staff, owner e manager (proteção das colunas *_encrypted)
    const { data: directOwnerSelect, error: directOwnerErr } = await ownerA.client
      .from("retail_payment_connections")
      .select("*");
    expect(directOwnerErr !== null || (directOwnerSelect ?? []).length === 0).toBe(true);

    // Verifica no banco via service_role que os tokens estão criptografados com AES-256-GCM (prefixo v1:)
    const { data: rawConnA } = await adminClient
      .from("retail_payment_connections")
      .select("access_token_encrypted, webhook_secret_encrypted")
      .eq("tenant_id", tenantAId)
      .single();
    expect(rawConnA?.access_token_encrypted?.startsWith("v1:")).toBe(true);
    expect(rawConnA?.access_token_encrypted).not.toContain("TEST-DEVESSENT-SANDBOX");
    expect(rawConnA?.webhook_secret_encrypted?.startsWith("v1:")).toBe(true);

    // RPC get_retail_payment_connection_summary funciona para ownerA e managerA no próprio tenant, mas bloqueia staffA, anon e ownerB
    const { data: rpcOwnerA, error: rpcOwnerAErr } = await ownerA.client.rpc(
      "get_retail_payment_connection_summary",
      { p_tenant_id: tenantAId }
    );
    expect(rpcOwnerAErr).toBeNull();
    expect(rpcOwnerA?.[0]?.seller_account_id).toBe("MP-SELLER-LOJA-A");

    const { error: rpcStaffErr } = await staffA.client.rpc(
      "get_retail_payment_connection_summary",
      { p_tenant_id: tenantAId }
    );
    expect(rpcStaffErr).not.toBeNull();
    expect(rpcStaffErr?.message).toMatch(/FORBIDDEN/i);

    const { error: rpcCrossTenantErr } = await ownerB.client.rpc(
      "get_retail_payment_connection_summary",
      { p_tenant_id: tenantAId }
    );
    expect(rpcCrossTenantErr).not.toBeNull();
    expect(rpcCrossTenantErr?.message).toMatch(/FORBIDDEN/i);
  });

  it("2. Pré-requisitos de Pedido, Frete Determinístico e Invalidação de Sessão Pendente ao Alterar Frete (§7 e §8)", async () => {
    // Cria pedido delivery em estado requested (subtotal = 15000, shipping_fee_cents = null)
    const { data: orderRow, error: orderErr } = await adminClient
      .from("retail_orders")
      .insert({
        tenant_id: tenantAId,
        store_id: storeAId,
        order_number: `PED-6D-001-${RUN_ID.slice(-4)}`,
        public_token_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        status: "requested",
        payment_status: "not_started",
        channel: "storefront",
        currency: "BRL",
        subtotal_cents: 15000,
        shipping_fee_cents: null,
        discount_cents: 0,
        total_cents: 15000,
        customer_name: "Mariana Costa",
        customer_phone: "11999990001",
        customer_email: "mariana@cliente.local",
        delivery_mode: "delivery",
        delivery_address: "Rua Oscar Freire, 1000",
      })
      .select()
      .single();
    expect(orderErr).toBeNull();
    const orderId = orderRow!.id;

    await adminClient.from("retail_order_items").insert({
      order_id: orderId,
      tenant_id: tenantAId,
      product_id: productAId,
      variant_id: variantAId,
      product_name_snapshot: "Casaco Alfaiataria 6D",
      variant_name_snapshot: "Tamanho M",
      sku_snapshot: `SKU-6D-${RUN_ID}`,
      unit_price_cents: 15000,
      quantity: 1,
      line_total_cents: 15000,
    });

    const contextOwnerA = {
      userId: ownerA.id,
      tenantId: tenantAId,
      tenantName: `Loja Pay A ${RUN_ID}`,
      slug: storeASlug,
      status: "active" as const,
      role: "owner" as const,
    };

    // 2.1 Pedido em 'requested' NÃO pode gerar link de pagamento nem iniciar sessão
    await expect(
      RetailPaymentService.generateOrderPaymentShareLink({
        supabase: ownerA.client,
        context: contextOwnerA,
        orderId,
      })
    ).rejects.toThrow(/aguarda confirmação/i);

    // 2.2 Confirma o pedido (baixa estoque de 5 para 4)
    const { error: confirmErr } = await ownerA.client.rpc("confirm_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: orderId,
      p_actor_user_id: ownerA.id,
      p_actor_name: "Owner Loja A",
      p_reason: "Confirmado para teste 6D",
    });
    expect(confirmErr).toBeNull();

    // 2.3 Pedido confirmado com delivery_mode='delivery' mas sem frete definido ainda bloqueia pagamento
    await expect(
      RetailPaymentService.generateOrderPaymentShareLink({
        supabase: ownerA.client,
        context: contextOwnerA,
        orderId,
      })
    ).rejects.toThrow(/frete/i);

    // 2.4 Staff e Owner de outro tenant NÃO podem definir frete
    const { error: staffShipErr } = await staffA.client.rpc(
      "set_retail_order_shipping_fee",
      {
        p_tenant_id: tenantAId,
        p_order_id: orderId,
        p_shipping_fee_cents: 2500,
        p_actor_user_id: staffA.id,
        p_actor_name: "Staff A",
      }
    );
    expect(staffShipErr).not.toBeNull();
    expect(staffShipErr?.message).toMatch(/FORBIDDEN/i);

    // 2.5 Owner A define frete determinístico de R$ 25,00 (2500 centavos) -> total passa para 17500
    const updatedOrder = await RetailPaymentService.setOrderShippingFee({
      supabase: ownerA.client,
      context: contextOwnerA,
      actorName: "Owner Loja A",
      rawInput: {
        orderId,
        shippingFeeCents: 2500,
      },
    });
    expect(updatedOrder.shippingFeeCents).toBe(2500);
    expect(updatedOrder.totalCents).toBe(17500);

    // 2.6 Emite link opaco de pagamento e inicia sessão #1
    const shareLink = await RetailPaymentService.generateOrderPaymentShareLink({
      supabase: ownerA.client,
      context: contextOwnerA,
      orderId,
    });
    expect(shareLink.shareToken.length).toBeGreaterThanOrEqual(32);

    const shareView = await RetailPaymentService.getPublicPaymentShareView({
      storeSlug: storeASlug,
      shareToken: shareLink.shareToken,
    });
    expect(shareView).not.toBeNull();
    expect(shareView?.customerFirstName).toBe("Mariana C.");
    expect(shareView?.totalCents).toBe(17500);
    expect(shareView?.canInitiatePayment).toBe(true);

    const session1 = await RetailPaymentService.initiatePaymentSessionByShareToken({
      storeSlug: storeASlug,
      shareToken: shareLink.shareToken,
      idempotencyKey: `idem_sess1_${RUN_ID}`,
      appBaseUrl: "http://localhost:3000",
    });
    expect(session1.paymentId).toBeDefined();

    // 2.7 Se o lojista alterar o frete para R$ 30,00 (3000 centavos) antes do pagamento, a sessão pendente anterior é invalidada!
    const orderAfterNewShipping = await RetailPaymentService.setOrderShippingFee({
      supabase: ownerA.client,
      context: contextOwnerA,
      actorName: "Owner Loja A",
      rawInput: {
        orderId,
        shippingFeeCents: 3000,
      },
    });
    expect(orderAfterNewShipping.totalCents).toBe(18000);
    expect(orderAfterNewShipping.paymentStatus).toBe("not_started");

    const { data: cancelledPay } = await ownerA.client
      .from("retail_payments")
      .select("status")
      .eq("id", session1.paymentId)
      .single();
    expect(cancelledPay?.status).toBe("cancelled");
  });

  it("3. Fluxo Completo de Pagamento, Webhooks HMAC-SHA256, Divergências, Idempotência, Fora de Ordem, Estorno Confirmado e Proteção de Estoque", async () => {
    const contextOwnerA = {
      userId: ownerA.id,
      tenantId: tenantAId,
      tenantName: `Loja Pay A ${RUN_ID}`,
      slug: storeASlug,
      status: "active" as const,
      role: "owner" as const,
    };

    const { data: orders } = await ownerA.client
      .from("retail_orders")
      .select("*")
      .eq("tenant_id", tenantAId)
      .limit(1);
    const order = orders![0];
    expect(order.total_cents).toBe(18000);

    // 3.1 Emite novo link opaco e inicia sessão de pagamento com o total atualizado (18000 centavos)
    const shareLink = await RetailPaymentService.generateOrderPaymentShareLink({
      supabase: ownerA.client,
      context: contextOwnerA,
      orderId: order.id,
    });

    const session = await RetailPaymentService.initiatePaymentSessionByShareToken({
      storeSlug: storeASlug,
      shareToken: shareLink.shareToken,
      idempotencyKey: `idem_sess2_${RUN_ID}`,
      appBaseUrl: "http://localhost:3000",
    });

    // Idempotência: mesma chave retorna exatamente o mesmo paymentId sem duplicar tentativas
    const sessionDup = await RetailPaymentService.initiatePaymentSessionByShareToken({
      storeSlug: storeASlug,
      shareToken: shareLink.shareToken,
      idempotencyKey: `idem_sess2_${RUN_ID}`,
      appBaseUrl: "http://localhost:3000",
    });
    expect(sessionDup.paymentId).toBe(session.paymentId);

    // 3.2 Webhook com assinatura HMAC inválida é rejeitado com UnauthorizedError
    await expect(
      RetailPaymentService.processWebhookNotification({
        providerName: "mercado_pago",
        headers: {
          "x-signature": "ts=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000",
          "x-request-id": "req_forged_001",
        },
        query: {
          "data.id": "mp_forged_999",
          tenant_id: tenantAId,
          order_id: order.id,
        },
        rawBody: JSON.stringify({
          id: "evt_forged_1",
          action: "payment.updated",
          data: { id: "mp_forged_999" },
        }),
      })
    ).rejects.toThrow(/assinatura|janela temporal|HMAC/i);

    // 3.3 Webhook assinado mas com DIVERGÊNCIA DE VALOR (ex.: 9900 em vez de 18000) é bloqueado (rejected_divergence) e NÃO baixa pagamento!
    const divRes = await RetailPaymentService.simulateSandboxProviderOutcome({
      tenantId: tenantAId,
      orderId: order.id,
      outcome: "approved",
      overrideAmountCents: 9900,
      customExternalPaymentId: `mp_div_amt_${RUN_ID}`,
      customExternalEventId: `evt_div_amt_${RUN_ID}`,
    });
    expect(divRes.processingResult).toBe("rejected_divergence");

    const { data: orderAfterDiv } = await ownerA.client
      .from("retail_orders")
      .select("payment_status, paid_amount_cents")
      .eq("id", order.id)
      .single();
    expect(orderAfterDiv?.payment_status).toBe("pending");
    expect(orderAfterDiv?.paid_amount_cents).toBe(0);

    // 3.4 Webhook assinado mas com DIVERGÊNCIA DE CONTA RECEBEDORA (seller_account_id de outro tenant) é bloqueado!
    const divSellerRes = await RetailPaymentService.simulateSandboxProviderOutcome({
      tenantId: tenantAId,
      orderId: order.id,
      outcome: "approved",
      overrideSellerAccountId: "MP-SELLER-LOJA-B",
      customExternalPaymentId: `mp_div_seller_${RUN_ID}`,
      customExternalEventId: `evt_div_seller_${RUN_ID}`,
    });
    expect(divSellerRes.processingResult).toBe("rejected_divergence");

    // 3.5 Webhook assinado e autoritativamente APROVADO com valor, moeda, referência e sellerAccountId corretos
    const approvedPayId = `mp_ok_${RUN_ID}`;
    const approvedEvtId = `evt_ok_${RUN_ID}`;
    const okRes = await RetailPaymentService.simulateSandboxProviderOutcome({
      tenantId: tenantAId,
      orderId: order.id,
      outcome: "approved",
      paymentMethod: "pix",
      customExternalPaymentId: approvedPayId,
      customExternalEventId: approvedEvtId,
    });
    expect(okRes.processingResult).toBe("processed");
    expect(okRes.paymentStatus).toBe("paid");

    // Verifica que payment_status passou para 'paid', MAS o status operacional do pedido permaneceu 'confirmed' (nunca 'completed' automaticamente!)
    const { data: orderAfterPaid } = await ownerA.client
      .from("retail_orders")
      .select("status, payment_status, paid_amount_cents")
      .eq("id", order.id)
      .single();
    expect(orderAfterPaid?.payment_status).toBe("paid");
    expect(orderAfterPaid?.paid_amount_cents).toBe(18000);
    expect(orderAfterPaid?.status).toBe("confirmed");

    // 3.6 Webhook DUPLICADO (mesmo externalEventId) é ignorado com idempotência ('ignored_duplicate')
    const xRequestIdDup = "req_dup_test_01";
    const tsDup = Math.floor(Date.now() / 1000);
    const sigDup = buildMercadoPagoWebhookSignature({
      dataId: approvedPayId,
      xRequestId: xRequestIdDup,
      timestampSeconds: tsDup,
      webhookSecret: tenantAWebhookSecret,
    });
    const dupWebhookRes = await RetailPaymentService.processWebhookNotification({
      providerName: "mercado_pago",
      headers: {
        "x-signature": sigDup,
        "x-request-id": xRequestIdDup,
      },
      query: {
        "data.id": approvedPayId,
        tenant_id: tenantAId,
        order_id: order.id,
      },
      rawBody: JSON.stringify({
        id: approvedEvtId,
        action: "payment.updated",
        data: { id: approvedPayId },
      }),
    });
    expect(dupWebhookRes.processingResult).toBe("ignored_duplicate");

    // 3.7 Webhook FORA DE ORDEM (tentativa de regredir pagamento 'paid' para 'rejected'/'failed') é ignorado ('ignored_out_of_order')
    const outOfOrderRes = await RetailPaymentService.simulateSandboxProviderOutcome({
      tenantId: tenantAId,
      orderId: order.id,
      outcome: "rejected",
      customExternalPaymentId: approvedPayId,
      customExternalEventId: `evt_out_of_order_${RUN_ID}`,
    });
    expect(outOfOrderRes.processingResult).toBe("ignored_out_of_order");

    const { data: orderStillPaid } = await ownerA.client
      .from("retail_orders")
      .select("payment_status")
      .eq("id", order.id)
      .single();
    expect(orderStillPaid?.payment_status).toBe("paid");

    // 3.8 Isolamento Multiempresa e RBAC nas tabelas financeiras:
    // Staff A e Owner B (outro tenant) não enxergam pagamentos, tentativas ou eventos da Loja A
    const { data: staffPayments } = await staffA.client
      .from("retail_payments")
      .select("*")
      .eq("tenant_id", tenantAId);
    expect(staffPayments ?? []).toHaveLength(0);

    const { data: ownerBPayments } = await ownerB.client
      .from("retail_payments")
      .select("*")
      .eq("tenant_id", tenantAId);
    expect(ownerBPayments ?? []).toHaveLength(0);

    // 3.9 Proteção contra cancelamento operacional de pedido já pago (impede liberação indevida de estoque)
    const { error: cancelPaidErr } = await ownerA.client.rpc("cancel_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: order.id,
      p_actor_user_id: ownerA.id,
      p_actor_name: "Owner Loja A",
      p_reason: "Tentativa de cancelar pedido pago sem estorno",
    });
    expect(cancelPaidErr).not.toBeNull();
    expect(cancelPaidErr?.message).toMatch(/PAYMENT_ALREADY_PAID/i);

    // 3.10 Estorno Parcial Confirmado (R$ 50,00 = 5000 centavos) -> status 'partially_refunded'
    // Re-seed a transação simulada como 'paid' para que o provedor aprove o estorno
    MercadoPagoSandboxProvider.seedSimulatedTransaction({
      externalPaymentId: approvedPayId,
      externalPreferenceId: "MP-PREF-SBX",
      externalReference: `devessent:t:${tenantAId}:o:${order.id}:n:${order.order_number}`,
      sellerAccountId: "MP-SELLER-LOJA-A",
      status: "paid",
      amountCents: 18000,
      refundedAmountCents: 0,
      currency: "BRL",
      paymentMethod: "pix",
      approvedAt: new Date().toISOString(),
      failureCode: null,
      failureReason: null,
    });

    const partialRefund = await RetailPaymentService.requestConfirmedRefund({
      supabase: ownerA.client,
      context: contextOwnerA,
      actorName: "Owner Loja A",
      rawInput: {
        paymentId: session.paymentId,
        refundAmountCents: 5000,
        reason: "Desconto comercial pós-venda",
      },
      idempotencyKey: `idem_ref_part_${RUN_ID}`,
    });
    expect(partialRefund.status).toBe("partially_refunded");
    expect(partialRefund.refundedAmountCents).toBe(5000);

    // Métricas financeiras refletem bruto confirmado (18000) - estornado (5000) = líquido (13000)
    const statsAfterPartial = await RetailPaymentService.getPaymentStats({
      supabase: ownerA.client,
      context: contextOwnerA,
    });
    expect(statsAfterPartial.grossConfirmedCents).toBe(18000);
    expect(statsAfterPartial.refundedCents).toBe(5000);
    expect(statsAfterPartial.netReceivedCents).toBe(13000);

    // 3.11 Estorno Restante (R$ 130,00 = 13000 centavos) -> status 'refunded'
    const fullRefund = await RetailPaymentService.requestConfirmedRefund({
      supabase: ownerA.client,
      context: contextOwnerA,
      actorName: "Owner Loja A",
      rawInput: {
        paymentId: session.paymentId,
        refundAmountCents: 13000,
        reason: "Cancelamento integral solicitado pelo cliente",
      },
      idempotencyKey: `idem_ref_full_${RUN_ID}`,
    });
    expect(fullRefund.status).toBe("refunded");
    expect(fullRefund.refundedAmountCents).toBe(18000);

    // Verifica que o estorno financeiro NÃO repôs o estoque sozinho (estoque continua 4)
    const { data: varBeforeCancel } = await adminClient
      .from("retail_variants")
      .select("stock_quantity")
      .eq("id", variantAId)
      .single();
    expect(varBeforeCancel?.stock_quantity).toBe(4);

    // Agora que o pedido está integralmente reembolsado ('refunded'), o cancelamento operacional é permitido e repõe o estoque uma única vez (4 -> 5)
    const { error: cancelAfterRefundErr } = await ownerA.client.rpc(
      "cancel_retail_order",
      {
        p_tenant_id: tenantAId,
        p_order_id: order.id,
        p_actor_user_id: ownerA.id,
        p_actor_name: "Owner Loja A",
        p_reason: "Cancelado após reembolso integral confirmado",
      }
    );
    expect(cancelAfterRefundErr).toBeNull();

    const { data: varAfterCancel } = await adminClient
      .from("retail_variants")
      .select("stock_quantity")
      .eq("id", variantAId)
      .single();
    expect(varAfterCancel?.stock_quantity).toBe(5);
  }, 60000);

  it("4. Aprovação Tardia em Pedido Já Cancelado: registra alerta LATE_APPROVAL_ON_CANCELLED_ORDER sem rebaixar estoque (§11 e §17)", async () => {
    const contextOwnerA = {
      userId: ownerA.id,
      tenantId: tenantAId,
      tenantName: `Loja Pay A ${RUN_ID}`,
      slug: storeASlug,
      status: "active" as const,
      role: "owner" as const,
    };

    const { data: lateOrder } = await adminClient
      .from("retail_orders")
      .insert({
        tenant_id: tenantAId,
        store_id: storeAId,
        order_number: `PED-6D-LATE-${RUN_ID.slice(-4)}`,
        public_token_hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        status: "requested",
        payment_status: "not_started",
        channel: "storefront",
        currency: "BRL",
        subtotal_cents: 15000,
        shipping_fee_cents: 0,
        discount_cents: 0,
        total_cents: 15000,
        customer_name: "Carlos Eduardo",
        customer_phone: "11999990002",
        delivery_mode: "pickup",
      })
      .select()
      .single();

    await adminClient.from("retail_order_items").insert({
      order_id: lateOrder!.id,
      tenant_id: tenantAId,
      product_id: productAId,
      variant_id: variantAId,
      product_name_snapshot: "Casaco Alfaiataria 6D",
      variant_name_snapshot: "Tamanho M",
      sku_snapshot: `SKU-6D-${RUN_ID}`,
      unit_price_cents: 15000,
      quantity: 1,
      line_total_cents: 15000,
    });

    // Confirma o pedido (estoque 5 -> 4)
    await ownerA.client.rpc("confirm_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: lateOrder!.id,
      p_actor_user_id: ownerA.id,
      p_actor_name: "Owner Loja A",
      p_reason: "Confirmação para teste de aprovação tardia",
    });

    // Inicia sessão de pagamento (status = pending)
    const shareLink = await RetailPaymentService.generateOrderPaymentShareLink({
      supabase: ownerA.client,
      context: contextOwnerA,
      orderId: lateOrder!.id,
    });
    const session = await RetailPaymentService.initiatePaymentSessionByShareToken({
      storeSlug: storeASlug,
      shareToken: shareLink.shareToken,
      idempotencyKey: `idem_late_${RUN_ID}`,
      appBaseUrl: "http://localhost:3000",
    });

    // Cancela o pedido operacionalmente enquanto o pagamento ainda estava 'pending' (estoque retorna 4 -> 5)
    const { error: cancelPendingErr } = await ownerA.client.rpc("cancel_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: lateOrder!.id,
      p_actor_user_id: ownerA.id,
      p_actor_name: "Owner Loja A",
      p_reason: "Cliente desistiu antes da compensação",
    });
    expect(cancelPendingErr).toBeNull();

    // Chega um webhook tardio de aprovação ('approved') do provedor após o pedido já estar cancelado
    const lateRes = await RetailPaymentService.simulateSandboxProviderOutcome({
      tenantId: tenantAId,
      orderId: lateOrder!.id,
      outcome: "approved",
      customExternalPaymentId: `mp_late_${RUN_ID}`,
      customExternalEventId: `evt_late_${RUN_ID}`,
    });
    expect(lateRes.processingResult).toBe("processed");

    const { data: latePaymentRow } = await ownerA.client
      .from("retail_payments")
      .select("status, divergence_alert")
      .eq("id", session.paymentId)
      .single();
    expect(latePaymentRow?.status).toBe("paid");
    expect(latePaymentRow?.divergence_alert).toMatch(/LATE_APPROVAL_ON_CANCELLED_ORDER/i);

    // Estoque permanece 5 (não houve rebaixa indevida)
    const { data: varFinal } = await adminClient
      .from("retail_variants")
      .select("stock_quantity")
      .eq("id", variantAId)
      .single();
    expect(varFinal?.stock_quantity).toBe(5);
  }, 60000);
});
