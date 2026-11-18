import type { MembershipRole } from "@/types/database.types";
import type { TenantContext, AppSupabaseClient } from "./tenant-service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/core/errors/app-error";
import { PermissionService } from "@/core/permissions/services/permission-service";
import { AuditService } from "@/core/audit/services/audit-service";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  updateMemberRoleSchema,
  removeMemberSchema,
  type UpdateMemberRoleInput,
  type RemoveMemberInput,
} from "../schemas";

export interface TenantMemberItem {
  id: string;
  userId: string;
  role: MembershipRole;
  fullName: string;
  avatarPath: string | null;
  createdAt: string;
}

export class MembershipService {
  /**
   * Lista todos os membros vinculados ao estabelecimento ativo.
   */
  public static async listMembers(
    supabase: AppSupabaseClient,
    context: TenantContext
  ): Promise<TenantMemberItem[]> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      return XamppTenantAdapter.listMembers(context);
    }

    PermissionService.assertPermission(context.role, "view_workspace");

    const { data, error } = await supabase
      .from("tenant_memberships")
      .select("id, user_id, role, created_at, profiles!inner(full_name, avatar_path)")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      throw new Error(`Falha ao consultar membros do estabelecimento: ${error?.message}`);
    }

    const roleOrder: Record<MembershipRole, number> = {
      owner: 1,
      manager: 2,
      staff: 3,
    };

    return data
      .map((item) => {
        const p = item.profiles as unknown as { full_name: string; avatar_path: string | null };
        return {
          id: item.id,
          userId: item.user_id,
          role: item.role as MembershipRole,
          fullName: p.full_name,
          avatarPath: p.avatar_path,
          createdAt: item.created_at,
        };
      })
      .sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  }

  /**
   * Altera o papel de um membro da organização dentro das regras de negócio.
   */
  public static async updateMemberRole(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: UpdateMemberRoleInput
  ) {
    const parsed = updateMemberRoleSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados inválidos para alteração de papel.", parsed.error.flatten().fieldErrors);
    }

    // 1. Impedir alteração do próprio papel
    if (parsed.data.targetUserId === context.userId) {
      throw new ForbiddenError("Não é permitido alterar o seu próprio papel.");
    }

    // 2. Verificar permissão do operador para gerenciar membros com o papel alvo
    PermissionService.assertPermission(context.role, "manage_members", parsed.data.newRole);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      return XamppTenantAdapter.updateMemberRole(context, parsed.data.targetUserId, parsed.data.newRole);
    }

    // 3. Obter o registro atual do membro
    const { data: targetMember, error: findError } = await supabase
      .from("tenant_memberships")
      .select("id, role, user_id")
      .eq("tenant_id", context.tenantId)
      .eq("user_id", parsed.data.targetUserId)
      .maybeSingle();

    if (findError || !targetMember) {
      throw new NotFoundError("Membro não encontrado neste estabelecimento.");
    }

    // 4. Se o membro atual for Owner, não pode ser rebaixado pelo fluxo comum
    if (targetMember.role === "owner") {
      throw new ForbiddenError("Não é permitido alterar o papel de um proprietário pelo fluxo comum.");
    }

    // 5. Se o operador for Gestor (Manager), ele só pode atuar sobre membros com papel 'staff'
    if (context.role === "manager" && targetMember.role !== "staff") {
      throw new ForbiddenError("Gestores só possuem permissão para gerenciar membros de equipe (staff).");
    }

    // 6. Atualizar papel
    const { data: updated, error: updateError } = await supabase
      .from("tenant_memberships")
      .update({ role: parsed.data.newRole })
      .eq("id", targetMember.id)
      .select()
      .single();

    if (updateError || !updated) {
      throw new ForbiddenError("Não foi possível atualizar o papel deste integrante.");
    }

    // 7. Registrar auditoria
    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "member.role_updated",
      resourceType: "tenant_membership",
      resourceId: updated.id,
      metadata: {
        targetUserId: updated.user_id,
        previousRole: targetMember.role,
        newRole: updated.role,
      },
    });

    return updated;
  }

  /**
   * Remove o vínculo de um membro com o estabelecimento.
   */
  public static async removeMember(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: RemoveMemberInput
  ) {
    const parsed = removeMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("ID de membro inválido.", parsed.error.flatten().fieldErrors);
    }

    // 1. Impedir auto-remoção administrativa
    if (parsed.data.targetUserId === context.userId) {
      throw new ForbiddenError("Não é permitido revogar o seu próprio vínculo por esta operação.");
    }

    // 2. Verificar permissão de gestão de membros
    PermissionService.assertPermission(context.role, "manage_members");

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      return XamppTenantAdapter.removeMember(context, parsed.data.targetUserId);
    }

    // 3. Obter dados do membro a ser removido
    const { data: targetMember, error: findError } = await supabase
      .from("tenant_memberships")
      .select("id, role, user_id")
      .eq("tenant_id", context.tenantId)
      .eq("user_id", parsed.data.targetUserId)
      .maybeSingle();

    if (findError || !targetMember) {
      throw new NotFoundError("Membro não encontrado neste estabelecimento.");
    }

    // 4. Gestor só pode remover Staff e proprietários exigem procedimento especial
    if (targetMember.role === "owner") {
      throw new ForbiddenError("Não é permitido remover um proprietário do estabelecimento.");
    }
    if (context.role === "manager" && targetMember.role !== "staff") {
      throw new ForbiddenError("Gestores só possuem permissão para remover membros de equipe (staff).");
    }

    // 5. Excluir vínculo (o trigger do banco impede remover o último owner se for o caso)
    const { error: deleteError } = await supabase
      .from("tenant_memberships")
      .delete()
      .eq("id", targetMember.id);

    if (deleteError) {
      throw new ForbiddenError("Não foi possível remover este integrante do estabelecimento.");
    }

    // 6. Registrar auditoria
    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "member.removed",
      resourceType: "tenant_membership",
      resourceId: targetMember.id,
      metadata: {
        removedUserId: targetMember.user_id,
        previousRole: targetMember.role,
      },
    });

    return { success: true };
  }
}
