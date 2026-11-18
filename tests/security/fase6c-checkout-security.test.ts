import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import nextConfig from "../../next.config";
import { XamppRetailOrderAdapter } from "@/infrastructure/xampp-test/retail-order-adapter";
import { xamppQuery } from "@/infrastructure/xampp-test/db";
import { ValidationError } from "@/core/errors/app-error";

describe("Fase 6C.1 — Auditoria de Segurança do Checkout Público, Tokens e Hardening PostgreSQL", () => {
  it("1. Migration 000012 aplica FORCE ROW LEVEL SECURITY, bloqueia UPDATE direto e vincula RPCs a auth.uid()", () => {
    const sqlPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20260301000012_retail_order_security_hardening.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf-8");

    expect(sql).toContain("ALTER TABLE public.retail_orders FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.retail_carts FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("DROP POLICY IF EXISTS retail_orders_tenant_update ON public.retail_orders");
    expect(sql).toContain("IF v_auth_role = 'anon'");
    expect(sql).toContain("p_actor_user_id <> v_auth_uid");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.create_public_retail_order");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.create_public_retail_order");
    expect(sql).toContain("TO service_role");

    const sql13Path = path.resolve(
      process.cwd(),
      "supabase/migrations/20260301000013_retail_rpc_caller_context_hardening.sql"
    );
    const sql13 = fs.readFileSync(sql13Path, "utf-8");
    const sql13Executable = sql13.replace(/--.*$/gm, "");

    expect(sql13Executable).not.toMatch(/\bcurrent_user\b/i);
    expect(sql13).toContain("session_user IN ('postgres', 'supabase_admin')");
    expect(sql13).toContain("NULLIF(current_setting('request.jwt.claims', true), '')");
    expect(sql13).toContain("public.membership_role[]");
    expect(sql13).toContain("GRANT EXECUTE ON FUNCTION public.create_public_retail_order");
  });

  it("2. next.config.ts aplica Referrer-Policy no-referrer, Cache-Control no-store e X-Robots-Tag noindex nas rotas de checkout e recibo", async () => {
    const headerRules = await nextConfig.headers?.();
    expect(headerRules).toBeDefined();

    const pedidoRule = headerRules!.find((r) => r.source.includes("/loja/:slug/pedido"));
    const finalizarRule = headerRules!.find((r) => r.source.includes("/loja/:slug/finalizar"));

    expect(pedidoRule).toBeDefined();
    expect(finalizarRule).toBeDefined();

    for (const rule of [pedidoRule!, finalizarRule!]) {
      const map = Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
      expect(map["Referrer-Policy"]).toBe("no-referrer");
      expect(map["Cache-Control"]).toContain("no-store");
      expect(map["X-Robots-Tag"]).toContain("noindex");
    }
  });

  it("3. A página de recibo /loja/[slug]/pedido/[orderNumber] lê token de cookie HttpOnly e não emite ?t= na URL", () => {
    const actionsCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/modules/retail/actions/retail-cart.actions.ts"),
      "utf-8"
    );
    const receiptPageCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(storefront)/loja/[slug]/pedido/[orderNumber]/page.tsx"),
      "utf-8"
    );
    const receiptComponentCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/modules/retail/storefront/components/storefront-order-receipt.tsx"),
      "utf-8"
    );

    expect(actionsCode).toContain("writeStoreOrderReceiptToken");
    expect(actionsCode).not.toContain("new URLSearchParams({ t:");
    expect(receiptPageCode).toContain("readStoreOrderReceiptToken");
    expect(receiptPageCode).toContain('dynamic = "force-dynamic"');
    expect(receiptPageCode).toContain("index: false");
    expect(receiptComponentCode).toContain('referrerPolicy="no-referrer"');
  });

  describe("4. Validação de Idempotência Vinculada ao Carrinho e Proteção de PII no Tracking Público (MariaDB XAMPP)", () => {
    const prevBackendMode = process.env.APP_BACKEND_MODE;
    const ATELIE_TENANT_ID = "22222222-2222-4222-8222-222222222201";
    const prodId = randomUUID();
    const varId = randomUUID();
    const createdOrders: string[] = [];
    const createdCarts: string[] = [];

    beforeAll(async () => {
      process.env.APP_BACKEND_MODE = "xampp-test";
      await xamppQuery(
        `INSERT INTO retail_products (id, tenant_id, name, slug, status, published_at)
         VALUES (?, ?, 'Peça Sec Checkout 6C1', ?, 'published', NOW())`,
        [prodId, ATELIE_TENANT_ID, `peca-sec-6c1-${prodId.slice(0, 8)}`]
      );
      await xamppQuery(
        `INSERT INTO retail_variants (id, tenant_id, product_id, sku, name, price_cents, stock_quantity, is_available, options_summary_json)
         VALUES (?, ?, ?, ?, 'Padrão', 9900, 10, 1, '{}')`,
        [varId, ATELIE_TENANT_ID, prodId, `SEC6C1-${varId.slice(0, 6)}`]
      );
    });

    afterAll(async () => {
      try {
        for (const id of createdOrders) {
          await xamppQuery(`DELETE FROM retail_orders WHERE id = ?`, [id]);
        }
        for (const id of createdCarts) {
          await xamppQuery(`DELETE FROM retail_carts WHERE id = ?`, [id]);
        }
        await xamppQuery(`DELETE FROM retail_products WHERE id = ?`, [prodId]);
      } finally {
        process.env.APP_BACKEND_MODE = prevBackendMode;
        vi.restoreAllMocks();
      }
    });

    it("Não expõe telefone, e-mail, token ou endereço completo em getPublicOrderTracking e impede sequestro por idempotencyKey de outra sessão", async () => {
      const cartA = await XamppRetailOrderAdapter.addOrIncrementCartItem({
        storeSlug: "atelie-xampp",
        rawCartToken: null,
        productId: prodId,
        variantId: varId,
        quantity: 1,
      });
      if (cartA.cart.id) createdCarts.push(cartA.cart.id);

      const idemKey = `sec-idem-${randomUUID()}`;
      const orderA = await XamppRetailOrderAdapter.createPublicOrder({
        storeSlug: "atelie-xampp",
        rawCartToken: cartA.rawToken,
        input: {
          customerName: "Compradora Segura",
          customerPhone: "(11) 97777-6666",
          customerEmail: "sigilo@teste.local",
          deliveryMode: "delivery",
          deliveryAddress: "Rua Sigilosa, 123 - Apto 45",
          idempotencyKey: idemKey,
        },
      });
      createdOrders.push(orderA.order.id);

      // Recibo público NÃO expõe endereço completo, telefone ou e-mail
      const receipt = await XamppRetailOrderAdapter.getPublicOrderTracking({
        storeSlug: "atelie-xampp",
        orderNumber: orderA.order.orderNumber,
        publicToken: orderA.publicToken,
      });
      expect(receipt).not.toBeNull();
      expect("deliveryAddress" in (receipt as unknown as Record<string, unknown>)).toBe(false);
      expect("customerPhone" in (receipt as unknown as Record<string, unknown>)).toBe(false);
      expect("customerEmail" in (receipt as unknown as Record<string, unknown>)).toBe(false);
      expect(receipt!.hasDeliveryAddress).toBe(true);

      // Token inválido retorna null
      const invalidReceipt = await XamppRetailOrderAdapter.getPublicOrderTracking({
        storeSlug: "atelie-xampp",
        orderNumber: orderA.order.orderNumber,
        publicToken: "token-falso-que-nao-corresponde",
      });
      expect(invalidReceipt).toBeNull();

      // Atacante tentando reutilizar a mesma idempotencyKey com OUTRO carrinho vazio/expirado não pode sequestrar ou resetar o recibo A
      const cartAttacker = await XamppRetailOrderAdapter.addOrIncrementCartItem({
        storeSlug: "atelie-xampp",
        rawCartToken: null,
        productId: prodId,
        variantId: varId,
        quantity: 1,
      });
      if (cartAttacker.cart.id) createdCarts.push(cartAttacker.cart.id);

      // Sem corresponder ao mesmo cart_id, o hash do recibo A permanece intacto
      await XamppRetailOrderAdapter.updateCartItemQuantity({
        storeSlug: "atelie-xampp",
        rawCartToken: cartAttacker.rawToken,
        variantId: varId,
        quantity: 0,
      });

      await expect(
        XamppRetailOrderAdapter.createPublicOrder({
          storeSlug: "atelie-xampp",
          rawCartToken: cartAttacker.rawToken,
          input: {
            customerName: "Atacante",
            customerPhone: "(11) 90000-0000",
            deliveryMode: "pickup",
            idempotencyKey: idemKey,
          },
        })
      ).rejects.toThrow(ValidationError);

      // O recibo legítimo A ainda funciona intacto porque seu hash não foi sobrescrito!
      const stillValid = await XamppRetailOrderAdapter.getPublicOrderTracking({
        storeSlug: "atelie-xampp",
        orderNumber: orderA.order.orderNumber,
        publicToken: orderA.publicToken,
      });
      expect(stillValid).not.toBeNull();
    });
  });
});
