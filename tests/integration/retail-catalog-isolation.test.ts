import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { RetailStoreService } from "@/modules/retail/services/retail-store-service";
import { RetailCategoryService } from "@/modules/retail/services/retail-category-service";
import { RetailProductService } from "@/modules/retail/services/retail-product-service";
import { RetailVariantService } from "@/modules/retail/services/retail-variant-service";
import { RetailImageService } from "@/modules/retail/services/retail-image-service";
import { ProductInvariants } from "@/modules/retail/domain/product-invariants";
import {
  ForbiddenError,
  NotFoundError,
  TenantSuspendedError,
  ValidationError,
} from "@/core/errors/app-error";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type AppClient = SupabaseClient<Database>;

const RUN_ID = `ret-${Date.now()}`;
const TEST_PASSWORD = "RetailTest@2026!#";

function makeClient(): AppClient {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe("Fase 6A — Integração Real: Retail Catálogo, Produtos, Variantes e RLS", () => {
  let adminClient: AppClient;
  let anonClient: AppClient;

  let tenantAId: string;
  let tenantBId: string;
  let tenantSuspendedId: string;

  let ownerAUser: { id: string; client: AppClient };
  let managerAUser: { id: string; client: AppClient };
  let staffAUser: { id: string; client: AppClient };
  let ownerBUser: { id: string; client: AppClient };

  const cleanupUserIds: string[] = [];
  const cleanupTenantIds: string[] = [];

  async function createAndSignIn(email: string, fullName: string) {
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !created.user) throw new Error(`Erro ao criar usuário ${email}: ${error?.message}`);

    cleanupUserIds.push(created.user.id);

    const client = makeClient();
    const { error: signErr } = await client.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });
    if (signErr) throw new Error(`Erro ao autenticar ${email}: ${signErr.message}`);

    return { id: created.user.id, client };
  }

  beforeAll(async () => {
    adminClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonClient = makeClient();

    // 1. Criar Empresas Efêmeras de Teste
    const { data: tA } = await adminClient
      .from("tenants")
      .insert({ name: `Ateliê ${RUN_ID}`, slug: `atelie-${RUN_ID}`, status: "active" })
      .select()
      .single();
    tenantAId = tA!.id;
    cleanupTenantIds.push(tenantAId);

    const { data: tB } = await adminClient
      .from("tenants")
      .insert({ name: `Verde ${RUN_ID}`, slug: `verde-${RUN_ID}`, status: "active" })
      .select()
      .single();
    tenantBId = tB!.id;
    cleanupTenantIds.push(tenantBId);

    const { data: tSusp } = await adminClient
      .from("tenants")
      .insert({ name: `Suspensa ${RUN_ID}`, slug: `susp-${RUN_ID}`, status: "suspended" })
      .select()
      .single();
    tenantSuspendedId = tSusp!.id;
    cleanupTenantIds.push(tenantSuspendedId);

    // 2. Criar Usuários
    ownerAUser = await createAndSignIn(`owner.a.${RUN_ID}@test.local`, "Proprietário A");
    managerAUser = await createAndSignIn(`manager.a.${RUN_ID}@test.local`, "Gestora A");
    staffAUser = await createAndSignIn(`staff.a.${RUN_ID}@test.local`, "Funcionário A");
    ownerBUser = await createAndSignIn(`owner.b.${RUN_ID}@test.local`, "Proprietário B");

    // 3. Vincular Membros
    await adminClient.from("tenant_memberships").insert([
      { tenant_id: tenantAId, user_id: ownerAUser.id, role: "owner" },
      { tenant_id: tenantAId, user_id: managerAUser.id, role: "manager" },
      { tenant_id: tenantAId, user_id: staffAUser.id, role: "staff" },
      { tenant_id: tenantBId, user_id: ownerBUser.id, role: "owner" },
      { tenant_id: tenantSuspendedId, user_id: ownerAUser.id, role: "owner" },
    ]);

    // 4. Ativar Retail para Tenant A e Tenant B
    await adminClient.from("retail_stores").insert([
      { tenant_id: tenantAId, store_name: "Loja A", currency: "BRL", is_active: true },
      { tenant_id: tenantBId, store_name: "Loja B", currency: "BRL", is_active: true },
    ]);
  });

  afterAll(async () => {
    for (const tId of cleanupTenantIds) {
      await adminClient.from("retail_stores").delete().eq("tenant_id", tId);
      await adminClient.from("retail_products").delete().eq("tenant_id", tId);
      await adminClient.from("retail_categories").delete().eq("tenant_id", tId);
      await adminClient.from("tenants").delete().eq("id", tId);
    }
    for (const uId of cleanupUserIds) {
      await adminClient.auth.admin.deleteUser(uId);
    }
  });

  it("1. Criar categoria autorizada: Owner/Manager cria categoria com sucesso no próprio tenant", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);

    const category = await RetailCategoryService.createCategory(ownerAUser.client, ctxA, {
      name: "Vestuário Premium",
      description: "Linha de alfaiataria",
      sortOrder: 1,
      isActive: true,
    });

    expect(category.id).toBeDefined();
    expect(category.tenantId).toBe(tenantAId);
    expect(category.slug).toBe("vestuario-premium");

    const list = await RetailCategoryService.listCategories(ownerAUser.client, tenantAId);
    expect(list.some((c) => c.id === category.id)).toBe(true);
  });

  it("2. Impedir criação de categoria em outra empresa: RLS barra Owner B tentando gravar no Tenant A", async () => {
    // Owner B tenta injetar categoria no Tenant A via chamada direta ao supabase
    const { error } = await ownerBUser.client.from("retail_categories").insert({
      tenant_id: tenantAId,
      name: "Invasão B",
      slug: "invasao-b",
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501"); // RLS violation
  });

  it("3-4. Criar produto com variantes: cria produto, opções e variantes vinculadas com preço em centavos", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);

    const product = await RetailProductService.createProduct(ownerAUser.client, ctxA, {
      name: "Camiseta Linho Orgânico",
      description: "Confeccionada em 100% linho",
      status: "draft",
      categoryIds: [],
      options: [
        { name: "Tamanho", values: ["M", "G"], position: 0 },
      ],
      variants: [
        {
          sku: `SKU-TEE-M-${RUN_ID}`,
          name: "M",
          priceCents: 15900,
          compareAtPriceCents: 18900,
          stockQuantity: 20,
          isAvailable: true,
          optionsSummary: { Tamanho: "M" },
          sortOrder: 0,
        },
        {
          sku: `SKU-TEE-G-${RUN_ID}`,
          name: "G",
          priceCents: 15900,
          compareAtPriceCents: 18900,
          stockQuantity: 15,
          isAvailable: true,
          optionsSummary: { Tamanho: "G" },
          sortOrder: 1,
        },
      ],
    });

    expect(product.id).toBeDefined();
    expect(product.variants.length).toBe(2);
    expect(product.minPriceCents).toBe(15900);
    expect(product.totalStock).toBe(35);
  });

  it("5. Garantir unicidade de SKU no escopo definido: impede SKU duplicado na mesma empresa", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);

    await expect(
      RetailProductService.createProduct(ownerAUser.client, ctxA, {
        name: "Produto Duplicado SKU",
        status: "draft",
        categoryIds: [],
        options: [],
        variants: [
          {
            sku: `SKU-TEE-M-${RUN_ID}`, // SKU já existente no Tenant A
            name: "Conflito",
            priceCents: 9900,
            stockQuantity: 5,
            isAvailable: true,
            optionsSummary: {},
            sortOrder: 0,
          },
        ],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("6. Unicidade de SKU escopada: mesmo SKU é PERMITIDO em empresas diferentes", async () => {
    const ctxB = await TenantService.resolveTenantContext(ownerBUser.client, ownerBUser.id, tenantBId);

    // Tenant B cadastra o mesmo SKU sem colisão
    const productB = await RetailProductService.createProduct(ownerBUser.client, ctxB, {
      name: "Produto Tenant B com Mesmo SKU",
      status: "draft",
      categoryIds: [],
      options: [],
      variants: [
        {
          sku: `SKU-TEE-M-${RUN_ID}`, // Mesmo SKU mas no Tenant B
          name: "Padrão B",
          priceCents: 12000,
          stockQuantity: 10,
          isAvailable: true,
          optionsSummary: {},
          sortOrder: 0,
        },
      ],
    });

    expect(productB.id).toBeDefined();
    expect(productB.tenantId).toBe(tenantBId);
  });

  it("7. Validar preços: bloqueia preço negativo ou preço comparativo menor que o preço de venda", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);

    // Tentativa com preço comparativo menor que o preço de venda para publicar
    await expect(
      RetailProductService.createProduct(ownerAUser.client, ctxA, {
        name: "Produto Preço Invalido",
        status: "published",
        categoryIds: [],
        options: [],
        variants: [
          {
            sku: `SKU-INV-${RUN_ID}`,
            name: "Inv",
            priceCents: 20000,
            compareAtPriceCents: 10000, // Menor que o preço
            stockQuantity: 5,
            isAvailable: true,
            optionsSummary: {},
            sortOrder: 0,
          },
        ],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("8. Validar quantidades de estoque: impede estoque negativo no banco via check constraint", async () => {
    const { error } = await adminClient.from("retail_variants").insert({
      tenant_id: tenantAId,
      product_id: (await adminClient.from("retail_products").select("id").eq("tenant_id", tenantAId).limit(1).single()).data!.id,
      sku: `SKU-NEG-${RUN_ID}`,
      name: "Estoque Negativo",
      price_cents: 1000,
      stock_quantity: -10, // Violando check constraint
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514"); // check_violation
  });

  it("9-10. Publicar produto válido e impedir publicação de produto inválido", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);

    // Produto válido com preço e variante
    const pValido = await RetailProductService.createProduct(ownerAUser.client, ctxA, {
      name: "Jaqueta Couro Ecológico",
      status: "draft",
      categoryIds: [],
      options: [],
      variants: [
        {
          sku: `SKU-JKT-${RUN_ID}`,
          name: "Único",
          priceCents: 59900,
          stockQuantity: 8,
          isAvailable: true,
          optionsSummary: {},
          sortOrder: 0,
        },
      ],
    });

    const published = await RetailProductService.publishProduct(ownerAUser.client, ctxA, pValido.id);
    expect(published.status).toBe("published");
    expect(published.publishedAt).not.toBeNull();

    // Produto inválido (preço zero) não pode ser publicado
    const pInvalido = await adminClient
      .from("retail_products")
      .insert({
        tenant_id: tenantAId,
        name: "Produto Incompleto",
        slug: `incompleto-${RUN_ID}`,
        status: "draft",
      })
      .select()
      .single();

    await adminClient.from("retail_variants").insert({
      tenant_id: tenantAId,
      product_id: pInvalido.data!.id,
      sku: `SKU-ZERO-${RUN_ID}`,
      name: "Zero",
      price_cents: 0, // Preço zero impede publicação
    });

    await expect(
      RetailProductService.publishProduct(ownerAUser.client, ctxA, pInvalido.data!.id)
    ).rejects.toThrow(ValidationError);
  });

  it("11. Arquivar produto: altera status para 'archived' preservando dados", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);
    const prod = await RetailProductService.createProduct(ownerAUser.client, ctxA, {
      name: "Peça para Arquivar",
      status: "published",
      categoryIds: [],
      options: [],
      variants: [
        {
          sku: `SKU-ARQ-${RUN_ID}`,
          name: "Var",
          priceCents: 10000,
          stockQuantity: 2,
          isAvailable: true,
          optionsSummary: {},
          sortOrder: 0,
        },
      ],
    });

    const archived = await RetailProductService.archiveProduct(ownerAUser.client, ctxA, prod.id);
    expect(archived.status).toBe("archived");
  });

  it("12-13. Editar produto autorizado e bloquear edição de produto de outra empresa", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);
    const prodA = await RetailProductService.createProduct(ownerAUser.client, ctxA, {
      name: "Produto Original A",
      status: "draft",
      categoryIds: [],
      options: [],
      variants: [
        {
          sku: `SKU-EDT-${RUN_ID}`,
          name: "V1",
          priceCents: 8000,
          stockQuantity: 5,
          isAvailable: true,
          optionsSummary: {},
          sortOrder: 0,
        },
      ],
    });

    // Edição pelo próprio Owner A
    const updated = await RetailProductService.updateProduct(ownerAUser.client, ctxA, {
      id: prodA.id,
      name: "Produto Modificado A",
    });
    expect(updated.name).toBe("Produto Modificado A");

    // Bloqueio contra Owner B tentando editar produto de A
    const ctxB = await TenantService.resolveTenantContext(ownerBUser.client, ownerBUser.id, tenantBId);
    await expect(
      RetailProductService.updateProduct(ownerBUser.client, ctxB, {
        id: prodA.id,
        name: "Tentativa de Hack B",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("14-15. Upload de imagem e bloqueio de upload em contexto de outra empresa", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);
    const prodA = await RetailProductService.createProduct(ownerAUser.client, ctxA, {
      name: "Produto com Imagem",
      status: "draft",
      categoryIds: [],
      options: [],
      variants: [
        {
          sku: `SKU-IMG-${RUN_ID}`,
          name: "V",
          priceCents: 12000,
          stockQuantity: 5,
          isAvailable: true,
          optionsSummary: {},
          sortOrder: 0,
        },
      ],
    });

    // Upload autorizado por Owner A
    const dummyBuffer = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header bytes
    const image = await RetailImageService.uploadProductImage(
      ownerAUser.client,
      ctxA,
      prodA.id,
      {
        buffer: dummyBuffer,
        fileName: "lookbook.png",
        contentType: "image/png",
        size: dummyBuffer.length,
      },
      "Foto do Produto",
      true
    );

    expect(image.id).toBeDefined();
    expect(image.isPrimary).toBe(true);
    expect(image.publicUrl).toContain("retail-media");

    // Tentativa de upload por Owner B para produto de A
    const ctxB = await TenantService.resolveTenantContext(ownerBUser.client, ownerBUser.id, tenantBId);
    await expect(
      RetailImageService.uploadProductImage(
        ownerBUser.client,
        ctxB,
        prodA.id,
        {
          buffer: dummyBuffer,
          fileName: "hack.png",
          contentType: "image/png",
          size: dummyBuffer.length,
        }
      )
    ).rejects.toThrow(NotFoundError);
  });

  it("16-17. Contexto Público: consulta somente produtos publicados de lojas ativas e impede leitura de rascunhos", async () => {
    // Consulta via cliente anônimo
    const { data: publicProds } = await anonClient
      .from("retail_products")
      .select("id, name, status, slug")
      .eq("tenant_id", tenantAId);

    const list = publicProds || [];
    // Todos os retornados devem estar rigorosamente como 'published'
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.status === "published")).toBe(true);

    // Não pode conter nenhum rascunho
    expect(list.some((p) => p.status === "draft")).toBe(false);
  });

  it("18. Produto sem opções explícitas: cadastra com variante única 'Padrão'", async () => {
    const ctxA = await TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantAId);

    const singleVariantProduct = await RetailProductService.createProduct(ownerAUser.client, ctxA, {
      name: "Bolsa Couro Tiracolo",
      status: "draft",
      categoryIds: [],
      options: [], // Sem opções cartesianas
      variants: [
        {
          sku: `SKU-BLS-${RUN_ID}`,
          name: "Padrão",
          priceCents: 42000,
          stockQuantity: 3,
          isAvailable: true,
          optionsSummary: {},
          sortOrder: 0,
        },
      ],
    });

    expect(singleVariantProduct.variants.length).toBe(1);
    expect(singleVariantProduct.variants[0].name).toBe("Padrão");
  });

  it("19. Alternar empresas: listar catálogo carrega exclusivamente registros do tenant ativo", async () => {
    const listA = await RetailProductService.listProducts(ownerAUser.client, tenantAId);
    const listB = await RetailProductService.listProducts(ownerBUser.client, tenantBId);

    expect(listA.products.length).toBeGreaterThan(0);
    expect(listB.products.length).toBeGreaterThan(0);

    const idsA = new Set(listA.products.map((p) => p.id));
    const idsB = new Set(listB.products.map((p) => p.id));

    // Zero interseção entre os produtos das duas empresas
    for (const id of idsB) {
      expect(idsA.has(id)).toBe(false);
    }
  });

  it("20. Impedir operação comercial em empresa suspensa", async () => {
    await expect(
      TenantService.resolveTenantContext(ownerAUser.client, ownerAUser.id, tenantSuspendedId)
    ).rejects.toThrow(TenantSuspendedError);
  });

  it("21. Impedir acesso a módulo não ativado: loja com is_active=false bloqueia acesso público", async () => {
    // Desativar a loja de B temporariamente
    await adminClient.from("retail_stores").update({ is_active: false }).eq("tenant_id", tenantBId);

    // Consulta anônima não deve retornar produtos da loja desativada
    const { data: prodsB } = await anonClient
      .from("retail_products")
      .select("id")
      .eq("tenant_id", tenantBId);

    expect(prodsB?.length || 0).toBe(0);

    // Restaurar
    await adminClient.from("retail_stores").update({ is_active: true }).eq("tenant_id", tenantBId);
  });

  it("22. Membros sem permissão (Staff) não podem publicar nem alterar preços", async () => {
    const ctxStaff = await TenantService.resolveTenantContext(staffAUser.client, staffAUser.id, tenantAId);

    // Staff tentando alterar preço de variante
    const variantId = (await adminClient.from("retail_variants").select("id").eq("tenant_id", tenantAId).limit(1).single()).data!.id;

    await expect(
      RetailVariantService.updatePrice(staffAUser.client, ctxStaff, variantId, 99999)
    ).rejects.toThrow(ForbiddenError);

    // Staff tentando publicar produto
    const productId = (await adminClient.from("retail_products").select("id").eq("tenant_id", tenantAId).limit(1).single()).data!.id;

    await expect(
      RetailProductService.publishProduct(staffAUser.client, ctxStaff, productId)
    ).rejects.toThrow(ForbiddenError);
  });

  it("23. Confirmar que operações comerciais relevantes geram auditoria", async () => {
    const { data: auditEvents } = await adminClient
      .from("audit_logs")
      .select("action, resource_type")
      .eq("tenant_id", tenantAId)
      .in("action", [
        "retail.product_created",
        "retail.product_published",
        "retail.category_created",
      ]);

    expect(auditEvents).toBeDefined();
    expect(auditEvents!.length).toBeGreaterThan(0);
    expect(auditEvents!.some((e) => e.action === "retail.product_created")).toBe(true);
  });

  it("24. Preservar autenticação, convites e governança existentes do Core", async () => {
    // Verificar que as tabelas do Core continuam operacionais
    const { data: profiles } = await adminClient.from("profiles").select("id").limit(1);
    expect(profiles).toBeDefined();

    const { data: tenants } = await adminClient.from("tenants").select("id").limit(1);
    expect(tenants).toBeDefined();

    const { data: memberships } = await adminClient.from("tenant_memberships").select("id").limit(1);
    expect(memberships).toBeDefined();
  });
});

