/**
 * Sistema de Identidade Visual Dinâmica por Estabelecimento.
 * - Nenhuma empresa fictícia ou slug de sandbox está hardcoded neste módulo.
 * - Deriva paletas acessíveis (WCAG AA) para Light Mode e Dark Mode diretamente dos metadados
 *   estruturados persistidos em `public.tenant_settings` (primary_color, segment_label,
 *   monogram, brand_description, display_name).
 * - Exposição de CSS Custom Properties (`cssVariables`) permite adaptar tipografia, filetes,
 *   botões contextuais e navegação em ambos os temas sem recarregar a página.
 * - Nunca executa CSS arbitrário enviado pelo cliente (valida estritamente #RRGGBB).
 */

export interface TenantBrandInput {
  slug?: string | null;
  name?: string | null;
  displayName?: string | null;
  segmentLabel?: string | null;
  primaryColor?: string | null;
  monogram?: string | null;
  brandDescription?: string | null;
}

export interface TenantBrandPreset {
  key: string;
  primaryHex: string;
  segmentTag: string;
  monogram: string;
  accentLight: string;
  accentDark: string;
  badgeBgLight: string;
  badgeBgDark: string;
  badgeTextLight: string;
  badgeTextDark: string;
  fillLight: string;
  fillDark: string;
  surfaceTintLight: string;
  surfaceTintDark: string;
  borderTintLight: string;
  borderTintDark: string;
  heroGradientLight: string;
  heroGradientDark: string;
  bannerGradientLight: string;
  bannerGradientDark: string;
  description: string;
  cssVariables: Record<string, string>;
}

export const DEFAULT_BRAND_HEX = "#5B46E5";

export const BRAND_COLOR_SWATCHES: ReadonlyArray<{ label: string; hex: string }> = [
  { label: "Violeta DevEssent", hex: "#5B46E5" },
  { label: "Esmeralda Botânico", hex: "#1B7A52" },
  { label: "Terracota Editorial", hex: "#9A5238" },
  { label: "Azul Safira", hex: "#2563EB" },
  { label: "Âmbar Ouro", hex: "#B45309" },
  { label: "Rosa Carmim", hex: "#BE185D" },
  { label: "Petróleo Profundo", hex: "#0F766E" },
  { label: "Ardósia Executiva", hex: "#334155" },
];

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;

function parseHexToRgb(hex?: string | null): { r: number; g: number; b: number; normalized: string } {
  const clean = (hex || "").trim();
  const match = HEX_COLOR_REGEX.exec(clean);
  if (!match) {
    return { r: 91, g: 70, b: 229, normalized: DEFAULT_BRAND_HEX };
  }
  const raw = match[1];
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
    normalized: `#${raw.toUpperCase()}`,
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function deriveMonogram(
  explicitMonogram?: string | null,
  displayName?: string | null,
  name?: string | null,
  slug?: string | null
): string {
  const trimmedMonogram = (explicitMonogram || "").trim().toUpperCase();
  if (/^[A-Z0-9]{1,3}$/.test(trimmedMonogram)) {
    return trimmedMonogram;
  }

  const source = (displayName || name || slug || "Estabelecimento").trim();
  const words = source
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9À-ÿ]/g, ""))
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return (words[0]?.slice(0, 2) || "DE").toUpperCase();
}

export function resolveTenantBrand(
  inputOrSlug?: TenantBrandInput | string | null,
  legacyName?: string | null
): TenantBrandPreset {
  const input: TenantBrandInput =
    typeof inputOrSlug === "string" || inputOrSlug === null || inputOrSlug === undefined
      ? { slug: inputOrSlug, name: legacyName }
      : inputOrSlug;

  const { r, g, b, normalized } = parseHexToRgb(input.primaryColor);
  const { h, s, l } = rgbToHsl(r, g, b);

  const satLight = clamp(s, 36, 78);
  const satDark = clamp(s, 45, 84);
  const lightAccentL = clamp(l, 28, 42);
  const darkAccentL = clamp(l, 64, 76);

  const accentLight = `hsl(${h}, ${satLight}%, ${lightAccentL}%)`;
  const accentDark = `hsl(${h}, ${satDark}%, ${darkAccentL}%)`;
  const fillLight = `hsl(${h}, ${clamp(s, 38, 72)}%, 29%)`;
  const fillDark = `hsl(${h}, ${clamp(s, 48, 76)}%, 44%)`;
  const badgeBgLight = `rgba(${r}, ${g}, ${b}, 0.10)`;
  const badgeBgDark = `rgba(${r}, ${g}, ${b}, 0.16)`;
  const badgeTextLight = `hsl(${h}, ${clamp(s, 45, 84)}%, 26%)`;
  const badgeTextDark = `hsl(${h}, ${clamp(s, 55, 88)}%, 78%)`;
  const surfaceTintLight = `rgba(${r}, ${g}, ${b}, 0.045)`;
  const surfaceTintDark = `rgba(${r}, ${g}, ${b}, 0.085)`;
  const borderTintLight = `rgba(${r}, ${g}, ${b}, 0.24)`;
  const borderTintDark = `rgba(${r}, ${g}, ${b}, 0.34)`;

  const monogram = deriveMonogram(input.monogram, input.displayName, input.name, input.slug);
  const segmentTag = (input.segmentLabel || "").trim() || "Operação Comercial";
  const description =
    (input.brandDescription || "").trim() ||
    "Unidade operacional estruturada com governança de equipe e controle de acesso.";

  return {
    key: input.slug ? `tenant-${input.slug}` : "tenant-dynamic",
    primaryHex: normalized,
    segmentTag,
    monogram,
    accentLight,
    accentDark,
    badgeBgLight,
    badgeBgDark,
    badgeTextLight,
    badgeTextDark,
    fillLight,
    fillDark,
    surfaceTintLight,
    surfaceTintDark,
    borderTintLight,
    borderTintDark,
    heroGradientLight: `linear-gradient(135deg, hsl(${h}, ${satLight}%, ${clamp(lightAccentL - 4, 22, 36)}%) 0%, hsl(${(h + 14) % 360}, ${satLight}%, ${clamp(lightAccentL + 6, 32, 46)}%) 100%)`,
    heroGradientDark: `linear-gradient(135deg, hsl(${h}, ${clamp(s, 36, 72)}%, 26%) 0%, hsl(${(h + 14) % 360}, ${clamp(s, 36, 72)}%, 18%) 100%)`,
    bannerGradientLight: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.09) 0%, rgba(${r}, ${g}, ${b}, 0.02) 100%)`,
    bannerGradientDark: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.16) 0%, rgba(${r}, ${g}, ${b}, 0.04) 100%)`,
    description,
    cssVariables: {
      "--t-ink-light": accentLight,
      "--t-ink-dark": accentDark,
      "--t-fill-light": fillLight,
      "--t-fill-dark": fillDark,
      "--t-tint-light": surfaceTintLight,
      "--t-tint-dark": surfaceTintDark,
      "--t-badge-bg-light": badgeBgLight,
      "--t-badge-bg-dark": badgeBgDark,
      "--t-badge-text-light": badgeTextLight,
      "--t-badge-text-dark": badgeTextDark,
      "--t-border-light": borderTintLight,
      "--t-border-dark": borderTintDark,
    },
  };
}

export const ROLE_DISPLAY_MAP: Record<
  string,
  { label: string; shortLabel: string; description: string }
> = {
  owner: {
    label: "Proprietário",
    shortLabel: "Proprietário",
    description: "Controle integral sobre membros, convites e configurações do estabelecimento.",
  },
  manager: {
    label: "Gestor",
    shortLabel: "Gestor",
    description: "Gestão operacional de equipe, emissão de convites e preferências cadastrais.",
  },
  staff: {
    label: "Equipe",
    shortLabel: "Equipe",
    description: "Acesso operacional às rotinas e consultas autorizadas no estabelecimento.",
  },
  platform_admin: {
    label: "Administrador Global",
    shortLabel: "Admin Global",
    description: "Supervisão executiva e governança corporativa de estabelecimentos na plataforma.",
  },
};
