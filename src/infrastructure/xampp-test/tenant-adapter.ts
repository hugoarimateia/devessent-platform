import { createHash, randomBytes, randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { MembershipRole, TenantStatus } from "@/types/database.types";
import type { TenantContext, UserTenantSummary } from "@/core/tenants/services/tenant-service";
import type { TenantMemberItem } from "@/core/tenants/services/membership-service";
import type { TenantInvitationItem } from "@/core/tenants/services/invitation-service";
import type { ListAuditLogsFilter } from "@/core/audit/services/audit-service";
import type { SessionUser } from "@/core/auth/types/auth.types";
import {
  ForbiddenError,
  NotFoundError,
  TenantSuspendedError,
  ValidationError,
} from "@/core/errors/app-error";
import { PermissionService } from "@/core/permissions/services/permission-service";
import { assertXamppRuntimeAllowed, xamppQuery } from "./db";

interface TenantJoinRow extends RowDataPacket {
  tenant_id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  role: MembershipRole;
  segment_label: string | null;
  primary_color: string | null;
  monogram: string | null;
  brand_description: string | null;
}

interface TenantRow extends RowDataPacket {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  created_at: Date | string;
}

interface MemberRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  user_id: string;
  role: MembershipRole;
  created_at: Date | string;
  full_name: string;
  email: string;
  avatar_path: string | null;
}

interface InvitationRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  email: string;
  role: MembershipRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: Date | string;
  created_at: Date | string;
  inviter_name?: string | null;
}

interface AuditRow extends RowDataPacket {
  id: string;
  tenant_id: string | null;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata_json: string | Record<string, unknown> | null;
  created_at: Date | string;
  actor_name?: string | null;
  tenant_name?: string | null;
  tenant_slug?: string | null;
}

export class XamppTenantAdapter {
  public static async listUserTenants(userId: string): Promise<UserTenantSummary[]> {
    assertXamppRuntimeAllowed();

    const rows = await xamppQuery<TenantJoinRow[]>(
      `SELECT
        t.id AS tenant_id,
        t.name,
        t.slug,
        t.status,
        tm.role,
        ts.segment_label,
        ts.primary_color,
        ts.monogram,
        ts.brand_description
      FROM tenant_memberships tm
      INNER JOIN tenants t ON t.id = tm.tenant_id
      LEFT JOIN tenant_settings ts ON ts.tenant_id = t.id
      WHERE tm.user_id = ?
      ORDER BY t.name ASC`,
      [userId]
    );

    return rows.map((r) => ({
      tenantId: r.tenant_id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      role: r.role,
      displayName: r.name,
      segmentLabel: r.segment_label,
      primaryColor: r.primary_color,
      monogram: r.monogram,
      brandDescription: r.brand_description,
    }));
  }

  public static async resolveTenantContext(
    userId: string,
    targetTenantSlugOrId: string
  ): Promise<TenantContext> {
    assertXamppRuntimeAllowed();

    const [adminRows, tenantRows] = await Promise.all([
      xamppQuery<RowDataPacket[]>(
        "SELECT id FROM users WHERE id = ? AND is_platform_admin = 1 LIMIT 1",
        [userId]
      ),
      xamppQuery<TenantRow[]>(
        "SELECT id, name, slug, status FROM tenants WHERE id = ? OR slug = ? LIMIT 1",
        [targetTenantSlugOrId, targetTenantSlugOrId]
      ),
    ]);

    const isPlatformAdmin = adminRows.length > 0;
    const tenant = tenantRows[0];

    if (!tenant) {
      throw new NotFoundError("Estabelecimento não encontrado.");
    }

    if (tenant.status === "suspended" && !isPlatformAdmin) {
      throw new TenantSuspendedError(
        "Este estabelecimento está temporariamente suspenso."
      );
    }

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

    const memRows = await xamppQuery<RowDataPacket[]>(
      "SELECT role FROM tenant_memberships WHERE tenant_id = ? AND user_id = ? LIMIT 1",
      [tenant.id, userId]
    );

    if (!memRows || memRows.length === 0) {
      throw new ForbiddenError("Você não tem acesso a este estabelecimento.");
    }

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      role: memRows[0].role as MembershipRole,
      userId,
    };
  }

  public static async listMembers(context: TenantContext): Promise<TenantMemberItem[]> {
    assertXamppRuntimeAllowed();
    PermissionService.assertPermission(context.role, "view_workspace");

    const rows = await xamppQuery<MemberRow[]>(
      `SELECT
        tm.id,
        tm.tenant_id,
        tm.user_id,
        tm.role,
        tm.created_at,
        u.full_name,
        u.email,
        u.avatar_path
      FROM tenant_memberships tm
      INNER JOIN users u ON u.id = tm.user_id
      WHERE tm.tenant_id = ?
      ORDER BY tm.created_at ASC`,
      [context.tenantId]
    );

    const roleOrder: Record<MembershipRole, number> = {
      owner: 1,
      manager: 2,
      staff: 3,
    };

    return rows
      .map((m) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        fullName: m.full_name,
        avatarPath: m.avatar_path,
        createdAt: new Date(m.created_at).toISOString(),
      }))
      .sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  }

  public static async updateMemberRole(
    context: TenantContext,
    membershipId: string,
    newRole: MembershipRole
  ) {
    assertXamppRuntimeAllowed();
    PermissionService.assertPermission(context.role, "manage_members");

    if (newRole === "owner") {
      throw new ForbiddenError("Não é permitido promover para proprietário neste fluxo.");
    }

    const rows = await xamppQuery<RowDataPacket[]>(
      "SELECT id, user_id, role FROM tenant_memberships WHERE (id = ? OR user_id = ?) AND tenant_id = ? LIMIT 1",
      [membershipId, membershipId, context.tenantId]
    );
    const target = rows[0];
    if (!target) {
      throw new NotFoundError("Vínculo de membro não encontrado neste estabelecimento.");
    }

    if (target.role === "owner") {
      throw new ForbiddenError("O papel do proprietário não pode ser alterado.");
    }

    if (context.role === "manager" && target.role === "manager") {
      throw new ForbiddenError("Gestores não podem alterar o papel de outros gestores.");
    }

    await xamppQuery(
      "UPDATE tenant_memberships SET role = ? WHERE id = ? AND tenant_id = ?",
      [newRole, target.id, context.tenantId]
    );

    await this.recordAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "member.role_updated",
      resourceType: "tenant_membership",
      resourceId: target.id as string,
      metadata: { targetUserId: target.user_id, previousRole: target.role, newRole },
    });

    return { id: target.id as string, role: newRole };
  }

  public static async removeMember(context: TenantContext, membershipId: string) {
    assertXamppRuntimeAllowed();
    PermissionService.assertPermission(context.role, "manage_members");

    const rows = await xamppQuery<RowDataPacket[]>(
      "SELECT id, user_id, role FROM tenant_memberships WHERE (id = ? OR user_id = ?) AND tenant_id = ? LIMIT 1",
      [membershipId, membershipId, context.tenantId]
    );
    const target = rows[0];
    if (!target) {
      throw new NotFoundError("Membro não encontrado neste estabelecimento.");
    }

    if (target.role === "owner") {
      throw new ForbiddenError("O proprietário do estabelecimento não pode ser removido.");
    }

    if (context.role === "manager" && target.role !== "staff") {
      throw new ForbiddenError("Gestores só podem remover membros com papel de equipe (staff).");
    }

    await xamppQuery(
      "DELETE FROM tenant_memberships WHERE id = ? AND tenant_id = ?",
      [target.id, context.tenantId]
    );

    await this.recordAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "member.removed",
      resourceType: "tenant_membership",
      resourceId: target.id as string,
      metadata: { targetUserId: target.user_id, removedRole: target.role },
    });
  }

  public static async listInvitations(
    context: TenantContext,
    options?: { includeHistory?: boolean }
  ): Promise<TenantInvitationItem[]> {
    assertXamppRuntimeAllowed();
    PermissionService.assertPermission(context.role, "invite_member");

    const sql = options?.includeHistory
      ? `SELECT ti.*, u.full_name AS inviter_name
         FROM tenant_invitations ti
         LEFT JOIN users u ON u.id = ti.created_by
         WHERE ti.tenant_id = ?
         ORDER BY ti.created_at DESC`
      : `SELECT ti.*, u.full_name AS inviter_name
         FROM tenant_invitations ti
         LEFT JOIN users u ON u.id = ti.created_by
         WHERE ti.tenant_id = ? AND ti.status = 'pending'
         ORDER BY ti.created_at DESC`;

    const rows = await xamppQuery<InvitationRow[]>(sql, [context.tenantId]);
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      status: r.status,
      expiresAt: new Date(r.expires_at).toISOString(),
      createdAt: new Date(r.created_at).toISOString(),
      inviterName: r.inviter_name || undefined,
    }));
  }

  public static async createInvitation(
    context: TenantContext,
    input: { email: string; role: MembershipRole }
  ) {
    assertXamppRuntimeAllowed();
    PermissionService.assertPermission(context.role, "invite_member", input.role);

    if (input.role === "owner") {
      throw new ForbiddenError("Não é permitido convidar usuários com papel de proprietário.");
    }
    if (context.role === "manager" && input.role !== "staff") {
      throw new ForbiddenError("Gestores só podem convidar membros com papel staff.");
    }

    const email = input.email.trim().toLowerCase();
    const existing = await xamppQuery<RowDataPacket[]>(
      "SELECT id FROM tenant_invitations WHERE tenant_id = ? AND email = ? AND status = 'pending' LIMIT 1",
      [context.tenantId, email]
    );
    if (existing.length > 0) {
      throw new ValidationError("Já existe um convite pendente para este e-mail.");
    }

    const id = randomUUID();
    const rawToken = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await xamppQuery(
      `INSERT INTO tenant_invitations (id, tenant_id, email, role, token_hash, status, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, context.tenantId, email, input.role, tokenHash, expiresAt, context.userId]
    );

    await this.recordAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "invitation.created",
      resourceType: "tenant_invitation",
      resourceId: id,
      metadata: { email, role: input.role },
    });

    return {
      invitationId: id,
      email,
      role: input.role,
      inviteUrl: `/convite/${rawToken}`,
    };
  }

  public static async revokeInvitation(context: TenantContext, invitationId: string) {
    assertXamppRuntimeAllowed();
    PermissionService.assertPermission(context.role, "revoke_invitation");

    await xamppQuery(
      "UPDATE tenant_invitations SET status = 'revoked' WHERE id = ? AND tenant_id = ? AND status = 'pending'",
      [invitationId, context.tenantId]
    );

    await this.recordAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "invitation.revoked",
      resourceType: "tenant_invitation",
      resourceId: invitationId,
    });
  }

  public static async getSettings(context: TenantContext) {
    assertXamppRuntimeAllowed();
    PermissionService.assertPermission(context.role, "view_own_tenant");

    const rows = await xamppQuery<RowDataPacket[]>(
      `SELECT t.id, t.name, t.slug, ts.segment_label, ts.primary_color, ts.monogram, ts.brand_description, ts.updated_at
       FROM tenants t
       LEFT JOIN tenant_settings ts ON ts.tenant_id = t.id
       WHERE t.id = ? LIMIT 1`,
      [context.tenantId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Configurações do estabelecimento não encontradas.");
    }

    return {
      tenant_id: row.id as string,
      display_name: row.name as string,
      support_email: null as string | null,
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      segment_label: (row.segment_label as string) || "Operação Comercial",
      primary_color: (row.primary_color as string) || "#6C5CE7",
      monogram: (row.monogram as string | null) || null,
      brand_description: (row.brand_description as string | null) || null,
      updated_at: row.updated_at
        ? new Date(row.updated_at as string).toISOString()
        : new Date().toISOString(),
    };
  }

  public static async updateSettings(
    context: TenantContext,
    input: {
      displayName: string;
      supportEmail?: string | null;
      timezone?: string;
      locale?: string;
      segmentLabel?: string;
      primaryColor?: string;
      monogram?: string | null;
      brandDescription?: string | null;
    }
  ) {
    assertXamppRuntimeAllowed();
    PermissionService.assertPermission(context.role, "update_general_settings");

    await xamppQuery("UPDATE tenants SET name = ? WHERE id = ?", [
      input.displayName.trim(),
      context.tenantId,
    ]);

    await xamppQuery(
      `INSERT INTO tenant_settings (tenant_id, segment_label, primary_color, monogram, brand_description)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         segment_label = VALUES(segment_label),
         primary_color = VALUES(primary_color),
         monogram = VALUES(monogram),
         brand_description = VALUES(brand_description)`,
      [
        context.tenantId,
        input.segmentLabel || "Operação Comercial",
        input.primaryColor || "#6C5CE7",
        input.monogram || null,
        input.brandDescription || null,
      ]
    );

    await this.recordAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "tenant.settings_updated",
      resourceType: "tenant_settings",
      resourceId: context.tenantId,
      metadata: { displayName: input.displayName, segmentLabel: input.segmentLabel },
    });

    return this.getSettings(context);
  }

  public static async recordAudit(params: {
    tenantId: string | null;
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    assertXamppRuntimeAllowed();
    await xamppQuery(
      `INSERT INTO audit_logs (id, tenant_id, actor_user_id, action, resource_type, resource_id, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        params.tenantId,
        params.actorUserId,
        params.action,
        params.resourceType,
        params.resourceId || null,
        JSON.stringify(params.metadata || {}),
      ]
    );
  }

  public static async listTenantAuditLogs(
    userId: string,
    tenantId: string,
    filter: ListAuditLogsFilter = {}
  ) {
    assertXamppRuntimeAllowed();
    const ctx = await this.resolveTenantContext(userId, tenantId);
    PermissionService.assertPermission(ctx.role, "view_tenant_audit_logs");

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(50, Math.max(1, filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const where: string[] = ["a.tenant_id = ?"];
    const params: unknown[] = [tenantId];

    if (filter.action) {
      where.push("a.action = ?");
      params.push(filter.action);
    }

    const [countRows, rows] = await Promise.all([
      xamppQuery<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM audit_logs a WHERE ${where.join(" AND ")}`,
        params
      ),
      xamppQuery<AuditRow[]>(
        `SELECT a.*, u.full_name AS actor_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
         WHERE ${where.join(" AND ")}
         ORDER BY a.created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params
      ),
    ]);

    const totalCount = Number(countRows[0]?.cnt || 0);
    return {
      items: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        actorUserId: r.actor_user_id,
        actorName: r.actor_name || "Sistema",
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        metadata:
          typeof r.metadata_json === "string"
            ? JSON.parse(r.metadata_json)
            : r.metadata_json || {},
        createdAt: new Date(r.created_at).toISOString(),
      })),
      totalCount,
      page,
      pageSize,
    };
  }

  public static async listPlatformAuditLogs(
    userId: string,
    filter: ListAuditLogsFilter = {}
  ) {
    assertXamppRuntimeAllowed();
    const adminRows = await xamppQuery<RowDataPacket[]>(
      "SELECT id FROM users WHERE id = ? AND is_platform_admin = 1 LIMIT 1",
      [userId]
    );
    if (adminRows.length === 0) {
      throw new ForbiddenError("Acesso restrito a administradores globais da plataforma.");
    }

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(50, Math.max(1, filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (filter.tenantId) {
      where.push("a.tenant_id = ?");
      params.push(filter.tenantId);
    }
    if (filter.action) {
      where.push("a.action = ?");
      params.push(filter.action);
    }

    const [countRows, rows] = await Promise.all([
      xamppQuery<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM audit_logs a WHERE ${where.join(" AND ")}`,
        params
      ),
      xamppQuery<AuditRow[]>(
        `SELECT a.*, u.full_name AS actor_name, t.name AS tenant_name, t.slug AS tenant_slug
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
         LEFT JOIN tenants t ON t.id = a.tenant_id
         WHERE ${where.join(" AND ")}
         ORDER BY a.created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params
      ),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        tenantName: r.tenant_name || undefined,
        tenantSlug: r.tenant_slug || undefined,
        actorUserId: r.actor_user_id,
        actorName: r.actor_name || "Sistema",
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        metadata:
          typeof r.metadata_json === "string"
            ? JSON.parse(r.metadata_json)
            : r.metadata_json || {},
        createdAt: new Date(r.created_at).toISOString(),
      })),
      totalCount: Number(countRows[0]?.cnt || 0),
      page,
      pageSize,
    };
  }

  public static async listAllTenantsForAdmin(user: SessionUser | string) {
    assertXamppRuntimeAllowed();
    const userId = typeof user === "string" ? user : user.id;
    const adminRows = await xamppQuery<RowDataPacket[]>(
      "SELECT id FROM users WHERE id = ? AND is_platform_admin = 1 LIMIT 1",
      [userId]
    );
    if (adminRows.length === 0) {
      throw new ForbiddenError("Acesso restrito ao administrador global.");
    }

    const rows = await xamppQuery<RowDataPacket[]>(
      `SELECT t.*, ts.segment_label, ts.primary_color,
        (SELECT COUNT(*) FROM tenant_memberships tm WHERE tm.tenant_id = t.id) AS member_count
       FROM tenants t
       LEFT JOIN tenant_settings ts ON ts.tenant_id = t.id
       ORDER BY t.created_at DESC`
    );

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      status: r.status as TenantStatus,
      segmentLabel: (r.segment_label as string) || "Operação Comercial",
      primaryColor: (r.primary_color as string) || "#6C5CE7",
      memberCount: Number(r.member_count || 0),
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }

  public static async createTenantForAdmin(
    userId: string,
    input: { name: string; slug: string; segmentLabel?: string; primaryColor?: string }
  ) {
    assertXamppRuntimeAllowed();
    const adminRows = await xamppQuery<RowDataPacket[]>(
      "SELECT id FROM users WHERE id = ? AND is_platform_admin = 1 LIMIT 1",
      [userId]
    );
    if (adminRows.length === 0) {
      throw new ForbiddenError("Acesso restrito ao administrador global.");
    }

    const id = randomUUID();
    await xamppQuery(
      "INSERT INTO tenants (id, name, slug, status) VALUES (?, ?, ?, 'active')",
      [id, input.name.trim(), input.slug.trim().toLowerCase()]
    );
    await xamppQuery(
      `INSERT INTO tenant_settings (tenant_id, segment_label, primary_color)
       VALUES (?, ?, ?)`,
      [id, input.segmentLabel || "Operação Comercial", input.primaryColor || "#6C5CE7"]
    );

    await this.recordAudit({
      tenantId: id,
      actorUserId: userId,
      action: "tenant.created",
      resourceType: "tenant",
      resourceId: id,
      metadata: { name: input.name, slug: input.slug },
    });

    return { id, name: input.name, slug: input.slug, status: "active" as TenantStatus };
  }

  public static async toggleTenantStatusForAdmin(
    user: SessionUser | string,
    tenantId: string,
    newStatus: TenantStatus
  ) {
    assertXamppRuntimeAllowed();
    const userId = typeof user === "string" ? user : user.id;
    const adminRows = await xamppQuery<RowDataPacket[]>(
      "SELECT id FROM users WHERE id = ? AND is_platform_admin = 1 LIMIT 1",
      [userId]
    );
    if (adminRows.length === 0) {
      throw new ForbiddenError("Acesso restrito ao administrador global.");
    }
    if (newStatus !== "active" && newStatus !== "suspended") {
      throw new ValidationError("Status de estabelecimento inválido.");
    }

    await xamppQuery("UPDATE tenants SET status = ? WHERE id = ?", [newStatus, tenantId]);
    await this.recordAudit({
      tenantId,
      actorUserId: userId,
      action: newStatus === "suspended" ? "tenant.suspended" : "tenant.reactivated",
      resourceType: "tenant",
      resourceId: tenantId,
      metadata: { status: newStatus },
    });
  }
}
