import { VariantInvariants } from "@/modules/retail/domain/variant-invariants";

export type GtinFormat = "EAN-13" | "EAN-8" | "UPC-A" | "GTIN-14" | "UNKNOWN";

export interface GtinValidationResult {
  raw: string;
  normalized: string;
  format: GtinFormat;
  valid: boolean;
  expectedCheckDigit: number | null;
  actualCheckDigit: number | null;
  reason: string;
}

/**
 * Calcula o dígito verificador GS1 Modulo-10 para EAN-8, UPC-A (12), EAN-13 e GTIN-14.
 */
export function computeGs1CheckDigit(digitsWithoutCheck: string): number {
  const digits = digitsWithoutCheck.replace(/\D/g, "");
  let sum = 0;
  // GS1 pondera da direita para a esquerda: posições ímpares a partir da direita recebem peso 3, pares peso 1
  for (let i = 0; i < digits.length; i++) {
    const num = Number(digits[digits.length - 1 - i]);
    const weight = i % 2 === 0 ? 3 : 1;
    sum += num * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function classifyGtinFormat(digits: string): GtinFormat {
  switch (digits.length) {
    case 13:
      return "EAN-13";
    case 8:
      return "EAN-8";
    case 12:
      return "UPC-A";
    case 14:
      return "GTIN-14";
    default:
      return "UNKNOWN";
  }
}

/**
 * Valida formato e dígito verificador GS1 de códigos de barras comerciais.
 */
export function validateGtin(rawInput: string): GtinValidationResult {
  const raw = (rawInput || "").trim();
  const normalized = raw.replace(/[\s-]+/g, "");

  if (!normalized || !/^\d+$/.test(normalized)) {
    return {
      raw,
      normalized,
      format: "UNKNOWN",
      valid: false,
      expectedCheckDigit: null,
      actualCheckDigit: null,
      reason: "Código deve conter apenas dígitos numéricos.",
    };
  }

  const format = classifyGtinFormat(normalized);
  if (format === "UNKNOWN") {
    return {
      raw,
      normalized,
      format,
      valid: false,
      expectedCheckDigit: null,
      actualCheckDigit: null,
      reason: `Comprimento ${normalized.length} não corresponde a EAN-8, UPC-A (12), EAN-13 ou GTIN-14.`,
    };
  }

  // Rejeitar códigos degenerados compostos apenas por zeros
  if (/^0+$/.test(normalized)) {
    return {
      raw,
      normalized,
      format,
      valid: false,
      expectedCheckDigit: null,
      actualCheckDigit: 0,
      reason: "Código GTIN composto apenas por zeros é inválido.",
    };
  }

  const body = normalized.slice(0, -1);
  const actualCheckDigit = Number(normalized[normalized.length - 1]);
  const expectedCheckDigit = computeGs1CheckDigit(body);
  const valid = actualCheckDigit === expectedCheckDigit;

  return {
    raw,
    normalized,
    format,
    valid,
    expectedCheckDigit,
    actualCheckDigit,
    reason: valid
      ? `${format} validado (dígito verificador ${actualCheckDigit} OK).`
      : `Dígito verificador inválido para ${format}: esperado ${expectedCheckDigit}, recebido ${actualCheckDigit}.`,
  };
}

/**
 * Gera um SKU compatível com VariantInvariants.SKU_REGEX (`/^[A-Za-z0-9_-]{3,48}$/`).
 */
export function buildSafeSku(params: {
  explicitSku?: string | null;
  gtin?: string | null;
  name?: string | null;
  suffix?: string | null;
}): string {
  const tryNormalize = (candidate: string): string | null => {
    const cleaned = candidate
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);

    if (cleaned.length < 3) return null;
    try {
      return VariantInvariants.normalizeSku(cleaned);
    } catch {
      return null;
    }
  };

  if (params.explicitSku) {
    const normalized = tryNormalize(params.explicitSku);
    if (normalized) return normalized;
  }

  if (params.gtin) {
    const suffixPart = params.suffix ? `-${params.suffix}` : "";
    const normalized = tryNormalize(`EAN-${params.gtin}${suffixPart}`);
    if (normalized) return normalized;
  }

  if (params.name) {
    const prefix = params.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
    const tail =
      params.suffix ||
      Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const normalized = tryNormalize(`${prefix || "ITEM"}-${tail}`);
    if (normalized) return normalized;
  }

  return `ITEM-${Date.now().toString(36).toUpperCase()}`;
}
