import { describe, it, expect } from "vitest";
import {
  createCategorySchema,
  createProductSchema,
  variantItemSchema,
  updateRetailStoreSchema,
  uploadProductImageSchema,
} from "@/modules/retail/schemas";

describe("Retail Module — Schemas Zod (Unit)", () => {
  it("deve validar e auto-slugificar schemas de categoria", () => {
    const valid = createCategorySchema.parse({
      name: "Moda Sustentável",
      description: "Coleções em algodão orgânico",
      sortOrder: 1,
      isActive: true,
    });
    expect(valid.name).toBe("Moda Sustentável");
    expect(valid.slug).toBe("moda-sustentavel");

    expect(() =>
      createCategorySchema.parse({
        name: "A", // menor que 2 caracteres
      })
    ).toThrow();
  });

  it("deve validar dados de variantes e preços não negativos", () => {
    const valid = variantItemSchema.parse({
      sku: "at-tee-m",
      name: "Tamanho M",
      priceCents: 15900,
      compareAtPriceCents: 19900,
      stockQuantity: 10,
    });
    expect(valid.sku).toBe("AT-TEE-M");
    expect(valid.priceCents).toBe(15900);

    expect(() =>
      variantItemSchema.parse({
        sku: "FAIL",
        name: "Item",
        priceCents: -100, // Preço negativo proibido
      })
    ).toThrow();

    expect(() =>
      variantItemSchema.parse({
        sku: "FAIL",
        name: "Item",
        priceCents: 1000,
        stockQuantity: -5, // Estoque negativo proibido
      })
    ).toThrow();
  });

  it("deve validar cadastro de produto com variantes obrigatórias", () => {
    const valid = createProductSchema.parse({
      name: "Vestido Midi Seda",
      description: "Vestido em seda pura",
      status: "draft",
      categoryIds: [],
      options: [],
      variants: [
        {
          sku: "VEST-001",
          name: "Padrão",
          priceCents: 49900,
          stockQuantity: 5,
          isAvailable: true,
          optionsSummary: {},
        },
      ],
    });
    expect(valid.name).toBe("Vestido Midi Seda");
    expect(valid.slug).toBe("vestido-midi-seda");
    expect(valid.variants.length).toBe(1);

    expect(() =>
      createProductSchema.parse({
        name: "Produto Sem Variantes",
        variants: [], // Requer ao menos 1 variante
      })
    ).toThrow();
  });

  it("deve validar configurações da loja comercial", () => {
    const valid = updateRetailStoreSchema.parse({
      storeName: "Minha Loja Autoral",
      currency: "BRL",
      isActive: true,
      inventoryMode: "track_quantity",
    });
    expect(valid.currency).toBe("BRL");

    expect(() =>
      updateRetailStoreSchema.parse({
        storeName: "X",
        currency: "INVALID", // Deve ter 3 letras
      })
    ).toThrow();
  });
});

