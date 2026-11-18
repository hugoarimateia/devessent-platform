import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Database, TenantStatus, MembershipRole } from "@/types/database.types";
import {
  createTenantSchema,
  updateTenantSettingsSchema,
  type CreateTenantInput,
  type UpdateTenantSettingsInput,
} from "../schemas";
import {
  ForbiddenError,
  NotFoundError,
  TenantSuspendedError,
  ValidationError,
} from "@/core/errors/app-error";
import { PermissionService } from "@/core/permissions/services/permission-service";
import { AuditService } from "@/core/audit/services/audit-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppSupabaseClient = SupabaseClient<Database, any, any>;

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  slug: string;
  status: TenantStatus;
  role: "platform_admin" | "owner" | "manager" | "staff";
  userId: string;
}

export interface UserTenantSummary {
  tenantId: string;
  name: string;
  slug: string;
  status: TenantStatus;
  role: MembershipRole;
  displayName?: string | null;
  segmentLabel?: string | null;
  primaryColor?: string | null;
  monogram?: string | null;
  brandDescription?: string | null;
}

export class TenantService {
  /**
   * Valida e resolve o contexto ativo de uma empresa para um usuário autenticado.
   * Garante que o usuário pertença à empresa e que o estabelecimento esteja ativo.
   * Executa checagem de privilégio e busca de empresa concorrentemente.
   * Memoizado por requisição via React.cache.
   */
  public static resolveTenantContext = cache(async (
    supabase: AppSupabaseClient,
    userId: string,
    targetTenantSlugOrId: string
  ): Promise<TenantContext> => {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      return XamppTenantAdapter.resolveTenantContext(userId, targetTenantSlugOrId);
    }

    // 1 & 2. Executar em paralelo checagem de admin e busca de empresa
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      targetTenantSlugOrId
    );

    const query = supabase.from("tenants").select("id, name, slug, status");
    const [adminRecordRes, tenantRes] = await Promise.all([
      supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle(),
      isUuid
        ? query.eq("id", targetTenantSlugOrId).maybeSingle()
        : query.eq("slug", targetTenantSlugOrId).maybeSingle(),
    ]);

    const isPlatformAdmin = Boolean(adminRecordRes.data);
    const tenant = tenantRes.data;
    const tenantError = tenantRes.error;

    if (tenantError || !tenant) {
      // Se RLS bloqueou a leitura do tenant, verificar se ele existe na base geral
      try {
        const admin = createAdminClient();
        const adminQuery = admin.from("tenants").select("id, name, slug, status");
        const { data: realTenant } = isUuid
          ? await adminQuery.eq("id", targetTenantSlugOrId).maybeSingle()
          : await adminQuery.eq("slug", targetTenantSlugOrId).maybeSingle();

        if (realTenant) {
          if (realTenant.status === "suspended") {
            throw new TenantSuspendedError();
          }
          throw new ForbiddenError("Acesso negado: você não possui vínculo com este estabelecimento.");
        }
      } catch (err: unknown) {
        if (
          err instanceof TenantSuspendedError ||
          err instanceof ForbiddenError
        ) {
          throw err;
        }
      }

      throw new NotFoundError("Estabelecimento não encontrado.");
    }

    // 3. Se for platform admin, tem acesso garantido com papel de platform_admin
    if (isPlatformAdmin) {
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        role: "platform_admin",
        userId,
      };
    }

    // 4. Se não for admin, verificar membership do usuário na empresa
    const { data: membership, error: memberError } = await supabase
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenant.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !membership) {
      throw new ForbiddenError("Acesso negado: você não possui vínculo com este estabelecimento.");
    }

    // 5. Verificar se a empresa está suspensa
    if (tenant.status === "suspended") {
      throw new TenantSuspendedError();
    }

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      role: membership.role,
      userId,
    };
  });

  /**
   * Lista todos os estabelecimentos aos quais o usuário autenticado está vinculado.
   * Memoizado por requisição via React.cache.
   */
  public static listUserTenants = cache(async (
    supabase: AppSupabaseClient,
    userId: string
  ): Promise<UserTenantSummary[]> => {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      return XamppTenantAdapter.listUserTenants(userId);
    }

    // 1. Consulta inicial com o cliente autenticado (respeita RLS para estabelecimentos ativos)
    const { data, error } = await supabase
      .from("tenant_memberships")
      .select(
        "tenant_id, role, tenants(id, name, slug, status, tenant_settings(display_name, segment_label, primary_color, monogram, brand_description))"
      )
      .eq("user_id", userId);

    const extractSettings = (raw: unknown) => {
      if (!raw) return null;
      if (Array.isArray(raw)) return (raw[0] || null) as Record<string, string | null> | null;
      return raw as Record<string, string | null>;
    };

    if (!error && data && data.length > 0) {
      return data.map((item) => {
        const t = item.tenants as unknown as {
          id: string;
          name: string;
          slug: string;
          status: TenantStatus;
          tenant_settings?: unknown;
        };
        const s = extractSettings(t?.tenant_settings);
        return {
          tenantId: item.tenant_id,
          name: t?.name || "Estabelecimento",
          slug: t?.slug || "",
          status: t?.status || "active",
          role: item.role,
          displayName: s?.display_name || null,
          segmentLabel: s?.segment_label || null,
          primaryColor: s?.primary_color || null,
          monogram: s?.monogram || null,
          brandDescription: s?.brand_description || null,
        };
      });
    }

    // 2. Fallback administrativo para estabelecimentos suspensos:
    // Quando uma empresa é suspensa, a política RLS oculta registros de tenant_memberships
    // para clientes comuns. O admin client permite identificar vínculos com empresas suspensas
    // para que a UI apresente o alerta explícito de suspensão e bloqueio no dashboard.
    try {
      const admin = createAdminClient();
      const { data: allMemberships } = await admin
        .from("tenant_memberships")
        .select(
          "tenant_id, role, tenants(id, name, slug, status, tenant_settings(display_name, segment_label, primary_color, monogram, brand_description))"
        )
        .eq("user_id", userId);

      if (allMemberships && allMemberships.length > 0) {
        return allMemberships.map((item) => {
          const t = item.tenants as unknown as {
            id: string;
            name: string;
            slug: string;
            status: TenantStatus;
            tenant_settings?: unknown;
          };
          const s = extractSettings(t?.tenant_settings);
          return {
            tenantId: item.tenant_id,
            name: t?.name || "Estabelecimento",
            slug: t?.slug || "",
            status: t?.status || "suspended",
            role: item.role,
            displayName: s?.display_name || null,
            segmentLabel: s?.segment_label || null,
            primaryColor: s?.primary_color || null,
            monogram: s?.monogram || null,
            brandDescription: s?.brand_description || null,
          };
        });
      }
    } catch {
      // Fallback gracioso caso o admin client não responda
    }

    return [];
  });

  /**
   * Criação atômica de estabelecimento — exclusivo para administradores da DevEssent.
   * Executa a transação atômica no PostgreSQL via RPC create_tenant_with_owner.
   */
  public static async createTenantWithAdmin(
    adminSupabase: AppSupabaseClient,
    actorAdminUserId: string,
    input: CreateTenantInput
  ) {
    // 1. Autorização rigorosa: apenas platform_admin
    const { data: adminRecord } = await adminSupabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", actorAdminUserId)
      .maybeSingle();

    if (!adminRecord) {
      throw new ForbiddenError("Acesso negado: operação restrita a administradores da plataforma.");
    }

    // 2. Validar inputs com Zod
    const parsed = createTenantSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados de cadastro inválidos.", parsed.error.flatten().fieldErrors);
    }

    // 2. Verificar se o slug já está em uso
    const { data: existing } = await adminSupabase
      .from("tenants")
      .select("id")
      .eq("slug", parsed.data.slug)
      .maybeSingle();

    if (existing) {
      throw new ValidationError("Este identificador (slug) já está em uso por outro estabelecimento.", {
        slug: ["Slug já cadastrado"],
      });
    }

    // 3. Localizar ou provisionar o proprietário inicial na base (com paginação completa)
    let ownerUserId = "";
    let page = 1;
    const perPage = 500;
    const targetEmail = parsed.data.ownerEmail.toLowerCase();

    while (!ownerUserId) {
      const { data: userList, error: listErr } = await adminSupabase.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listErr) {
        throw new Error(`Falha ao consultar usuários no Auth: ${listErr.message}`);
      }
      const existingUser = userList?.users?.find(
        (u) => u.email?.toLowerCase() === targetEmail
      );
      if (existingUser) {
        ownerUserId = existingUser.id;
        break;
      }
      if (!userList?.users || userList.users.length < perPage) {
        break;
      }
      page += 1;
    }

    if (!ownerUserId) {
      // Provisionar novo usuário com e-mail confirmado
      const { data: newUser, error: createErr } = await adminSupabase.auth.admin.createUser({
        email: parsed.data.ownerEmail,
        email_confirm: true,
        user_metadata: {
          full_name: parsed.data.ownerFullName,
        },
      });

      if (createErr || !newUser.user) {
        throw new Error(`Falha ao provisionar proprietário: ${createErr?.message}`);
      }
      ownerUserId = newUser.user.id;
    }

    // 4. Executar transação SQL atômica no PostgreSQL
    const { data: rpcResult, error: rpcErr } = await adminSupabase.rpc("create_tenant_with_owner", {
      p_name: parsed.data.name,
      p_slug: parsed.data.slug,
      p_owner_user_id: ownerUserId,
      p_actor_user_id: actorAdminUserId,
      p_display_name: parsed.data.name,
      p_timezone: "America/Sao_Paulo",
      p_locale: "pt-BR",
    });

    if (rpcErr || !rpcResult) {
      throw new Error(`Falha na criação transacional da empresa: ${rpcErr?.message}`);
    }

    const createdData = rpcResult as unknown as {
      id: string;
      name: string;
      slug: string;
      status: TenantStatus;
      owner_user_id: string;
    };

    return {
      id: createdData.id,
      name: createdData.name,
      slug: createdData.slug,
      status: createdData.status,
    };
  }

  /**
   * Listagem de todas as empresas cadastradas — exclusivo para administradores globais.
   */
  public static async listAllTenants(
    adminSupabase: AppSupabaseClient,
    actorUserId: string
  ) {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      const list = await XamppTenantAdapter.listAllTenantsForAdmin(actorUserId);
      return list.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        created_at: t.createdAt,
        updated_at: t.createdAt,
        ownerName: "Conta Teste XAMPP",
      }));
    }

    const { data: adminRecord } = await adminSupabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!adminRecord) {
      throw new ForbiddenError("Acesso negado: restrito a administradores da plataforma.");
    }

    const [tenantsRes, membershipsRes] = await Promise.all([
      adminSupabase
        .from("tenants")
        .select("id, name, slug, status, created_at, updated_at")
        .order("created_at", { ascending: false }),
      adminSupabase
        .from("tenant_memberships")
        .select("tenant_id, role, profiles(full_name)")
        .eq("role", "owner"),
    ]);

    const { data: tenants, error } = tenantsRes;
    const { data: memberships } = membershipsRes;

    if (error || !tenants) {
      throw new Error(`Falha ao listar estabelecimentos: ${error?.message}`);
    }

    const ownerMap = new Map<string, string>();
    memberships?.forEach((m) => {
      const p = m.profiles as unknown as { full_name: string } | null;
      if (p?.full_name) {
        ownerMap.set(m.tenant_id, p.full_name);
      }
    });

    return tenants.map((t) => ({
      ...t,
      ownerName: ownerMap.get(t.id) || "Não atribuído",
    }));
  }

  /**
   * Alteração administrativa do status de um estabelecimento (ativo / suspenso).
   */
  public static async updateTenantStatus(
    adminSupabase: AppSupabaseClient,
    actorUserId: string,
    tenantId: string,
    status: TenantStatus
  ) {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      await XamppTenantAdapter.toggleTenantStatusForAdmin(actorUserId, tenantId, status);
      return { id: tenantId, status };
    }

    const { data: adminRecord } = await adminSupabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!adminRecord) {
      throw new ForbiddenError("Acesso negado: restrito a administradores da plataforma.");
    }

    const { data: updated, error } = await adminSupabase
      .from("tenants")
      .update({ status })
      .eq("id", tenantId)
      .select()
      .single();

    if (error || !updated) {
      throw new Error(`Falha ao atualizar status do estabelecimento: ${error?.message}`);
    }

    await AuditService.recordEvent({
      supabase: adminSupabase,
      tenantId: updated.id,
      actorUserId,
      action: status === "suspended" ? "tenant.suspended" : "tenant.reactivated",
      resourceType: "tenant",
      resourceId: updated.id,
      metadata: { newStatus: status },
    });

    return updated;
  }

  /**
   * Consulta as configurações de um estabelecimento específico.
   * Memoizado por requisição via React.cache.
   */
  public static getSettings = cache(async (
    supabase: AppSupabaseClient,
    context: TenantContext
  ) => {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      const s = await XamppTenantAdapter.getSettings(context);
      return {
        ...s,
        created_at: s.updated_at,
        contact_email: null,
        contact_phone: null,
      } as Database["public"]["Tables"]["tenant_settings"]["Row"];
    }

    PermissionService.assertPermission(context.role, "view_own_tenant");

    const { data: settings, error } = await supabase
      .from("tenant_settings")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .single();

    if (error || !settings) {
      throw new NotFoundError("Configurações do estabelecimento não encontradas.");
    }

    return settings;
  });

  /**
   * Atualização de configurações do estabelecimento pelo Owner ou Manager autorizado.
   */
  public static async updateSettings(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: UpdateTenantSettingsInput
  ) {
    PermissionService.assertPermission(context.role, "update_general_settings");

    const parsed = updateTenantSettingsSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados de configurações inválidos.", parsed.error.flatten().fieldErrors);
    }

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      const s = await XamppTenantAdapter.updateSettings(context, {
        displayName: parsed.data.display_name,
        supportEmail: parsed.data.contact_email,
        timezone: parsed.data.timezone,
        locale: parsed.data.locale,
        segmentLabel: parsed.data.segment_label,
        primaryColor: parsed.data.primary_color,
        monogram: parsed.data.monogram,
        brandDescription: parsed.data.brand_description,
      });
      return {
        ...s,
        created_at: s.updated_at,
        contact_email: null,
        contact_phone: null,
      } as Database["public"]["Tables"]["tenant_settings"]["Row"];
    }

    const updatePayload: Database["public"]["Tables"]["tenant_settings"]["Update"] = {
      display_name: parsed.data.display_name,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      timezone: parsed.data.timezone,
      locale: parsed.data.locale,
    };

    if (parsed.data.segment_label !== undefined) {
      updatePayload.segment_label = parsed.data.segment_label;
    }
    if (parsed.data.primary_color !== undefined) {
      updatePayload.primary_color = parsed.data.primary_color;
    }
    if (parsed.data.monogram !== undefined) {
      updatePayload.monogram = parsed.data.monogram || null;
    }
    if (parsed.data.brand_description !== undefined) {
      updatePayload.brand_description = parsed.data.brand_description || null;
    }

    const { data: updated, error } = await supabase
      .from("tenant_settings")
      .update(updatePayload)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error) {
      throw new Error("Não foi possível salvar as configurações da unidade.");
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "tenant_settings.updated",
      resourceType: "tenant_settings",
      resourceId: context.tenantId,
      metadata: {
        updatedFields: Object.keys(updatePayload),
        changes: {
          display_name: updatePayload.display_name,
          segment_label: updatePayload.segment_label,
          primary_color: updatePayload.primary_color,
          monogram: updatePayload.monogram,
        },
      },
    });

    return updated;
  }
}
