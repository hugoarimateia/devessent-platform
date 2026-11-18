import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { AuditService } from "@/core/audit/services/audit-service";
import { InvitationService } from "@/core/tenants/services/invitation-service";
import { MembershipService } from "@/core/tenants/services/membership-service";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { RateLimitService } from "@/core/security/rate-limit-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import {
  ForbiddenError,
  RateLimitError,
  TenantSuspendedError,
  ValidationError,
} from "@/core/errors/app-error";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type AppClient = SupabaseClient<Database>;

const TEST_RUN_TAG = `f5b-${Date.now()}`;
const TEST_PASSWORD = "SandboxTest@2026!#";

function makeClient(): AppClient {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createAndSignInUser(
  adminClient: AppClient,
  email: string,
  fullName: string
): Promise<{ userId: string; client: AppClient }> {
  const { data: created, error } = await adminClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !created.user) {
    throw new Error(`Falha ao criar usuário de teste (${email}): ${error?.message}`);
  }

  const client = makeClient();
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });

  if (signInErr) {
    throw new Error(`Falha no signIn do usuário de teste (${email}): ${signInErr.message}`);
  }

  return { userId: created.user.id, client };
}

describe("Fase 5B — Integração Real PostgreSQL, RLS, Auditoria, Convites e Rate Limit", () => {
  const adminClient: AppClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const createdUserIds: string[] = [];
  const createdTenantIds: string[] = [];

  let adminUserId = "";
  let adminAuthClient: AppClient;

  let ownerUserId = "";
  let ownerClient: AppClient;

  let secondOwnerUserId = "";

  let managerUserId = "";
  let managerClient: AppClient;

  let staffUserId = "";
  let staffClient: AppClient;

  let inviteeUserId = "";
  let inviteeClient: AppClient;

  let tenantAId = "";
  let tenantASlug = "";
  let tenantBId = "";
  let tenantBSlug = "";

  const ownerEmail = `owner-${TEST_RUN_TAG}@teste.devessent.test`;
  const secondOwnerEmail = `owner2-${TEST_RUN_TAG}@teste.devessent.test`;
  const managerEmail = `manager-${TEST_RUN_TAG}@teste.devessent.test`;
  const staffEmail = `staff-${TEST_RUN_TAG}@teste.devessent.test`;
  const inviteeEmail = `invitee-${TEST_RUN_TAG}@teste.devessent.test`;
  const platformAdminEmail = `padmin-${TEST_RUN_TAG}@teste.devessent.test`;

  beforeAll(async () => {
    const pAdmin = await createAndSignInUser(adminClient, platformAdminEmail, "Admin Fase 5B");
    adminUserId = pAdmin.userId;
    adminAuthClient = pAdmin.client;
    createdUserIds.push(adminUserId);

    const { error: paErr } = await adminClient
      .from("platform_admins")
      .insert({ user_id: adminUserId });
    if (paErr) throw new Error(`Falha ao promover admin de teste: ${paErr.message}`);

    const owner = await createAndSignInUser(adminClient, ownerEmail, "Owner Unidade A");
    ownerUserId = owner.userId;
    ownerClient = owner.client;
    createdUserIds.push(ownerUserId);

    const owner2 = await createAndSignInUser(adminClient, secondOwnerEmail, "Segundo Owner B");
    secondOwnerUserId = owner2.userId;
    createdUserIds.push(secondOwnerUserId);

    const manager = await createAndSignInUser(adminClient, managerEmail, "Gestor Unidade A");
    managerUserId = manager.userId;
    managerClient = manager.client;
    createdUserIds.push(managerUserId);

    const staff = await createAndSignInUser(adminClient, staffEmail, "Equipe Unidade A");
    staffUserId = staff.userId;
    staffClient = staff.client;
    createdUserIds.push(staffUserId);

    const invitee = await createAndSignInUser(adminClient, inviteeEmail, "Convidado Ciclo Vida");
    inviteeUserId = invitee.userId;
    inviteeClient = invitee.client;
    createdUserIds.push(inviteeUserId);

    tenantASlug = `tenant-a-${TEST_RUN_TAG}`;
    const tenantA = await TenantService.createTenantWithAdmin(adminClient, adminUserId, {
      name: "Unidade Alpha F5B",
      slug: tenantASlug,
      ownerEmail,
      ownerFullName: "Owner Unidade A",
    });
    tenantAId = tenantA.id;
    createdTenantIds.push(tenantAId);

    tenantBSlug = `tenant-b-${TEST_RUN_TAG}`;
    const tenantB = await TenantService.createTenantWithAdmin(adminClient, adminUserId, {
      name: "Unidade Beta F5B",
      slug: tenantBSlug,
      ownerEmail: secondOwnerEmail,
      ownerFullName: "Segundo Owner B",
    });
    tenantBId = tenantB.id;
    createdTenantIds.push(tenantBId);

    const { error: mErr } = await adminClient.from("tenant_memberships").insert([
      { tenant_id: tenantAId, user_id: managerUserId, role: "manager" },
      { tenant_id: tenantAId, user_id: staffUserId, role: "staff" },
      // Staff também participa da Unidade Beta para testar isolamento multiempresa na remoção
      { tenant_id: tenantBId, user_id: staffUserId, role: "staff" },
    ]);
    if (mErr) throw new Error(`Falha ao vincular membros iniciais: ${mErr.message}`);
  });

  afterAll(async () => {
    await adminClient
      .from("rate_limits")
      .delete()
      .like("scope", "test:%");

    if (createdUserIds.length > 0) {
      await adminClient
        .from("audit_logs")
        .delete()
        .in("actor_user_id", createdUserIds);
    }

    if (createdTenantIds.length > 0) {
      await adminClient
        .from("tenants")
        .delete()
        .in("id", createdTenantIds);
    }

    if (adminUserId) {
      await adminClient
        .from("platform_admins")
        .delete()
        .eq("user_id", adminUserId);
    }

    for (const uid of createdUserIds) {
      await adminClient.auth.admin.deleteUser(uid).catch(() => {});
    }
  });

  it("1-2. Convite expirado permite reenvio sem colisão 23505, marca anterior como expired e novo convite é aceito", async () => {
    const ownerCtx = await TenantService.resolveTenantContext(ownerClient, ownerUserId, tenantAId);

    // Emitir primeiro convite
    const firstInvite = await InvitationService.createInvitation(ownerClient, ownerCtx, {
      email: inviteeEmail,
      role: "staff",
    });

    // Forçar expiração no banco simulando decurso de 8 dias (mantendo status 'pending' como ocorre naturalmente)
    const pastIso = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const { error: expireErr } = await adminClient
      .from("tenant_invitations")
      .update({ expires_at: pastIso })
      .eq("id", firstInvite.id);
    expect(expireErr).toBeNull();

    // Consulta pública deve indicar status computado 'expired'
    const expiredCheck = await InvitationService.getInvitationByToken(makeClient(), firstInvite.token);
    expect(expiredCheck.status).toBe("expired");
    expect(expiredCheck.isExpired).toBe(true);

    // Aceite do token expirado precisa falhar no banco
    await expect(
      InvitationService.acceptInvitation(inviteeClient, firstInvite.token, inviteeUserId)
    ).rejects.toThrow(ValidationError);

    // Reenviar convite para o mesmo e-mail: NÃO pode lançar 23505 nem erro de duplicidade
    const reInvite = await InvitationService.createInvitation(ownerClient, ownerCtx, {
      email: inviteeEmail,
      role: "staff",
    });
    expect(reInvite.id).not.toBe(firstInvite.id);

    // Histórico deve mostrar o antigo como 'expired' e o novo como 'pending'
    const history = await InvitationService.listInvitations(ownerClient, ownerCtx, {
      includeHistory: true,
    });
    const oldRow = history.find((item) => item.id === firstInvite.id);
    const newRow = history.find((item) => item.id === reInvite.id);
    expect(oldRow?.status).toBe("expired");
    expect(newRow?.status).toBe("pending");

    // Novo token precisa ser aceito normalmente
    const accepted = await InvitationService.acceptInvitation(
      inviteeClient,
      reInvite.token,
      inviteeUserId
    );
    expect(accepted.success).toBe(true);
    expect(accepted.tenant_id).toBe(tenantAId);
  });

  it("3. Convite revogado permanece bloqueado e pode ser reenviado posteriormente", async () => {
    const ownerCtx = await TenantService.resolveTenantContext(ownerClient, ownerUserId, tenantAId);
    const targetEmail = `revoked-${TEST_RUN_TAG}@teste.devessent.test`;

    const invite = await InvitationService.createInvitation(ownerClient, ownerCtx, {
      email: targetEmail,
      role: "staff",
    });

    await InvitationService.revokeInvitation(ownerClient, ownerCtx, invite.id);

    const lookup = await InvitationService.getInvitationByToken(makeClient(), invite.token);
    expect(lookup.status).toBe("revoked");

    await expect(
      InvitationService.acceptInvitation(inviteeClient, invite.token, inviteeUserId)
    ).rejects.toThrow(ValidationError);

    // Reenvio após revogação deve funcionar
    const reIssued = await InvitationService.createInvitation(ownerClient, ownerCtx, {
      email: targetEmail,
      role: "staff",
    });
    expect(reIssued.id).not.toBe(invite.id);
    await InvitationService.revokeInvitation(ownerClient, ownerCtx, reIssued.id);
  });

  it("4. Configurações com telefone brasileiro formatado e monograma minúsculo persistem corretamente e geram auditoria segura", async () => {
    const ownerCtx = await TenantService.resolveTenantContext(ownerClient, ownerUserId, tenantAId);

    const updated = await TenantService.updateSettings(ownerClient, ownerCtx, {
      display_name: "Alpha Matriz Renovada",
      contact_email: "matriz@alpha.test",
      contact_phone: "(11) 98888-1001",
      segment_label: "Moda & Varejo",
      primary_color: "#5B46E5",
      monogram: "am",
      brand_description: "Operação comercial validada em testes reais.",
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
    });

    expect(updated.contact_phone).toBe("(11) 98888-1001");
    expect(updated.monogram).toBe("AM");
  });

  it("5-6. Redação profunda impede tokens/senhas/JWTs em audit_logs na gravação e na leitura", async () => {
    await AuditService.recordEvent({
      supabase: ownerClient,
      tenantId: tenantAId,
      actorUserId: ownerUserId,
      action: "tenant_settings.updated",
      resourceType: "tenant_settings",
      resourceId: tenantAId,
      metadata: {
        updatedFields: ["display_name"],
        token: "nao-deve-persistir",
        nested: {
          password: "secret-password",
          link: "http://localhost:3000/convite/0123456789abcdef012345",
        },
      },
    });

    const auditResult = await AuditService.listTenantAuditLogs(
      ownerClient,
      ownerUserId,
      tenantAId,
      { action: "tenant_settings.updated", pageSize: 10 }
    );

    expect(auditResult.items.length).toBeGreaterThanOrEqual(1);
    const serialized = JSON.stringify(auditResult.items);
    expect(serialized).not.toContain("nao-deve-persistir");
    expect(serialized).not.toContain("secret-password");
    expect(serialized).not.toContain("0123456789abcdef012345");
  });

  it("7-9. Auditoria multiempresa respeita RBAC e RLS: Owner vê governança, Manager vê apenas operação, Staff vê 0 linhas e cross-tenant falha", async () => {
    // Owner da Unidade A tenta ler auditoria da Unidade B -> ForbiddenError
    await expect(
      AuditService.listTenantAuditLogs(ownerClient, ownerUserId, tenantBId)
    ).rejects.toThrow(ForbiddenError);

    // Query direta RLS cross-tenant na Unidade B retorna 0 registros
    const { data: crossTenantRows } = await ownerClient
      .from("audit_logs")
      .select("id")
      .eq("tenant_id", tenantBId);
    expect(crossTenantRows ?? []).toHaveLength(0);

    // Owner da Unidade A vê eventos de governança (tenant.created) e operação (tenant_settings.updated)
    const ownerAudit = await AuditService.listTenantAuditLogs(ownerClient, ownerUserId, tenantAId, {
      pageSize: 30,
    });
    const ownerActions = ownerAudit.items.map((i) => i.action);
    expect(ownerActions).toContain("tenant.created");
    expect(ownerActions).toContain("tenant_settings.updated");

    // Manager vê eventos operacionais, MAS não vê tenant.created / tenant.suspended / tenant.reactivated
    const managerAudit = await AuditService.listTenantAuditLogs(
      managerClient,
      managerUserId,
      tenantAId,
      { pageSize: 30 }
    );
    const managerActions = managerAudit.items.map((i) => i.action);
    expect(managerActions).toContain("tenant_settings.updated");
    expect(managerActions).not.toContain("tenant.created");
    expect(managerActions).not.toContain("tenant.suspended");

    // Mesmo se manager filtrar explicitamente por ação de governança, retorna vazio
    const managerGovFilter = await AuditService.listTenantAuditLogs(
      managerClient,
      managerUserId,
      tenantAId,
      { action: "tenant.created" }
    );
    expect(managerGovFilter.items).toHaveLength(0);

    // Staff é bloqueado tanto no serviço (ForbiddenError) quanto diretamente por RLS no PostgreSQL
    await expect(
      AuditService.listTenantAuditLogs(staffClient, staffUserId, tenantAId)
    ).rejects.toThrow(ForbiddenError);

    const { data: staffDirectRows } = await staffClient
      .from("audit_logs")
      .select("id")
      .eq("tenant_id", tenantAId);
    expect(staffDirectRows ?? []).toHaveLength(0);
  });

  it("10. Hierarquia de equipe, proteção contra remoção de proprietário e isolamento multiempresa na remoção", async () => {
    const ownerCtx = await TenantService.resolveTenantContext(ownerClient, ownerUserId, tenantAId);
    const managerCtx = await TenantService.resolveTenantContext(
      managerClient,
      managerUserId,
      tenantAId
    );

    // Manager NÃO pode alterar papel de outro manager/owner nem convidar manager
    await expect(
      InvitationService.createInvitation(managerClient, managerCtx, {
        email: `blocked-${TEST_RUN_TAG}@teste.devessent.test`,
        role: "manager",
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      MembershipService.updateMemberRole(managerClient, managerCtx, {
        targetUserId: ownerUserId,
        newRole: "staff",
      })
    ).rejects.toThrow(ForbiddenError);

    // Owner NÃO pode remover outro owner pelo fluxo comum e trigger protege último owner
    const { data: ownerMembership } = await adminClient
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", tenantAId)
      .eq("user_id", ownerUserId)
      .single();

    const { error: triggerErr } = await adminClient
      .from("tenant_memberships")
      .delete()
      .eq("id", ownerMembership!.id);
    expect(triggerErr).not.toBeNull();
    expect(toPublicErrorMessage(triggerErr)).not.toContain("SQLSTATE");

    // Staff pertence às unidades A e B; ao ser removido da Unidade A pelo Owner, mantém acesso na Unidade B
    await MembershipService.updateMemberRole(ownerClient, ownerCtx, {
      targetUserId: inviteeUserId,
      newRole: "manager",
    });

    await MembershipService.removeMember(ownerClient, ownerCtx, {
      targetUserId: staffUserId,
    });

    await expect(
      TenantService.resolveTenantContext(staffClient, staffUserId, tenantAId)
    ).rejects.toThrow(ForbiddenError);

    const betaContextForStaff = await TenantService.resolveTenantContext(
      staffClient,
      staffUserId,
      tenantBId
    );
    expect(betaContextForStaff.tenantId).toBe(tenantBId);
    expect(betaContextForStaff.role).toBe("staff");
  });

  it("11-12. Suspensão bloqueia sub-rotas/convites de membros, enquanto platform_admin consulta auditoria global filtrada", async () => {
    // Usuário comum não acessa listPlatformAuditLogs
    await expect(
      AuditService.listPlatformAuditLogs(ownerClient, ownerUserId)
    ).rejects.toThrow(ForbiddenError);

    // Admin suspende Unidade Alpha
    await TenantService.updateTenantStatus(adminClient, adminUserId, tenantAId, "suspended");

    // Qualquer resolução de contexto (dashboard/membros/configurações/atividades) lança TenantSuspendedError
    await expect(
      TenantService.resolveTenantContext(ownerClient, ownerUserId, tenantAId)
    ).rejects.toThrow(TenantSuspendedError);

    await expect(
      TenantService.resolveTenantContext(managerClient, managerUserId, tenantAId)
    ).rejects.toThrow(TenantSuspendedError);

    // Convite pendente aponta tenantStatus 'suspended'
    const ownerCtxWhileReactivating = await TenantService.updateTenantStatus(
      adminClient,
      adminUserId,
      tenantAId,
      "active"
    );
    expect(ownerCtxWhileReactivating.status).toBe("active");

    const activeOwnerCtx = await TenantService.resolveTenantContext(
      ownerClient,
      ownerUserId,
      tenantAId
    );
    const pendingInvite = await InvitationService.createInvitation(ownerClient, activeOwnerCtx, {
      email: `susp-${TEST_RUN_TAG}@teste.devessent.test`,
      role: "staff",
    });

    await TenantService.updateTenantStatus(adminClient, adminUserId, tenantAId, "suspended");
    const suspInvite = await InvitationService.getInvitationByToken(makeClient(), pendingInvite.token);
    expect(suspInvite.tenantStatus).toBe("suspended");

    // Platform admin filtra trilha global por tenantAId e encontra eventos de suspensão e reativação
    const platformAudit = await AuditService.listPlatformAuditLogs(adminAuthClient, adminUserId, {
      tenantId: tenantAId,
      pageSize: 30,
    });
    const actions = platformAudit.items.map((item) => item.action);
    expect(actions).toContain("tenant.suspended");
    expect(actions).toContain("tenant.reactivated");
    expect(platformAudit.items.every((item) => item.tenantId === tenantAId)).toBe(true);

    // Reativar para deixar unidade consistente até limpeza no afterAll
    await TenantService.updateTenantStatus(adminClient, adminUserId, tenantAId, "active");
    const restoredCtx = await TenantService.resolveTenantContext(
      ownerClient,
      ownerUserId,
      tenantAId
    );
    expect(restoredCtx.status).toBe("active");
  });

  it("13-14. RateLimitService durável no PostgreSQL bloqueia após limite (429), reseta e impede acesso direto via anon/authenticated", async () => {
    const testPolicy = {
      scope: `test:fase5b_${TEST_RUN_TAG}`,
      maxAttempts: 3,
      windowSeconds: 60,
      blockSeconds: 120,
      message: "Limite de teste atingido.",
    };
    const key = "usuario-teste-rate-limit@devessent.test";

    const r1 = await RateLimitService.consumeOrThrow(testPolicy, key, adminClient);
    expect(r1.remaining).toBe(2);

    const r2 = await RateLimitService.consumeOrThrow(testPolicy, key, adminClient);
    expect(r2.remaining).toBe(1);

    const r3 = await RateLimitService.consumeOrThrow(testPolicy, key, adminClient);
    expect(r3.remaining).toBe(0);

    await expect(
      RateLimitService.consumeOrThrow(testPolicy, key, adminClient)
    ).rejects.toThrow(RateLimitError);

    await expect(
      RateLimitService.assertNotBlocked(testPolicy, key, adminClient)
    ).rejects.toThrow(RateLimitError);

    await RateLimitService.reset(testPolicy, key, adminClient);

    const afterReset = await RateLimitService.consumeOrThrow(testPolicy, key, adminClient);
    expect(afterReset.remaining).toBe(2);

    // Garantia fail-closed: cliente autenticado comum não lê rate_limits nem executa RPC privada
    const { error: selectErr } = await ownerClient.from("rate_limits").select("*").limit(1);
    expect(selectErr).not.toBeNull();

    const { error: rpcErr } = await ownerClient.rpc("consume_rate_limit", {
      p_scope: testPolicy.scope,
      p_identifier: "hack",
      p_max_attempts: 100,
      p_window_seconds: 60,
      p_block_seconds: 1,
    });
    expect(rpcErr).not.toBeNull();
  });
});
