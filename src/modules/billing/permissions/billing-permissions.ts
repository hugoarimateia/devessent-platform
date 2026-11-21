import { ForbiddenError } from "@/core/errors/app-error";
import type { RoleOrAdmin } from "@/core/permissions/policies/role-matrix";

export type BillingOperation =
  | "view_global_billing"
  | "manage_billing_plans"
  | "manage_billing_subscriptions"
  | "manage_implementation_contracts"
  | "simulate_billing_sandbox"
  | "view_own_tenant_billing"
  | "authorize_own_tenant_subscription"
  | "update_own_payment_method";

/**
 * Matriz estrita de permissões do Billing SaaS (§6, §7, §12):
 * - Gestão global (planos, assinaturas, contratos 50/50, reconciliação): EXCLUSIVA de platform_admin.
 * - Consulta e autorização da assinatura do próprio estabelecimento: EXCLUSIVA do owner (e platform_admin).
 * - manager e staff NÃO têm acesso a contratos/mensalidades da DevEssent.
 */
const BILLING_PERMISSION_MATRIX: Record<BillingOperation, RoleOrAdmin[]> = {
  view_global_billing: ["platform_admin"],
  manage_billing_plans: ["platform_admin"],
  manage_billing_subscriptions: ["platform_admin"],
  manage_implementation_contracts: ["platform_admin"],
  simulate_billing_sandbox: ["platform_admin"],
  view_own_tenant_billing: ["platform_admin", "owner"],
  authorize_own_tenant_subscription: ["platform_admin", "owner"],
  update_own_payment_method: ["platform_admin", "owner"],
};

export const BillingPermissionService = {
  hasPermission(role: RoleOrAdmin, operation: BillingOperation): boolean {
    const allowed = BILLING_PERMISSION_MATRIX[operation];
    return Boolean(allowed && allowed.includes(role));
  },

  assertPermission(role: RoleOrAdmin, operation: BillingOperation, message?: string): void {
    if (!this.hasPermission(role, operation)) {
      throw new ForbiddenError(
        message ||
          "Acesso negado: seu perfil não possui autorização para esta operação de Billing SaaS."
      );
    }
  },
};
