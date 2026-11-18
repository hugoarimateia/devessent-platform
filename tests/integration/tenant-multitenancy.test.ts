import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/environment/env";
import { TenantService, MembershipService, InvitationService } from "@/core/tenants";
import { ForbiddenError, NotFoundError, TenantSuspendedError } from "@/core/errors/app-error";

describe("Real Multi-Tenant Integration Suite — DevEssent Core (Fase 3B)", () => {
  const ts = Date.now();
  const adminEmail = `admin.mt.${ts}@devessent.test`;
  const ownerAEmail = `ownerA.mt.${ts}@devessent.test`;
  const ownerBEmail = `ownerB.mt.${ts}@devessent.test`;
  const commonUserEmail = `common.mt.${ts}@devessent.test`;
  const inviteeEmail = `invitee.mt.${ts}@devessent.test`;

  let adminUserId: string;
  let ownerAUserId: string;
  let ownerBUserId: string;
  let commonUserId: string;
  let inviteeUserId: string;

  let tenantAId: string;
  let tenantASlug: string;
  let tenantBId: string;
  let tenantBSlug: string;

  // Clientes com diferentes identidades
  const adminClient = createAdminClient();
  let ownerAClient: ReturnType<typeof createClient<Database>>;
  let commonClient: ReturnType<typeof createClient<Database>>;
  let inviteeClient: ReturnType<typeof createClient<Database>>;

  beforeAll(async () => {
    // 1. Provisionar usuário Admin Global
    const { data: uAdmin } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: "SenhaSegura123!",
      email_confirm: true,
      user_metadata: { full_name: "Admin Multi-Tenant" },
    });
    adminUserId = uAdmin.user!.id;
    await adminClient.from("platform_admins").insert({ user_id: adminUserId });

    // 2. Provisionar Usuário Owner A
    const { data: uOwnerA } = await adminClient.auth.admin.createUser({
      email: ownerAEmail,
      password: "SenhaSegura123!",
      email_confirm: true,
      user_metadata: { full_name: "Proprietário A" },
    });
    ownerAUserId = uOwnerA.user!.id;

    // 3. Provisionar Usuário Owner B
    const { data: uOwnerB } = await adminClient.auth.admin.createUser({
      email: ownerBEmail,
      password: "SenhaSegura123!",
      email_confirm: true,
      user_metadata: { full_name: "Proprietário B" },
    });
    ownerBUserId = uOwnerB.user!.id;

    // 4. Provisionar Usuário Comum
    const { data: uCommon } = await adminClient.auth.admin.createUser({
      email: commonUserEmail,
      password: "SenhaSegura123!",
      email_confirm: true,
      user_metadata: { full_name: "Usuário Comum" },
    });
    commonUserId = uCommon.user!.id;

    // 5. Provisionar Usuário Convidado
    const { data: uInvitee } = await adminClient.auth.admin.createUser({
      email: inviteeEmail,
      password: "SenhaSegura123!",
      email_confirm: true,
      user_metadata: { full_name: "Usuário Convidado" },
    });
    inviteeUserId = uInvitee.user!.id;

    // Inicializar clientes autenticados para os testes de sessão
    ownerAClient = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await ownerAClient.auth.signInWithPassword({ email: ownerAEmail, password: "SenhaSegura123!" });

    commonClient = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await commonClient.auth.signInWithPassword({ email: commonUserEmail, password: "SenhaSegura123!" });

    inviteeClient = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await inviteeClient.auth.signInWithPassword({ email: inviteeEmail, password: "SenhaSegura123!" });
  });

  afterAll(async () => {
    // Cleanup das empresas de teste e usuários
    if (tenantAId) await adminClient.from("tenants").delete().eq("id", tenantAId);
    if (tenantBId) await adminClient.from("tenants").delete().eq("id", tenantBId);

    const userIds = [adminUserId, ownerAUserId, ownerBUserId, commonUserId, inviteeUserId];
    for (const uid of userIds) {
      if (uid) await adminClient.auth.admin.deleteUser(uid);
    }
  });

  it("1. Administrador global cria empresa com proprietário inicial de forma atômica", async () => {
    tenantASlug = `atelie-sandbox-${ts}`;
    const result = await TenantService.createTenantWithAdmin(adminClient, adminUserId, {
      name: "Ateliê Sandbox",
      slug: tenantASlug,
      ownerEmail: ownerAEmail,
      ownerFullName: "Proprietário A",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    tenantAId = result.id;

    // Verificar se a membership de owner foi criada
    const { data: member } = await adminClient
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantAId)
      .eq("user_id", ownerAUserId)
      .single();

    expect(member).not.toBeNull();
    expect(member!.role).toBe("owner");

    // Verificar configurações padrão
    const { data: settings } = await adminClient
      .from("tenant_settings")
      .select("display_name, contact_email")
      .eq("tenant_id", tenantAId)
      .single();

    expect(settings).not.toBeNull();
    expect(settings!.display_name).toBe("Ateliê Sandbox");
    expect(settings!.contact_email).toBe(ownerAEmail.toLowerCase());

    // Criar Tenant B para testes de isolamento cruzado
    tenantBSlug = `verde-sandbox-${ts}`;
    const resultB = await TenantService.createTenantWithAdmin(adminClient, adminUserId, {
      name: "Verde Sandbox",
      slug: tenantBSlug,
      ownerEmail: ownerBEmail,
      ownerFullName: "Proprietário B",
    });
    tenantBId = resultB.id;
  });

  it("2. Usuário comum NÃO consegue criar empresa através do serviço administrativo", async () => {
    await expect(
      TenantService.createTenantWithAdmin(commonClient, commonUserId, {
        name: "Empresa Invasora",
        slug: `invasora-${ts}`,
        ownerEmail: commonUserEmail,
        ownerFullName: "Tentativa de Fraude",
      })
    ).rejects.toThrow(/Acesso negado/);
  });

  it("3. Proprietário da Empresa A visualiza apenas seus dados autorizados", async () => {
    const contextA = await TenantService.resolveTenantContext(ownerAClient, ownerAUserId, tenantASlug);
    expect(contextA.tenantId).toBe(tenantAId);
    expect(contextA.role).toBe("owner");

    // Consulta de membros da Empresa A
    const membersA = await MembershipService.listMembers(ownerAClient, contextA);
    expect(membersA.some((m) => m.userId === ownerAUserId)).toBe(true);
    expect(membersA.every((m) => m.userId !== ownerBUserId)).toBe(true);
  });

  it("4. Bloqueio cruzado: Proprietário da Empresa A NÃO consegue acessar nem modificar Empresa B", async () => {
    // Tentar resolver o contexto da Empresa B
    await expect(
      TenantService.resolveTenantContext(ownerAClient, ownerAUserId, tenantBSlug)
    ).rejects.toThrow(ForbiddenError);

    // Tentativa direta no banco via client autenticado como Owner A para atualizar settings da Empresa B
    const { data, error } = await ownerAClient
      .from("tenant_settings")
      .update({ display_name: "Hacked Display Name" })
      .eq("tenant_id", tenantBId)
      .select();

    // RLS deve bloquear a alteração, retornando nenhum registro afetado
    expect(data?.length || 0).toBe(0);
  });

  it("5. Usuário com dois vínculos consegue listar e alternar entre empresas autorizadas", async () => {
    // Vincular usuário comum à Empresa A como 'staff'
    await adminClient.from("tenant_memberships").insert({
      tenant_id: tenantAId,
      user_id: commonUserId,
      role: "staff",
    });

    // Vincular usuário comum à Empresa B como 'manager'
    await adminClient.from("tenant_memberships").insert({
      tenant_id: tenantBId,
      user_id: commonUserId,
      role: "manager",
    });

    // Listar estabelecimentos do usuário
    const userTenants = await TenantService.listUserTenants(commonClient, commonUserId);
    expect(userTenants.length).toBe(2);

    const tenantA = userTenants.find((t) => t.tenantId === tenantAId);
    const tenantB = userTenants.find((t) => t.tenantId === tenantBId);

    expect(tenantA).toBeDefined();
    expect(tenantA!.role).toBe("staff");

    expect(tenantB).toBeDefined();
    expect(tenantB!.role).toBe("manager");

    // Alternar contexto para Empresa A (deve retornar papel staff)
    const contextA = await TenantService.resolveTenantContext(commonClient, commonUserId, tenantAId);
    expect(contextA.role).toBe("staff");

    // Alternar contexto para Empresa B (deve retornar papel manager)
    const contextB = await TenantService.resolveTenantContext(commonClient, commonUserId, tenantBId);
    expect(contextB.role).toBe("manager");
  });

  it("6. Forjamento / Adulteração de ID de empresa é sumariamente rejeitado pelo servidor", async () => {
    const fakeUuid = "99999999-9999-9999-9999-999999999999";
    await expect(
      TenantService.resolveTenantContext(commonClient, commonUserId, fakeUuid)
    ).rejects.toThrow(NotFoundError);
  });

  it("7. Gestor (Manager) NÃO consegue promover funcionário a Proprietário nem a Gestor", async () => {
    const contextB = await TenantService.resolveTenantContext(commonClient, commonUserId, tenantBId);
    expect(contextB.role).toBe("manager");

    // Adicionar um membro staff na Empresa B
    const { data: uStaff } = await adminClient.auth.admin.createUser({
      email: `staff.b.${ts}@devessent.test`,
      password: "SenhaForte123!",
      email_confirm: true,
      user_metadata: { full_name: "Staff B" },
    });
    await adminClient.from("tenant_memberships").insert({
      tenant_id: tenantBId,
      user_id: uStaff.user!.id,
      role: "staff",
    });

    // Gestor tentando alterar papel de outro membro deve ser bloqueado
    await expect(
      MembershipService.updateMemberRole(commonClient, contextB, {
        targetUserId: uStaff.user!.id,
        newRole: "manager",
      })
    ).rejects.toThrow(ForbiddenError);

    await adminClient.auth.admin.deleteUser(uStaff.user!.id);
  });

  it("8. Funcionário (Staff) NÃO consegue alterar seu próprio papel nem de terceiros", async () => {
    const contextA = await TenantService.resolveTenantContext(commonClient, commonUserId, tenantAId);
    expect(contextA.role).toBe("staff");

    await expect(
      MembershipService.updateMemberRole(commonClient, contextA, {
        targetUserId: commonUserId,
        newRole: "manager",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("9. Usuário sem vínculo recebe acesso negado ao tentar acessar estabelecimento", async () => {
    await expect(
      TenantService.resolveTenantContext(inviteeClient, inviteeUserId, tenantAId)
    ).rejects.toThrow(ForbiddenError);
  });

  it("10. Fluxo completo de convite: emissão, validação de token e aceitação autorizada", async () => {
    const contextA = await TenantService.resolveTenantContext(ownerAClient, ownerAUserId, tenantAId);

    // 1. Owner A emite convite para inviteeEmail
    const invite = await InvitationService.createInvitation(ownerAClient, contextA, {
      email: inviteeEmail,
      role: "staff",
    });

    expect(invite).toBeDefined();
    expect(invite.token).toBeDefined();

    // 2. Consulta pública dos dados do convite
    const publicInvite = await InvitationService.getInvitationByToken(inviteeClient, invite.token);
    expect(publicInvite.email).toBe(inviteeEmail);
    expect(publicInvite.role).toBe("staff");
    expect(publicInvite.tenantName).toBe("Ateliê Sandbox");
    expect(publicInvite.isExpired).toBe(false);

    // 3. Usuário autorizado aceita o convite
    const acceptResult = await InvitationService.acceptInvitation(inviteeClient, invite.token, inviteeUserId);
    expect(acceptResult.success).toBe(true);
    expect(acceptResult.tenant_id).toBe(tenantAId);

    // 4. Confirmar que o vínculo foi criado
    const contextInvitee = await TenantService.resolveTenantContext(inviteeClient, inviteeUserId, tenantAId);
    expect(contextInvitee.role).toBe("staff");

    // 5. Tentativa de reutilizar o mesmo convite deve falhar
    await expect(
      InvitationService.acceptInvitation(inviteeClient, invite.token, inviteeUserId)
    ).rejects.toThrow();
  });

  it("11. Convite NÃO pode ser aceito por identidade com e-mail divergente", async () => {
    const contextA = await TenantService.resolveTenantContext(ownerAClient, ownerAUserId, tenantAId);

    const differentEmail = `divergente.${ts}@devessent.test`;
    const invite = await InvitationService.createInvitation(ownerAClient, contextA, {
      email: differentEmail,
      role: "staff",
    });

    // Tentativa do usuário commonUserId aceitar um convite destinado a differentEmail
    await expect(
      InvitationService.acceptInvitation(commonClient, invite.token, commonUserId)
    ).rejects.toThrow(/outro endereço de e-mail/i);
  });

  it("12. Convite revogado é rejeitado e não permite adesão", async () => {
    const contextA = await TenantService.resolveTenantContext(ownerAClient, ownerAUserId, tenantAId);

    const revogEmail = `revogado.${ts}@devessent.test`;
    const invite = await InvitationService.createInvitation(ownerAClient, contextA, {
      email: revogEmail,
      role: "staff",
    });

    // Owner revoga o convite
    await InvitationService.revokeInvitation(ownerAClient, contextA, invite.id);

    // Tentar aceitar convite revogado
    await expect(
      InvitationService.acceptInvitation(inviteeClient, invite.token, inviteeUserId)
    ).rejects.toThrow();
  });

  it("13. Remoção de membro impede operações posteriores no estabelecimento", async () => {
    const contextA = await TenantService.resolveTenantContext(ownerAClient, ownerAUserId, tenantAId);

    // Owner A remove o usuário convidado
    await MembershipService.removeMember(ownerAClient, contextA, { targetUserId: inviteeUserId });

    // O usuário convidado deve ter seu acesso negado
    await expect(
      TenantService.resolveTenantContext(inviteeClient, inviteeUserId, tenantAId)
    ).rejects.toThrow(ForbiddenError);
  });

  it("14. Empresa suspensa bloqueia operações de membros comuns", async () => {
    // Suspender a Empresa A através do Platform Admin
    await TenantService.updateTenantStatus(adminClient, adminUserId, tenantAId, "suspended");

    // O Owner A tenta resolver o contexto da empresa suspensa
    await expect(
      TenantService.resolveTenantContext(ownerAClient, ownerAUserId, tenantAId)
    ).rejects.toThrow(TenantSuspendedError);

    // Reativar a empresa
    await TenantService.updateTenantStatus(adminClient, adminUserId, tenantAId, "active");
    const reativado = await TenantService.resolveTenantContext(ownerAClient, ownerAUserId, tenantAId);
    expect(reativado.status).toBe("active");
  });

  it("15. Platform Admin acessa funções da plataforma sem criar automaticamente sessão corporativa", async () => {
    // Admin consulta todas as empresas
    const allTenants = await TenantService.listAllTenants(adminClient, adminUserId);
    expect(allTenants.length).toBeGreaterThanOrEqual(2);

    // Admin NÃO deve estar na tabela tenant_memberships da Empresa A
    const { data: adminMember } = await adminClient
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantAId)
      .eq("user_id", adminUserId)
      .maybeSingle();

    expect(adminMember).toBeNull();
  });
});
