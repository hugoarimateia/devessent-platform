import { hasPermission, type PlatformOperation, type RoleOrAdmin } from "../policies/role-matrix";
import { ForbiddenError } from "@/core/errors/app-error";
import type { MembershipRole } from "@/types/database.types";

export class PermissionService {
  /**
   * Garante que o papel do usuário é autorizado para a operação solicitada.
   * Dispara ForbiddenError em caso negativo.
   */
  public static assertPermission(
    role: RoleOrAdmin,
    operation: PlatformOperation,
    targetMemberRole?: MembershipRole
  ): void {
    const allowed = hasPermission(role, operation, targetMemberRole);
    if (!allowed) {
      throw new ForbiddenError(
        `Permissão insuficiente para executar a operação '${operation}' com papel '${role}'.`
      );
    }
  }

  /**
   * Checagem booleana sem lançar exceção.
   */
  public static checkPermission(
    role: RoleOrAdmin,
    operation: PlatformOperation,
    targetMemberRole?: MembershipRole
  ): boolean {
    return hasPermission(role, operation, targetMemberRole);
  }
}

