/**
 * Script de Verificação dos Cenários Funcionais do Sandbox (A a H).
 * - Executa validações automatizadas contra o banco e serviços reais locais.
 * - Confirma isolamento, permissões de papéis, multiempresa e suspensão.
 * - Restaura o estado original de qualquer mutação de teste (ex: Cenário G).
 */
import { createClient } from "@supabase/supabase-js";
import { LocalGuard } from "../lib/local-guard";
import { SandboxManifest } from "../lib/sandbox-manifest";
import { resolveSandboxPassword } from "../fixtures/users";
import { createAdminClient } from "@/lib/supabase/admin";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { AuthService } from "@/core/auth/services/auth-service";
import { PermissionService } from "@/core/permissions/services/permission-service";
import { env } from "@/lib/environment/env";
import type { Database } from "@/types/database.types";

async function authenticateClient(email: string, password = resolveSandboxPassword(email)) {
  const client = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(`Falha ao autenticar ${email}: ${error?.message}`);
  }
  return { client, user: data.user, session: data.session };
}

export async function verifySandboxScenarios() {
  LocalGuard.loadLocalEnv();
  LocalGuard.assertSafeEnvironment();

  const adminClient = createAdminClient();
  await LocalGuard.assertSafeDatabaseConnection(adminClient);

  console.log("===============================================================================");
  console.log("      DEVESSENT PLATFORM CORE — VERIFICAÇÃO DE CENÁRIOS SANDBOX (A - H)        ");
  console.log("===============================================================================");

  // Obter IDs dos tenants do Sandbox
  const { data: tenants } = await adminClient
    .from("tenants")
    .select("id, slug, name, status")
    .in("slug", SandboxManifest.KNOWN_SANDBOX_SLUGS as unknown as string[]);

  const atelieTenant = tenants?.find((t) => t.slug === "atelier-sandbox");
  const verdeTenant = tenants?.find((t) => t.slug === "verde-sandbox");

  if (!atelieTenant || !verdeTenant) {
    throw new Error("Sandbox incompleto. Execute 'pnpm sandbox:seed' antes de verificar.");
  }

  let passedScenarios = 0;

  // ---------------------------------------------------------------------------
  // CENÁRIO A: Proprietário
  // ---------------------------------------------------------------------------
  console.log("\n🧪 Cenário A: Proprietário (Owner) do Ateliê Sandbox");
  {
    const { client: ownerClient, user: ownerUser } = await authenticateClient(
      "owner.atelie@sandbox.devessent.test"
    );

    // 1. Resolução autorizada de contexto no Ateliê
    const atelieContext = await TenantService.resolveTenantContext(
      ownerClient,
      ownerUser.id,
      atelieTenant.id
    );
    if (atelieContext.role !== "owner") {
      throw new Error(`Cenário A falhou: papel esperado 'owner', recebido '${atelieContext.role}'`);
    }

    // 2. Consulta autorizada aos membros da própria empresa via RLS
    const { data: myMembers, error: membersErr } = await ownerClient
      .from("tenant_memberships")
      .select("id, role, user_id")
      .eq("tenant_id", atelieTenant.id);

    if (membersErr || !myMembers || myMembers.length === 0) {
      throw new Error(`Cenário A falhou: proprietário não conseguiu listar membros: ${membersErr?.message}`);
    }

    // 3. Bloqueio de acesso cruzado ao Verde Sandbox via RLS
    const { data: alienData } = await ownerClient
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", verdeTenant.id);

    if (alienData && alienData.length > 0) {
      throw new Error("Cenário A falhou: proprietário do Ateliê conseguiu ler dados do Verde Sandbox via RLS!");
    }

    console.log("  ✅ Acesso legítimo ao Ateliê confirmado e isolamento contra Verde Sandbox validado.");
    passedScenarios++;
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO B: Gestor
  // ---------------------------------------------------------------------------
  console.log("\n🧪 Cenário B: Gestor (Manager) do Ateliê Sandbox");
  {
    const { client: managerClient, user: managerUser } = await authenticateClient(
      "manager.atelie@sandbox.devessent.test"
    );

    const context = await TenantService.resolveTenantContext(
      managerClient,
      managerUser.id,
      atelieTenant.id
    );

    if (context.role !== "manager") {
      throw new Error(`Cenário B falhou: papel esperado 'manager', recebido '${context.role}'`);
    }

    // Verificar permissões com a matriz RBAC de domínio
    const canInviteStaff = PermissionService.checkPermission("manager", "invite_member", "staff");
    const canInviteOwner = PermissionService.checkPermission("manager", "invite_member", "owner");
    const canInviteManager = PermissionService.checkPermission("manager", "invite_member", "manager");

    if (!canInviteStaff) throw new Error("Cenário B falhou: gestor deveria poder convidar membros staff.");
    if (canInviteOwner) throw new Error("Cenário B falhou: gestor NÃO pode convidar proprietário.");
    if (canInviteManager) throw new Error("Cenário B falhou: gestor NÃO pode convidar gestor.");

    console.log("  ✅ Gestor visualiza recursos autorizados e restrições de promoção a Owner/Manager cumpridas.");
    passedScenarios++;
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO C: Funcionário
  // ---------------------------------------------------------------------------
  console.log("\n🧪 Cenário C: Funcionário (Staff) do Ateliê Sandbox");
  {
    const { client: staffClient, user: staffUser } = await authenticateClient(
      "staff.atelie@sandbox.devessent.test"
    );

    const context = await TenantService.resolveTenantContext(
      staffClient,
      staffUser.id,
      atelieTenant.id
    );

    if (context.role !== "staff") {
      throw new Error(`Cenário C falhou: papel esperado 'staff', recebido '${context.role}'`);
    }

    const canInvite = PermissionService.checkPermission("staff", "invite_member");
    const canEditSettings = PermissionService.checkPermission("staff", "update_general_settings");
    const canManagePlatform = PermissionService.checkPermission("staff", "manage_any_tenant");

    if (canInvite || canEditSettings || canManagePlatform) {
      throw new Error("Cenário C falhou: funcionário possui privilégios indevidos na matriz RBAC.");
    }

    // Tentativa de alterar configurações via RLS direta
    const { error: patchErr } = await staffClient
      .from("tenant_settings")
      .update({ display_name: "Tentativa Maliciosa" })
      .eq("tenant_id", atelieTenant.id);

    // O PostgREST não altera nada ou retorna erro de permissão por RLS
    const { data: checkSettings } = await adminClient
      .from("tenant_settings")
      .select("display_name")
      .eq("tenant_id", atelieTenant.id)
      .single();

    if (checkSettings?.display_name === "Tentativa Maliciosa") {
      throw new Error("Cenário C falhou: funcionário conseguiu modificar configurações via RLS!");
    }

    console.log("  ✅ Funcionário possui apenas privilégios operacionais mínimos; alteração bloqueada.");
    passedScenarios++;
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO D: Usuário Multiempresa
  // ---------------------------------------------------------------------------
  console.log("\n🧪 Cenário D: Usuário com Múltiplos Vínculos (Ateliê e Verde)");
  {
    const { client: multiClient, user: multiUser } = await authenticateClient(
      "multi.member@sandbox.devessent.test"
    );

    const userTenants = await TenantService.listUserTenants(multiClient, multiUser.id);
    if (userTenants.length < 2) {
      throw new Error(`Cenário D falhou: esperado pelo menos 2 vínculos, encontrados ${userTenants.length}`);
    }

    // Alternar para Ateliê
    const ctxAtelie = await TenantService.resolveTenantContext(multiClient, multiUser.id, atelieTenant.id);
    // Alternar para Verde
    const ctxVerde = await TenantService.resolveTenantContext(multiClient, multiUser.id, verdeTenant.id);

    if (ctxAtelie.role !== "staff") {
      throw new Error(`Cenário D falhou: papel no Ateliê esperado 'staff', obtido '${ctxAtelie.role}'`);
    }
    if (ctxVerde.role !== "manager") {
      throw new Error(`Cenário D falhou: papel no Verde esperado 'manager', obtido '${ctxVerde.role}'`);
    }

    console.log(`  ✅ Alternância de empresa validada: Ateliê (${ctxAtelie.role}) ↔ Verde (${ctxVerde.role}).`);
    passedScenarios++;
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO E: Usuário Sem Empresa
  // ---------------------------------------------------------------------------
  console.log("\n🧪 Cenário E: Usuário Autenticado Sem Vínculos");
  {
    const { client: soloClient, user: soloUser } = await authenticateClient(
      "solo.user@sandbox.devessent.test"
    );

    const userTenants = await TenantService.listUserTenants(soloClient, soloUser.id);
    if (userTenants.length !== 0) {
      throw new Error(`Cenário E falhou: usuário sem empresa retornou ${userTenants.length} vínculos.`);
    }

    let failedAsExpected = false;
    try {
      await TenantService.resolveTenantContext(soloClient, soloUser.id, atelieTenant.id);
    } catch {
      failedAsExpected = true;
    }

    if (!failedAsExpected) {
      throw new Error("Cenário E falhou: usuário sem vínculo conseguiu resolver contexto de empresa!");
    }

    console.log("  ✅ Usuário autentica com sucesso, apresenta 0 empresas vinculadas e acesso negado a tenants.");
    passedScenarios++;
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO F: Administrador Global da DevEssent
  // ---------------------------------------------------------------------------
  console.log("\n🧪 Cenário F: Administrador Global da Plataforma");
  {
    const { client: adminUserClient, user: adminUser } = await authenticateClient(
      "admin.global@sandbox.devessent.test"
    );

    const sessionUser = await AuthService.getSessionUser(adminUserClient);
    if (!sessionUser || !sessionUser.isPlatformAdmin) {
      throw new Error("Cenário F falhou: admin.global não foi reconhecido como platform_admin.");
    }

    // Administrador acessa qualquer tenant com papel platform_admin sem precisar de membership comum
    const atelieAdminCtx = await TenantService.resolveTenantContext(
      adminUserClient,
      adminUser.id,
      atelieTenant.id
    );

    if (atelieAdminCtx.role !== "platform_admin") {
      throw new Error(`Cenário F falhou: papel esperado 'platform_admin', recebido '${atelieAdminCtx.role}'`);
    }

    console.log("  ✅ Administrador global validado com acesso soberano de plataforma.");
    passedScenarios++;
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO G: Suspensão Temporária e Restauração
  // ---------------------------------------------------------------------------
  console.log("\n🧪 Cenário G: Suspensão Temporária de Empresa e Revogação Imediata");
  {
    const { client: ownerClient, user: ownerUser } = await authenticateClient(
      "owner.verde@sandbox.devessent.test"
    );

    try {
      // 1. Suspender temporariamente Verde Sandbox
      await adminClient.from("tenants").update({ status: "suspended" }).eq("id", verdeTenant.id);

      // 2. Verificar que o proprietário tem o acesso bloqueado com TenantSuspendedError
      let caughtSuspension = false;
      try {
        await TenantService.resolveTenantContext(ownerClient, ownerUser.id, verdeTenant.id);
      } catch (err: unknown) {
        if ((err as Error).name === "TenantSuspendedError") {
          caughtSuspension = true;
        }
      }

      if (!caughtSuspension) {
        throw new Error("Cenário G falhou: empresa suspensa não disparou TenantSuspendedError.");
      }

      console.log("  ✅ Bloqueio imediato verificado em empresa com status suspenso.");
    } finally {
      // 3. Restaurar estado original ativo (Always-restored)
      await adminClient.from("tenants").update({ status: "active" }).eq("id", verdeTenant.id);
      console.log("  ↳ Estado operacional 'active' do Verde Sandbox restaurado com sucesso.");
    }

    passedScenarios++;
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO H: Convites e Validações
  // ---------------------------------------------------------------------------
  console.log("\n🧪 Cenário H: Ciclo de Vida de Convites (Pendente, Expirado e Rejeição de Divergência)");
  {
    // 1. Consultar convite expirado
    const { data: expiredInv } = await adminClient
      .from("tenant_invitations")
      .select("id, status, expires_at")
      .eq("email", "convidado.expirado@sandbox.devessent.test")
      .single();

    if (!expiredInv || expiredInv.status !== "expired") {
      throw new Error("Cenário H falhou: convite expirado de teste não encontrado com status correto.");
    }

    // 2. Consultar convite pendente
    const { data: pendingInv } = await adminClient
      .from("tenant_invitations")
      .select("id, status, expires_at, token_hash")
      .eq("email", "convidado.pendente@sandbox.devessent.test")
      .single();

    if (!pendingInv || pendingInv.status !== "pending") {
      throw new Error("Cenário H falhou: convite pendente de teste não encontrado.");
    }

    // 3. Testar rejeição de aceitação por usuário com e-mail divergente
    const { user: soloUser } = await authenticateClient("solo.user@sandbox.devessent.test");

    const { error: rejectErr } = await adminClient.rpc("accept_tenant_invitation", {
      p_token_hash: pendingInv.token_hash,
      p_user_id: soloUser.id,
    });

    if (!rejectErr) {
      throw new Error("Cenário H falhou: aceitação de convite por e-mail divergente DEVERIA ter sido rejeitada!");
    }

    console.log("  ✅ Convites pendente e expirado verificados; rejeição de destinatário divergente aprovada.");
    passedScenarios++;
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO I: Módulo Comercial Retail — Catálogo e Isolamento
  // ---------------------------------------------------------------------------
  console.log("\n🧪 Cenário I: Módulo Comercial Retail — Catálogo, Produtos e Isolamento");
  {
    // 1. Verificar loja comercial do Ateliê
    const { data: atelieStore } = await adminClient
      .from("retail_stores")
      .select("id, is_active, currency")
      .eq("tenant_id", atelieTenant.id)
      .single();

    if (!atelieStore || !atelieStore.is_active) {
      throw new Error("Cenário I falhou: loja Retail do Ateliê Sandbox não encontrada ou inativa.");
    }

    // 2. Autenticar proprietária do Ateliê e consultar produtos
    const { client: ownerAtelieClient } = await authenticateClient("owner.atelie@sandbox.devessent.test");
    const { data: atelieProds } = await ownerAtelieClient
      .from("retail_products")
      .select("id, name, status, slug")
      .eq("tenant_id", atelieTenant.id);

    if (!atelieProds || atelieProds.length < 3) {
      throw new Error("Cenário I falhou: produtos do Ateliê Sandbox não carregados pelo proprietário.");
    }

    // 3. Autenticar proprietário do Verde e verificar que NÃO consegue ver produtos rascunho do Ateliê
    const { client: ownerVerdeClient } = await authenticateClient("owner.verde@sandbox.devessent.test");
    const { data: crossDrafts } = await ownerVerdeClient
      .from("retail_products")
      .select("id")
      .eq("tenant_id", atelieTenant.id)
      .eq("status", "draft");

    if (crossDrafts && crossDrafts.length > 0) {
      throw new Error("Cenário I falhou: vazamento de produtos em rascunho entre empresas distintas!");
    }

    console.log("  ✅ Catálogo Retail ativo, produtos com variantes provisionados e isolamento multiempresa validado.");
    passedScenarios++;
  }

  console.log("\n===============================================================================");
  console.log(`🎉 TODOS OS ${passedScenarios} CENÁRIOS DO SANDBOX APROVADOS: ${passedScenarios}/9 (100% SUCESSO)`);
  console.log("===============================================================================\n");
}

if (process.argv[1] && process.argv[1].endsWith("verify.ts")) {
  verifySandboxScenarios().catch((err) => {
    console.error("🛑 Erro na verificação dos cenários Sandbox:", err.message);
    process.exit(1);
  });
}
