import { describe, it, expect } from "vitest";
import { RetailPermissionService } from "@/modules/retail/permissions/retail-permissions";
import { updateRetailOperationalSettingsSchema } from "@/modules/retail/schemas/store.schema";
import { ForbiddenError } from "@/core/errors/app-error";

describe("Fase 6B.1 — Separação de Permissões (Gestão Operacional vs Customização Técnica)", () => {
  it("1. Restringe 'manage_storefront_design' exclusivamente ao papel platform_admin", () => {
    expect(RetailPermissionService.hasPermission("platform_admin", "manage_storefront_design")).toBe(true);
    expect(RetailPermissionService.hasPermission("owner", "manage_storefront_design")).toBe(false);
    expect(RetailPermissionService.hasPermission("manager", "manage_storefront_design")).toBe(false);
    expect(RetailPermissionService.hasPermission("staff", "manage_storefront_design")).toBe(false);

    expect(() =>
      RetailPermissionService.assertPermission("owner", "manage_storefront_design")
    ).toThrow(ForbiddenError);
    expect(() =>
      RetailPermissionService.assertPermission("manager", "manage_storefront_design")
    ).toThrow(ForbiddenError);
    expect(() =>
      RetailPermissionService.assertPermission("staff", "manage_storefront_design")
    ).toThrow(ForbiddenError);
  });

  it("2. Mantém 'manage_retail_settings' para owner, manager e platform_admin, bloqueando staff", () => {
    expect(RetailPermissionService.hasPermission("platform_admin", "manage_retail_settings")).toBe(true);
    expect(RetailPermissionService.hasPermission("owner", "manage_retail_settings")).toBe(true);
    expect(RetailPermissionService.hasPermission("manager", "manage_retail_settings")).toBe(true);
    expect(RetailPermissionService.hasPermission("staff", "manage_retail_settings")).toBe(false);
  });

  it("3. updateRetailOperationalSettingsSchema valida somente campos operacionais permitidos ao cliente", () => {
    const parsed = updateRetailOperationalSettingsSchema.parse({
      storeName: "Ateliê Operacional",
      currency: "BRL",
      isActive: true,
      inventoryMode: "track_quantity",
      contactEmail: "contato@atelie.test",
      contactPhone: "(11) 99999-8888",
      socialLinks: { instagram: "https://instagram.com/atelie" },
      // Campos estruturais não pertencem ao schema operacional e devem ser descartados pelo Zod
      template: "experimental",
      accentColor: "#FF0000",
      heroBadge: "HACKED",
    } as Record<string, unknown>);

    expect(parsed.storeName).toBe("Ateliê Operacional");
    expect(parsed.currency).toBe("BRL");
    expect("template" in parsed).toBe(false);
    expect("accentColor" in parsed).toBe(false);
    expect("heroBadge" in parsed).toBe(false);
  });
});
