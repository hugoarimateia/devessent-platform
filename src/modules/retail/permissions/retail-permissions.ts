import { ForbiddenError } from "@/core/errors/app-error";
import type { RoleOrAdmin } from "@/core/permissions/policies/role-matrix";

export type RetailOperation =
  | "view_retail_catalog"
  | "manage_categories"
  | "manage_products"
  | "publish_products"
  | "manage_prices"
  | "manage_inventory"
  | "manage_retail_settings"
  | "view_retail_orders"
  | "manage_retail_orders"
  | "view_retail_payments"
  | "manage_retail_payments"
  | "manage_payment_connections"
  | "manage_storefront_design";

export const RETAIL_PERMISSION_MATRIX: Record<RetailOperation, RoleOrAdmin[]> = {
  view_retail_catalog: ["platform_admin", "owner", "manager", "staff"],
  manage_categories: ["platform_admin", "owner", "manager"],
  manage_products: ["platform_admin", "owner", "manager"],
  publish_products: ["platform_admin", "owner", "manager"],
  manage_prices: ["platform_admin", "owner", "manager"],
  manage_inventory: ["platform_admin", "owner", "manager"],
  manage_retail_settings: ["platform_admin", "owner", "manager"],
  // Gestão de pedidos comerciais restrita a owner, manager e platform_admin (staff não confirma/cancela)
  view_retail_orders: ["platform_admin", "owner", "manager"],
  manage_retail_orders: ["platform_admin", "owner", "manager"],
  // Gestão financeira e acompanhamento de recebimentos do estabelecimento (staff bloqueado)
  view_retail_payments: ["platform_admin", "owner", "manager"],
  manage_retail_payments: ["platform_admin", "owner", "manager"],
  // Configuração técnica de credenciais/conexão de gateway do lojista restrita à equipe DevEssent (§4)
  manage_payment_connections: ["platform_admin"],
  // Exclusivo da equipe técnica DevEssent (template, paleta, hero e estrutura visual do site)
  manage_storefront_design: ["platform_admin"],
};

export class RetailPermissionService {
  /**
   * Verifica se o papel possui permissão para executar a operação no módulo Retail
   */
  public static hasPermission(role: RoleOrAdmin, operation: RetailOperation): boolean {
    const allowed = RETAIL_PERMISSION_MATRIX[operation];
    return allowed ? allowed.includes(role) : false;
  }

  /**
   * Assegura autorização para a operação comercial, lançando ForbiddenError em caso de recusa
   */
  public static assertPermission(role: RoleOrAdmin, operation: RetailOperation): void {
    if (!this.hasPermission(role, operation)) {
      throw new ForbiddenError(
        `Acesso negado: seu papel operacional '${role}' não possui permissão para '${operation}' no módulo Retail.`
      );
    }
  }
}

