import { describe, it, expect } from "vitest";
import { ProductInvariants } from "@/modules/retail/domain/product-invariants";
import { ValidationError } from "@/core/errors/app-error";

describe("Retail Module — ProductInvariants (Unit)", () => {
  it("deve formatar centavos inteiros para moeda BRL corretamente", () => {
    expect(ProductInvariants.formatCentsToCurrency(0)).toMatch(/R\$\s*0,00/);
    expect(ProductInvariants.formatCentsToCurrency(15900)).toMatch(/R\$\s*159,00/);
    expect(ProductInvariants.formatCentsToCurrency(38990)).toMatch(/R\$\s*389,90/);
  });

  it("deve converter valores decimais ou strings formatadas em centavos inteiros", () => {
    expect(ProductInvariants.parseToCents(159.9)).toBe(15990);
    expect(ProductInvariants.parseToCents("159,90")).toBe(15990);
    expect(ProductInvariants.parseToCents("R$ 1.250,50")).toBe(125050);
    expect(ProductInvariants.parseToCents(-50)).toBe(0);
  });

  it("deve gerar slugs amigáveis sem acentos e caracteres especiais", () => {
    expect(ProductInvariants.slugify("Camiseta Linho & Algodão")).toBe("camiseta-linho-algodao");
    expect(ProductInvariants.slugify("Calça Cargo Utilitária - 2026")).toBe("calca-cargo-utilitaria-2026");
  });

  it("deve reprovar publicação de produtos sem variantes ou com preço zero", () => {
    const semVariantes = ProductInvariants.checkPublicationReadiness({
      name: "Produto Teste",
      variants: [],
    });
    expect(semVariantes.canPublish).toBe(false);
    expect(semVariantes.reasons.length).toBeGreaterThan(0);

    const precoZero = ProductInvariants.checkPublicationReadiness({
      name: "Produto Teste",
      variants: [{ sku: "SKU-1", priceCents: 0, compareAtPriceCents: null }],
    });
    expect(precoZero.canPublish).toBe(false);

    const precoComparativoMenor = ProductInvariants.checkPublicationReadiness({
      name: "Produto Teste",
      variants: [{ sku: "SKU-1", priceCents: 10000, compareAtPriceCents: 8000 }],
    });
    expect(precoComparativoMenor.canPublish).toBe(false);
  });

  it("deve aprovar publicação de produtos válidos e lançar ValidationError quando inválido", () => {
    const valido = ProductInvariants.checkPublicationReadiness({
      name: "Camiseta Autoral",
      variants: [{ sku: "SKU-OK", priceCents: 14900, compareAtPriceCents: 18900 }],
    });
    expect(valido.canPublish).toBe(true);
    expect(valido.reasons.length).toBe(0);

    expect(() =>
      ProductInvariants.assertCanPublish({
        name: "A",
        variants: [],
      })
    ).toThrow(ValidationError);
  });
});

