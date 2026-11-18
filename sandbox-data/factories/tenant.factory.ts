import type { SandboxCompanyFixture } from "../fixtures/companies";

export class TenantFactory {
  /**
   * Constrói dados para um estabelecimento de demonstração.
   */
  public static buildTenant(overrides: Partial<SandboxCompanyFixture> = {}): SandboxCompanyFixture {
    const timestamp = Date.now();
    const name = overrides.name || `Empresa Demo ${timestamp}`;
    const slug = overrides.slug || `empresa-demo-${timestamp}`;
    const segmentMetadata = overrides.segmentMetadata || "segmento demonstrativo geral";
    const status = overrides.status || "active";
    const timezone = overrides.timezone || "America/Sao_Paulo";
    const locale = overrides.locale || "pt-BR";

    return {
      name,
      slug,
      segmentMetadata,
      status,
      timezone,
      locale,
      settings: {
        displayName: overrides.settings?.displayName || name,
        contactEmail: overrides.settings?.contactEmail || `contato@${slug}.sandbox.devessent.test`,
        contactPhone: overrides.settings?.contactPhone || "(11) 90000-0000",
        segmentLabel: overrides.settings?.segmentLabel || "Operação Comercial",
        primaryColor: overrides.settings?.primaryColor || "#6C5CE7",
        secondaryColor: overrides.settings?.secondaryColor || "#1E293B",
        monogram: overrides.settings?.monogram || "ED",
        brandDescription:
          overrides.settings?.brandDescription ||
          "Unidade operacional demonstrativa da DevEssent Platform.",
      },
    };
  }
}

