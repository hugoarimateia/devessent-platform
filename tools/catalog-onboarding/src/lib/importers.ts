import ExcelJS from "exceljs";
import { validateGtin } from "./barcode";

export type CanonicalColumnKey =
  | "name"
  | "sku"
  | "gtin"
  | "brand"
  | "description"
  | "category"
  | "price"
  | "compareAtPrice"
  | "stock"
  | "variantName"
  | "size"
  | "color"
  | "presentation"
  | "imageUrl";

export interface ParsedTabularPreview {
  sourceType: "csv" | "xlsx" | "pdf";
  fileName: string;
  headers: string[];
  suggestedMapping: Partial<Record<CanonicalColumnKey, string>>;
  sampleRows: Array<Record<string, string>>;
  allRows: Array<Record<string, string>>;
  totalRows: number;
  pdfMeta?: {
    pageCount: number;
    hasExtractableText: boolean;
    needsOcrFallback: boolean;
    warnings: string[];
  };
}

export interface NormalizedImportedProductRow {
  externalSourceId: string;
  name: string;
  sku: string | null;
  gtin: string | null;
  brand: string | null;
  description: string | null;
  category: string | null;
  presentation: string | null;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  stockQuantity: number | null;
  variantName: string;
  optionsSummary: Record<string, string>;
  imageRef: string | null;
}

const COLUMN_SYNONYMS: Record<CanonicalColumnKey, RegExp[]> = {
  name: [/^(nome|produto|titulo|t[ií]tulo|descri[cç][aã]o\s*curta|item|name|product|title)$/i],
  sku: [/^(sku|c[oó]d(?:igo)?|ref(?:er[eê]ncia)?|codigo_sku|cod_interno)$/i],
  gtin: [/^(gtin|ean|ean13|ean_13|codigo_barras|c[oó]digo\s*de\s*barras|barcode|upc)$/i],
  brand: [/^(marca|fabricante|brand)$/i],
  description: [/^(descri[cç][aã]o|detalhes|observa[cç][oõ]es|description|desc)$/i],
  category: [/^(categoria|departamento|se[cç][aã]o|grupo|linha|category)$/i],
  price: [/^(pre[cç]o|valor|pre[cç]o\s*venda|preco_venda|price|vlr|valor_unitario)$/i],
  compareAtPrice: [/^(pre[cç]o\s*de|preco_de|pre[cç]o\s*comparativo|compare_at_price|preco_antigo)$/i],
  stock: [/^(estoque|qtd|quantidade|saldo|stock|qty|inventory)$/i],
  variantName: [/^(variante|varia[cç][aã]o|modelo|variant)$/i],
  size: [/^(tamanho|tam|medida|size)$/i],
  color: [/^(cor|color|tonalidade)$/i],
  presentation: [/^(apresenta[cç][aã]o|volume|peso|embalagem|unidade|presentation)$/i],
  imageUrl: [/^(imagem|foto|url_imagem|image|image_url|caminho_imagem|foto_principal)$/i],
};

function normalizeHeaderToken(header: string): string {
  return (header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function detectColumnMapping(
  headers: string[]
): Partial<Record<CanonicalColumnKey, string>> {
  const mapping: Partial<Record<CanonicalColumnKey, string>> = {};
  const cleanHeaders = headers.map(normalizeHeaderToken);

  for (const key of Object.keys(COLUMN_SYNONYMS) as CanonicalColumnKey[]) {
    const patterns = COLUMN_SYNONYMS[key];
    const matched = cleanHeaders.find((h) => patterns.some((rx) => rx.test(h)));
    if (matched) {
      mapping[key] = matched;
    }
  }
  return mapping;
}

/**
 * Converte formatos monetários brasileiros (`R$ 1.250,90`, `159,90`, `89.90`) em centavos inteiros.
 */
export function parseFlexiblePriceToCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (Number.isNaN(raw) || raw < 0) return null;
    return Math.round(raw * 100);
  }
  const str = String(raw).trim();
  if (!str) return null;
  const cleaned = str.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Formato brasileiro: 1.250,90 -> 1250.90
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Formato internacional: 1,250.90 -> 1250.90
    normalized = cleaned.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function parseFlexibleStock(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (Number.isNaN(raw) || raw < 0) return null;
    return Math.floor(raw);
  }
  const cleaned = String(raw).trim().replace(/[^\d-]/g, "");
  if (!cleaned) return null;
  const num = Number.parseInt(cleaned, 10);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

function detectCsvDelimiter(firstLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const delim of candidates) {
    const count = firstLine.split(delim).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

/**
 * Parser RFC-4180 com detecção automática de delimitador (`;`, `,`, `\t`) e remoção de UTF-8 BOM.
 */
export function parseCsvBuffer(buffer: Buffer, fileName: string): ParsedTabularPreview {
  const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const delimiter = detectCsvDelimiter(firstLine);

  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(field.trim());
      matrix.push(row);
      row = [];
      field = "";
      i++;
    } else if (ch === "\n") {
      row.push(field.trim());
      matrix.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    matrix.push(row);
  }

  const nonEmpty = matrix.filter((r) => r.some((cell) => cell.length > 0));
  if (nonEmpty.length === 0) {
    return {
      sourceType: "csv",
      fileName,
      headers: [],
      suggestedMapping: {},
      sampleRows: [],
      allRows: [],
      totalRows: 0,
    };
  }

  const headers = nonEmpty[0].map((h, idx) => normalizeHeaderToken(h) || `Coluna_${idx + 1}`);
  const allRows: Array<Record<string, string>> = [];

  for (let r = 1; r < nonEmpty.length; r++) {
    const rec: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      rec[headers[c]] = (nonEmpty[r][c] ?? "").trim();
    }
    allRows.push(rec);
  }

  return {
    sourceType: "csv",
    fileName,
    headers,
    suggestedMapping: detectColumnMapping(headers),
    sampleRows: allRows.slice(0, 8),
    allRows,
    totalRows: allRows.length,
  };
}

/**
 * Parser de planilhas Excel `.xlsx` utilizando `exceljs` (seguro, sem dependências nativas).
 */
export async function parseXlsxBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ParsedTabularPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return {
      sourceType: "xlsx",
      fileName,
      headers: [],
      suggestedMapping: {},
      sampleRows: [],
      allRows: [],
      totalRows: 0,
    };
  }

  const cellToString = (val: ExcelJS.CellValue): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val.trim();
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (val instanceof Date) return val.toISOString();
    if (typeof val === "object") {
      if ("text" in val && typeof val.text === "string") return val.text.trim();
      if ("result" in val && val.result !== undefined && val.result !== null) {
        return String(val.result).trim();
      }
      if ("richText" in val && Array.isArray(val.richText)) {
        return val.richText.map((rt) => rt.text).join("").trim();
      }
    }
    return String(val).trim();
  };

  let headerRowIdx = -1;
  let headers: string[] = [];
  const allRows: Array<Record<string, string>> = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = cellToString(cell.value);
    });
    const hasContent = values.some((v) => v && v.trim().length > 0);
    if (!hasContent) return;

    if (headerRowIdx === -1) {
      headerRowIdx = rowNumber;
      headers = values.map((v, idx) => normalizeHeaderToken(v) || `Coluna_${idx + 1}`);
      return;
    }

    const rec: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      rec[headers[i]] = (values[i] ?? "").trim();
    }
    allRows.push(rec);
  });

  return {
    sourceType: "xlsx",
    fileName,
    headers,
    suggestedMapping: detectColumnMapping(headers),
    sampleRows: allRows.slice(0, 8),
    allRows,
    totalRows: allRows.length,
  };
}

/**
 * Extrator de catálogos PDF (§6):
 * 1. Verifica se o PDF possui texto extraível via `unpdf`.
 * 2. Se for digitalizado (sem camada de texto), sinaliza explicitamente `needsOcrFallback: true`.
 * 3. Tenta extrair linhas tabulares de produto (`SKU / EAN / Nome / Preço / Estoque`).
 */
export async function parsePdfCatalogBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ParsedTabularPreview> {
  const { extractText } = await import("unpdf");
  const { totalPages, text } = await extractText(new Uint8Array(buffer), {
    mergePages: true,
  });

  const mergedText = Array.isArray(text) ? text.join("\n") : String(text || "");
  const lines = mergedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const hasExtractableText = lines.join("").length >= 15;
  const warnings: string[] = [];

  if (!hasExtractableText) {
    warnings.push(
      "PDF sem camada de texto selecionável (possivelmente digitalizado). Envie páginas em PNG/JPEG pelo Scanner por Fotografia + OCR para conferência manual."
    );
    return {
      sourceType: "pdf",
      fileName,
      headers: ["nome", "sku", "gtin", "preco", "estoque", "categoria"],
      suggestedMapping: {
        name: "nome",
        sku: "sku",
        gtin: "gtin",
        price: "preco",
        stock: "estoque",
        category: "categoria",
      },
      sampleRows: [],
      allRows: [],
      totalRows: 0,
      pdfMeta: {
        pageCount: totalPages || 0,
        hasExtractableText: false,
        needsOcrFallback: true,
        warnings,
      },
    };
  }

  // Tentar detectar linhas estruturadas separadas por `;`, `|`, `\t` ou múltiplos espaços + preço/EAN
  const allRows: Array<Record<string, string>> = [];
  for (const line of lines) {
    // Pular provável linha de cabeçalho genérico
    if (/^(produto|nome)\s*[;|,\t]/i.test(line)) continue;

    if (/[;|\t]/.test(line)) {
      const parts = line.split(/[;|\t]/).map((p) => p.trim());
      if (parts.length >= 2) {
        const gtinFound = parts.find((p) => validateGtin(p).valid) || "";
        const priceFound = parts.find((p) => /R?\$?\s*\d+[.,]\d{2}/.test(p)) || "";
        const namePart =
          parts.find((p) => p !== gtinFound && p !== priceFound && /[A-Za-zÀ-ÿ]{3,}/.test(p)) ||
          parts[0];
        allRows.push({
          nome: namePart,
          sku: parts[0] !== namePart && parts[0] !== gtinFound ? parts[0] : "",
          gtin: gtinFound,
          preco: priceFound,
          estoque: "",
          categoria: "",
        });
        continue;
      }
    }

    // Heurística de linha de catálogo contendo preço (`Nome do Produto ... R$ 129,90`) ou GTIN válido
    const priceMatch = line.match(/R\$\s*(\d{1,5}(?:\.\d{3})*,\d{2})/);
    const digits = line.match(/\b\d{8,14}\b/g) || [];
    const validGtin = digits.find((d) => validateGtin(d).valid) || "";

    if (priceMatch || validGtin) {
      let cleanedName = line
        .replace(/R\$\s*\d{1,5}(?:\.\d{3})*,\d{2}/g, "")
        .replace(validGtin, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      cleanedName = cleanedName.replace(/^[-–—•·:\s]+|[-–—•·:\s]+$/g, "");
      if (cleanedName.length >= 3) {
        allRows.push({
          nome: cleanedName,
          sku: "",
          gtin: validGtin,
          preco: priceMatch ? priceMatch[0] : "",
          estoque: "",
          categoria: "",
        });
      }
    }
  }

  if (allRows.length === 0) {
    warnings.push(
      "Texto extraído do PDF, porém nenhuma linha de tabela de produtos com nome/preço/GTIN foi reconhecida automaticamente. Revise ou converta para CSV/XLSX."
    );
  } else {
    warnings.push(
      "Dados extraídos de PDF exigem conferência integral de nome, preço e estoque antes da aprovação."
    );
  }

  const headers = ["nome", "sku", "gtin", "preco", "estoque", "categoria"];
  return {
    sourceType: "pdf",
    fileName,
    headers,
    suggestedMapping: {
      name: "nome",
      sku: "sku",
      gtin: "gtin",
      price: "preco",
      stock: "estoque",
      category: "categoria",
    },
    sampleRows: allRows.slice(0, 8),
    allRows,
    totalRows: allRows.length,
    pdfMeta: {
      pageCount: totalPages || 1,
      hasExtractableText: true,
      needsOcrFallback: false,
      warnings,
    },
  };
}

/**
 * Aplica o mapeamento de colunas confirmado pelo operador para normalizar linhas tabulares.
 */
export function applyColumnMapping(
  rows: Array<Record<string, string>>,
  mapping: Partial<Record<CanonicalColumnKey, string>>,
  fileName: string
): NormalizedImportedProductRow[] {
  const getVal = (row: Record<string, string>, key: CanonicalColumnKey): string => {
    const col = mapping[key];
    if (!col) return "";
    return (row[col] ?? "").trim();
  };

  const results: NormalizedImportedProductRow[] = [];
  rows.forEach((row, index) => {
    const name = getVal(row, "name");
    const sku = getVal(row, "sku") || null;
    const rawGtin = getVal(row, "gtin");
    const gtinCheck = rawGtin ? validateGtin(rawGtin) : null;
    const gtin = gtinCheck?.valid ? gtinCheck.normalized : rawGtin || null;

    if (!name && !sku && !gtin) return;

    const size = getVal(row, "size");
    const color = getVal(row, "color");
    const presentation = getVal(row, "presentation") || null;
    const explicitVariant = getVal(row, "variantName");

    const optionsSummary: Record<string, string> = {};
    if (color) optionsSummary.Cor = color;
    if (size) optionsSummary.Tamanho = size;
    if (presentation) optionsSummary.Apresentacao = presentation;

    const variantParts = [color, size, presentation].filter(Boolean);
    const variantName = explicitVariant || variantParts.join(" / ") || "Padrão";

    results.push({
      externalSourceId: `${fileName}:row-${index + 2}`,
      name: name || (sku ? `Item ${sku}` : `Item ${gtin}`),
      sku,
      gtin,
      brand: getVal(row, "brand") || null,
      description: getVal(row, "description") || null,
      category: getVal(row, "category") || null,
      presentation,
      priceCents: parseFlexiblePriceToCents(getVal(row, "price")),
      compareAtPriceCents: parseFlexiblePriceToCents(getVal(row, "compareAtPrice")),
      stockQuantity: parseFlexibleStock(getVal(row, "stock")),
      variantName,
      optionsSummary,
      imageRef: getVal(row, "imageUrl") || null,
    });
  });

  return results;
}
