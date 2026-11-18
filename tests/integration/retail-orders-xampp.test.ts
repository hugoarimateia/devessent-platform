import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { xamppQuery } from "@/infrastructure/xampp-test/db";
import { XamppRetailOrderAdapter } from "@/infrastructure/xampp-test/retail-order-adapter";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/core/errors/app-error";
import type { TenantContext } from "@/core/tenants/services/tenant-service";

const ATELIE_TENANT_ID = "22222222-2222-4222-8222-222222222201";
const VERDE_TENANT_ID = "22222222-2222-4222-8222-222222222202";

const MANAGER_CONTEXT: TenantContext = {
  tenantId: ATELIE_TENANT_ID,
  tenantName: "Ateliê Teste XAMPP",
  slug: "atelie-xampp",
  role: "manager",
  status: "active",
  userId: "11111111-1111-4111-8111-111111111103",
};

const STAFF_CONTEXT: TenantContext = {
  ...MANAGER_CONTEXT,
  role: "staff",
  userId: "11111111-1111-4111-8111-111111111104",
};

const VERDE_MANAGER_CONTEXT: TenantContext = {
  tenantId: VERDE_TENANT_ID,
  tenantName: "Verde Teste XAMPP",
  slug: "verde-xampp",
  role: "manager",
  status: "active",
  userId: "11111111-1111-4111-8111-111111111105",
};

describe("Fase 6C — Integração Transacional XAMPP / MariaDB (Pedidos, Estoque e Concorrência)", () => {
  const prevBackendMode = process.env.APP_BACKEND_MODE;
  const testProductId = randomUUID();
  const limitedVariantId = randomUUID();
  const secondVariantId = randomUUID();
  const createdOrderIds: string[] = [];
  const createdCartIds: string[] = [];

  beforeAll(async () => {
    process.env.APP_BACKEND_MODE = "xampp-test";
    await xamppQuery(
      `INSERT INTO retail_products (id, tenant_id, name, slug, description, status, published_at)
       VALUES (?, ?, 'Peça Transacional Teste 6C', ?, 'Produto isolado para testes de concorrência.', 'published', NOW())`,
      [testProductId, ATELIE_TENANT_ID, `peca-transacional-6c-${testProductId.slice(0, 8)}`]
    );

    await xamppQuery(
      `INSERT INTO retail_variants (id, tenant_id, product_id, sku, name, price_cents, stock_quantity, is_available, options_summary_json)
       VALUES (?, ?, ?, ?, 'Único Raro', 25000, 1, 1, '{"Tamanho":"U"}')`,
      [limitedVariantId, ATELIE_TENANT_ID, testProductId, `SKU6C-A-${limitedVariantId.slice(0, 6)}`]
    );

    await xamppQuery(
      `INSERT INTO retail_variants (id, tenant_id, product_id, sku, name, price_cents, stock_quantity, is_available, options_summary_json)
       VALUES (?, ?, ?, ?, 'Múltiplo', 12000, 5, 1, '{"Tamanho":"M"}')`,
      [secondVariantId, ATELIE_TENANT_ID, testProductId, `SKU6C-B-${secondVariantId.slice(0, 6)}`]
    );
  });

  afterAll(async () => {
    try {
      for (const ordId of createdOrderIds) {
        await xamppQuery(`DELETE FROM retail_orders WHERE id = ?`, [ordId]);
      }
      for (const cId of createdCartIds) {
        await xamppQuery(`DELETE FROM retail_carts WHERE id = ?`, [cId]);
      }
      await xamppQuery(`DELETE FROM retail_products WHERE id = ?`, [testProductId]);
      await xamppQuery(
        `UPDATE retail_stores SET inventory_mode = 'track_quantity' WHERE tenant_id = ?`,
        [ATELIE_TENANT_ID]
      );
      await xamppQuery(`UPDATE tenants SET status = 'active' WHERE id = ?`, [VERDE_TENANT_ID]);
    } finally {
      process.env.APP_BACKEND_MODE = prevBackendMode;
    }
  });

  it("1. Isolamento de carrinho entre lojas e cálculo autoritativo no servidor", async () => {
    const added = await XamppRetailOrderAdapter.addOrIncrementCartItem({
      storeSlug: "atelie-xampp",
      rawCartToken: null,
      productId: testProductId,
      variantId: secondVariantId,
      quantity: 2,
    });
    if (added.cart.id) createdCartIds.push(added.cart.id);

    expect(added.cart.itemCount).toBe(2);
    expect(added.cart.subtotalCents).toBe(24000);

    // O token da loja A não vaza itens para a loja B
    const otherStoreCart = await XamppRetailOrderAdapter.getCart("verde-xampp", added.rawToken);
    expect(otherStoreCart).not.toBeNull();
    expect(otherStoreCart?.items.length).toBe(0);
    expect(otherStoreCart?.subtotalCents).toBe(0);

    // Atualizar para 0 remove o item
    const cleared = await XamppRetailOrderAdapter.updateCartItemQuantity({
      storeSlug: "atelie-xampp",
      rawCartToken: added.rawToken,
      variantId: secondVariantId,
      quantity: 0,
    });
    expect(cleared.items.length).toBe(0);
    expect(cleared.subtotalCents).toBe(0);
  });

  it("2. Criação em requested NÃO baixa estoque + idempotencyKey evita pedido duplicado + confirmação/cancelamento restaura uma única vez", async () => {
    const cartRes = await XamppRetailOrderAdapter.addOrIncrementCartItem({
      storeSlug: "atelie-xampp",
      rawCartToken: null,
      productId: testProductId,
      variantId: secondVariantId,
      quantity: 2,
    });
    if (cartRes.cart.id) createdCartIds.push(cartRes.cart.id);

    const idemKey = `idem-${randomUUID()}`;
    const orderRes = await XamppRetailOrderAdapter.createPublicOrder({
      storeSlug: "atelie-xampp",
      rawCartToken: cartRes.rawToken,
      input: {
        customerName: "Ana Paula Teste",
        customerPhone: "(11) 98765-4321",
        customerEmail: "ana@teste.local",
        deliveryMode: "pickup",
        notes: "Retirar à tarde",
        idempotencyKey: idemKey,
      },
    });
    createdOrderIds.push(orderRes.order.id);

    expect(orderRes.order.status).toBe("requested");
    expect(orderRes.order.stockDeducted).toBe(false);
    expect(orderRes.order.subtotalCents).toBe(24000);

    // Idempotência com mesma chave retorna mesmo pedido sem duplicar
    const duplicateTry = await XamppRetailOrderAdapter.createPublicOrder({
      storeSlug: "atelie-xampp",
      rawCartToken: cartRes.rawToken,
      input: {
        customerName: "Ana Paula Teste",
        customerPhone: "(11) 98765-4321",
        deliveryMode: "pickup",
        idempotencyKey: idemKey,
      },
    });
    expect(duplicateTry.deduplicated).toBe(true);
    expect(duplicateTry.order.id).toBe(orderRes.order.id);

    // Estoque continua intacto (5 unidades) enquanto status for requested
    const [stockBefore] = await xamppQuery<Array<{ stock_quantity: number }>>(
      `SELECT stock_quantity FROM retail_variants WHERE id = ?`,
      [secondVariantId]
    );
    expect(Number(stockBefore.stock_quantity)).toBe(5);

    // Cross-tenant não pode acessar ou confirmar pedido de outro estabelecimento
    await expect(
      XamppRetailOrderAdapter.getOrderById(VERDE_MANAGER_CONTEXT, orderRes.order.id)
    ).rejects.toThrow(NotFoundError);

    // Staff não pode confirmar ou cancelar pedido
    await expect(
      XamppRetailOrderAdapter.confirmOrder({
        context: STAFF_CONTEXT,
        orderId: orderRes.order.id,
        actorName: "Staff",
      })
    ).rejects.toThrow(ForbiddenError);

    // Manager confirma pedido -> estoque cai de 5 para 3
    const confirmed = await XamppRetailOrderAdapter.confirmOrder({
      context: MANAGER_CONTEXT,
      orderId: orderRes.order.id,
      actorName: "Gestora Teste",
    });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.stockDeducted).toBe(true);

    const [stockAfterConfirm] = await xamppQuery<Array<{ stock_quantity: number }>>(
      `SELECT stock_quantity FROM retail_variants WHERE id = ?`,
      [secondVariantId]
    );
    expect(Number(stockAfterConfirm.stock_quantity)).toBe(3);

    // Cancelar pedido confirmado estorna estoque de 3 -> 5 uma única vez
    const cancelled = await XamppRetailOrderAdapter.cancelOrder({
      context: MANAGER_CONTEXT,
      orderId: orderRes.order.id,
      actorName: "Gestora Teste",
      reason: "Cliente desistiu",
    });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.stockDeducted).toBe(false);

    const [stockAfterCancel] = await xamppQuery<Array<{ stock_quantity: number }>>(
      `SELECT stock_quantity FROM retail_variants WHERE id = ?`,
      [secondVariantId]
    );
    expect(Number(stockAfterCancel.stock_quantity)).toBe(5);

    // Tentar cancelar novamente falha sem estornar duas vezes
    await expect(
      XamppRetailOrderAdapter.cancelOrder({
        context: MANAGER_CONTEXT,
        orderId: orderRes.order.id,
        actorName: "Gestora Teste",
      })
    ).rejects.toThrow(ValidationError);

    const [stockAfterDoubleCancel] = await xamppQuery<Array<{ stock_quantity: number }>>(
      `SELECT stock_quantity FROM retail_variants WHERE id = ?`,
      [secondVariantId]
    );
    expect(Number(stockAfterDoubleCancel.stock_quantity)).toBe(5);
  });

  it("3. Concorrência: 2 solicitações disputam 1 unidade; confirmação simultânea aceita apenas 1 e nunca gera estoque negativo", async () => {
    const cart1 = await XamppRetailOrderAdapter.addOrIncrementCartItem({
      storeSlug: "atelie-xampp",
      rawCartToken: null,
      productId: testProductId,
      variantId: limitedVariantId,
      quantity: 1,
    });
    if (cart1.cart.id) createdCartIds.push(cart1.cart.id);

    const cart2 = await XamppRetailOrderAdapter.addOrIncrementCartItem({
      storeSlug: "atelie-xampp",
      rawCartToken: null,
      productId: testProductId,
      variantId: limitedVariantId,
      quantity: 1,
    });
    if (cart2.cart.id) createdCartIds.push(cart2.cart.id);

    const order1 = await XamppRetailOrderAdapter.createPublicOrder({
      storeSlug: "atelie-xampp",
      rawCartToken: cart1.rawToken,
      input: {
        customerName: "Cliente Um",
        customerPhone: "(11) 91111-1111",
        deliveryMode: "pickup",
      },
    });
    const order2 = await XamppRetailOrderAdapter.createPublicOrder({
      storeSlug: "atelie-xampp",
      rawCartToken: cart2.rawToken,
      input: {
        customerName: "Cliente Dois",
        customerPhone: "(11) 92222-2222",
        deliveryMode: "pickup",
      },
    });
    createdOrderIds.push(order1.order.id, order2.order.id);

    const results = await Promise.allSettled([
      XamppRetailOrderAdapter.confirmOrder({
        context: MANAGER_CONTEXT,
        orderId: order1.order.id,
        actorName: "Gestora 1",
      }),
      XamppRetailOrderAdapter.confirmOrder({
        context: MANAGER_CONTEXT,
        orderId: order2.order.id,
        actorName: "Gestora 2",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const [finalStock] = await xamppQuery<Array<{ stock_quantity: number }>>(
      `SELECT stock_quantity FROM retail_variants WHERE id = ?`,
      [limitedVariantId]
    );
    expect(Number(finalStock.stock_quantity)).toBe(0);
  });

  it("4. Cancelar pedido ainda em 'requested' não altera estoque e modo 'untracked' confirma sem baixar saldo", async () => {
    const cartReq = await XamppRetailOrderAdapter.addOrIncrementCartItem({
      storeSlug: "atelie-xampp",
      rawCartToken: null,
      productId: testProductId,
      variantId: secondVariantId,
      quantity: 2,
    });
    if (cartReq.cart.id) createdCartIds.push(cartReq.cart.id);

    const orderReq = await XamppRetailOrderAdapter.createPublicOrder({
      storeSlug: "atelie-xampp",
      rawCartToken: cartReq.rawToken,
      input: {
        customerName: "Cancelado em Requested",
        customerPhone: "(11) 93333-0000",
        deliveryMode: "pickup",
      },
    });
    createdOrderIds.push(orderReq.order.id);

    const cancelledReq = await XamppRetailOrderAdapter.cancelOrder({
      context: MANAGER_CONTEXT,
      orderId: orderReq.order.id,
      actorName: "Gestora",
      reason: "Desistência antes da confirmação",
    });
    expect(cancelledReq.status).toBe("cancelled");
    expect(cancelledReq.stockDeducted).toBe(false);

    const [stockAfterReqCancel] = await xamppQuery<Array<{ stock_quantity: number }>>(
      `SELECT stock_quantity FROM retail_variants WHERE id = ?`,
      [secondVariantId]
    );
    expect(Number(stockAfterReqCancel.stock_quantity)).toBe(5);

    await xamppQuery(
      `UPDATE retail_stores SET inventory_mode = 'untracked' WHERE tenant_id = ?`,
      [ATELIE_TENANT_ID]
    );

    const cartUntracked = await XamppRetailOrderAdapter.addOrIncrementCartItem({
      storeSlug: "atelie-xampp",
      rawCartToken: null,
      productId: testProductId,
      variantId: secondVariantId,
      quantity: 3,
    });
    if (cartUntracked.cart.id) createdCartIds.push(cartUntracked.cart.id);

    const orderUntracked = await XamppRetailOrderAdapter.createPublicOrder({
      storeSlug: "atelie-xampp",
      rawCartToken: cartUntracked.rawToken,
      input: {
        customerName: "Cliente Livre",
        customerPhone: "(11) 93333-4444",
        deliveryMode: "pickup",
      },
    });
    createdOrderIds.push(orderUntracked.order.id);

    const confirmed = await XamppRetailOrderAdapter.confirmOrder({
      context: MANAGER_CONTEXT,
      orderId: orderUntracked.order.id,
      actorName: "Gestora",
    });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.stockDeducted).toBe(false);

    const [stockUnchanged] = await xamppQuery<Array<{ stock_quantity: number }>>(
      `SELECT stock_quantity FROM retail_variants WHERE id = ?`,
      [secondVariantId]
    );
    expect(Number(stockUnchanged.stock_quantity)).toBe(5);
  });

  it("5. Tenant suspenso recusa novos pedidos públicos", async () => {
    await xamppQuery(`UPDATE tenants SET status = 'suspended' WHERE id = ?`, [VERDE_TENANT_ID]);

    await expect(
      XamppRetailOrderAdapter.createPublicOrder({
        storeSlug: "verde-xampp",
        rawCartToken: "arbitrary-token",
        input: {
          customerName: "Tentativa Bloqueada",
          customerPhone: "(11) 94444-5555",
          deliveryMode: "pickup",
        },
      })
    ).rejects.toThrow(NotFoundError);

    await xamppQuery(`UPDATE tenants SET status = 'active' WHERE id = ?`, [VERDE_TENANT_ID]);
  });
});
