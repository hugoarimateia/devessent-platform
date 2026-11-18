import { randomBytes, createHash } from "crypto";
import type { MembershipRole } from "@/types/database.types";
import type { TenantContext, AppSupabaseClient } from "./tenant-service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/core/errors/app-error";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import { PermissionService } from "@/core/permissions/services/permission-service";
import { AuditService } from "@/core/audit/services/audit-service";
import { inviteMemberSchema, type InviteMemberInput } from "../schemas";
import { env } from "@/lib/environment/env";

import { createAdminClient } from "@/lib/supabase/admin";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

export interface TenantInvitationItem {
  id: string;
  email: string;
  role: MembershipRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  inviterName?: string;
}

export class InvitationService {
  /**
   * Emite um convite de estabelecimento para um endereço de e-mail corporativo.
   * O token seguro gerado é hasheado em SHA-256 antes de persistir no banco.
   */
  public static async createInvitation(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: InviteMemberInput
  ) {
    const parsed = inviteMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados de convite inválidos.", parsed.error.flatten().fieldErrors);
    }

    // 1. Validar permissão de convite
    PermissionService.assertPermission(context.role, "invite_member", parsed.data.role);

    // 2. Blindagem adicional: nunca permitir convite com papel 'owner'
    if ((parsed.data.role as string) === "owner") {
      throw new ForbiddenError("Não é permitido convidar usuários com papel de proprietário.");
    }

    // 3. Gestor só pode convidar 'staff'
    if (context.role === "manager" && parsed.data.role !== "staff") {
      throw new ForbiddenError("Gestores só possuem permissão para convidar membros com papel de equipe (staff).");
    }

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      const created = await XamppTenantAdapter.createInvitation(context, parsed.data);
      return {
        id: created.invitationId,
        email: created.email,
        role: created.role,
        token: created.inviteUrl.split("/").pop() || "",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      };
    }

    // 4. Verificar se já existe convite pendente para este e-mail
    const { data: existingInvitation } = await supabase
      .from("tenant_invitations")
      .select("id, expires_at, status")
      .eq("tenant_id", context.tenantId)
      .eq("email", parsed.data.email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvitation) {
      if (new Date(existingInvitation.expires_at) > new Date()) {
        throw new ValidationError("Já existe um convite pendente e válido para este endereço de e-mail.");
      }

      // Convite anterior expirou mantendo status 'pending': marcar como 'expired' antes de emitir o novo
      const adminClient = createAdminClient();
      await adminClient
        .from("tenant_invitations")
        .update({ status: "expired" })
        .eq("id", existingInvitation.id)
        .eq("status", "pending");
    }

    // 5. Gerar token criptograficamente seguro (32 bytes) e seu hash SHA-256
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    // 6. Persistir convite
    const { data: invitation, error } = await supabase
      .from("tenant_invitations")
      .insert({
        tenant_id: context.tenantId,
        email: parsed.data.email,
        role: parsed.data.role,
        token_hash: tokenHash,
        invited_by: context.userId,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error || !invitation) {
      if (error?.code === "23505") {
        throw new ValidationError("Já existe um convite pendente e válido para este endereço de e-mail.");
      }
      throw new Error(toPublicErrorMessage(error, "Não foi possível registrar o convite de acesso."));
    }

    // 7. Enviar e-mail de notificação ao convidado
    const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/convite/${rawToken}`;
    try {
      // Disparar envio local de simulação / SMTP Mailpit
      await fetch("http://127.0.0.1:54324/api/v1/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: "nao-responda@devessent.com.br", Name: "DevEssent Platform" },
          To: [{ Email: parsed.data.email }],
          Subject: `Você foi convidado para integrar ${context.tenantName}`,
          Text: `Olá!\n\nVocê recebeu um convite para integrar o estabelecimento ${context.tenantName} na DevEssent Platform com o papel de ${parsed.data.role}.\n\nPara aceitar, acesse o link seguro abaixo:\n${inviteUrl}\n\nEste link expira em 7 dias.`,
        }),
      }).catch(() => {
        // Mailpit opcional em tempo de execução
      });
    } catch {
      // Falha de envio não trava o registro
    }

    // 8. Registrar auditoria (NUNCA registrar o token em texto puro)
    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "invitation.created",
      resourceType: "tenant_invitation",
      resourceId: invitation.id,
      metadata: {
        email: parsed.data.email,
        role: parsed.data.role,
        expiresAt: invitation.expires_at,
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: rawToken,
      expiresAt: invitation.expires_at,
    };
  }

  /**
   * Lista os convites de um estabelecimento (pendentes ou histórico completo de pendentes/expirados/revogados).
   */
  public static async listInvitations(
    supabase: AppSupabaseClient,
    context: TenantContext,
    options: { includeHistory?: boolean } = {}
  ): Promise<TenantInvitationItem[]> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      return XamppTenantAdapter.listInvitations(context, options);
    }

    PermissionService.assertPermission(context.role, "manage_members");

    let query = supabase
      .from("tenant_invitations")
      .select("id, email, role, status, expires_at, created_at, profiles!invited_by(full_name)")
      .eq("tenant_id", context.tenantId);

    if (options.includeHistory) {
      query = query.in("status", ["pending", "expired", "revoked"]).limit(100);
    } else {
      query = query.eq("status", "pending");
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error || !data) {
      throw new Error(toPublicErrorMessage(error, "Não foi possível consultar os convites da unidade."));
    }

    const nowMs = Date.now();
    return data.map((item) => {
      const p = item.profiles as unknown as { full_name: string } | null;
      const isPendingExpired = item.status === "pending" && new Date(item.expires_at).getTime() <= nowMs;
      const effectiveStatus = (isPendingExpired ? "expired" : item.status) as
        | "pending"
        | "accepted"
        | "revoked"
        | "expired";

      return {
        id: item.id,
        email: item.email,
        role: item.role,
        status: effectiveStatus,
        expiresAt: item.expires_at,
        createdAt: item.created_at,
        inviterName: p?.full_name,
      };
    });
  }

  /**
   * Revoga um convite pendente.
   */
  public static async revokeInvitation(
    supabase: AppSupabaseClient,
    context: TenantContext,
    invitationId: string
  ) {
    PermissionService.assertPermission(context.role, "revoke_invitation");

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      await XamppTenantAdapter.revokeInvitation(context, invitationId);
      return { success: true };
    }

    const { data: updated, error } = await supabase
      .from("tenant_invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId)
      .eq("tenant_id", context.tenantId)
      .eq("status", "pending")
      .select()
      .single();

    if (error || !updated) {
      throw new NotFoundError("Convite não encontrado ou já processado.");
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "invitation.revoked",
      resourceType: "tenant_invitation",
      resourceId: updated.id,
      metadata: { email: updated.email },
    });

    return { success: true };
  }

  /**
   * Consulta os dados públicos de um convite a partir de seu token seguro.
   */
  public static async getInvitationByToken(
    _supabase: AppSupabaseClient,
    rawToken: string
  ) {
    const admin = createAdminClient();
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const { data: invitation, error } = await admin
      .from("tenant_invitations")
      .select("id, email, role, status, expires_at, tenants(name, slug, status)")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !invitation) {
      throw new NotFoundError("Convite não encontrado ou inválido.");
    }

    const t = invitation.tenants as unknown as { name: string; slug: string; status: string } | null;
    const isExpired = new Date(invitation.expires_at) <= new Date();
    const effectiveStatus =
      invitation.status === "pending" && isExpired ? "expired" : invitation.status;

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: effectiveStatus,
      expiresAt: invitation.expires_at,
      isExpired,
      tenantName: t?.name || "Estabelecimento",
      tenantSlug: t?.slug || "",
      tenantStatus: t?.status || "active",
    };
  }

  /**
   * Aceita um convite de forma atômica no PostgreSQL via RPC accept_tenant_invitation.
   */
  public static async acceptInvitation(
    supabase: AppSupabaseClient,
    rawToken: string,
    acceptingUserId: string
  ) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const { data, error } = await supabase.rpc("accept_tenant_invitation", {
      p_token_hash: tokenHash,
      p_user_id: acceptingUserId,
    });

    if (error || !data) {
      const msg = error?.message || "";
      if (
        /expir|inválid|suspens|destinatário|membro|revogad|aceit|outro endereço|processado|sessão|divergente/i.test(
          msg
        )
      ) {
        throw new ValidationError(msg);
      }
      throw new Error(toPublicErrorMessage(error, "Não foi possível processar o aceite do convite."));
    }

    const result = data as unknown as {
      success: boolean;
      tenant_id: string;
      role: MembershipRole;
    };

    return result;
  }
}
