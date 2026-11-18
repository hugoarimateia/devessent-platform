export interface SandboxCompanyFixture {
  name: string;
  slug: string;
  segmentMetadata: string;
  status: "active" | "suspended";
  timezone: string;
  locale: string;
  settings: {
    displayName: string;
    contactEmail: string;
    contactPhone: string;
    segmentLabel: string;
    primaryColor: string;
    secondaryColor: string;
    monogram: string;
    brandDescription: string;
  };
}

export const sandboxCompanies: readonly SandboxCompanyFixture[] = [
  {
    name: "Ateliê Sandbox",
    slug: "atelier-sandbox",
    segmentMetadata: "moda / vestuário artesanal",
    status: "active",
    timezone: "America/Sao_Paulo",
    locale: "pt-BR",
    settings: {
      displayName: "Ateliê Sandbox & Alta Costura",
      contactEmail: "contato@atelie.sandbox.devessent.test",
      contactPhone: "(11) 98888-1001",
      segmentLabel: "Moda & Confecção Autoral",
      primaryColor: "#9A5238",
      secondaryColor: "#2C2C2C",
      monogram: "AS",
      brandDescription:
        "Operação de varejo de moda autoral, coleções cápsula e peças sob medida.",
    },
  },
  {
    name: "Verde Sandbox",
    slug: "verde-sandbox",
    segmentMetadata: "serviços sustentáveis e produtos ecológicos",
    status: "active",
    timezone: "America/Sao_Paulo",
    locale: "pt-BR",
    settings: {
      displayName: "Verde Sandbox Sustentabilidade",
      contactEmail: "contato@verde.sandbox.devessent.test",
      contactPhone: "(11) 98888-1002",
      segmentLabel: "Botânica & Paisagismo",
      primaryColor: "#1B7A52",
      secondaryColor: "#FFFFF0",
      monogram: "VS",
      brandDescription:
        "Comércio especializado em arranjos autorais, plantas ornamentais e assinaturas.",
    },
  },
] as const;
