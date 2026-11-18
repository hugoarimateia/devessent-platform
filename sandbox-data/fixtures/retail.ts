export interface SandboxRetailProductFixture {
  name: string;
  slug: string;
  description: string;
  status: "draft" | "published" | "archived";
  categoryNames: string[];
  options: Array<{ name: string; values: string[] }>;
  variants: Array<{
    sku: string;
    name: string;
    priceCents: number;
    compareAtPriceCents?: number | null;
    stockQuantity: number;
    isAvailable: boolean;
    optionsSummary: Record<string, string>;
  }>;
}

export interface SandboxRetailStoreFixture {
  companySlug: string;
  storeName: string;
  currency: string;
  isActive: boolean;
  inventoryMode: "track_quantity" | "untracked";
  categories: Array<{
    name: string;
    slug: string;
    description: string;
    sortOrder: number;
  }>;
  products: SandboxRetailProductFixture[];
}

export const sandboxRetailStores: readonly SandboxRetailStoreFixture[] = [
  {
    companySlug: "atelier-sandbox",
    storeName: "Ateliê Sandbox Store",
    currency: "BRL",
    isActive: true,
    inventoryMode: "track_quantity",
    categories: [
      {
        name: "Moda Masculina",
        slug: "moda-masculina",
        description: "Camisetas, calças e jaquetas de alfaiataria masculina",
        sortOrder: 1,
      },
      {
        name: "Moda Feminina",
        slug: "moda-feminina",
        description: "Peças autorais e atemporais de moda feminina",
        sortOrder: 2,
      },
      {
        name: "Alfaiataria & Sob Medida",
        slug: "alfaiataria-sob-medida",
        description: "Criações exclusivas confeccionadas em alta costura",
        sortOrder: 3,
      },
      {
        name: "Acessórios",
        slug: "acessorios",
        description: "Bolsas, cintos e complementos de vestuário",
        sortOrder: 4,
      },
    ],
    products: [
      {
        name: "Camiseta Essential Linho",
        slug: "camiseta-essential-linho",
        description: "Camiseta de corte reto confeccionada em linho nobre com elastano.",
        status: "published",
        categoryNames: ["Moda Masculina", "Moda Feminina"],
        options: [
          { name: "Cor", values: ["Preto", "Off-White", "Vinho"] },
          { name: "Tamanho", values: ["P", "M", "G", "GG"] },
        ],
        variants: [
          { sku: "AT-TEE-BLK-P", name: "Preto / P", priceCents: 18900, compareAtPriceCents: 22900, stockQuantity: 15, isAvailable: true, optionsSummary: { Cor: "Preto", Tamanho: "P" } },
          { sku: "AT-TEE-BLK-M", name: "Preto / M", priceCents: 18900, compareAtPriceCents: 22900, stockQuantity: 20, isAvailable: true, optionsSummary: { Cor: "Preto", Tamanho: "M" } },
          { sku: "AT-TEE-BLK-G", name: "Preto / G", priceCents: 18900, compareAtPriceCents: 22900, stockQuantity: 12, isAvailable: true, optionsSummary: { Cor: "Preto", Tamanho: "G" } },
          { sku: "AT-TEE-WHT-M", name: "Off-White / M", priceCents: 18900, compareAtPriceCents: null, stockQuantity: 10, isAvailable: true, optionsSummary: { Cor: "Off-White", Tamanho: "M" } },
          { sku: "AT-TEE-VIN-G", name: "Vinho / G", priceCents: 18900, compareAtPriceCents: null, stockQuantity: 8, isAvailable: true, optionsSummary: { Cor: "Vinho", Tamanho: "G" } },
        ],
      },
      {
        name: "Moletom Oversized Street",
        slug: "moletom-oversized-street",
        description: "Moletom pesado 400g/m² em algodão premium com caimento volumoso.",
        status: "published",
        categoryNames: ["Moda Masculina", "Moda Feminina"],
        options: [
          { name: "Cor", values: ["Preto", "Cinza Mescla"] },
          { name: "Tamanho", values: ["M", "G"] },
        ],
        variants: [
          { sku: "AT-HD-BLK-M", name: "Preto / M", priceCents: 38900, compareAtPriceCents: null, stockQuantity: 8, isAvailable: true, optionsSummary: { Cor: "Preto", Tamanho: "M" } },
          { sku: "AT-HD-BLK-G", name: "Preto / G", priceCents: 38900, compareAtPriceCents: null, stockQuantity: 6, isAvailable: true, optionsSummary: { Cor: "Preto", Tamanho: "G" } },
          { sku: "AT-HD-GRY-M", name: "Cinza Mescla / M", priceCents: 38900, compareAtPriceCents: null, stockQuantity: 10, isAvailable: true, optionsSummary: { Cor: "Cinza Mescla", Tamanho: "M" } },
        ],
      },
      {
        name: "Calça Cargo Utilitária",
        slug: "calca-cargo-utilitaria",
        description: "Calça cargo em sarja pesada com bolsos frontais fole e ajustadores em metal.",
        status: "published",
        categoryNames: ["Moda Masculina"],
        options: [
          { name: "Tamanho", values: ["38", "40", "42"] },
        ],
        variants: [
          { sku: "AT-CRG-BLK-38", name: "Tamanho 38", priceCents: 34900, compareAtPriceCents: null, stockQuantity: 5, isAvailable: true, optionsSummary: { Tamanho: "38" } },
          { sku: "AT-CRG-BLK-40", name: "Tamanho 40", priceCents: 34900, compareAtPriceCents: null, stockQuantity: 8, isAvailable: true, optionsSummary: { Tamanho: "40" } },
          { sku: "AT-CRG-BLK-42", name: "Tamanho 42", priceCents: 34900, compareAtPriceCents: null, stockQuantity: 4, isAvailable: true, optionsSummary: { Tamanho: "42" } },
        ],
      },
      {
        name: "Jaqueta Urban Minimalist",
        slug: "jaqueta-urban-minimalist",
        description: "Jaqueta bomber com forro térmico acetinado e fechamento em zíper metálico duplo.",
        status: "draft",
        categoryNames: ["Alfaiataria & Sob Medida"],
        options: [
          { name: "Tamanho", values: ["M", "G"] },
        ],
        variants: [
          { sku: "AT-JKT-BLK-M", name: "Preto / M", priceCents: 58900, compareAtPriceCents: null, stockQuantity: 4, isAvailable: true, optionsSummary: { Tamanho: "M" } },
          { sku: "AT-JKT-BLK-G", name: "Preto / G", priceCents: 58900, compareAtPriceCents: null, stockQuantity: 3, isAvailable: true, optionsSummary: { Tamanho: "G" } },
        ],
      },
    ],
  },
  {
    companySlug: "verde-sandbox",
    storeName: "Verde Sandbox Sustentabilidade",
    currency: "BRL",
    isActive: true,
    inventoryMode: "track_quantity",
    categories: [
      {
        name: "Vasos & Cerâmicas",
        slug: "vasos-ceramicas",
        description: "Vasos modelados à mão em cerâmica terracota",
        sortOrder: 1,
      },
      {
        name: "Plantas Raras",
        slug: "plantas-raras",
        description: "Espécimes botânicos selecionados e aclimatados",
        sortOrder: 2,
      },
    ],
    products: [
      {
        name: "Vaso Cerâmica Terracota",
        slug: "vaso-ceramica-terracota",
        description: "Vaso modelado à mão em argila terracota queimada em alta temperatura.",
        status: "published",
        categoryNames: ["Vasos & Cerâmicas"],
        options: [
          { name: "Acabamento", values: ["Fosco", "Esmaltado"] },
        ],
        variants: [
          { sku: "VRD-VAS-FOSC", name: "Fosco", priceCents: 12000, compareAtPriceCents: null, stockQuantity: 15, isAvailable: true, optionsSummary: { Acabamento: "Fosco" } },
          { sku: "VRD-VAS-ESM", name: "Esmaltado", priceCents: 14500, compareAtPriceCents: 16000, stockQuantity: 10, isAvailable: true, optionsSummary: { Acabamento: "Esmaltado" } },
        ],
      },
      {
        name: "Monstera Deliciosa Variegata",
        slug: "monstera-deliciosa-variegata",
        description: "Muda aclimatada com alto grau de variegação em vaso de cultivo.",
        status: "draft",
        categoryNames: ["Plantas Raras"],
        options: [],
        variants: [
          { sku: "VRD-PLT-MONS", name: "Muda Padrão", priceCents: 45000, compareAtPriceCents: null, stockQuantity: 2, isAvailable: true, optionsSummary: {} },
        ],
      },
    ],
  },
];

