import { deflateSync } from "zlib";

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export interface DemoArtworkSpec {
  width?: number;
  height?: number;
  bgTop: [number, number, number];
  bgBottom: [number, number, number];
  accent: [number, number, number];
  secondary: [number, number, number];
  motif: "arch" | "botanical" | "diamond" | "pill";
}

/**
 * Gera um buffer PNG válido (image/png) de forma determinística em Node puro,
 * ideal para imagens demonstrativas leves (15-30 KB) no Supabase Storage (plano Free).
 */
export function generateDemoPngBuffer(spec: DemoArtworkSpec): Buffer {
  const width = spec.width ?? 600;
  const height = spec.height ?? 750;
  const [r1, g1, b1] = spec.bgTop;
  const [r2, g2, b2] = spec.bgBottom;
  const [ar, ag, ab] = spec.accent;
  const [sr, sg, sb] = spec.secondary;

  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);

  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type: None
    const ty = y / (height - 1);

    for (let x = 0; x < width; x++) {
      const tx = x / (width - 1);

      // Fundo em gradiente suave com sutil variação radial
      const distCenter = Math.hypot((x - cx) / width, (y - cy) / height);
      const vignette = Math.max(0, 1 - distCenter * 0.45);
      let r = Math.round((r1 + (r2 - r1) * ty) * (0.92 + 0.08 * vignette));
      let g = Math.round((g1 + (g2 - g1) * ty) * (0.92 + 0.08 * vignette));
      let b = Math.round((b1 + (b2 - b1) * ty) * (0.92 + 0.08 * vignette));

      // Moldura editorial fina
      const pad = 28;
      const inFrameEdge =
        (x >= pad && x <= width - pad && (y === pad || y === pad + 1 || y === height - pad || y === height - pad - 1)) ||
        (y >= pad && y <= height - pad && (x === pad || x === pad + 1 || x === width - pad || x === width - pad - 1));
      if (inFrameEdge) {
        r = Math.round(r * 0.7 + sr * 0.3);
        g = Math.round(g * 0.7 + sg * 0.3);
        b = Math.round(b * 0.7 + sb * 0.3);
      }

      // Forma geométrica principal central
      const dx = (x - cx) / (width * 0.3);
      const dy = (y - cy) / (height * 0.28);
      let inPrimary = false;
      let inSecondary = false;

      if (spec.motif === "arch") {
        const inUpperCircle = dy < 0 && dx * dx + dy * dy <= 1.0;
        const inLowerRect = dy >= 0 && dy <= 1.25 && Math.abs(dx) <= 1.0;
        inPrimary = inUpperCircle || inLowerRect;
        const dx2 = (x - (cx + 42)) / (width * 0.16);
        const dy2 = (y - (cy + 36)) / (height * 0.16);
        inSecondary = dx2 * dx2 + dy2 * dy2 <= 1.0;
      } else if (spec.motif === "botanical") {
        // Silhueta estilizada de folha / vaso botânico
        const leaf1 = Math.pow(dx + 0.35, 2) / 0.55 + Math.pow(dy + 0.25, 2) / 0.95 <= 1.0;
        const leaf2 = Math.pow(dx - 0.38, 2) / 0.45 + Math.pow(dy + 0.05, 2) / 0.75 <= 1.0;
        const pot = dy >= 0.48 && dy <= 1.15 && Math.abs(dx) <= 0.75 - (dy - 0.48) * 0.28;
        inPrimary = leaf1 || leaf2;
        inSecondary = pot;
      } else if (spec.motif === "diamond") {
        inPrimary = Math.abs(dx) + Math.abs(dy) <= 1.15;
        inSecondary = Math.abs(dx - 0.35) + Math.abs(dy - 0.35) <= 0.55;
      } else {
        // pill
        inPrimary = Math.abs(dx) <= 0.85 && Math.abs(dy) <= 0.85 && (Math.abs(dy) <= 0.45 || dx * dx + Math.pow(Math.abs(dy) - 0.45, 2) <= 0.72);
        const ringDist = Math.hypot(dx + 0.25, dy + 0.25);
        inSecondary = ringDist <= 0.48 && ringDist >= 0.32;
      }

      if (inPrimary) {
        const shade = 0.88 + 0.16 * (1 - tx * 0.6 - ty * 0.4);
        r = Math.min(255, Math.round(ar * shade));
        g = Math.min(255, Math.round(ag * shade));
        b = Math.min(255, Math.round(ab * shade));
      }

      if (inSecondary) {
        r = Math.round(r * 0.25 + sr * 0.75);
        g = Math.round(g * 0.25 + sg * 0.75);
        b = Math.round(b * 0.25 + sb * 0.75);
      }

      const idx = rowStart + 1 + x * 3;
      raw[idx] = Math.max(0, Math.min(255, r));
      raw[idx + 1] = Math.max(0, Math.min(255, g));
      raw[idx + 2] = Math.max(0, Math.min(255, b));
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: Truecolor (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = deflateSync(raw, { level: 9 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", iend),
  ]);
}
