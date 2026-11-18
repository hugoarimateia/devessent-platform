import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "@/modules/retail/services/retail-cart-cookie";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type AppClient = SupabaseClient<Database>;

const RUN_ID = `ordsec-${Date.now()}`;
const TEST_PASSWORD = "OrderSecTest@2026!#";

function makeClient(): AppClient {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe("Fase 6C.1 — Homologação PostgreSQL/Supabase: RLS, RPC Spoofing, Isolamento e Concorrência", () => {
  let adminClient: AppClient;
  let anonClient: AppClient;

  let tenantAId: string;
  let tenantBId: string;
  let tenantSuspId: string;
  let storeAId: string;
  let storeASlug: string;
  let storeBId: string;
  let productAId: string;
  let singleStockVariantId: string;
  let multiStockVariantId: string;

  let ownerA: { id: string; client: AppClient };
  let managerA: { id: string; client: AppClient };
  let staffA: { id: string; client: AppClient };
  let ownerB: { id: string; client: AppClient };
  let platformAdmin: { id: string; client: AppClient };

  const cleanupUserIds: string[] = [];
  const cleanupTenantIds: string[] = [];

  async function createAndSignIn(email: string, fullName: string) {
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !created.user) throw new Error(`Falha ao criar usuário ${email}: ${error?.message}`);
    cleanupUserIds.push(created.user.id);

    const client = makeClient();
    const { error: signErr } = await client.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });
    if (signErr) throw new Error(`Falha ao autenticar ${email}: ${signErr.message}`);

    return { id: created.user.id, client };
  }

  beforeAll(async () => {
    adminClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonClient = makeClient();

    storeASlug = `store-a-${RUN_ID}`;

    const [{ data: tA }, { data: tB }, { data: tSusp }] = await Promise.all([
      adminClient.from("tenants").insert({ name: `Loja A ${RUN_ID}`, slug: storeASlug, status: "active" }).select().single(),
      adminClient.from("tenants").insert({ name: `Loja B ${RUN_ID}`, slug: `store-b-${RUN_ID}`, status: "active" }).select().single(),
      adminClient.from("tenants").insert({ name: `Suspensa ${RUN_ID}`, slug: `susp-${RUN_ID}`, status: "suspended" }).select().single(),
    ]);

    tenantAId = tA!.id;
    tenantBId = tB!.id;
    tenantSuspId = tSusp!.id;
    cleanupTenantIds.push(tenantAId, tenantBId, tenantSuspId);

    [ownerA, managerA, staffA, ownerB, platformAdmin] = await Promise.all([
      createAndSignIn(`owner.a.${RUN_ID}@test.local`, "Owner A"),
      createAndSignIn(`manager.a.${RUN_ID}@test.local`, "Manager A"),
      createAndSignIn(`staff.a.${RUN_ID}@test.local`, "Staff A"),
      createAndSignIn(`owner.b.${RUN_ID}@test.local`, "Owner B"),
      createAndSignIn(`padmin.${RUN_ID}@test.local`, "Platform Admin"),
    ]);

    await adminClient.from("platform_admins").insert({ user_id: platformAdmin.id });

    await adminClient.from("tenant_memberships").insert([
      { tenant_id: tenantAId, user_id: ownerA.id, role: "owner" },
      { tenant_id: tenantAId, user_id: managerA.id, role: "manager" },
      { tenant_id: tenantAId, user_id: staffA.id, role: "staff" },
      { tenant_id: tenantBId, user_id: ownerB.id, role: "owner" },
      { tenant_id: tenantSuspId, user_id: ownerA.id, role: "owner" },
    ]);

    const [{ data: sA }, { data: sB }] = await Promise.all([
      adminClient.from("retail_stores").insert({
        tenant_id: tenantAId,
        store_name: "Loja A Homolog",
        slug: storeASlug,
        currency: "BRL",
        is_active: true,
        inventory_mode: "track_quantity",
      }).select().single(),
      adminClient.from("retail_stores").insert({
        tenant_id: tenantBId,
        store_name: "Loja B Homolog",
        slug: `store-b-${RUN_ID}`,
        currency: "BRL",
        is_active: true,
        inventory_mode: "track_quantity",
      }).select().single(),
    ]);
    storeAId = sA!.id;
    storeBId = sB!.id;

    await adminClient.from("retail_stores").insert({
      tenant_id: tenantSuspId,
      store_name: "Loja Suspensa",
      slug: `susp-${RUN_ID}`,
      currency: "BRL",
      is_active: true,
    });

    const { data: prodA } = await adminClient.from("retail_products").insert({
      tenant_id: tenantAId,
      name: "Peça Homolog 6C.1",
      slug: `peca-6c1-${RUN_ID}`,
      status: "published",
      published_at: new Date().toISOString(),
    }).select().single();
    productAId = prodA!.id;

    const [{ data: v1 }, { data: v2 }] = await Promise.all([
      adminClient.from("retail_variants").insert({
        tenant_id: tenantAId,
        product_id: productAId,
        sku: `HOMOLOG-U-${RUN_ID}`,
        name: "Único (1 un)",
        price_cents: 19900,
        stock_quantity: 1,
        is_available: true,
      }).select().single(),
      adminClient.from("retail_variants").insert({
        tenant_id: tenantAId,
        product_id: productAId,
        sku: `HOMOLOG-M-${RUN_ID}`,
        name: "Tamanho M (4 un)",
        price_cents: 15000,
        stock_quantity: 4,
        is_available: true,
      }).select().single(),
    ]);
    singleStockVariantId = v1!.id;
    multiStockVariantId = v2!.id;
  }, 45_000);

  afterAll(async () => {
    await adminClient.from("tenants").update({ status: "active" }).eq("id", tenantSuspId);

    // Garante limpeza também na tabela platform_admins antes de remover auth users
    await adminClient.from("platform_admins").delete().eq("user_id", platformAdmin.id);
    for (const tId of cleanupTenantIds) {
      await adminClient.from("tenants").delete().eq("id", tId);
    }
    for (const uId of cleanupUserIds) {
      await adminClient.auth.admin.deleteUser(uId);
    }
  }, 45_000);

  async function seedCartAndCreateOrder(variantId: string, qty: number, customerName: string) {
    const rawCartToken = generateOpaqueToken(24);
    const cartHash = hashOpaqueToken(rawCartToken);
    const { data: cart } = await adminClient.from("retail_carts").insert({
      tenant_id: tenantAId,
      store_id: storeAId,
      cart_token_hash: cartHash,
      status: "active",
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    }).select().single();

    await adminClient.from("retail_cart_items").insert({
      cart_id: cart!.id,
      tenant_id: tenantAId,
      product_id: productAId,
      variant_id: variantId,
      quantity: qty,
    });

    const publicToken = generateOpaqueToken(24);
    const orderNumber = `PED-${generateOpaqueToken(4).toUpperCase()}`;
    const { data, error } = await adminClient.rpc("create_public_retail_order", {
      p_store_slug: storeASlug,
      p_cart_token_hash: cartHash,
      p_order_number: orderNumber,
      p_public_token_hash: hashOpaqueToken(publicToken),
      p_customer_name: customerName,
      p_customer_phone: "(11) 98888-7777",
      p_delivery_mode: "pickup",
    });

    expect(error).toBeNull();
    const res = data as unknown as { order: { id: string; subtotal_cents: number; status: string } };
    return res.order;
  }

  it("1. Bloqueia completamente acesso anônimo às 5 tabelas e às RPCs transacionais", async () => {
    for (const table of [
      "retail_carts",
      "retail_cart_items",
      "retail_orders",
      "retail_order_items",
      "retail_order_status_history",
    ] as const) {
      const { data } = await anonClient.from(table).select("*");
      expect(data ?? []).toHaveLength(0);
    }

    const fakeId = "00000000-0000-0000-0000-000000000001";
    const { error: rpcErr } = await anonClient.rpc("confirm_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: fakeId,
    });
    expect(rpcErr).not.toBeNull();

    const { error: pubRpcErr } = await anonClient.rpc("create_public_retail_order", {
      p_store_slug: storeASlug,
      p_cart_token_hash: "fake",
      p_order_number: "PED-FAIL01",
      p_public_token_hash: "fake",
      p_customer_name: "Hacker",
      p_customer_phone: "11999999999",
    });
    expect(pubRpcErr).not.toBeNull();
  });

  it("2. Impede leitura cross-tenant, leitura por staff e UPDATE direto via PostgREST", async () => {
    const order = await seedCartAndCreateOrder(multiStockVariantId, 1, "Comprador Protegido");

    // Staff da mesma loja NÃO pode consultar retail_orders nem retail_order_items
    const { data: staffOrders } = await staffA.client.from("retail_orders").select("*").eq("tenant_id", tenantAId);
    expect(staffOrders ?? []).toHaveLength(0);

    // Owner B de outra empresa NÃO pode consultar pedidos de Tenant A
    const { data: crossOrders } = await ownerB.client.from("retail_orders").select("*").eq("tenant_id", tenantAId);
    expect(crossOrders ?? []).toHaveLength(0);

    // Mesmo Owner A não pode fazer UPDATE direto via PostgREST em total_cents/status (revogado em 000012)
    const { data: directUpdate } = await ownerA.client
      .from("retail_orders")
      .update({ total_cents: 1, status: "confirmed" })
      .eq("id", order.id)
      .select("*");
    expect(directUpdate ?? []).toHaveLength(0);

    // Carrinho B não consegue enxergar ou manipular loja A
    const { data: cartsCross } = await ownerB.client.from("retail_carts").select("*").eq("store_id", storeAId);
    expect(cartsCross ?? []).toHaveLength(0);
    expect(storeBId).toBeDefined();
  });

  it("3. Bloqueia bypass via p_actor_user_id=NULL e spoofing de p_actor_user_id=ownerA nas RPCs", async () => {
    const order = await seedCartAndCreateOrder(multiStockVariantId, 1, "Alvo Spoofing");

    // Tentativa 1: staffA passando p_actor_user_id = NULL
    const { error: nullBypassErr } = await staffA.client.rpc("confirm_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: order.id,
      p_actor_user_id: null,
    });
    expect(nullBypassErr).not.toBeNull();
    expect(nullBypassErr!.message).toMatch(/FORBIDDEN/i);

    // Tentativa 2: staffA passando p_actor_user_id = ownerA.id (spoofing de identidade)
    const { error: spoofErr } = await staffA.client.rpc("confirm_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: order.id,
      p_actor_user_id: ownerA.id,
    });
    expect(spoofErr).not.toBeNull();
    expect(spoofErr!.message).toMatch(/FORBIDDEN/i);

    // Tentativa 3: ownerB (outro tenant) tentando cancelar ou transicionar pedido de Tenant A
    const { error: crossCancelErr } = await ownerB.client.rpc("cancel_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: order.id,
    });
    expect(crossCancelErr).not.toBeNull();

    // Tentativa 4: usuário autenticado tentando chamar create_public_retail_order diretamente
    const { error: createPublicErr } = await ownerA.client.rpc("create_public_retail_order", {
      p_store_slug: storeASlug,
      p_cart_token_hash: "fake",
      p_order_number: "PED-OWN001",
      p_public_token_hash: "fake",
      p_customer_name: "Owner",
      p_customer_phone: "11999999999",
    });
    expect(createPublicErr).not.toBeNull();
  });

  it("4. Concorrência real no PostgreSQL: 2 pedidos para 1 unidade permitem só 1 confirmação sem estoque negativo", async () => {
    const order1 = await seedCartAndCreateOrder(singleStockVariantId, 1, "Concorrente 1");
    const order2 = await seedCartAndCreateOrder(singleStockVariantId, 1, "Concorrente 2");

    const [res1, res2] = await Promise.all([
      ownerA.client.rpc("confirm_retail_order", {
        p_tenant_id: tenantAId,
        p_order_id: order1.id,
        p_actor_user_id: ownerA.id,
        p_actor_name: "Owner A",
      }),
      managerA.client.rpc("confirm_retail_order", {
        p_tenant_id: tenantAId,
        p_order_id: order2.id,
        p_actor_user_id: managerA.id,
        p_actor_name: "Manager A",
      }),
    ]);

    const errors = [res1.error, res2.error].filter(Boolean);
    const successes = [res1.data, res2.data].filter(Boolean);

    expect(successes).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/INSUFFICIENT_STOCK/i);

    const { data: variantAfter } = await adminClient
      .from("retail_variants")
      .select("stock_quantity")
      .eq("id", singleStockVariantId)
      .single();
    expect(variantAfter!.stock_quantity).toBe(0);

    // Cancelamento do pedido vencedor estorna exatamente 1 unidade e proíbe cancelamento repetido
    const winnerOrderId = successes[0]!.id;
    const { error: cancelOkErr } = await ownerA.client.rpc("cancel_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: winnerOrderId,
      p_actor_user_id: ownerA.id,
      p_actor_name: "Owner A",
    });
    expect(cancelOkErr).toBeNull();

    const { error: cancelAgainErr } = await ownerA.client.rpc("cancel_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: winnerOrderId,
      p_actor_user_id: ownerA.id,
      p_actor_name: "Owner A",
    });
    expect(cancelAgainErr).not.toBeNull();

    const { data: variantRestored } = await adminClient
      .from("retail_variants")
      .select("stock_quantity")
      .eq("id", singleStockVariantId)
      .single();
    expect(variantRestored!.stock_quantity).toBe(1);
  });

  it("5. Bloqueia novos pedidos em loja de tenant suspenso", async () => {
    const { error } = await adminClient.rpc("create_public_retail_order", {
      p_store_slug: `susp-${RUN_ID}`,
      p_cart_token_hash: "any",
      p_order_number: "PED-SUSP01",
      p_public_token_hash: "any",
      p_customer_name: "Bloqueado",
      p_customer_phone: "11999999999",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/STORE_UNAVAILABLE/i);
  });

  it("6. Valida transition_retail_order_status, Platform Admin e bloqueio em tenant suspenso", async () => {
    const order = await seedCartAndCreateOrder(multiStockVariantId, 1, "Ciclo Completo");

    // Staff não pode transicionar nem passando NULL nem spoofing platformAdmin.id
    const { error: staffTransErr } = await staffA.client.rpc("transition_retail_order_status", {
      p_tenant_id: tenantAId,
      p_order_id: order.id,
      p_next_status: "confirmed",
      p_actor_user_id: platformAdmin.id,
    });
    expect(staffTransErr).not.toBeNull();
    expect(staffTransErr!.message).toMatch(/FORBIDDEN/i);

    // Platform Admin consegue confirmar e avançar fluxo operacional com seu próprio auth.uid()
    const { data: confirmed, error: pConfirmErr } = await platformAdmin.client.rpc("transition_retail_order_status", {
      p_tenant_id: tenantAId,
      p_order_id: order.id,
      p_next_status: "confirmed",
      p_actor_user_id: platformAdmin.id,
      p_actor_name: "Platform Admin",
    });
    expect(pConfirmErr).toBeNull();
    expect(confirmed?.status).toBe("confirmed");

    for (const nextStatus of ["preparing", "ready", "completed"] as const) {
      const { data: stepData, error: stepErr } = await managerA.client.rpc("transition_retail_order_status", {
        p_tenant_id: tenantAId,
        p_order_id: order.id,
        p_next_status: nextStatus,
        p_actor_user_id: managerA.id,
        p_actor_name: "Manager A",
      });
      expect(stepErr).toBeNull();
      expect(stepData?.status).toBe(nextStatus);
    }

    // Pedido concluído não pode ser cancelado nem revertido
    const { error: cancelCompletedErr } = await ownerA.client.rpc("cancel_retail_order", {
      p_tenant_id: tenantAId,
      p_order_id: order.id,
      p_actor_user_id: ownerA.id,
    });
    expect(cancelCompletedErr).not.toBeNull();
    expect(cancelCompletedErr!.message).toMatch(/INVALID_TRANSITION/i);

    // Operações de RPC em tenant suspenso bloqueiam até Owner e Platform Admin
    const { error: suspConfirmErr } = await ownerA.client.rpc("confirm_retail_order", {
      p_tenant_id: tenantSuspId,
      p_order_id: "00000000-0000-0000-0000-000000000099",
      p_actor_user_id: ownerA.id,
    });
    expect(suspConfirmErr).not.toBeNull();
    expect(suspConfirmErr!.message).toMatch(/TENANT_SUSPENDED/i);

    const { error: suspAdminErr } = await platformAdmin.client.rpc("cancel_retail_order", {
      p_tenant_id: tenantSuspId,
      p_order_id: "00000000-0000-0000-0000-000000000099",
      p_actor_user_id: platformAdmin.id,
    });
    expect(suspAdminErr).not.toBeNull();
    expect(suspAdminErr!.message).toMatch(/TENANT_SUSPENDED/i);
  }, 30_000);
});
