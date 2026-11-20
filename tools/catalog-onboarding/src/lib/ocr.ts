import { validateGtin } from "./barcode";

export interface OcrExtractedFields {
  rawText: string;
  confidence: number;
  suggestedName: string | null;
  brand: string | null;
  gtin: string | null;
  gtinFormat: string | null;
  skuCandidate: string | null;
  presentation: string | null;
  size: string | null;
  color: string | null;
  unconfirmedPriceCents: number | null;
  ambiguous: boolean;
  notes: string[];
}

const KNOWN_COLORS = [
  "preto",
  "preta",
  "branco",
  "branca",
  "off-white",
  "cru",
  "bege",
  "areia",
  "azul",
  "marinho",
  "verde",
  "oliva",
  "musgo",
  "vermelho",
  "vinho",
  "terracota",
  "rosa",
  "cinza",
  "grafite",
  "marrom",
  "caramelo",
  "amarelo",
  "dourado",
  "prata",
  "lilás",
  "roxo",
];

const SIZE_REGEX =
  /\b(?:tam(?:anho)?\.?\s*[:\-]?\s*)?(PP|P|M|G|GG|XG|XGG|EXG|UN|ÚNICO|3[4-9]|4[0-6])\b/i;
const PRESENTATION_REGEX =
  /\b(\d+(?:[.,]\d+)?\s*(?:ml|mL|L|l|g|gr|kg|KG|mg|un|unid(?:ades)?|pçs?|peças?|cm|mm))\b/i;
const SKU_REGEX = /\b(?:SKU|REF|C[ÓO]D(?:IGO)?)\s*[:.#\-]?\s*([A-Z0-9][A-Z0-9_-]{2,24})\b/i;
const BRAND_REGEX = /\b(?:MARCA|FABRICANTE|BRAND)\s*[:\-]\s*([A-Za-zÀ-ÿ0-9 &'.-]{2,40})/i;
const PRICE_REGEX = /R\$\s*(\d{1,5}(?:\.\d{3})*,\d{2}|\d{1,5}\.\d{2})/i;

/**
 * Parser determinístico de texto OCR de etiquetas e embalagens (§5).
 * Extrai EXCLUSIVAMENTE informações efetivamente presentes no texto — nunca inventa campos.
 */
export function parseOcrProductText(
  rawText: string,
  confidence: number
): OcrExtractedFields {
  const cleanLines = (rawText || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 2);

  const joined = cleanLines.join("\n");
  const notes: string[] = [];

  // 1. Buscar códigos GTIN válidos no texto (8, 12, 13 ou 14 dígitos)
  let gtin: string | null = null;
  let gtinFormat: string | null = null;
  const digitCandidates = joined.match(/\b\d{8,14}\b/g) || [];
  for (const cand of digitCandidates) {
    const check = validateGtin(cand);
    if (check.valid) {
      gtin = check.normalized;
      gtinFormat = check.format;
      notes.push(`GTIN ${check.format} (${check.normalized}) identificado e validado no OCR.`);
      break;
    }
  }

  // 2. SKU / Referência
  const skuMatch = joined.match(SKU_REGEX);
  const skuCandidate = skuMatch ? skuMatch[1].trim().toUpperCase() : null;

  // 3. Volume / Peso / Apresentação
  const presMatch = joined.match(PRESENTATION_REGEX);
  const presentation = presMatch ? presMatch[1].replace(/\s+/g, " ").trim() : null;

  // 4. Tamanho
  const sizeMatch = joined.match(SIZE_REGEX);
  const size = sizeMatch ? sizeMatch[1].toUpperCase() : null;

  // 5. Cor
  const lowerText = joined.toLowerCase();
  const colorFound = KNOWN_COLORS.find((c) => new RegExp(`\\b${c}\\b`, "i").test(lowerText));
  const color = colorFound
    ? colorFound.charAt(0).toUpperCase() + colorFound.slice(1)
    : null;

  // 6. Marca explícita
  const brandMatch = joined.match(BRAND_REGEX);
  const brand = brandMatch ? brandMatch[1].trim() : null;

  // 7. Preço encontrado na etiqueta (SEMPRE marcado como não confirmado até validação do lojista!)
  let unconfirmedPriceCents: number | null = null;
  const priceMatch = joined.match(PRICE_REGEX);
  if (priceMatch) {
    const normalizedPrice = priceMatch[1].replace(/\./g, "").replace(",", ".");
    const parsedFloat = Number.parseFloat(normalizedPrice);
    if (!Number.isNaN(parsedFloat) && parsedFloat > 0) {
      unconfirmedPriceCents = Math.round(parsedFloat * 100);
      notes.push(
        "Preço visualizado na etiqueta requer confirmação explícita do estabelecimento antes da importação."
      );
    }
  }

  // 8. Nome candidato: primeira linha descritiva que não seja apenas número, preço, SKU ou rótulo técnico
  const titleLine = cleanLines.find((line) => {
    if (line.length < 4 || line.length > 90) return false;
    if (/^\d[\d\s.-]+$/.test(line)) return false;
    if (/^R\$/i.test(line)) return false;
    if (/^(?:SKU|REF|C[ÓO]D|EAN|GTIN|LOTE|VAL|FAB|CNPJ|CPF)/i.test(line)) return false;
    return /[A-Za-zÀ-ÿ]{3,}/.test(line);
  });

  const suggestedName = titleLine || null;

  const ambiguous =
    confidence < 70 ||
    !suggestedName ||
    cleanLines.length === 0;

  if (confidence < 70) {
    notes.push(
      `Confiança OCR moderada/baixa (${Math.round(confidence)}%). Revisão manual obrigatória.`
    );
  }
  if (!suggestedName) {
    notes.push(
      "Não foi possível identificar um nome comercial claro na fotografia. Preencha manualmente na revisão."
    );
  }

  return {
    rawText: joined,
    confidence: Math.round(confidence),
    suggestedName,
    brand,
    gtin,
    gtinFormat,
    skuCandidate,
    presentation,
    size,
    color,
    unconfirmedPriceCents,
    ambiguous,
    notes,
  };
}

/**
 * Executa OCR local gratuito usando Tesseract.js (`por+eng`), sem custo recorrente (§5).
 */
export async function runLocalImageOcr(imageBuffer: Buffer): Promise<OcrExtractedFields> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por+eng", 1, {
    logger: () => {
      // silencioso no servidor
    },
  });

  try {
    const result = await worker.recognize(imageBuffer);
    const rawText = result?.data?.text || "";
    const confidence = typeof result?.data?.confidence === "number" ? result.data.confidence : 0;
    return parseOcrProductText(rawText, confidence);
  } finally {
    await worker.terminate();
  }
}
