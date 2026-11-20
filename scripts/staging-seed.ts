/**
 * DevEssent Platform — Provisionamento Permanente e Idempotente de Staging Cloud
 *
 * Regras estritas:
 * - Aceita EXCLUSIVAMENTE o projeto Supabase Cloud Staging autorizado (auebnppzxcvtaaqqlbts).
 * - Nunca executa resets, deletes ou sobrescritas destrutivas de registros já editados pelo usuário.
 * - Salva senhas geradas apenas em local-test/staging/.credentials.staging.local.json (ignorado pelo Git).
 * - Nunca imprime senhas, tokens ou chaves no terminal.
 * - Mantém estrutura financeira estritamente em modo sandbox (zero credenciais live, zero cobranças).
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { Database } from "../src/types/database.types";
import { encryptPaymentSecret } from "../src/modules/retail/payments/payment-crypto";
import {
  AUTHORIZED_STAGING_ORG_NAME,
  AUTHORIZED_STAGING_PROJECT_NAME,
  loadAndValidateStagingEnv,
} from "./lib/staging-env";
import { generateDemoPngBuffer, type DemoArtworkSpec } from "./lib/demo-image-generator";

const CREDENTIALS_VAULT_REL_PATH = "local-test/staging/.credentials.staging.local.json";

interface DemoAccountSpec {
  key: string;
  email: string;
  fullName: string;
  roleSummary: string;
  isPlatformAdmin?: boolean;
  memberships: Array<{ tenantSlug: string; role: "owner" | "manager" | "staff" }>;
}

interface StoredCredentialEntry {
  key: string;
  email: string;
  fullName: string;
  roleSummary: string;
  password: string;
  userId: string;
}

interface CredentialsVault {
  projectRef: string;
  projectName: string;
  organization: string;
  appUrl: string;
  updatedAt: string;
  note: string;
  accounts: Record<string, StoredCredentialEntry>;
}

const DEMO_ACCOUNTS: DemoAccountSpec[] = [
  {
    key: "platform_admin",
    email: "admin.staging@devessent-demo.com",
    fullName: "Admin Global DevEssent (Demo)",
    roleSummary: "Platform Admin DevEssent",
    isPlatformAdmin: true,
    memberships: [],
  },
  {
    key: "owner_atelie",
    email: "owner.atelie@devessent-demo.com",
    fullName: "Clara Rocha (Proprietária · Demo)",
    roleSummary: "Owner — Ateliê Demonstrativo",
    memberships: [{ tenantSlug: "atelie-demonstrativo", role: "owner" }],
  },
  {
    key: "manager_atelie",
    email: "manager.atelie@devessent-demo.com",
    fullName: "Beatriz Lima (Gestora · Demo)",
    roleSummary: "Manager — Ateliê Demonstrativo",
    memberships: [{ tenantSlug: "atelie-demonstrativo", role: "manager" }],
  },
  {
    key: "staff_atelie",
    email: "staff.atelie@devessent-demo.com",
    fullName: "Thiago Neves (Equipe · Demo)",
    roleSummary: "Staff — Ateliê Demonstrativo",
    memberships: [{ tenantSlug: "atelie-demonstrativo", role: "staff" }],
  },
  {
    key: "owner_verde",
    email: "owner.verde@devessent-demo.com",
    fullName: "Renato Vasconcelos (Proprietário · Demo)",
    roleSummary: "Owner — Verde Demonstrativo",
    memberships: [{ tenantSlug: "verde-demonstrativo", role: "owner" }],
  },
  {
    key: "staff_verde",
    email: "staff.verde@devessent-demo.com",
    fullName: "Marina Prado (Equipe · Demo)",
    roleSummary: "Staff — Verde Demonstrativo",
    memberships: [{ tenantSlug: "verde-demonstrativo", role: "staff" }],
  },
  {
    key: "multi_manager",
    email: "multi.gestor@devessent-demo.com",
    fullName: "Camila Duarte (Gestora Multiempresa · Demo)",
    roleSummary: "Manager — Ateliê Demonstrativo & Verde Demonstrativo",
    memberships: [
      { tenantSlug: "atelie-demonstrativo", role: "manager" },
      { tenantSlug: "verde-demonstrativo", role: "manager" },
    ],
  },
];

interface DemoStoreSeedSpec {
  tenantSlug: string;
  tenantName: string;
  ownerAccountKey: string;
  settings: {
    displayName: string;
    segmentLabel: string;
    primaryColor: string;
    monogram: string;
    brandDescription: string;
  };
  store: {
    storeName: string;
    template: "editorial" | "experimental";
    heroBadge: string;
    brandHeadline: string;
    brandSubheadline: string;
    aboutText: string;
    announcementBar: string;
    accentColor: string;
    secondaryColor: string;
    contactEmail: string;
    contactPhone: string;
  };
  sandboxPayment: {
    sellerAccountId: string;
    sellerAccountLabel: string;
  };
  categories: Array<{
    name: string;
    slug: string;
    description: string;
    sortOrder: number;
  }>;
  products: Array<{
    name: string;
    slug: string;
    description: string;
    categorySlug: string;
    optionName: string;
    optionValues: string[];
    imageFileName: string;
    imageAlt: string;
    artwork: DemoArtworkSpec;
    variants: Array<{
      name: string;
      sku: string;
      priceCents: number;
      compareAtPriceCents?: number | null;
      stockQuantity: number;
      optionValue: string;
    }>;
  }>;
}

const DEMO_STORES: DemoStoreSeedSpec[] = [
  {
    tenantSlug: "atelie-demonstrativo",
    tenantName: "Ateliê Demonstrativo",
    ownerAccountKey: "owner_atelie",
    settings: {
      displayName: "Ateliê Demonstrativo",
      segmentLabel: "Moda & Alfaiataria Autoral (Demo)",
      primaryColor: "#9A4D2E",
      monogram: "AD",
      brandDescription:
        "Loja fictícia de demonstração da DevEssent Platform no Supabase Cloud Staging — vitrine Editorial.",
    },
    store: {
      storeName: "Ateliê Demonstrativo",
      template: "editorial",
      heroBadge: "COLEÇÃO DEMONSTRAÇÃO · STAGING",
      brandHeadline: "Alfaiataria contemporânea em fibras naturais",
      brandSubheadline:
        "Peças autorais de demonstração com corte arquitetônico, linho lavado e acabamento editorial.",
      aboutText:
        "O Ateliê Demonstrativo é uma loja fictícia criada exclusivamente para homologação diária da DevEssent Platform no ambiente Supabase Cloud Staging.",
      announcementBar: "AMBIENTE DEMONSTRATIVO STAGING · PEDIDOS E PAGAMENTOS APENAS EM SANDBOX",
      accentColor: "#9A4D2E",
      secondaryColor: "#F6F1EA",
      contactEmail: "contato@atelie-demo.devessent-demo.com",
      contactPhone: "(11) 99001-0100",
    },
    sandboxPayment: {
      sellerAccountId: "MP-SANDBOX-ATELIE-DEMO-01",
      sellerAccountLabel: "Ateliê Demonstrativo (Conta Sandbox)",
    },
    categories: [
      {
        name: "Alfaiataria",
        slug: "alfaiataria",
        description: "Blazers, calças e cortes estruturados de demonstração.",
        sortOrder: 0,
      },
      {
        name: "Linho Natural",
        slug: "linho-natural",
        description: "Vestidos e camisas em linho e fibras orgânicas.",
        sortOrder: 1,
      },
      {
        name: "Acessórios Autorais",
        slug: "acessorios-autorais",
        description: "Bolsas e complementos minimalistas de demonstração.",
        sortOrder: 2,
      },
    ],
    products: [
      {
        name: "Blazer Estruturado Linho Cru",
        slug: "blazer-estruturado-linho-cru",
        description:
          "Blazer de alfaiataria demonstrativa em linho cru encorpado, forro parcial em viscose e botões naturais.",
        categorySlug: "alfaiataria",
        optionName: "Tamanho",
        optionValues: ["P", "M", "G"],
        imageFileName: "blazer-linho-cru.png",
        imageAlt: "Blazer Estruturado Linho Cru — Ateliê Demonstrativo",
        artwork: {
          bgTop: [245, 238, 228],
          bgBottom: [228, 214, 198],
          accent: [154, 77, 46],
          secondary: [72, 54, 44],
          motif: "arch",
        },
        variants: [
          { name: "Tamanho P", sku: "ATD-BLZ-P", priceCents: 48900, compareAtPriceCents: 54900, stockQuantity: 16, optionValue: "P" },
          { name: "Tamanho M", sku: "ATD-BLZ-M", priceCents: 48900, compareAtPriceCents: 54900, stockQuantity: 20, optionValue: "M" },
          { name: "Tamanho G", sku: "ATD-BLZ-G", priceCents: 48900, compareAtPriceCents: 54900, stockQuantity: 12, optionValue: "G" },
        ],
      },
      {
        name: "Vestido Midi Terracota",
        slug: "vestido-midi-terracota",
        description:
          "Vestido midi fluido em linho misto tingido em tom terracota, decote quadrado e bolsos laterais invisíveis.",
        categorySlug: "linho-natural",
        optionName: "Tamanho",
        optionValues: ["P", "M"],
        imageFileName: "vestido-midi-terracota.png",
        imageAlt: "Vestido Midi Terracota — Ateliê Demonstrativo",
        artwork: {
          bgTop: [248, 236, 229],
          bgBottom: [232, 205, 190],
          accent: [179, 88, 55],
          secondary: [244, 234, 222],
          motif: "pill",
        },
        variants: [
          { name: "Tamanho P", sku: "ATD-VST-P", priceCents: 37900, compareAtPriceCents: null, stockQuantity: 14, optionValue: "P" },
          { name: "Tamanho M", sku: "ATD-VST-M", priceCents: 37900, compareAtPriceCents: null, stockQuantity: 18, optionValue: "M" },
        ],
      },
      {
        name: "Camisa Seda Fosca Areia",
        slug: "camisa-seda-fosca-areia",
        description:
          "Camisa de caimento leve em seda fosca lavada na cor areia, punhos largos e gola clássica.",
        categorySlug: "linho-natural",
        optionName: "Tamanho",
        optionValues: ["P", "M", "G"],
        imageFileName: "camisa-seda-areia.png",
        imageAlt: "Camisa Seda Fosca Areia — Ateliê Demonstrativo",
        artwork: {
          bgTop: [244, 241, 235],
          bgBottom: [219, 211, 198],
          accent: [130, 108, 86],
          secondary: [249, 246, 240],
          motif: "diamond",
        },
        variants: [
          { name: "Tamanho P", sku: "ATD-CAM-P", priceCents: 28900, compareAtPriceCents: null, stockQuantity: 15, optionValue: "P" },
          { name: "Tamanho M", sku: "ATD-CAM-M", priceCents: 28900, compareAtPriceCents: null, stockQuantity: 22, optionValue: "M" },
          { name: "Tamanho G", sku: "ATD-CAM-G", priceCents: 28900, compareAtPriceCents: null, stockQuantity: 10, optionValue: "G" },
        ],
      },
      {
        name: "Bolsa Estruturada Couro Vegetal",
        slug: "bolsa-estruturada-couro-vegetal",
        description:
          "Bolsa geométrica autoral com acabamento fosco e ferragens em latão escovado — edição de demonstração.",
        categorySlug: "acessorios-autorais",
        optionName: "Cor",
        optionValues: ["Caramelo", "Café"],
        imageFileName: "bolsa-couro-vegetal.png",
        imageAlt: "Bolsa Estruturada Couro Vegetal — Ateliê Demonstrativo",
        artwork: {
          bgTop: [239, 232, 224],
          bgBottom: [212, 196, 180],
          accent: [118, 69, 43],
          secondary: [232, 198, 152],
          motif: "arch",
        },
        variants: [
          { name: "Caramelo", sku: "ATD-BLS-CRM", priceCents: 54900, compareAtPriceCents: 59900, stockQuantity: 9, optionValue: "Caramelo" },
          { name: "Café", sku: "ATD-BLS-CAF", priceCents: 54900, compareAtPriceCents: 59900, stockQuantity: 7, optionValue: "Café" },
        ],
      },
    ],
  },
  {
    tenantSlug: "verde-demonstrativo",
    tenantName: "Verde Demonstrativo",
    ownerAccountKey: "owner_verde",
    settings: {
      displayName: "Verde Demonstrativo",
      segmentLabel: "Botânica & Design Vivo (Demo)",
      primaryColor: "#147A52",
      monogram: "VD",
      brandDescription:
        "Loja fictícia experimental da DevEssent Platform no Supabase Cloud Staging — vitrine Experimental.",
    },
    store: {
      storeName: "Verde Demonstrativo",
      template: "experimental",
      heroBadge: "ESTÚDIO BOTÂNICO · DEMO EXPERIMENTAL",
      brandHeadline: "Arquitetura viva para interiores contemporâneos",
      brandSubheadline:
        "Espécies selecionadas, cerâmica autoral e kits de cultivo demonstrativos em vitrine experimental.",
      aboutText:
        "A Verde Demonstrativo é a segunda empresa fictícia do ambiente Supabase Cloud Staging, configurada com template Experimental para validação multiempresa.",
      announcementBar: "VITRINE EXPERIMENTAL DEMONSTRAÇÃO · AMBIENTE STAGING SUPABASE CLOUD",
      accentColor: "#147A52",
      secondaryColor: "#E9F4EF",
      contactEmail: "contato@verde-demo.devessent-demo.com",
      contactPhone: "(21) 99002-0200",
    },
    sandboxPayment: {
      sellerAccountId: "MP-SANDBOX-VERDE-DEMO-02",
      sellerAccountLabel: "Verde Demonstrativo (Conta Sandbox)",
    },
    categories: [
      {
        name: "Plantas de Interior",
        slug: "plantas-de-interior",
        description: "Espécies ornamentais adaptadas a ambientes internos.",
        sortOrder: 0,
      },
      {
        name: "Cerâmica Artesanal",
        slug: "ceramica-artesanal",
        description: "Vasos e cachepôs autorais de alta temperatura.",
        sortOrder: 1,
      },
      {
        name: "Kits de Cultivo",
        slug: "kits-de-cultivo",
        description: "Terrários e conjuntos completos para cultivo urbano.",
        sortOrder: 2,
      },
    ],
    products: [
      {
        name: "Monstera Deliciosa em Vaso Cimento",
        slug: "monstera-deliciosa-vaso-cimento",
        description:
          "Planta ornamental de folhagem escultural acompanhada de vaso cilíndrico em cimento queimado fosco.",
        categorySlug: "plantas-de-interior",
        optionName: "Porte",
        optionValues: ["Médio", "Grande"],
        imageFileName: "monstera-vaso-cimento.png",
        imageAlt: "Monstera Deliciosa em Vaso Cimento — Verde Demonstrativo",
        artwork: {
          bgTop: [227, 240, 233],
          bgBottom: [195, 219, 206],
          accent: [20, 122, 82],
          secondary: [110, 118, 114],
          motif: "botanical",
        },
        variants: [
          { name: "Porte Médio", sku: "VRD-MON-M", priceCents: 18900, compareAtPriceCents: null, stockQuantity: 15, optionValue: "Médio" },
          { name: "Porte Grande", sku: "VRD-MON-G", priceCents: 25900, compareAtPriceCents: 28900, stockQuantity: 9, optionValue: "Grande" },
        ],
      },
      {
        name: "Vaso Cerâmica Esmaltada Musgo",
        slug: "vaso-ceramica-esmaltada-musgo",
        description:
          "Vaso artesanal torneado à mão com esmalte mineral verde musgo e drenagem com prato integrado.",
        categorySlug: "ceramica-artesanal",
        optionName: "Diâmetro",
        optionValues: ["18 cm", "24 cm"],
        imageFileName: "vaso-ceramica-musgo.png",
        imageAlt: "Vaso Cerâmica Esmaltada Musgo — Verde Demonstrativo",
        artwork: {
          bgTop: [236, 243, 238],
          bgBottom: [204, 222, 210],
          accent: [46, 107, 78],
          secondary: [215, 198, 174],
          motif: "pill",
        },
        variants: [
          { name: "18 cm", sku: "VRD-VAS-18", priceCents: 12900, compareAtPriceCents: null, stockQuantity: 18, optionValue: "18 cm" },
          { name: "24 cm", sku: "VRD-VAS-24", priceCents: 16900, compareAtPriceCents: null, stockQuantity: 14, optionValue: "24 cm" },
        ],
      },
      {
        name: "Kit Terrário Autossustentável",
        slug: "kit-terrario-autossustentavel",
        description:
          "Conjunto completo em vidro soprado com substrato drenante, carvão ativado, musgo vivo e guia ilustrado.",
        categorySlug: "kits-de-cultivo",
        optionName: "Formato",
        optionValues: ["Cúpula", "Cilindro"],
        imageFileName: "kit-terrario-autossustentavel.png",
        imageAlt: "Kit Terrário Autossustentável — Verde Demonstrativo",
        artwork: {
          bgTop: [230, 239, 235],
          bgBottom: [189, 212, 202],
          accent: [18, 99, 71],
          secondary: [239, 247, 242],
          motif: "diamond",
        },
        variants: [
          { name: "Cúpula", sku: "VRD-KIT-CUP", priceCents: 21900, compareAtPriceCents: null, stockQuantity: 12, optionValue: "Cúpula" },
          { name: "Cilindro", sku: "VRD-KIT-CIL", priceCents: 29900, compareAtPriceCents: 32900, stockQuantity: 8, optionValue: "Cilindro" },
        ],
      },
    ],
  },
];

function generateStrongPassword(): string {
  const bytes = randomBytes(12).toString("base64url");
  return `DvStg#${bytes}!9`;
}

function sha256Hex(val: string): string {
  return createHash("sha256").update(val).digest("hex");
}

function loadExistingVault(vaultPath: string): CredentialsVault | null {
  if (!fs.existsSync(vaultPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(vaultPath, "utf-8")) as CredentialsVault;
  } catch {
    return null;
  }
}

async function main() {
  const validated = loadAndValidateStagingEnv({ requireServiceRole: true });

  // Injeta chave de criptografia no processo para uso do encryptPaymentSecret
  if (validated.paymentEncryptionKey) {
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY = validated.paymentEncryptionKey;
  }
  process.env.SUPABASE_SERVICE_ROLE_KEY = validated.serviceRoleKey;

  console.log("🌱 DevEssent Platform — Staging Seed Idempotente");
  console.log(`   Organização : ${AUTHORIZED_STAGING_ORG_NAME}`);
  console.log(`   Projeto     : ${AUTHORIZED_STAGING_PROJECT_NAME} (${validated.projectRef})`);
  console.log(`   Destino     : ${validated.supabaseHost}`);

  const admin = createClient<Database>(validated.supabaseUrl, validated.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const vaultPath = path.resolve(process.cwd(), CREDENTIALS_VAULT_REL_PATH);
  const existingVault = loadExistingVault(vaultPath);
  const accountsOut: Record<string, StoredCredentialEntry> = {
    ...(existingVault?.accounts || {}),
  };

  // 1. Listar usuários existentes no Supabase Auth (paginado)
  const existingUsersByEmail = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(`Falha ao consultar auth.users no staging: ${error.message}`);
    }
    for (const u of data.users) {
      if (u.email) existingUsersByEmail.set(u.email.toLowerCase(), u.id);
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  // 2. Criar contas Auth faltantes (sem sobrescrever usuários existentes)
  const userIdsByKey = new Map<string, string>();
  let createdUsersCount = 0;

  for (const spec of DEMO_ACCOUNTS) {
    const emailLower = spec.email.toLowerCase();
    let userId = existingUsersByEmail.get(emailLower);

    if (!userId) {
      const password = generateStrongPassword();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: emailLower,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: spec.fullName,
          demo_environment: "staging",
        },
      });

      if (createErr || !created.user) {
        throw new Error(`Erro ao criar conta ${spec.email}: ${createErr?.message || "desconhecido"}`);
      }

      userId = created.user.id;
      createdUsersCount += 1;

      accountsOut[spec.key] = {
        key: spec.key,
        email: emailLower,
        fullName: spec.fullName,
        roleSummary: spec.roleSummary,
        password,
        userId,
      };
    } else {
      const existingEntry = accountsOut[spec.key];
      if (existingEntry) {
        accountsOut[spec.key] = {
          ...existingEntry,
          userId,
          email: emailLower,
          fullName: spec.fullName,
          roleSummary: spec.roleSummary,
        };
      }
    }

    userIdsByKey.set(spec.key, userId);

    // Garantir profile sincronizado (trigger on_auth_user_created cria automaticamente; fallback seguro)
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile) {
      await admin.from("profiles").insert({
        id: userId,
        full_name: spec.fullName,
      });
    }

    if (spec.isPlatformAdmin) {
      const { data: existingAdmin } = await admin
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingAdmin) {
        const { error: admErr } = await admin
          .from("platform_admins")
          .insert({ user_id: userId });
        if (admErr) throw new Error(`Erro ao promover Platform Admin: ${admErr.message}`);
      }
    }
  }

  // Salvar cofre local ignorado pelo Git (nunca imprimir senhas)
  fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
  const vaultPayload: CredentialsVault = {
    projectRef: validated.projectRef,
    projectName: AUTHORIZED_STAGING_PROJECT_NAME,
    organization: AUTHORIZED_STAGING_ORG_NAME,
    appUrl: validated.appUrl,
    updatedAt: new Date().toISOString(),
    note: "Credenciais exclusivas de demonstração do Supabase Cloud Staging. Arquivo ignorado pelo Git.",
    accounts: accountsOut,
  };
  fs.writeFileSync(vaultPath, JSON.stringify(vaultPayload, null, 2) + "\n", {
    encoding: "utf-8",
    mode: 0o600,
  });

  console.log(`✅ Contas Auth verificadas: ${DEMO_ACCOUNTS.length} (${createdUsersCount} novas).`);

  // 3. Provisionar empresas, lojas, categorias, produtos, variantes, imagens reais no Storage e conexões sandbox
  const tenantIdBySlug = new Map<string, string>();
  const storeIdBySlug = new Map<string, string>();
  const variantBySku = new Map<string, { variantId: string; productId: string; tenantId: string; storeId: string }>();

  let createdTenants = 0;
  let createdCategories = 0;
  let createdProducts = 0;
  let uploadedImages = 0;

  for (const storeSpec of DEMO_STORES) {
    const ownerUserId = userIdsByKey.get(storeSpec.ownerAccountKey);
    if (!ownerUserId) throw new Error(`Owner ausente para ${storeSpec.tenantSlug}`);

    // 3a. Tenant
    let { data: tenant } = await admin
      .from("tenants")
      .select("id, slug, name")
      .eq("slug", storeSpec.tenantSlug)
      .maybeSingle();

    if (!tenant) {
      const { data: insertedTenant, error: tErr } = await admin
        .from("tenants")
        .insert({
          name: storeSpec.tenantName,
          slug: storeSpec.tenantSlug,
          status: "active",
        })
        .select("id, slug, name")
        .single();

      if (tErr || !insertedTenant) {
        throw new Error(`Erro ao criar tenant ${storeSpec.tenantSlug}: ${tErr?.message}`);
      }
      tenant = insertedTenant;
      createdTenants += 1;
    }

    tenantIdBySlug.set(storeSpec.tenantSlug, tenant.id);

    // 3b. Tenant Settings (somente cria se não existir — preserva edições do usuário!)
    const { data: existingSettings } = await admin
      .from("tenant_settings")
      .select("tenant_id")
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (!existingSettings) {
      const { error: sErr } = await admin.from("tenant_settings").insert({
        tenant_id: tenant.id,
        display_name: storeSpec.settings.displayName,
        segment_label: storeSpec.settings.segmentLabel,
        primary_color: storeSpec.settings.primaryColor,
        monogram: storeSpec.settings.monogram,
        brand_description: storeSpec.settings.brandDescription,
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
      });
      if (sErr) throw new Error(`Erro ao criar tenant_settings: ${sErr.message}`);
    }

    // 3c. Retail Store (somente cria se não existir — preserva customizações feitas pelo usuário/admin!)
    let { data: retailStore } = await admin
      .from("retail_stores")
      .select("id, slug")
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (!retailStore) {
      const { data: insertedStore, error: rsErr } = await admin
        .from("retail_stores")
        .insert({
          tenant_id: tenant.id,
          store_name: storeSpec.store.storeName,
          slug: storeSpec.tenantSlug,
          currency: "BRL",
          template: storeSpec.store.template,
          hero_badge: storeSpec.store.heroBadge,
          brand_headline: storeSpec.store.brandHeadline,
          brand_subheadline: storeSpec.store.brandSubheadline,
          about_text: storeSpec.store.aboutText,
          announcement_bar: storeSpec.store.announcementBar,
          accent_color: storeSpec.store.accentColor,
          secondary_color: storeSpec.store.secondaryColor,
          contact_email: storeSpec.store.contactEmail,
          contact_phone: storeSpec.store.contactPhone,
          inventory_mode: "track_quantity",
          is_active: true,
        })
        .select("id, slug")
        .single();

      if (rsErr || !insertedStore) {
        throw new Error(`Erro ao criar retail_store ${storeSpec.tenantSlug}: ${rsErr?.message}`);
      }
      retailStore = insertedStore;
    }

    storeIdBySlug.set(storeSpec.tenantSlug, retailStore.id);

    // 3d. Categorias
    const categoryIdBySlug = new Map<string, string>();
    for (const cat of storeSpec.categories) {
      let { data: existingCat } = await admin
        .from("retail_categories")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("slug", cat.slug)
        .maybeSingle();

      if (!existingCat) {
        const { data: insertedCat, error: cErr } = await admin
          .from("retail_categories")
          .insert({
            tenant_id: tenant.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            sort_order: cat.sortOrder,
            is_active: true,
          })
          .select("id")
          .single();

        if (cErr || !insertedCat) {
          throw new Error(`Erro ao criar categoria ${cat.slug}: ${cErr?.message}`);
        }
        existingCat = insertedCat;
        createdCategories += 1;
      }

      categoryIdBySlug.set(cat.slug, existingCat.id);
    }

    // 3e. Produtos, Opções, Variantes e Imagens Reais no Bucket retail-media
    for (const prod of storeSpec.products) {
      let { data: existingProd } = await admin
        .from("retail_products")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("slug", prod.slug)
        .maybeSingle();

      if (!existingProd) {
        const { data: insertedProd, error: pErr } = await admin
          .from("retail_products")
          .insert({
            tenant_id: tenant.id,
            name: prod.name,
            slug: prod.slug,
            description: prod.description,
            status: "published",
            published_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (pErr || !insertedProd) {
          throw new Error(`Erro ao criar produto ${prod.slug}: ${pErr?.message}`);
        }
        existingProd = insertedProd;
        createdProducts += 1;

        // Vínculo produto <-> categoria
        const catId = categoryIdBySlug.get(prod.categorySlug);
        if (catId) {
          await admin.from("retail_product_categories").insert({
            tenant_id: tenant.id,
            product_id: existingProd.id,
            category_id: catId,
          });
        }

        // Opção do produto
        await admin.from("retail_product_options").insert({
          tenant_id: tenant.id,
          product_id: existingProd.id,
          name: prod.optionName,
          position: 0,
          values: prod.optionValues,
        });
      }

      // Variantes (verifica por SKU dentro do tenant — idempotente e não sobrescreve estoque editado!)
      for (let vIdx = 0; vIdx < prod.variants.length; vIdx++) {
        const v = prod.variants[vIdx];
        let { data: existingVar } = await admin
          .from("retail_variants")
          .select("id")
          .eq("tenant_id", tenant.id)
          .eq("sku", v.sku)
          .maybeSingle();

        if (!existingVar) {
          const { data: insertedVar, error: vErr } = await admin
            .from("retail_variants")
            .insert({
              tenant_id: tenant.id,
              product_id: existingProd.id,
              name: v.name,
              sku: v.sku,
              price_cents: v.priceCents,
              compare_at_price_cents: v.compareAtPriceCents ?? null,
              stock_quantity: v.stockQuantity,
              is_available: true,
              sort_order: vIdx,
              options_summary: { [prod.optionName]: v.optionValue },
            })
            .select("id")
            .single();

          if (vErr || !insertedVar) {
            throw new Error(`Erro ao criar variante ${v.sku}: ${vErr?.message}`);
          }
          existingVar = insertedVar;
        }

        variantBySku.set(v.sku, {
          variantId: existingVar.id,
          productId: existingProd.id,
          tenantId: tenant.id,
          storeId: retailStore.id,
        });
      }

      // Imagem real no bucket retail-media (somente se o produto ainda não possuir imagem)
      const { count: imgCount } = await admin
        .from("retail_product_images")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("product_id", existingProd.id);

      if ((imgCount || 0) === 0) {
        const pngBuffer = generateDemoPngBuffer(prod.artwork);
        const storagePath = `retail/${tenant.id}/products/${existingProd.id}/${prod.imageFileName}`;

        const { error: upErr } = await admin.storage
          .from("retail-media")
          .upload(storagePath, pngBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (upErr) {
          throw new Error(`Erro no upload de imagem ${storagePath}: ${upErr.message}`);
        }

        const { error: imgRowErr } = await admin.from("retail_product_images").insert({
          tenant_id: tenant.id,
          product_id: existingProd.id,
          storage_path: storagePath,
          alt_text: prod.imageAlt,
          is_primary: true,
          sort_order: 0,
        });

        if (imgRowErr) {
          throw new Error(`Erro ao registrar retail_product_images: ${imgRowErr.message}`);
        }

        uploadedImages += 1;
      }
    }

    // 3f. Conexão financeira SANDBOX por loja (nunca live, zero cobranças reais)
    const { data: existingConn } = await admin
      .from("retail_payment_connections")
      .select("id")
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (!existingConn) {
      const platformAdminId = userIdsByKey.get("platform_admin") || null;
      const sandboxToken = `SANDBOX-DEMO-TOKEN-${storeSpec.tenantSlug.toUpperCase()}-${randomBytes(8).toString("hex")}`;
      const sandboxHmac = `sandbox_hmac_demo_${storeSpec.tenantSlug}_${randomBytes(12).toString("hex")}`;

      const { error: connErr } = await admin.from("retail_payment_connections").insert({
        tenant_id: tenant.id,
        store_id: retailStore.id,
        provider: "mercado_pago",
        environment: "sandbox",
        status: "connected",
        seller_account_id: storeSpec.sandboxPayment.sellerAccountId,
        seller_account_label: storeSpec.sandboxPayment.sellerAccountLabel,
        public_key: `TEST-PUB-${storeSpec.tenantSlug.toUpperCase()}-DEMO`,
        access_token_encrypted: encryptPaymentSecret(sandboxToken, tenant.id),
        webhook_secret_encrypted: encryptPaymentSecret(sandboxHmac, tenant.id),
        scopes: ["sandbox_checkout", "sandbox_webhooks"],
        connected_by_user_id: platformAdminId,
        connected_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        metadata: {
          demoSeed: true,
          simulationOnly: true,
          warning: "Conexão demonstrativa Sandbox — sem cobranças reais.",
        },
      });

      if (connErr) {
        throw new Error(`Erro ao criar conexão sandbox ${storeSpec.tenantSlug}: ${connErr.message}`);
      }
    }
  }

  // 4. Garantir memberships exatas por empresa (sem sobrescrever papéis já editados)
  let createdMemberships = 0;
  for (const spec of DEMO_ACCOUNTS) {
    const userId = userIdsByKey.get(spec.key);
    if (!userId) continue;

    for (const m of spec.memberships) {
      const tenantId = tenantIdBySlug.get(m.tenantSlug);
      if (!tenantId) continue;

      const { data: existingMem } = await admin
        .from("tenant_memberships")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingMem) {
        const { error: mErr } = await admin.from("tenant_memberships").insert({
          tenant_id: tenantId,
          user_id: userId,
          role: m.role,
        });
        if (mErr) {
          throw new Error(`Erro ao vincular ${spec.email} em ${m.tenantSlug}: ${mErr.message}`);
        }
        createdMemberships += 1;
      }
    }
  }

  console.log(
    `✅ Empresas/catálogo verificados: ${DEMO_STORES.length} lojas (${createdTenants} novas), ` +
      `+${createdCategories} categorias, +${createdProducts} produtos, +${uploadedImages} imagens no Storage, +${createdMemberships} vínculos.`
  );

  // 5. Provisionar pedidos fictícios coerentes via RPCs transacionais reais (respeitando estoque!)
  interface DemoOrderSpec {
    orderNumber: string;
    storeSlug: string;
    sku: string;
    quantity: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    deliveryMode: "pickup" | "delivery";
    deliveryAddress: string | null;
    shippingFeeCents?: number;
    notes: string;
    targetStatus: "requested" | "confirmed" | "preparing" | "completed" | "cancelled";
    createPendingSandboxPayment?: boolean;
  }

  const DEMO_ORDERS: DemoOrderSpec[] = [
    {
      orderNumber: "ATD-DEMO-0001",
      storeSlug: "atelie-demonstrativo",
      sku: "ATD-BLZ-M",
      quantity: 1,
      customerName: "Fernanda Almeida (Cliente Demo)",
      customerPhone: "(11) 98111-1001",
      customerEmail: "fernanda.demo@devessent-demo.com",
      deliveryMode: "pickup",
      deliveryAddress: null,
      notes: "Pedido demonstrativo em estado Solicitado (aguardando confirmação da equipe).",
      targetStatus: "requested",
    },
    {
      orderNumber: "ATD-DEMO-0002",
      storeSlug: "atelie-demonstrativo",
      sku: "ATD-VST-P",
      quantity: 1,
      customerName: "Juliana Costa (Cliente Demo)",
      customerPhone: "(11) 98111-1002",
      customerEmail: "juliana.demo@devessent-demo.com",
      deliveryMode: "pickup",
      deliveryAddress: null,
      notes: "Pedido demonstrativo Confirmado com sessão de cobrança Sandbox pendente.",
      targetStatus: "confirmed",
      createPendingSandboxPayment: true,
    },
    {
      orderNumber: "ATD-DEMO-0003",
      storeSlug: "atelie-demonstrativo",
      sku: "ATD-CAM-M",
      quantity: 2,
      customerName: "Rafael Mendes (Cliente Demo)",
      customerPhone: "(11) 98111-1003",
      customerEmail: "rafael.demo@devessent-demo.com",
      deliveryMode: "delivery",
      deliveryAddress: "Rua das Acácias, 145 — Jardins, São Paulo/SP (Endereço Fictício)",
      shippingFeeCents: 2500,
      notes: "Pedido demonstrativo Em Preparação com frete calculado.",
      targetStatus: "preparing",
    },
    {
      orderNumber: "ATD-DEMO-0004",
      storeSlug: "atelie-demonstrativo",
      sku: "ATD-BLS-CRM",
      quantity: 1,
      customerName: "Mariana Ferreira (Cliente Demo)",
      customerPhone: "(11) 98111-1004",
      customerEmail: "mariana.demo@devessent-demo.com",
      deliveryMode: "pickup",
      deliveryAddress: null,
      notes: "Pedido demonstrativo Concluído após fluxo operacional completo.",
      targetStatus: "completed",
    },
    {
      orderNumber: "ATD-DEMO-0005",
      storeSlug: "atelie-demonstrativo",
      sku: "ATD-BLZ-P",
      quantity: 1,
      customerName: "Eduardo Santos (Cliente Demo)",
      customerPhone: "(11) 98111-1005",
      customerEmail: "eduardo.demo@devessent-demo.com",
      deliveryMode: "pickup",
      deliveryAddress: null,
      notes: "Pedido demonstrativo Cancelado após confirmação com reposição automática de estoque.",
      targetStatus: "cancelled",
    },
    {
      orderNumber: "VRD-DEMO-0001",
      storeSlug: "verde-demonstrativo",
      sku: "VRD-MON-M",
      quantity: 1,
      customerName: "Gustavo Oliveira (Cliente Demo)",
      customerPhone: "(21) 98222-2001",
      customerEmail: "gustavo.demo@devessent-demo.com",
      deliveryMode: "pickup",
      deliveryAddress: null,
      notes: "Pedido demonstrativo Solicitado na loja experimental.",
      targetStatus: "requested",
    },
    {
      orderNumber: "VRD-DEMO-0002",
      storeSlug: "verde-demonstrativo",
      sku: "VRD-KIT-CUP",
      quantity: 1,
      customerName: "Patrícia Nogueira (Cliente Demo)",
      customerPhone: "(21) 98222-2002",
      customerEmail: "patricia.demo@devessent-demo.com",
      deliveryMode: "pickup",
      deliveryAddress: null,
      notes: "Pedido demonstrativo Confirmado com baixa transacional de estoque na Verde Demonstrativo.",
      targetStatus: "confirmed",
    },
  ];

  let createdOrders = 0;

  for (const ord of DEMO_ORDERS) {
    const tenantId = tenantIdBySlug.get(ord.storeSlug);
    const storeId = storeIdBySlug.get(ord.storeSlug);
    const variantRef = variantBySku.get(ord.sku);
    if (!tenantId || !storeId || !variantRef) {
      throw new Error(`Referências ausentes para pedido ${ord.orderNumber}`);
    }

    const { data: existingOrder } = await admin
      .from("retail_orders")
      .select("id, status, payment_status")
      .eq("tenant_id", tenantId)
      .eq("order_number", ord.orderNumber)
      .maybeSingle();

    const ownerKey = ord.storeSlug === "atelie-demonstrativo" ? "owner_atelie" : "owner_verde";
    const ownerId = userIdsByKey.get(ownerKey)!;
    const ownerName =
      ord.storeSlug === "atelie-demonstrativo"
        ? "Clara Rocha (Proprietária · Demo)"
        : "Renato Vasconcelos (Proprietário · Demo)";

    let orderId: string;
    let currentStatus: string;

    if (existingOrder) {
      // Idempotente: se já atingiu o estado esperado ou foi alterado pelo usuário, não sobrescreve!
      const { count: historyCount } = await admin
        .from("retail_order_status_history")
        .select("id", { count: "exact", head: true })
        .eq("order_id", existingOrder.id);

      const isInterruptedInitialSeed =
        existingOrder.status === "requested" &&
        ord.targetStatus !== "requested" &&
        (historyCount || 0) <= 1;

      if (!isInterruptedInitialSeed) {
        continue;
      }

      orderId = existingOrder.id;
      currentStatus = existingOrder.status;
    } else {
      // Cria carrinho transitório para execução oficial via create_public_retail_order
      const cartTokenHash = sha256Hex(`staging-seed-cart-${ord.orderNumber}`);
      const publicTokenHash = sha256Hex(`staging-seed-receipt-${ord.orderNumber}`);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: cart, error: cartErr } = await admin
        .from("retail_carts")
        .insert({
          tenant_id: tenantId,
          store_id: storeId,
          cart_token_hash: cartTokenHash,
          status: "active",
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (cartErr || !cart) {
        throw new Error(`Erro ao criar carrinho para ${ord.orderNumber}: ${cartErr?.message}`);
      }

      const { error: itemErr } = await admin.from("retail_cart_items").insert({
        tenant_id: tenantId,
        cart_id: cart.id,
        product_id: variantRef.productId,
        variant_id: variantRef.variantId,
        quantity: ord.quantity,
      });

      if (itemErr) {
        throw new Error(`Erro ao adicionar item no carrinho ${ord.orderNumber}: ${itemErr.message}`);
      }

      const { data: createdOrderRes, error: createOrdErr } = await admin.rpc(
        "create_public_retail_order",
        {
          p_store_slug: ord.storeSlug,
          p_cart_token_hash: cartTokenHash,
          p_order_number: ord.orderNumber,
          p_public_token_hash: publicTokenHash,
          p_customer_name: ord.customerName,
          p_customer_phone: ord.customerPhone,
          p_customer_email: ord.customerEmail,
          p_delivery_mode: ord.deliveryMode,
          p_delivery_address: ord.deliveryAddress ?? undefined,
          p_notes: ord.notes,
          p_idempotency_key: `staging-seed-order-${ord.orderNumber}`,
        }
      );

      const createdPayload = createdOrderRes as { order?: { id?: string }; id?: string } | null;
      const resolvedId = createdPayload?.order?.id || createdPayload?.id;

      if (createOrdErr || !resolvedId) {
        throw new Error(`Erro na RPC create_public_retail_order (${ord.orderNumber}): ${createOrdErr?.message || "ID não retornado"}`);
      }

      orderId = resolvedId;
      currentStatus = "requested";
      createdOrders += 1;
    }

    // Aplica transições reais conforme estado alvo
    if (currentStatus === "requested" && ord.targetStatus !== "requested") {
      const { error: confErr } = await admin.rpc("confirm_retail_order", {
        p_tenant_id: tenantId,
        p_order_id: orderId,
        p_actor_user_id: ownerId,
        p_actor_name: ownerName,
        p_reason: "Confirmação operacional demonstrativa (staging seed)",
      });
      if (confErr) {
        throw new Error(`Erro ao confirmar ${ord.orderNumber}: ${confErr.message}`);
      }
    }

    if (typeof ord.shippingFeeCents === "number") {
      const { error: shipErr } = await admin.rpc("set_retail_order_shipping_fee", {
        p_tenant_id: tenantId,
        p_order_id: orderId,
        p_shipping_fee_cents: ord.shippingFeeCents,
        p_actor_user_id: ownerId,
        p_actor_name: ownerName,
      });
      if (shipErr) {
        throw new Error(`Erro ao definir frete em ${ord.orderNumber}: ${shipErr.message}`);
      }
    }

    if (ord.targetStatus === "preparing" || ord.targetStatus === "completed") {
      const { error: prepErr } = await admin.rpc("transition_retail_order_status", {
        p_tenant_id: tenantId,
        p_order_id: orderId,
        p_next_status: "preparing",
        p_actor_user_id: ownerId,
        p_actor_name: ownerName,
        p_reason: "Pedido em separação demonstrativa",
      });
      if (prepErr) {
        throw new Error(`Erro ao avançar ${ord.orderNumber} para preparing: ${prepErr.message}`);
      }
    }

    if (ord.targetStatus === "completed") {
      const { error: readyErr } = await admin.rpc("transition_retail_order_status", {
        p_tenant_id: tenantId,
        p_order_id: orderId,
        p_next_status: "ready",
        p_actor_user_id: ownerId,
        p_actor_name: ownerName,
        p_reason: "Pedido pronto para retirada demonstrativa",
      });
      if (readyErr) throw new Error(`Erro ao avançar ${ord.orderNumber} para ready: ${readyErr.message}`);

      const { error: compErr } = await admin.rpc("transition_retail_order_status", {
        p_tenant_id: tenantId,
        p_order_id: orderId,
        p_next_status: "completed",
        p_actor_user_id: ownerId,
        p_actor_name: ownerName,
        p_reason: "Retirada demonstrativa concluída",
      });
      if (compErr) throw new Error(`Erro ao concluir ${ord.orderNumber}: ${compErr.message}`);
    }

    if (ord.targetStatus === "cancelled") {
      const { error: cancErr } = await admin.rpc("cancel_retail_order", {
        p_tenant_id: tenantId,
        p_order_id: orderId,
        p_actor_user_id: ownerId,
        p_actor_name: ownerName,
        p_reason: "Cancelamento demonstrativo com reposição transacional de estoque",
      });
      if (cancErr) {
        throw new Error(`Erro ao cancelar ${ord.orderNumber}: ${cancErr.message}`);
      }
    }

    // Sessão financeira exclusivamente SANDBOX em estado pendente (nunca falsamente paga!)
    if (ord.createPendingSandboxPayment) {
      const shareTokenRaw = `demo_share_${ord.orderNumber.toLowerCase()}_${randomBytes(12).toString("hex")}`;
      const shareTokenHash = sha256Hex(shareTokenRaw);
      const shareExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await admin
        .from("retail_orders")
        .update({
          payment_share_token_hash: shareTokenHash,
          payment_share_expires_at: shareExpiresAt,
        })
        .eq("id", orderId)
        .eq("tenant_id", tenantId);

      const { error: payErr } = await admin.rpc("create_retail_payment_session_tx", {
        p_tenant_id: tenantId,
        p_order_id: orderId,
        p_provider: "mercado_pago",
        p_seller_account_id: "MP-SANDBOX-ATELIE-DEMO-01",
        p_external_preference_id: `SANDBOX-PREF-${ord.orderNumber}`,
        p_external_reference: `${tenantId}:${orderId}`,
        p_checkout_url: `${validated.appUrl}/loja/${ord.storeSlug}/pagamento/${shareTokenRaw}`,
        p_idempotency_key: `staging-seed-pay-${ord.orderNumber}`,
        p_expires_at: shareExpiresAt,
        p_payer_email_masked: "j***@devessent-demo.com",
        p_metadata: {
          demoSeed: true,
          environment: "sandbox",
          note: "Sessão demonstrativa pendente em Sandbox (nenhuma cobrança real).",
        },
      });
      if (payErr) {
        throw new Error(`Erro ao criar sessão sandbox para ${ord.orderNumber}: ${payErr.message}`);
      }
    }
  }

  console.log(`✅ Pedidos demonstrativos verificados: ${DEMO_ORDERS.length} (${createdOrders} novos).`);
  console.log(`🔐 Arquivo local de credenciais (ignorado pelo Git): ${CREDENTIALS_VAULT_REL_PATH}`);
  console.log("✨ Staging Seed concluído com segurança e idempotência.");
}

main().catch((err) => {
  console.error(`❌ Falha no staging:seed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
