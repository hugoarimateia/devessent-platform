import { ValidationError } from "@/core/errors/app-error";


export interface PublicationCheckResult {
  canPublish: boolean;
  reasons: string[];
}

export class ProductInvariants {
  /**
   * Converte centavos inteiros para string monetária formatada (ex.: 15900 -> "R$ 159,00")
   */
  public static formatCentsToCurrency(cents: number, currency = "BRL"): string {
    const value = (cents || 0) / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value);
  }

  /**
   * Converte valor monetário (número decimal ou string) em centavos inteiros (ex.: 159.9 -> 15990)
   */
  public static parseToCents(value: number | string): number {
    if (typeof value === "number") {
      if (isNaN(value) || value < 0) return 0;
      return Math.round(value * 100);
    }

    if (typeof value === "string") {
      const cleaned = value
        .replace(/[^\d.,]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed) || parsed < 0) return 0;
      return Math.round(parsed * 100);
    }

    return 0;
  }

  /**
   * Gera slug amigável a partir do nome
   */
  public static slugify(text: string): string {
    return text
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Verifica se o produto atende aos critérios estritos para publicação no catálogo:
   * 1. Nome válido (mínimo 2 caracteres).
   * 2. Pelo menos uma variante cadastrada.
   * 3. Todas as variantes possuem preço positivo (> 0).
   * 4. Preço comparativo (quando informado) deve ser maior ou igual ao preço de venda.
   */
  public static checkPublicationReadiness(params: {
    name: string;
    variants: Array<{
      sku?: string;
      priceCents: number;
      compareAtPriceCents?: number | null;
    }>;
    images?: Array<{ id?: string; storagePath?: string }>;
  }): PublicationCheckResult {
    const reasons: string[] = [];

    if (!params.name || params.name.trim().length < 2) {
      reasons.push("O produto precisa de um nome válido com pelo menos 2 caracteres.");
    }

    if (!params.variants || params.variants.length === 0) {
      reasons.push("O produto deve conter pelo menos uma variante cadastrada.");
    } else {
      for (let i = 0; i < params.variants.length; i++) {
        const v = params.variants[i];
        if (v.priceCents <= 0) {
          reasons.push(`A variante ${v.sku || `#${i + 1}`} deve possuir preço maior que zero.`);
        }
        if (v.compareAtPriceCents !== null && v.compareAtPriceCents !== undefined && v.compareAtPriceCents < v.priceCents) {
          reasons.push(`O preço comparativo da variante ${v.sku || `#${i + 1}`} não pode ser menor que o preço de venda.`);
        }
      }
    }

    return {
      canPublish: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Assegura que o produto está pronto para ser publicado, ou lança ValidationError
   */
  public static assertCanPublish(params: {
    name: string;
    variants: Array<{
      sku?: string;
      priceCents: number;
      compareAtPriceCents?: number | null;
    }>;
    images?: Array<{ id?: string; storagePath?: string }>;
  }): void {
    const check = this.checkPublicationReadiness(params);
    if (!check.canPublish) {
      throw new ValidationError(
        `Não é possível publicar o produto: ${check.reasons.join(" ")}`
      );
    }
  }
}

