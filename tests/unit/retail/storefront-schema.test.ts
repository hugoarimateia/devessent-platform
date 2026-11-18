import { describe, it, expect } from "vitest";
import {
  storefrontTemplateSchema,
  storefrontSettingsSchema,
  updateRetailStoreSchema,
} from "@/modules/retail/schemas";

describe("Fase 6B — Schemas da Vitrine Pública (Storefront)", () => {
  it("1. storefrontTemplateSchema aceita apenas 'editorial' e 'experimental'", () => {
    expect(storefrontTemplateSchema.parse("editorial")).toBe("editorial");
    expect(storefrontTemplateSchema.parse("experimental")).toBe("experimental");

    expect(() => storefrontTemplateSchema.parse("classic")).toThrow();
    expect(() => storefrontTemplateSchema.parse("minimalist")).toThrow();
    expect(() => storefrontTemplateSchema.parse("")).toThrow();
  });

  it("2. storefrontSettingsSchema valida campos opcionais com defaults corretos", () => {
    const parsed = storefrontSettingsSchema.parse({});
    expect(parsed.template).toBe("editorial");
    expect(parsed.brandHeadline).toBeUndefined();
    expect(parsed.socialLinks).toEqual({});
  });

  it("3. storefrontSettingsSchema valida formato de cores hexadecimais", () => {
    const valid = storefrontSettingsSchema.parse({
      accentColor: "#111111",
      secondaryColor: "#FAFAFA",
    });
    expect(valid.accentColor).toBe("#111111");
    expect(valid.secondaryColor).toBe("#FAFAFA");

    expect(() =>
      storefrontSettingsSchema.parse({
        accentColor: "red",
      })
    ).toThrow(/hexadecimal/);

    expect(() =>
      storefrontSettingsSchema.parse({
        accentColor: "#12345",
      })
    ).toThrow(/hexadecimal/);
  });

  it("4. storefrontSettingsSchema valida limites de tamanho de textos", () => {
    expect(() =>
      storefrontSettingsSchema.parse({
        brandHeadline: "A".repeat(161),
      })
    ).toThrow(/Headline da marca não pode exceder 160/);

    expect(() =>
      storefrontSettingsSchema.parse({
        brandSubheadline: "B".repeat(241),
      })
    ).toThrow(/Subtítulo da marca não pode exceder 240/);

    expect(() =>
      storefrontSettingsSchema.parse({
        announcementBar: "C".repeat(201),
      })
    ).toThrow(/Barra de anúncios/i);
  });

  it("5. updateRetailStoreSchema integra campos operacionais e de vitrine pública", () => {
    const valid = updateRetailStoreSchema.parse({
      storeName: "Ateliê Contemporâneo",
      currency: "BRL",
      isActive: true,
      inventoryMode: "track_quantity",
      template: "experimental",
      brandHeadline: "Wear Your Customization",
      accentColor: "#D4FF00",
      announcementBar: "Frete grátis acima de R$ 250",
    });

    expect(valid.storeName).toBe("Ateliê Contemporâneo");
    expect(valid.template).toBe("experimental");
    expect(valid.accentColor).toBe("#D4FF00");
  });
});

