import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";
import crypto from "crypto";

describe("API & Database Security Audit Suite — DevEssent Core (Fase 3B)", () => {
  const adminClient = createAdminClient();
  const ts = Date.now();

  let adminUserId: string;
  let ownerAUserId: string;
  let ownerBUserId: string;
  let managerAUserId: string;
  let staffAUserId: string;
  let externalUserId: string;

  let tenantAId: string;
  let tenantBId: string;

  let ownerAClient: SupabaseClient<Database>;
  let managerAClient: SupabaseClient<Database>;
  let staffAClient: SupabaseClient<Database>;
  let externalClient: SupabaseClient<Database>;
  let anonClient: SupabaseClient<Database>;

  async function createAuthUser(emailPrefix: string, role?: string) {
    const email = `${emailPrefix}.${ts}@devessent.test`;
    const password = "Password123!";
    const { data: u, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `User ${emailPrefix}` },
    });
    if (error || !u.user) throw new Error(`Falha ao criar usuário ${email}: ${error?.message}`);

    const client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: authData } = await client.auth.signInWithPassword({ email, password });

    const authedClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${authData.session!.access_token}`,
          },
        },
      }
    );

    return { id: u.user.id, email, client: authedClient };
  }

  beforeAll(async () => {
    anonClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Provisionar Platform Admin
    const uAdmin = await createAuthUser("admin.sec");
    adminUserId = uAdmin.id;
    await adminClient.from("platform_admins").insert({ user_id: adminUserId });

    // 2. Provisionar Usuários
    const uOwnerA = await createAuthUser("ownera.sec");
    ownerAUserId = uOwnerA.id;
    ownerAClient = uOwnerA.client;

    const uOwnerB = await createAuthUser("ownerb.sec");
    ownerBUserId = uOwnerB.id;

    const uManagerA = await createAuthUser("managera.sec");
    managerAUserId = uManagerA.id;
    managerAClient = uManagerA.client;

    const uStaffA = await createAuthUser("staffa.sec");
    staffAUserId = uStaffA.id;
    staffAClient = uStaffA.client;

    const uExternal = await createAuthUser("external.sec");
    externalUserId = uExternal.id;
    externalClient = uExternal.client;

    // 3. Provisionar Empresa A via RPC autorizada pelo service_role
    const { data: resA, error: errA } = await adminClient.rpc("create_tenant_with_owner", {
      p_name: "Empresa Segurança A",
      p_slug: `empresa-sec-a-${ts}`,
      p_owner_user_id: ownerAUserId,
      p_actor_user_id: adminUserId,
      p_display_name: "Empresa Segurança A",
      p_timezone: "America/Sao_Paulo",
      p_locale: "pt-BR",
    });
    if (errA || !resA) throw new Error(`Falha ao criar Tenant A: ${errA?.message}`);
    tenantAId = (resA as any).id;

    // Adicionar Manager A e Staff A ao Tenant A
    await adminClient.from("tenant_memberships").insert([
      { tenant_id: tenantAId, user_id: managerAUserId, role: "manager" },
      { tenant_id: tenantAId, user_id: staffAUserId, role: "staff" },
    ]);

    // 4. Provisionar Empresa B
    const { data: resB, error: errB } = await adminClient.rpc("create_tenant_with_owner", {
      p_name: "Empresa Segurança B",
      p_slug: `empresa-sec-b-${ts}`,
      p_owner_user_id: ownerBUserId,
      p_actor_user_id: adminUserId,
      p_display_name: "Empresa Segurança B",
      p_timezone: "America/Sao_Paulo",
      p_locale: "pt-BR",
    });
    if (errB || !resB) throw new Error(`Falha ao criar Tenant B: ${errB?.message}`);
    tenantBId = (resB as any).id;
  });

  afterAll(async () => {
    if (tenantAId) await adminClient.from("tenants").delete().eq("id", tenantAId);
    if (tenantBId) await adminClient.from("tenants").delete().eq("id", tenantBId);

    const userIds = [adminUserId, ownerAUserId, ownerBUserId, managerAUserId, staffAUserId, externalUserId];
    for (const uid of userIds) {
      if (uid) await adminClient.auth.admin.deleteUser(uid);
    }
  });

  // ============================================================================
  // 1. AUDITORIA DA RPC create_tenant_with_owner & PREVENÇÃO DE SPOOFING
  // ============================================================================

  it("1. Usuário comum autenticado NÃO consegue invocar create_tenant_with_owner diretamente via RPC (nem com ID de admin real)", async () => {
    const maliciousSlug = `malicious-tenant-${ts}`;

    // O atacante chama a RPC passando o identificador real do platform admin como p_actor_user_id
    const { data, error } = await staffAClient.rpc("create_tenant_with_owner", {
      p_name: "Empresa Invasora",
      p_slug: maliciousSlug,
      p_owner_user_id: staffAUserId,
      p_actor_user_id: adminUserId, // Spoofing do admin!
      p_display_name: "Empresa Invasora",
      p_timezone: "America/Sao_Paulo",
      p_locale: "pt-BR",
    });

    // Deve ser bloqueado pelo PostgreSQL com erro de privilégio de execução
    expect(error).not.toBeNull();
    expect(data).toBeNull();

    // Comprovação estrita no banco: a empresa invasora NÃO deve existir
    const { data: existing } = await adminClient
      .from("tenants")
      .select("id")
      .eq("slug", maliciousSlug)
      .maybeSingle();

    expect(existing).toBeNull();

    // Nenhum log falso deve ter sido gravado
    const { data: logs } = await adminClient
      .from("audit_logs")
      .select("id")
      .contains("metadata", { slug: maliciousSlug });

    expect(logs?.length ?? 0).toBe(0);
  });

  it("2. Usuário anônimo (anon) é sumariamente bloqueado ao tentar invocar create_tenant_with_owner", async () => {
    const { data, error } = await anonClient.rpc("create_tenant_with_owner", {
      p_name: "Anon Company",
      p_slug: `anon-slug-${ts}`,
      p_owner_user_id: staffAUserId,
      p_actor_user_id: adminUserId,
      p_display_name: "Anon Company",
      p_timezone: "America/Sao_Paulo",
      p_locale: "pt-BR",
    });

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  // ============================================================================
  // 2. AUDITORIA CONTRA ENUMERAÇÃO DE IDENTIDADES PRIVILEGIADAS
  // ============================================================================

  it("3. Chamada à RPC is_platform_admin não permite que usuário comum ou anon descubra quem são os administradores", async () => {
    // 1. Usuário anônimo consultando status de admin real: retorna false
    const { data: anonCheck } = await anonClient.rpc("is_platform_admin", {
      check_user_id: adminUserId,
    });
    expect(anonCheck).toBe(false);

    // 2. Usuário comum consultando o admin real: retorna false (proteção contra enumeração)
    const { data: staffCheckAdmin } = await staffAClient.rpc("is_platform_admin", {
      check_user_id: adminUserId,
    });
    expect(staffCheckAdmin).toBe(false);

    // 3. Usuário comum consultando a si próprio: retorna false
    const { data: staffCheckSelf } = await staffAClient.rpc("is_platform_admin", {
      check_user_id: staffAUserId,
    });
    expect(staffCheckSelf).toBe(false);

    // 4. O próprio admin consultando a si mesmo: retorna true
    const { data: adminSelfCheck } = await adminClient.rpc("is_platform_admin", {
      check_user_id: adminUserId,
    });
    expect(adminSelfCheck).toBe(true);
  });

  // ============================================================================
  // 3. ISOLAMENTO MULTIEMPRESA & BLINDAGEM DE MUTABILIDADE RLS
  // ============================================================================

  it("4. Proprietário da Empresa A NÃO consegue ler nem alterar dados da Empresa B via REST API", async () => {
    // Tentativa de leitura de configurações da Empresa B pelo Owner A
    const { data: settingsB } = await ownerAClient
      .from("tenant_settings")
      .select("display_name, contact_email")
      .eq("tenant_id", tenantBId)
      .maybeSingle();

    // RLS deve retornar nulo (oculto para membros alheios)
    expect(settingsB).toBeNull();

    // Tentativa de mutação (UPDATE) nas configurações da Empresa B pelo Owner A
    const { data: updateRes, error: updateErr } = await ownerAClient
      .from("tenant_settings")
      .update({ display_name: "Hackeado pelo Owner A" })
      .eq("tenant_id", tenantBId)
      .select();

    // RLS deve retornar 0 registros atualizados
    expect(updateRes?.length ?? 0).toBe(0);

    // Comprovação via admin: a configuração da Empresa B permanece intocada
    const { data: originalB } = await adminClient
      .from("tenant_settings")
      .select("display_name")
      .eq("tenant_id", tenantBId)
      .single();

    expect(originalB?.display_name).toBe("Empresa Segurança B");
  });

  it("5. Gestor (Manager) da Empresa A NÃO consegue promover funcionário a Proprietário", async () => {
    const { data: updated, error } = await managerAClient
      .from("tenant_memberships")
      .update({ role: "owner" })
      .eq("tenant_id", tenantAId)
      .eq("user_id", staffAUserId)
      .select();

    // RLS memberships_update_owner_or_admin bloqueia: 0 rows atualizadas
    expect(updated?.length ?? 0).toBe(0);

    // Comprovar que o papel continua como staff
    const { data: staffMember } = await adminClient
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantAId)
      .eq("user_id", staffAUserId)
      .single();

    expect(staffMember?.role).toBe("staff");
  });

  it("6. Funcionário (Staff) NÃO consegue alterar o próprio papel nem o de colegas", async () => {
    const { data: updatedSelf } = await staffAClient
      .from("tenant_memberships")
      .update({ role: "owner" })
      .eq("tenant_id", tenantAId)
      .eq("user_id", staffAUserId)
      .select();

    expect(updatedSelf?.length ?? 0).toBe(0);

    const { data: updatedManager } = await staffAClient
      .from("tenant_memberships")
      .update({ role: "staff" })
      .eq("tenant_id", tenantAId)
      .eq("user_id", managerAUserId)
      .select();

    expect(updatedManager?.length ?? 0).toBe(0);
  });

  it("7. Usuário comum NÃO consegue inserir nem alterar registros em platform_admins", async () => {
    // Tentativa de auto-promoção a platform_admin
    const { data: inserted, error: insErr } = await staffAClient
      .from("platform_admins")
      .insert({ user_id: staffAUserId })
      .select();

    expect(inserted).toBeNull();
    expect(insErr).not.toBeNull();

    // Comprovação: o usuário não é platform admin
    const { data: adminRow } = await adminClient
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", staffAUserId)
      .maybeSingle();

    expect(adminRow).toBeNull();
  });

  it("8. Usuário removido de um estabelecimento perde o acesso operacional imediato", async () => {
    // 1. Remover Staff A da Empresa A
    await adminClient
      .from("tenant_memberships")
      .delete()
      .eq("tenant_id", tenantAId)
      .eq("user_id", staffAUserId);

    // 2. Staff A tenta ler membros e configurações da Empresa A
    const { data: members } = await staffAClient
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", tenantAId);

    expect(members?.length ?? 0).toBe(0);

    const { data: settings } = await staffAClient
      .from("tenant_settings")
      .select("display_name")
      .eq("tenant_id", tenantAId)
      .maybeSingle();

    expect(settings).toBeNull();
  });

  // ============================================================================
  // 4. AUDITORIA DO FLUXO DE CONVITES & accept_tenant_invitation
  // ============================================================================

  it("9. Convite NÃO pode ser aceito por identidade com e-mail divergente do destinatário", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const targetEmail = `convidado.legitimo.${ts}@devessent.test`;

    // Inserir convite emitido para targetEmail
    await adminClient.from("tenant_invitations").insert({
      tenant_id: tenantAId,
      email: targetEmail,
      role: "staff",
      token_hash: tokenHash,
      invited_by: ownerAUserId,
      status: "pending",
    });

    // externalClient (cujo e-mail é external.sec.*) tenta aceitar o convite
    const { data, error } = await externalClient.rpc("accept_tenant_invitation", {
      p_token_hash: tokenHash,
      p_user_id: externalUserId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/outro endereço de e-mail/i);
    expect(data).toBeNull();

    // Comprovar que nenhuma membership foi criada para externalUserId
    const { data: member } = await adminClient
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", tenantAId)
      .eq("user_id", externalUserId)
      .maybeSingle();

    expect(member).toBeNull();
  });

  it("10. Usuário que já possui vínculo no estabelecimento NÃO pode aceitar convite redundante", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Convite emitido com o e-mail do próprio Manager A
    const managerEmail = `managera.sec.${ts}@devessent.test`;
    await adminClient.from("tenant_invitations").insert({
      tenant_id: tenantAId,
      email: managerEmail,
      role: "staff",
      token_hash: tokenHash,
      invited_by: ownerAUserId,
      status: "pending",
    });

    // Manager A tenta aceitar convite para uma empresa onde ele já é gestor
    const { data, error } = await managerAClient.rpc("accept_tenant_invitation", {
      p_token_hash: tokenHash,
      p_user_id: managerAUserId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/já possui vínculo/i);

    // O papel de Manager A NÃO foi rebaixado para staff
    const { data: managerRow } = await adminClient
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantAId)
      .eq("user_id", managerAUserId)
      .single();

    expect(managerRow?.role).toBe("manager");
  });

  // ============================================================================
  // 5. PROTEÇÃO DO ÚLTIMO PROPRIETÁRIO & SUSPENSÃO
  // ============================================================================

  it("11. Trigger check_last_tenant_owner impede que o único proprietário delete a própria membership", async () => {
    // Owner A tenta deletar sua própria membership na Empresa A
    const { data, error } = await ownerAClient
      .from("tenant_memberships")
      .delete()
      .eq("tenant_id", tenantAId)
      .eq("user_id", ownerAUserId)
      .select();

    expect(data?.length ?? 0).toBe(0);

    // Comprovar que Owner A permanece na empresa
    const { data: ownerRow } = await adminClient
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantAId)
      .eq("user_id", ownerAUserId)
      .maybeSingle();

    expect(ownerRow).not.toBeNull();
    expect(ownerRow?.role).toBe("owner");
  });

  it("12. Empresa suspensa bloqueia imediatamente operações de membros comuns via RLS", async () => {
    // Suspender Empresa A via admin
    await adminClient.from("tenants").update({ status: "suspended" }).eq("id", tenantAId);

    // Manager A tenta ler configurações
    const { data: settings } = await managerAClient
      .from("tenant_settings")
      .select("display_name")
      .eq("tenant_id", tenantAId)
      .maybeSingle();

    expect(settings).toBeNull();

    // Manager A tenta ler membros
    const { data: members } = await managerAClient
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", tenantAId);

    expect(members?.length ?? 0).toBe(0);

    // Reativar para finalizar
    await adminClient.from("tenants").update({ status: "active" }).eq("id", tenantAId);
  });
});
