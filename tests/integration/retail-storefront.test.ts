import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { RetailStoreService } from "@/modules/retail/services/retail-store-service";
import { RetailCategoryService } from "@/modules/retail/services/retail-category-service";
import { RetailProductService } from "@/modules/retail/services/retail-product-service";
import { RetailStorefrontService } from "@/modules/retail/services/retail-storefront-service";
import { resolveActiveTemplate } from "@/modules/retail/storefront/components/template-resolver";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type AppClient = SupabaseClient<Database>;

const RUN_ID = `sf-${Date.now()}`;
const TEST_PASSWORD = "StorefrontTest@2026!#";

function makeAnonClient(): AppClient {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe("Fase 6B — Integração Real: Lojas Públicas (Storefronts), Resolução Segura e Isolamento RLS", () => {
  let adminClient: AppClient;
  let anonClient: AppClient;

  let tenantAId: string;
  let tenantASlug: string;
  let tenantBId: string;
  let tenantBSlug: string;
  let tenantSuspendedId: string;
  let tenantSuspendedSlug: string;

  let ownerAUser: { id: string; client: AppClient };
  let ownerBUser: { id: string; client: AppClient };

  let categoryA1Id: string;
  let categoryA1Slug: string;

  let publishedProductA1Slug: string;
  let draftProductA2Slug: string;

  const cleanupUserIds: string[] = [];
  const cleanupTenantIds: string[] = [];

  async function createAndSignIn(email: string, fullName: string) {
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !created.user) {
      throw new Error(`Erro ao criar usuário ${email}: ${error?.message}`);
    }

    cleanupUserIds.push(created.user.id);

    const client = makeAnonClient();
    const { error: signInErr } = await client.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });
    if (signInErr) {
      throw new Error(`Erro no login ${email}: ${signInErr.message}`);
    }

    return { id: created.user.id, client };
  }

  beforeAll(async () => {
    adminClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonClient = makeAnonClient();

    // 1. Criar usuários proprietários
    ownerAUser = await createAndSignIn(`owner.a.${RUN_ID}@devessent.test`, "Proprietário Loja Editorial");
    ownerBUser = await createAndSignIn(`owner.b.${RUN_ID}@devessent.test`, "Proprietário Loja Experimental");

    // 2. Criar Tenant A (Loja Editorial)
    tenantASlug = `loja-editorial-${RUN_ID}`;
    const { data: tA } = await adminClient
      .from("tenants")
      .insert({ name: "Marca Editorial Studio", slug: tenantASlug, status: "active" })
      .select()
      .single();
    tenantAId = tA!.id;
    cleanupTenantIds.push(tenantAId);

    // 3. Criar Tenant B (Loja Experimental)
    tenantBSlug = `loja-street-${RUN_ID}`;
    const { data: tB } = await adminClient
      .from("tenants")
      .insert({ name: "Streetwear Experimental Lab", slug: tenantBSlug, status: "active" })
      .select()
      .single();
    tenantBId = tB!.id;
    cleanupTenantIds.push(tenantBId);

    // 4. Criar Tenant Suspenso
    tenantSuspendedSlug = `loja-suspensa-${RUN_ID}`;
    const { data: tSusp } = await adminClient
      .from("tenants")
      .insert({ name: "Loja Temporariamente Suspensa", slug: tenantSuspendedSlug, status: "suspended" })
      .select()
      .single();
    tenantSuspendedId = tSusp!.id;
    cleanupTenantIds.push(tenantSuspendedId);

    // Vincular Membros
    await adminClient.from("tenant_memberships").insert([
      { tenant_id: tenantAId, user_id: ownerAUser.id, role: "owner" },
      { tenant_id: tenantBId, user_id: ownerBUser.id, role: "owner" },
      { tenant_id: tenantSuspendedId, user_id: ownerAUser.id, role: "owner" },
    ]);

    // 5. Configurar Loja Retail A (Template Editorial via privilégio técnico platform_admin)
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);
    await RetailStoreService.updateStorefrontDesign(
      adminClient,
      { ...ctxA, role: "platform_admin" },
      {
        template: "editorial",
        brandHeadline: "Contemporary apparel for a modern life.",
        brandSubheadline: "Alfaiataria autoral e silhuetas contemporâneas.",
        aboutText: "Criações de alta costura com acabamentos manuais nobres.",
        heroBadge: "SPRING SUMMER 2026",
        announcementBar: "Frete grátis para todo o Brasil em compras acima de R$ 250",
        accentColor: "#111111",
      }
    );
    await RetailStoreService.updateOperationalSettings(ownerAUser.client, ctxA, {
      storeName: "Marca Editorial Studio",
      currency: "BRL",
      isActive: true,
      inventoryMode: "track_quantity",
      contactEmail: "contato@editorial.test",
    });

    // 6. Configurar Loja Retail B (Template Experimental via privilégio técnico platform_admin)
    const ctxB = await TenantService.resolveTenantContext(ownerBUser.client, ownerBUser.id, tenantBId);
    await RetailStoreService.updateStorefrontDesign(
      adminClient,
      { ...ctxB, role: "platform_admin" },
      {
        template: "experimental",
        brandHeadline: "Wear Your Customization.",
        brandSubheadline: "Streetwear pesado, modelagem boxy e alta atitude.",
        aboutText: "Plataforma de moda urbana feita sob demanda.",
        heroBadge: "NEW DROP // 2026",
        announcementBar: "DROPS SOB DEMANDA • EDIÇÃO LIMITADA",
        accentColor: "#D4FF00",
      }
    );
    await RetailStoreService.updateOperationalSettings(ownerBUser.client, ctxB, {
      storeName: "Streetwear Experimental Lab",
      currency: "BRL",
      isActive: true,
      inventoryMode: "track_quantity",
      contactEmail: "contato@experimental.test",
    });

    // 7. Criar Categoria e Produtos na Loja A
    categoryA1Slug = `alfaiataria-${RUN_ID}`;
    const catA1 = await RetailCategoryService.createCategory(ownerAUser.client, ctxA, {
      name: "Alfaiataria Nobre",
      slug: categoryA1Slug,
      description: "Cortes arquitetônicos e tecidos puros.",
    });
    categoryA1Id = catA1.id;

    // Produto Publicado A1
    publishedProductA1Slug = `blazer-linho-${RUN_ID}`;
    await RetailProductService.createProduct(ownerAUser.client, ctxA, {
      name: "Blazer Linho Puro",
      slug: publishedProductA1Slug,
      description: "Blazer estruturado com linho orgânico certificado.",
      status: "published",
      categoryIds: [categoryA1Id],
      variants: [
        {
          sku: `BLZ-LNH-P-${RUN_ID}`,
          name: "Blazer Linho - Tamanho P",
          priceCents: 38900,
          stockQuantity: 10,
          optionsSummary: { Tamanho: "P" },
        },
        {
          sku: `BLZ-LNH-M-${RUN_ID}`,
          name: "Blazer Linho - Tamanho M",
          priceCents: 38900,
          stockQuantity: 5,
          optionsSummary: { Tamanho: "M" },
        },
      ],
    });

    // Produto Rascunho A2 (DRAFT - Não deve ser exposto publicamente)
    draftProductA2Slug = `calca-linho-draft-${RUN_ID}`;
    await RetailProductService.createProduct(ownerAUser.client, ctxA, {
      name: "Calça Linho Draft Rascunho",
      slug: draftProductA2Slug,
      description: "Produto em confecção, ainda não aprovado para catálogo.",
      status: "draft",
      categoryIds: [categoryA1Id],
      variants: [
        {
          sku: `CLC-DFT-${RUN_ID}`,
          name: "Calça Draft Única",
          priceCents: 19900,
          stockQuantity: 2,
        },
      ],
    });
  });

  afterAll(async () => {
    // Limpeza de tenants
    for (const tid of cleanupTenantIds) {
      await adminClient.from("tenants").delete().eq("id", tid);
    }
    // Limpeza de usuários
    for (const uid of cleanupUserIds) {
      await adminClient.auth.admin.deleteUser(uid);
    }
  });

  it("1. getPublicStore resolve loja ativa por slug sem necessidade de autenticação", async () => {
    const store = await RetailStorefrontService.getPublicStore(anonClient, tenantASlug);

    expect(store).not.toBeNull();
    expect(store?.slug).toBe(tenantASlug);
    expect(store?.storeName).toBe("Marca Editorial Studio");
    expect(store?.template).toBe("editorial");
    expect(store?.brandHeadline).toBe("Contemporary apparel for a modern life.");
    expect(store?.announcementBar).toBe("Frete grátis para todo o Brasil em compras acima de R$ 250");
    expect(store?.isActive).toBe(true);
  });

  it("2. getPublicStore resolve loja com template experimental corretamente", async () => {
    const store = await RetailStorefrontService.getPublicStore(anonClient, tenantBSlug);

    expect(store).not.toBeNull();
    expect(store?.slug).toBe(tenantBSlug);
    expect(store?.template).toBe("experimental");
    expect(store?.brandHeadline).toBe("Wear Your Customization.");
    expect(store?.accentColor).toBe("#D4FF00");
  });

  it("3. getPublicStore retorna null para slug inexistente", async () => {
    const store = await RetailStorefrontService.getPublicStore(
      anonClient,
      `slug-fantasma-${Date.now()}`
    );
    expect(store).toBeNull();
  });

  it("4. getPublicStore bloqueia loja pertencente a estabelecimento suspenso", async () => {
    const store = await RetailStorefrontService.getPublicStore(
      anonClient,
      tenantSuspendedSlug
    );
    expect(store).toBeNull();
  });

  it("5. getPublicCategories retorna apenas categorias ativas do tenant", async () => {
    const categories = await RetailStorefrontService.getPublicCategories(
      anonClient,
      tenantAId
    );

    expect(categories.length).toBeGreaterThanOrEqual(1);
    expect(categories.some((c) => c.slug === categoryA1Slug)).toBe(true);
    expect(categories.every((c) => c.tenantId === tenantAId)).toBe(true);
  });

  it("6. getPublicCatalog retorna apenas produtos com status 'published' (Zero vazamento de drafts)", async () => {
    const { products, totalCount } = await RetailStorefrontService.getPublicCatalog(
      anonClient,
      tenantAId
    );

    expect(totalCount).toBeGreaterThanOrEqual(1);
    const hasPublished = products.some((p) => p.slug === publishedProductA1Slug);
    const hasDraft = products.some((p) => p.slug === draftProductA2Slug);

    expect(hasPublished).toBe(true);
    expect(hasDraft).toBe(false); // DRAFT NUNCA APARECE NA VITRINE PÚBLICA
  });

  it("7. getPublicCatalog garante isolamento multiempresa (Zero vazamento cross-tenant)", async () => {
    const { products: productsB } = await RetailStorefrontService.getPublicCatalog(
      anonClient,
      tenantBId
    );

    // Produtos do Tenant A não podem aparecer na loja do Tenant B
    expect(productsB.some((p) => p.slug === publishedProductA1Slug)).toBe(false);
  });

  it("8. getPublicCatalog suporta busca e filtro por categoria", async () => {
    const filtered = await RetailStorefrontService.getPublicCatalog(
      anonClient,
      tenantAId,
      { categorySlug: categoryA1Slug, search: "Blazer" }
    );

    expect(filtered.products.length).toBe(1);
    expect(filtered.products[0].slug).toBe(publishedProductA1Slug);

    const emptyFilter = await RetailStorefrontService.getPublicCatalog(
      anonClient,
      tenantAId,
      { search: "TermoInexistenteXYZ123" }
    );

    expect(emptyFilter.products.length).toBe(0);
    expect(emptyFilter.totalCount).toBe(0);
  });

  it("9. getPublicProduct recupera detalhes do produto publicado e calcula disponibilidade", async () => {
    const product = await RetailStorefrontService.getPublicProduct(
      anonClient,
      tenantAId,
      publishedProductA1Slug
    );

    expect(product).not.toBeNull();
    expect(product?.name).toBe("Blazer Linho Puro");
    expect(product?.variants.length).toBe(2);
    expect(product?.minPriceCents).toBe(38900);
    expect(product?.totalStock).toBe(15); // 10 (P) + 5 (M)
  });

  it("10. getPublicProduct retorna null ao tentar consultar produto rascunho", async () => {
    const draftProduct = await RetailStorefrontService.getPublicProduct(
      anonClient,
      tenantAId,
      draftProductA2Slug
    );

    expect(draftProduct).toBeNull();
  });

  it("11. resolveActiveTemplate respeita override por preview_template com fallback correto", () => {
    expect(resolveActiveTemplate("editorial", "experimental")).toBe("experimental");
    expect(resolveActiveTemplate("experimental", "editorial")).toBe("editorial");
    expect(resolveActiveTemplate("experimental", undefined)).toBe("experimental");
    expect(resolveActiveTemplate("editorial", undefined)).toBe("editorial");
    expect(resolveActiveTemplate("editorial", "invalid_template")).toBe("editorial");
  });

  it("12. Fase 6B.1: Owner NÃO pode alterar template/design via updateStore ou updateStorefrontDesign", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);

    await expect(
      RetailStoreService.updateStore(ownerAUser.client, ctxA, {
        storeName: "Tentativa Invasão Visual",
        currency: "BRL",
        isActive: true,
        inventoryMode: "track_quantity",
        template: "experimental",
      })
    ).rejects.toThrow(/Acesso negado/i);

    await expect(
      RetailStoreService.updateStorefrontDesign(ownerAUser.client, ctxA, {
        template: "experimental",
        accentColor: "#FF0000",
      })
    ).rejects.toThrow(/Acesso negado/i);

    // Atualização operacional como Owner continua funcionando e preserva template original
    const updated = await RetailStoreService.updateOperationalSettings(ownerAUser.client, ctxA, {
      storeName: "Marca Editorial Studio",
      currency: "BRL",
      isActive: true,
      inventoryMode: "track_quantity",
      contactEmail: "contato.operacional@editorial.test",
    });
    expect(updated.template).toBe("editorial");
    expect(updated.contactEmail).toBe("contato.operacional@editorial.test");
  });
});
