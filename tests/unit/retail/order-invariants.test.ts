import { describe, it, expect } from "vitest";
import { OrderInvariants } from "@/modules/retail/domain/order-invariants";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";
import {
  cartItemInputSchema,
  cartUpdateQuantitySchema,
  createPublicOrderSchema,
} from "@/modules/retail/schemas/order.schema";
import { ForbiddenError, ValidationError } from "@/core/errors/app-error";

describe("Fase 6C — Invariantes de Pedidos, Cálculos em Centavos e Permissões", () => {
  it("1. Valida matriz estrita de transições de status", () => {
    expect(OrderInvariants.canTransition("requested", "confirmed")).toBe(true);
    expect(OrderInvariants.canTransition("requested", "cancelled")).toBe(true);
    expect(OrderInvariants.canTransition("confirmed", "preparing")).toBe(true);
    expect(OrderInvariants.canTransition("preparing", "ready")).toBe(true);
    expect(OrderInvariants.canTransition("ready", "completed")).toBe(true);

    // Transições inválidas ou terminais
    expect(OrderInvariants.canTransition("requested", "preparing")).toBe(false);
    expect(OrderInvariants.canTransition("requested", "completed")).toBe(false);
    expect(OrderInvariants.canTransition("completed", "cancelled")).toBe(false);
    expect(OrderInvariants.canTransition("cancelled", "confirmed")).toBe(false);
    expect(OrderInvariants.canTransition("confirmed", "requested")).toBe(false);

    expect(() => OrderInvariants.assertValidTransition("completed", "cancelled")).toThrow(
      ValidationError
    );
  });

  it("2. Calcula totais estritamente em centavos inteiros positivos", () => {
    expect(OrderInvariants.computeLineTotalCents(18900, 2)).toBe(37800);
    expect(
      OrderInvariants.computeSubtotalCents([
        { unitPriceCents: 18900, quantity: 2 },
        { unitPriceCents: 4550, quantity: 3 },
      ])
    ).toBe(51450);

    expect(() => OrderInvariants.computeLineTotalCents(189.9, 1)).toThrow(ValidationError);
    expect(() => OrderInvariants.computeLineTotalCents(-100, 1)).toThrow(ValidationError);
    expect(() => OrderInvariants.computeLineTotalCents(100, 0)).toThrow(ValidationError);
  });

  it("3. Bloqueia gestão e visualização irrestrita de pedidos para papel staff", () => {
    expect(RetailPermissionService.hasPermission("owner", "view_retail_orders")).toBe(true);
    expect(RetailPermissionService.hasPermission("manager", "view_retail_orders")).toBe(true);
    expect(RetailPermissionService.hasPermission("platform_admin", "view_retail_orders")).toBe(true);
    expect(RetailPermissionService.hasPermission("staff", "view_retail_orders")).toBe(false);

    expect(RetailPermissionService.hasPermission("owner", "manage_retail_orders")).toBe(true);
    expect(RetailPermissionService.hasPermission("manager", "manage_retail_orders")).toBe(true);
    expect(RetailPermissionService.hasPermission("platform_admin", "manage_retail_orders")).toBe(true);
    expect(RetailPermissionService.hasPermission("staff", "manage_retail_orders")).toBe(false);

    expect(() => RetailPermissionService.assertPermission("staff", "manage_retail_orders")).toThrow(
      ForbiddenError
    );
  });

  it("4. Valida schemas de carrinho e solicitação de pedido público (sem campos de preço do cliente)", () => {
    const okCart = cartItemInputSchema.parse({
      productId: "44444444-4444-4444-8444-444444444401",
      variantId: "55555555-5555-4555-8555-555555555501",
      quantity: 2,
    });
    expect(okCart.quantity).toBe(2);

    const zeroQty = cartUpdateQuantitySchema.parse({
      variantId: "55555555-5555-4555-8555-555555555501",
      quantity: 0,
    });
    expect(zeroQty.quantity).toBe(0);

    expect(() =>
      createPublicOrderSchema.parse({
        customerName: "Mariana",
        customerPhone: "(11) 99999-1234",
        deliveryMode: "delivery",
        deliveryAddress: "",
      })
    ).toThrow();

    const pickupOrder = createPublicOrderSchema.parse({
      customerName: "Mariana Costa",
      customerPhone: "(11) 99999-1234",
      deliveryMode: "pickup",
      subtotalCents: 1, // campo extra não permitido deve ser ignorado/descartado pelo schema
    } as Record<string, unknown>);
    expect("subtotalCents" in pickupOrder).toBe(false);
  });

  it("5. Gera link de WhatsApp opcional somente com contactPhone válido", () => {
    expect(
      OrderInvariants.buildOrderWhatsAppUrl({
        storePhone: null,
        storeName: "Ateliê Teste",
        orderNumber: "PED-A1B2C3",
        customerName: "João",
        totalFormatted: "R$ 189,00",
        deliveryMode: "pickup",
      })
    ).toBeNull();

    const url = OrderInvariants.buildOrderWhatsAppUrl({
      storePhone: "(11) 98888-7777",
      storeName: "Ateliê Teste",
      orderNumber: "PED-A1B2C3",
      customerName: "João",
      totalFormatted: "R$ 189,00",
      deliveryMode: "delivery",
    });
    expect(url).toContain("https://wa.me/5511988887777?text=");
    expect(url).toContain("PED-A1B2C3");
  });
});
