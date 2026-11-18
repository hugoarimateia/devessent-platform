import { ValidationError } from "@/core/errors/app-error";

export class VariantInvariants {
  public static readonly SKU_REGEX = /^[A-Za-z0-9_-]{3,48}$/;

  /**
   * Valida e normaliza o formato do SKU corporativo
   */
  public static normalizeSku(sku: string): string {
    const trimmed = (sku || "").trim().toUpperCase();
    if (!this.SKU_REGEX.test(trimmed)) {
      throw new ValidationError(
        "SKU inválido: deve conter de 3 a 48 caracteres alfanuméricos, hífen ou sublinhado."
      );
    }
    return trimmed;
  }

  /**
   * Gera combinações cartesianas para variantes a partir de opções
   * Exemplo: [{ name: "Cor", values: ["P", "B"] }, { name: "Tamanho", values: ["M", "G"] }]
   */
  public static generateCombinations(
    options: Array<{ name: string; values: string[] }>
  ): Array<Record<string, string>> {
    if (!options || options.length === 0) return [];

    let results: Array<Record<string, string>> = [{}];

    for (const opt of options) {
      if (!opt.values || opt.values.length === 0) continue;
      const next: Array<Record<string, string>> = [];
      for (const res of results) {
        for (const val of opt.values) {
          next.push({
            ...res,
            [opt.name]: val,
          });
        }
      }
      results = next;
    }

    return results.filter((r) => Object.keys(r).length > 0);
  }
}

