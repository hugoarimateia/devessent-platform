import { createHash, randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/modules/retail/schemas/image.schema";

export interface ValidatedImageBuffer {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  extension: "jpg" | "png" | "webp" | "gif";
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  safeFileName: string;
}

const MIN_IMAGE_BYTES = 64;
const MAX_IMAGE_DIMENSION = 10000;

/**
 * Detecta tipo MIME real exclusivamente via assinatura binária (magic bytes),
 * ignorando o header Content-Type ou extensão fornecida pelo cliente.
 */
export function detectImageSignature(
  buf: Buffer
): { mimeType: ValidatedImageBuffer["mimeType"]; extension: ValidatedImageBuffer["extension"] } | null {
  if (!buf || buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }

  // GIF: "GIF87a" ou "GIF89a"
  const gifSig = buf.toString("ascii", 0, 6);
  if (gifSig === "GIF87a" || gifSig === "GIF89a") {
    return { mimeType: "image/gif", extension: "gif" };
  }

  return null;
}

/**
 * Leitura pura de dimensões (width x height) a partir dos headers binários sem dependências nativas.
 */
export function readImageDimensions(
  buf: Buffer,
  mimeType: ValidatedImageBuffer["mimeType"]
): { width: number; height: number } | null {
  try {
    if (mimeType === "image/png" && buf.length >= 24) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      return width > 0 && height > 0 ? { width, height } : null;
    }

    if (mimeType === "image/gif" && buf.length >= 10) {
      const width = buf.readUInt16LE(6);
      const height = buf.readUInt16LE(8);
      return width > 0 && height > 0 ? { width, height } : null;
    }

    if (mimeType === "image/webp" && buf.length >= 30) {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8X" && buf.length >= 30) {
        const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { width, height };
      }
      if (chunk === "VP8 " && buf.length >= 30) {
        const width = buf.readUInt16LE(26) & 0x3fff;
        const height = buf.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      if (chunk === "VP8L" && buf.length >= 25) {
        const bits = buf.readUInt32LE(21);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { width, height };
      }
    }

    if (mimeType === "image/jpeg") {
      let offset = 2;
      while (offset + 9 < buf.length) {
        if (buf[offset] !== 0xff) break;
        const marker = buf[offset + 1];
        if (marker === 0xd9 || marker === 0xda) break;
        const length = buf.readUInt16BE(offset + 2);
        // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
        if (
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf)
        ) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          return width > 0 && height > 0 ? { width, height } : null;
        }
        if (length < 2) break;
        offset += 2 + length;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function sanitizeImageFileName(rawName: string, extension: string): string {
  const base = path
    .basename(rawName || "produto")
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "imagem"}-${randomUUID().slice(0, 8)}.${extension}`;
}

/**
 * Valida rigorosamente uma imagem (assinatura mágica, MIME permitido no Retail, peso <= 5 MB e dimensões).
 */
export function validateImageBuffer(
  buffer: Buffer,
  originalFileName: string,
  declaredMime?: string | null
): ValidatedImageBuffer {
  if (!buffer || buffer.length < MIN_IMAGE_BYTES) {
    throw new Error("Arquivo de imagem vazio ou corrompido.");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `Imagem excede o limite oficial do Retail (${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB).`
    );
  }

  const sig = detectImageSignature(buffer);
  if (!sig || !ALLOWED_MIME_TYPES.includes(sig.mimeType)) {
    throw new Error(
      "Assinatura binária de imagem inválida. Formatos permitidos: JPG, PNG, WebP e GIF."
    );
  }

  if (
    declaredMime &&
    declaredMime.trim().length > 0 &&
    !declaredMime.toLowerCase().includes("octet-stream")
  ) {
    const normalizedDeclared = declaredMime.toLowerCase().replace("image/jpg", "image/jpeg");
    if (normalizedDeclared !== sig.mimeType) {
      throw new Error(
        `Tipo MIME informado (${declaredMime}) diverge da assinatura real do arquivo (${sig.mimeType}).`
      );
    }
  }

  const dims = readImageDimensions(buffer, sig.mimeType);
  if (dims && (dims.width > MAX_IMAGE_DIMENSION || dims.height > MAX_IMAGE_DIMENSION)) {
    throw new Error(
      `Dimensões da imagem (${dims.width}x${dims.height}) excedem o limite máximo seguro (${MAX_IMAGE_DIMENSION}px).`
    );
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const safeFileName = sanitizeImageFileName(originalFileName, sig.extension);

  return {
    buffer,
    mimeType: sig.mimeType,
    extension: sig.extension,
    sizeBytes: buffer.length,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    sha256,
    safeFileName,
  };
}

function isPrivateOrReservedIp(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    clean === "localhost" ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal") ||
    clean === "::1" ||
    clean === "0.0.0.0"
  ) {
    return true;
  }

  if (net.isIPv4(clean)) {
    const parts = clean.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true; // link-local / cloud metadata
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // CGNAT
    if (parts[0] === 0) return true;
  }

  if (net.isIPv6(clean)) {
    if (
      clean === "::1" ||
      clean.startsWith("fc") ||
      clean.startsWith("fd") ||
      clean.startsWith("fe80")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Proteção Anti-SSRF (§10): só permite download de URLs HTTPS pertencentes a domínios
 * explicitamente autorizados em `CATALOG_SCANNER_ALLOWED_IMAGE_HOSTS`.
 */
export function assertSafeAuthorizedImageUrl(
  rawUrl: string,
  allowedHosts: string[]
): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("URL de imagem inválida.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("BLOQUEIO ANTI-SSRF: apenas URLs HTTPS são permitidas para imagens remotas.");
  }

  const host = parsed.hostname.toLowerCase();
  if (isPrivateOrReservedIp(host)) {
    throw new Error(
      "BLOQUEIO ANTI-SSRF: endereços locais, privados ou de metadados de nuvem são estritamente proibidos."
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error("BLOQUEIO ANTI-SSRF: credenciais embutidas na URL são proibidas.");
  }

  const normalizedAllowed = allowedHosts.map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (normalizedAllowed.length === 0) {
    throw new Error(
      "BLOQUEIO ANTI-SSRF: download remoto de imagens desabilitado (CATALOG_SCANNER_ALLOWED_IMAGE_HOSTS vazio). Envie o arquivo localmente ou autorize o domínio do fornecedor."
    );
  }

  const hostMatched = normalizedAllowed.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
  if (!hostMatched) {
    throw new Error(
      `BLOQUEIO ANTI-SSRF: domínio '${host}' não está na lista de origens de imagem autorizadas.`
    );
  }

  return parsed;
}

export async function fetchAuthorizedRemoteImage(
  rawUrl: string,
  allowedHosts: string[]
): Promise<ValidatedImageBuffer> {
  const safeUrl = assertSafeAuthorizedImageUrl(rawUrl, allowedHosts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(safeUrl.toString(), {
      method: "GET",
      redirect: "manual", // impede redirect para IP privado/interno
      signal: controller.signal,
    });

    if (res.status >= 300 && res.status < 400) {
      throw new Error("BLOQUEIO ANTI-SSRF: redirecionamentos HTTP em imagens remotas não são permitidos.");
    }

    if (!res.ok) {
      throw new Error(`Falha ao baixar imagem autorizada (HTTP ${res.status}).`);
    }

    const contentLength = Number(res.headers.get("content-length") || "0");
    if (contentLength > MAX_FILE_SIZE) {
      throw new Error("Imagem remota excede o limite de 5 MB.");
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    return validateImageBuffer(buf, path.basename(safeUrl.pathname) || "remote-image", null);
  } finally {
    clearTimeout(timer);
  }
}

export function getUploadsRootDir(): string {
  return path.resolve(process.cwd(), "data/uploads");
}

export function saveStagedImageFile(
  batchId: string,
  validated: ValidatedImageBuffer
): string {
  const safeBatch = batchId.replace(/[^a-zA-Z0-9_-]/g, "");
  const batchDir = path.join(getUploadsRootDir(), safeBatch);
  fs.mkdirSync(batchDir, { recursive: true });
  const fileName = `${validated.sha256.slice(0, 16)}-${validated.safeFileName}`;
  const fullPath = path.join(batchDir, fileName);
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, validated.buffer);
  }
  return path.posix.join(safeBatch, fileName);
}

export function readStagedImageFile(localRelativePath: string): Buffer {
  const root = getUploadsRootDir();
  const resolved = path.resolve(root, localRelativePath);
  if (!resolved.startsWith(root)) {
    throw new Error("Caminho de imagem local inválido (path traversal bloqueado).");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error("Arquivo de imagem local não encontrado no lote.");
  }
  return fs.readFileSync(resolved);
}
