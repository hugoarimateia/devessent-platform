/**
 * Script de Seed de dados sintéticos para o ambiente Sandbox Local.
 * - Idempotente: pode ser executado múltiplas vezes sem duplicar dados.
 * - Fail-closed: bloqueia execução se não for estritamente local e descartável.
 * - Não vaza credenciais para logs ou saídas padrão.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { LocalGuard, SandboxSecurityError } from "../lib/local-guard";
import { SandboxManifest } from "../lib/sandbox-manifest";
import { sandboxCompanies } from "../fixtures/companies";
import { sandboxUsers, resolveSandboxPassword } from "../fixtures/users";
import { sandboxMemberships } from "../fixtures/memberships";
import { sandboxInvitations } from "../fixtures/invitations";
import { sandboxRetailStores } from "../fixtures/retail";
import { createAdminClient } from "@/lib/supabase/admin";

export async function runSandboxSeed() {
  // 1. Verificações rígidas de ambiente (Fail-Closed)
  LocalGuard.loadLocalEnv();
  LocalGuard.assertSafeEnvironment();

  const adminClient = createAdminClient();
  await LocalGuard.assertSafeDatabaseConnection(adminClient);

  console.log("🌱 Iniciando provisionamento idempotente do ambiente Sandbox Local...");

  const userMap = new Map<string, { id: string; email: string; fullName: string }>();
  const tenantMap = new Map<string, { id: string; slug: string; name: string }>();
  const credentialsVault: Array<{ email: string; fullName: string; roleDescription: string; password: string }> = [];
  const sandboxPassword = resolveSandboxPassword();

  // 2. Provisionamento de Usuários Fictícios no Supabase Auth e Profiles
  console.log("  ↳ Sincronizando contas de demonstração em auth.users...");
  const { data: existingUsersList, error: listUsersErr } = await adminClient.auth.admin.listUsers();
  if (listUsersErr) {
    throw new SandboxSecurityError("Falha ao consultar usuários existentes no Supabase Auth local.", listUsersErr);
  }

  const existingAuthMap = new Map(
    existingUsersList.users.map((u) => [u.email?.toLowerCase(), u])
  );

  for (const uFixture of sandboxUsers) {
    const emailLower = uFixture.email.toLowerCase();
    let userId: string;

    const existingAuthUser = existingAuthMap.get(emailLower);

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      // Atualizar metadados e sincronizar senha
      await adminClient.auth.admin.updateUserById(userId, {
        password: sandboxPassword,
        email_confirm: true,
        user_metadata: {
          full_name: uFixture.fullName,
        },
      });
    } else {
      // Criar novo usuário com e-mail confirmado
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: uFixture.email,
        password: sandboxPassword,
        email_confirm: true,
        user_metadata: {
          full_name: uFixture.fullName,
        },
      });

      if (createErr || !newUser.user) {
        throw new SandboxSecurityError(`Falha ao criar usuário ${uFixture.email}: ${createErr?.message}`);
      }
      userId = newUser.user.id;
    }

    // Garantir sincronização com public.profiles
    await adminClient.from("profiles").upsert({
      id: userId,
      full_name: uFixture.fullName,
    });

    // Se for administrador da plataforma, garantir vínculo em platform_admins
    if (uFixture.isPlatformAdmin) {
      const { data: adminRecord } = await adminClient
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!adminRecord) {
        await adminClient.from("platform_admins").insert({ user_id: userId });
      }
    }

    userMap.set(emailLower, { id: userId, email: uFixture.email, fullName: uFixture.fullName });
    credentialsVault.push({
      email: uFixture.email,
      fullName: uFixture.fullName,
      roleDescription: uFixture.roleDescription,
      password: sandboxPassword,
    });
  }

  // 3. Provisionamento de Empresas Fictícias (Tenants)
  console.log("  ↳ Sincronizando estabelecimentos fictícios em public.tenants...");
  for (const cFixture of sandboxCompanies) {
    const { data: existingTenant } = await adminClient
      .from("tenants")
      .select("id, slug, name, status")
      .eq("slug", cFixture.slug)
      .maybeSingle();

    let tenantId: string;

    if (existingTenant) {
      tenantId = existingTenant.id;
      // Garantir status ativo / esperado
      if (existingTenant.status !== cFixture.status) {
        await adminClient
          .from("tenants")
          .update({ status: cFixture.status })
          .eq("id", tenantId);
      }
    } else {
      const { data: newTenant, error: tErr } = await adminClient
        .from("tenants")
        .insert({
          name: cFixture.name,
          slug: cFixture.slug,
          status: cFixture.status,
        })
        .select("id, slug, name")
        .single();

      if (tErr || !newTenant) {
        throw new SandboxSecurityError(`Falha ao criar tenant ${cFixture.slug}: ${tErr?.message}`);
      }
      tenantId = newTenant.id;

      // Registrar auditoria da criação
      await adminClient.from("audit_logs").insert({
        tenant_id: tenantId,
        action: "tenant.sandbox_created",
        resource_type: "tenants",
        resource_id: tenantId,
        metadata: {
          slug: cFixture.slug,
          name: cFixture.name,
          segment: cFixture.segmentMetadata,
        },
      });
    }

    // Upsert em tenant_settings com identidade visual persistida no banco
    await adminClient.from("tenant_settings").upsert({
      tenant_id: tenantId,
      display_name: cFixture.settings.displayName,
      contact_email: cFixture.settings.contactEmail,
      contact_phone: cFixture.settings.contactPhone,
      segment_label: cFixture.settings.segmentLabel,
      primary_color: cFixture.settings.primaryColor,
      monogram: cFixture.settings.monogram,
      brand_description: cFixture.settings.brandDescription,
      timezone: cFixture.timezone,
      locale: cFixture.locale,
    });

    tenantMap.set(cFixture.slug, { id: tenantId, slug: cFixture.slug, name: cFixture.name });
  }

  // 4. Provisionamento de Memberships (Vínculos e Papéis)
  console.log("  ↳ Sincronizando vínculos operacionais em public.tenant_memberships...");
  const manifestMemberships: Array<{ tenantId: string; userId: string; role: string }> = [];

  for (const mFixture of sandboxMemberships) {
    const tenant = tenantMap.get(mFixture.companySlug);
    const user = userMap.get(mFixture.userEmail.toLowerCase());

    if (!tenant || !user) {
      throw new SandboxSecurityError(
        `Inconsistência nos fixtures: empresa ${mFixture.companySlug} ou usuário ${mFixture.userEmail} não localizado.`
      );
    }

    const { data: existingMembership } = await adminClient
      .from("tenant_memberships")
      .select("id, role")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMembership) {
      if (existingMembership.role !== mFixture.role) {
        await adminClient
          .from("tenant_memberships")
          .update({ role: mFixture.role })
          .eq("id", existingMembership.id);
      }
    } else {
      await adminClient.from("tenant_memberships").insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: mFixture.role,
      });
    }

    manifestMemberships.push({
      tenantId: tenant.id,
      userId: user.id,
      role: mFixture.role,
    });
  }

  // 5. Provisionamento de Convites de Demonstração (Cenário H)
  console.log("  ↳ Configurando convites controlados em public.tenant_invitations...");
  const manifestInvitations: Array<{ id: string; tenantId: string; email: string; role: string }> = [];

  for (const invFixture of sandboxInvitations) {
    const tenant = tenantMap.get(invFixture.companySlug);
    const inviterUser = sandboxUsers.find((u) => u.idKey === invFixture.invitedByKey);
    const inviter = inviterUser ? userMap.get(inviterUser.email.toLowerCase()) : null;

    if (!tenant || !inviter) continue;

    const { data: existingInv } = await adminClient
      .from("tenant_invitations")
      .select("id, status")
      .eq("tenant_id", tenant.id)
      .eq("email", invFixture.email.toLowerCase())
      .maybeSingle();

    if (!existingInv) {
      const rawToken = crypto.randomBytes(24).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      let expiresAt: string;
      let status: "pending" | "expired" | "revoked" = "pending";

      if (invFixture.statusScenario === "expired") {
        expiresAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        status = "expired";
      } else if (invFixture.statusScenario === "revoked") {
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        status = "revoked";
      } else {
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        status = "pending";
      }

      const { data: newInv } = await adminClient
        .from("tenant_invitations")
        .insert({
          tenant_id: tenant.id,
          email: invFixture.email.toLowerCase(),
          role: invFixture.role,
          token_hash: tokenHash,
          invited_by: inviter.id,
          status,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (newInv) {
        manifestInvitations.push({
          id: newInv.id,
          tenantId: tenant.id,
          email: invFixture.email,
          role: invFixture.role,
        });
      }
    } else {
      manifestInvitations.push({
        id: existingInv.id,
        tenantId: tenant.id,
        email: invFixture.email,
        role: invFixture.role,
      });
    }
  }

  // 6. Provisionamento do Módulo Comercial Retail
  console.log("  ↳ Sincronizando lojas, categorias e produtos comerciais do Retail...");
  for (const storeFixture of sandboxRetailStores) {
    const tenant = tenantMap.get(storeFixture.companySlug);
    if (!tenant) continue;

    // 6.1. Upsert na tabela retail_stores
    await adminClient.from("retail_stores").upsert(
      {
        tenant_id: tenant.id,
        store_name: storeFixture.storeName,
        currency: storeFixture.currency,
        is_active: storeFixture.isActive,
        inventory_mode: storeFixture.inventoryMode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

    // 6.2. Categorias
    const categoryMap = new Map<string, string>();
    for (const catFixture of storeFixture.categories) {
      const { data: catData } = await adminClient
        .from("retail_categories")
        .upsert(
          {
            tenant_id: tenant.id,
            name: catFixture.name,
            slug: catFixture.slug,
            description: catFixture.description,
            sort_order: catFixture.sortOrder,
            is_active: true,
          },
          { onConflict: "tenant_id,slug" }
        )
        .select("id, name")
        .single();

      if (catData) {
        categoryMap.set(catData.name, catData.id);
      }
    }

    // 6.3. Produtos e Variantes
    for (const prodFixture of storeFixture.products) {
      const { data: prodData } = await adminClient
        .from("retail_products")
        .upsert(
          {
            tenant_id: tenant.id,
            name: prodFixture.name,
            slug: prodFixture.slug,
            description: prodFixture.description,
            status: prodFixture.status,
            published_at: prodFixture.status === "published" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,slug" }
        )
        .select("id")
        .single();

      if (!prodData) continue;
      const productId = prodData.id;

      // Vincular categorias
      for (const catName of prodFixture.categoryNames) {
        const catId = categoryMap.get(catName);
        if (catId) {
          await adminClient
            .from("retail_product_categories")
            .upsert(
              {
                product_id: productId,
                category_id: catId,
                tenant_id: tenant.id,
              },
              { onConflict: "product_id,category_id" }
            );
        }
      }

      // Opções
      for (let i = 0; i < prodFixture.options.length; i++) {
        const opt = prodFixture.options[i];
        await adminClient.from("retail_product_options").upsert(
          {
            product_id: productId,
            tenant_id: tenant.id,
            name: opt.name,
            position: i,
            values: opt.values,
          },
          { onConflict: "product_id,name" }
        );
      }

      // Variantes
      for (let i = 0; i < prodFixture.variants.length; i++) {
        const v = prodFixture.variants[i];
        await adminClient.from("retail_variants").upsert(
          {
            tenant_id: tenant.id,
            product_id: productId,
            sku: v.sku,
            name: v.name,
            price_cents: v.priceCents,
            compare_at_price_cents: v.compareAtPriceCents || null,
            stock_quantity: v.stockQuantity,
            is_available: v.isAvailable,
            options_summary: v.optionsSummary,
            sort_order: i,
          },
          { onConflict: "tenant_id,sku" }
        );
      }
    }
  }

  // 7. Atualização do Manifesto Local e Cofre de Credenciais
  SandboxManifest.save({
    tenants: Array.from(tenantMap.values()),
    users: sandboxUsers.map((u) => {
      const live = userMap.get(u.email.toLowerCase())!;
      return {
        id: live.id,
        email: live.email,
        fullName: live.fullName,
        roleDescription: u.roleDescription,
      };
    }),
    memberships: manifestMemberships,
    invitations: manifestInvitations,
  });

  // Salvar credenciais de forma restrita e ignorada pelo git
  const credsPath = path.resolve(process.cwd(), "sandbox-data/.credentials.local.json");
  fs.writeFileSync(
    credsPath,
    JSON.stringify(
      {
        description: "Credenciais locais para acesso ao ambiente Sandbox. ARQUIVO NÃO COMMITADO.",
        updatedAt: new Date().toISOString(),
        defaultPassword: sandboxPassword,
        users: credentialsVault,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log("✅ Ambiente Sandbox local provisionado com sucesso!");
  console.log(`  - ${tenantMap.size} empresas fictícias configuradas (${Array.from(tenantMap.keys()).join(", ")})`);
  console.log(`  - ${userMap.size} usuários de demonstração sincronizados com Supabase Auth`);
  console.log(`  - ${manifestMemberships.length} vínculos multiempresa aplicados`);
  console.log(`  - ${manifestInvitations.length} cenários controlados de convite registrados`);
  console.log("🔒 Credenciais salvas localmente em 'sandbox-data/.credentials.local.json' (ignorado pelo Git).");
  console.log("   Execute 'pnpm sandbox:status --show-credentials' para consultar as contas de teste.");
}

// Execução direta via CLI
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  runSandboxSeed().catch((err) => {
    console.error("🛑 Erro durante execução do seed:", err.message);
    if (err.details) console.error("Detalhes:", err.details);
    process.exit(1);
  });
}
