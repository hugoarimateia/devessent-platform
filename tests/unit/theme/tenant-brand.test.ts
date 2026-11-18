import { describe, it, expect } from "vitest";
import {
  resolveTenantBrand,
  deriveMonogram,
  ROLE_DISPLAY_MAP,
  DEFAULT_BRAND_HEX,
} from "@/lib/theme/tenant-brand";

describe("Design System — Identidade Visual Dinâmica Baseada em Banco", () => {
  it("1. Deve derivar paleta acessível, variáveis CSS e monograma diretamente de configurações reais do banco", () => {
    const brand = resolveTenantBrand({
      slug: "estabelecimento-novo",
      name: "Torrefação Serra Azul",
      displayName: "Serra Azul Cafés Especiais",
      segmentLabel: "Cafeteria & Torrefação",
      primaryColor: "#1B7A52",
      monogram: "SA",
      brandDescription: "Torrefação artesanal de cafés de origem controlada.",
    });

    expect(brand.key).toBe("tenant-estabelecimento-novo");
    expect(brand.monogram).toBe("SA");
    expect(brand.primaryHex).toBe("#1B7A52");
    expect(brand.segmentTag).toBe("Cafeteria & Torrefação");
    expect(brand.description).toBe(
      "Torrefação artesanal de cafés de origem controlada."
    );
    expect(brand.accentLight).toContain("hsl(");
    expect(brand.accentDark).toContain("hsl(");
    expect(brand.fillLight).toContain("hsl(");
    expect(brand.fillDark).toContain("hsl(");
    expect(brand.heroGradientLight).toContain("linear-gradient(");
    expect(brand.cssVariables["--t-ink-light"]).toBe(brand.accentLight);
    expect(brand.cssVariables["--t-ink-dark"]).toBe(brand.accentDark);
    expect(brand.cssVariables["--t-fill-light"]).toBe(brand.fillLight);
    expect(brand.cssVariables["--t-fill-dark"]).toBe(brand.fillDark);
  });

  it("2. Deve aplicar fallback seguro para empresa recém-criada sem parâmetros customizados", () => {
    const brand = resolveTenantBrand("padaria-aurora", "Padaria Aurora");
    expect(brand.key).toBe("tenant-padaria-aurora");
    expect(brand.monogram).toBe("PA");
    expect(brand.primaryHex).toBe(DEFAULT_BRAND_HEX);
    expect(brand.segmentTag).toBe("Operação Comercial");
  });

  it("3. Deve rejeitar cores malformadas e reverter para a cor segura padrão (#5B46E5)", () => {
    const brand = resolveTenantBrand({
      slug: "empresa-teste",
      name: "Empresa Teste",
      primaryColor: "javascript:alert(1)",
    });
    expect(brand.primaryHex).toBe(DEFAULT_BRAND_HEX);
  });

  it("4. Deve gerar monograma automático a partir do nome quando não especificado", () => {
    expect(deriveMonogram(null, "Clínica Horizonte", null, null)).toBe("CH");
    expect(deriveMonogram("V3", "Clínica Horizonte", null, null)).toBe("V3");
  });

  it("5. Deve mapear todos os papéis RBAC para rótulos em português", () => {
    expect(ROLE_DISPLAY_MAP.owner.label).toBe("Proprietário");
    expect(ROLE_DISPLAY_MAP.manager.label).toBe("Gestor");
    expect(ROLE_DISPLAY_MAP.staff.label).toBe("Equipe");
    expect(ROLE_DISPLAY_MAP.platform_admin.label).toBe("Administrador Global");
  });
});
