import { describe, it, expect } from "vitest";
import { VariantInvariants } from "@/modules/retail/domain/variant-invariants";
import { ValidationError } from "@/core/errors/app-error";

describe("Retail Module — VariantInvariants (Unit)", () => {
  it("deve normalizar SKUs válidos em maiúsculas", () => {
    expect(VariantInvariants.normalizeSku("at-tee-blk-p")).toBe("AT-TEE-BLK-P");
    expect(VariantInvariants.normalizeSku("  prod_01_m  ")).toBe("PROD_01_M");
  });

  it("deve rejeitar SKUs inválidos com caracteres especiais proibidos ou tamanho incorreto", () => {
    expect(() => VariantInvariants.normalizeSku("A")).toThrow(ValidationError);
    expect(() => VariantInvariants.normalizeSku("SKU COM ESPAÇO")).toThrow(ValidationError);
    expect(() => VariantInvariants.normalizeSku("SKU@SPECIAL!")).toThrow(ValidationError);
  });

  it("deve gerar produto cartesiano de opções para matriz de variantes", () => {
    const options = [
      { name: "Cor", values: ["Preto", "Branco"] },
      { name: "Tamanho", values: ["P", "M", "G"] },
    ];

    const combos = VariantInvariants.generateCombinations(options);
    expect(combos.length).toBe(6);
    expect(combos[0]).toEqual({ Cor: "Preto", Tamanho: "P" });
    expect(combos[5]).toEqual({ Cor: "Branco", Tamanho: "G" });
  });

  it("deve retornar array vazio se nenhuma opção com valores for fornecida", () => {
    expect(VariantInvariants.generateCombinations([])).toEqual([]);
    expect(VariantInvariants.generateCombinations([{ name: "Vazio", values: [] }])).toEqual([]);
  });
});

