import type { MembershipRole } from "@/types/database.types";

export type RoleOrAdmin = "platform_admin" | MembershipRole;

export type PlatformOperation =
  | "create_tenant"
  | "manage_any_tenant"
  | "view_own_tenant"
  | "update_general_settings"
  | "manage_members"
  | "change_owner"
  | "view_workspace"
  | "suspend_tenant"
  | "invite_member"
  | "revoke_invitation"
  | "view_tenant_audit_logs"
  | "view_platform_audit_logs";

/**
 * Matriz explícita de permissões (Seção 12 da Especificação Mestre + Fase 5B)
 *
 * | Operação                  | Platform Admin       | Owner                | Manager       | Staff |
 * |---------------------------|----------------------|----------------------|---------------|-------|
 * | create_tenant             | Sim                  | Não                  | Não           | Não   |
 * | manage_any_tenant         | Sim                  | Não                  | Não           | Não   |
 * | view_own_tenant           | Sim                  | Sim                  | Sim           | Sim   |
 * | update_general_settings   | Sim                  | Sim                  | Sim           | Não   |
 * | manage_members            | Sim                  | Sim                  | Limitado      | Não   |
 * | invite_member             | Sim                  | Sim (Manager/Staff)  | Apenas Staff  | Não   |
 * | revoke_invitation         | Sim                  | Sim                  | Sim           | Não   |
 * | view_tenant_audit_logs    | Sim                  | Sim                  | Operacional   | Não   |
 * | view_platform_audit_logs  | Sim                  | Não                  | Não           | Não   |
 * | change_owner              | Procedimento especial| Procedimento especial| Não           | Não   |
 * | view_workspace            | Sim                  | Sim                  | Sim           | Sim   |
 * | suspend_tenant            | Sim                  | Não                  | Não           | Não   |
 */

export const MANAGER_VISIBLE_AUDIT_ACTIONS = [
  "tenant_settings.updated",
  "invitation.created",
  "invitation.revoked",
  "invitation.accepted",
  "member.role_updated",
  "member.removed",
  "membership.role_updated",
  "membership.removed",
  "retail.category_created",
  "retail.category_updated",
  "retail.category_deleted",
  "retail.product_created",
  "retail.product_updated",
  "retail.product_published",
  "retail.product_archived",
  "retail.variant_created",
  "retail.variant_updated",
  "retail.price_updated",
  "retail.stock_adjusted",
  "retail.store_updated",
  "retail.order_requested",
  "retail.order_confirmed",
  "retail.order_status_updated",
  "retail.order_cancelled",
  "retail.order_shipping_updated",
  "retail.payment_share_link_generated",
  "retail.payment_session_created",
  "retail.payment_approved",
  "retail.payment_failed",
  "retail.payment_cancelled",
  "retail.payment_refunded",
  "retail.payment_divergence_blocked",
] as const;

interface PermissionRule {
  allowedRoles: RoleOrAdmin[];
  specialProcedureOnly?: boolean;
}

export const PERMISSION_MATRIX: Record<PlatformOperation, PermissionRule> = {
  create_tenant: {
    allowedRoles: ["platform_admin"],
  },
  manage_any_tenant: {
    allowedRoles: ["platform_admin"],
  },
  view_own_tenant: {
    allowedRoles: ["platform_admin", "owner", "manager", "staff"],
  },
  update_general_settings: {
    allowedRoles: ["platform_admin", "owner", "manager"],
  },
  manage_members: {
    allowedRoles: ["platform_admin", "owner", "manager"],
  },
  invite_member: {
    allowedRoles: ["platform_admin", "owner", "manager"],
  },
  revoke_invitation: {
    allowedRoles: ["platform_admin", "owner", "manager"],
  },
  view_tenant_audit_logs: {
    allowedRoles: ["platform_admin", "owner", "manager"],
  },
  view_platform_audit_logs: {
    allowedRoles: ["platform_admin"],
  },
  change_owner: {
    allowedRoles: ["platform_admin", "owner"],
    specialProcedureOnly: true, // Requer procedimento administrativo especial auditado
  },
  view_workspace: {
    allowedRoles: ["platform_admin", "owner", "manager", "staff"],
  },
  suspend_tenant: {
    allowedRoles: ["platform_admin"],
  },
};

/**
 * Retorna a lista de ações de auditoria visíveis para o papel no escopo do estabelecimento,
 * ou null quando todos os eventos do estabelecimento são permitidos.
 */
export function getVisibleTenantAuditActions(role: RoleOrAdmin): readonly string[] | null {
  if (role === "platform_admin" || role === "owner") {
    return null;
  }
  if (role === "manager") {
    return MANAGER_VISIBLE_AUDIT_ACTIONS;
  }
  return [];
}

/**
 * Avalia se determinado papel tem autorização para uma operação específica.
 */
export function hasPermission(
  role: RoleOrAdmin,
  operation: PlatformOperation,
  targetMemberRole?: MembershipRole
): boolean {
  const rule = PERMISSION_MATRIX[operation];
  if (!rule) return false;

  // Se o papel não consta na lista de permitidos
  if (!rule.allowedRoles.includes(role)) {
    return false;
  }

  // Operação change_owner não permitida em fluxo padrão
  if (rule.specialProcedureOnly) {
    return false;
  }

  // Regra refinada de membros e convites: Manager só pode gerenciar/convidar Staff
  if ((operation === "manage_members" || operation === "invite_member") && role === "manager") {
    if (targetMemberRole && targetMemberRole !== "staff") {
      return false;
    }
  }

  // Blindagem: Convite para Owner é estritamente proibido
  if (operation === "invite_member" && targetMemberRole === "owner") {
    return false;
  }

  return true;
}

