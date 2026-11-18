"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import { RATE_LIMIT_POLICIES, RateLimitService } from "@/core/security";
import {
  TenantService,
  MembershipService,
  InvitationService,
  inviteMemberSchema,
} from "@/core/tenants";
import type { MembershipRole } from "@/types/database.types";

export interface MembershipActionState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
  inviteUrl?: string;
}

/**
 * Emite um novo convite para membro da empresa ativa.
 */
export async function inviteMemberAction(
  tenantId: string,
  _prevState: MembershipActionState | null,
  formData: FormData
): Promise<MembershipActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login");
  }

  const rawData = {
    email: formData.get("email")?.toString() || "",
    role: formData.get("role")?.toString() || "staff",
  };

  const validated = inviteMemberSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      error: "Preencha o e-mail e papel corretamente.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    await RateLimitService.consumeOrThrow(
      RATE_LIMIT_POLICIES.invitationCreate,
      `${sessionUser.id}:${tenantId}`
    );

    const context = await TenantService.resolveTenantContext(supabase, sessionUser.id, tenantId);
    const invite = await InvitationService.createInvitation(supabase, context, validated.data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/membros");
    revalidatePath("/dashboard/atividades");
    revalidatePath("/admin/atividades");
    return {
      success: true,
      message: `Convite enviado com sucesso para ${invite.email}.`,
      inviteUrl: `/convite/${invite.token}`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível emitir o convite."),
    };
  }
}

/**
 * Altera o papel de um membro da organização ativa.
 */
export async function updateMemberRoleAction(
  tenantId: string,
  targetUserId: string,
  newRole: MembershipRole
): Promise<MembershipActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login");
  }

  try {
    const context = await TenantService.resolveTenantContext(supabase, sessionUser.id, tenantId);
    await MembershipService.updateMemberRole(supabase, context, {
      targetUserId,
      newRole: newRole as "manager" | "staff",
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/membros");
    revalidatePath("/dashboard/atividades");
    revalidatePath("/admin/atividades");
    return { success: true, message: "Papel do integrante atualizado com sucesso." };
  } catch (err: unknown) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível atualizar o papel do integrante."),
    };
  }
}

/**
 * Remove o vínculo de um membro da organização ativa.
 */
export async function removeMemberAction(
  tenantId: string,
  targetUserId: string
): Promise<MembershipActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login");
  }

  try {
    const context = await TenantService.resolveTenantContext(supabase, sessionUser.id, tenantId);
    await MembershipService.removeMember(supabase, context, {
      targetUserId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/membros");
    revalidatePath("/dashboard/atividades");
    revalidatePath("/admin/atividades");
    return { success: true, message: "Membro removido com sucesso." };
  } catch (err: unknown) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível remover o integrante."),
    };
  }
}

/**
 * Revoga um convite pendente.
 */
export async function revokeInvitationAction(
  tenantId: string,
  invitationId: string
): Promise<MembershipActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login");
  }

  try {
    const context = await TenantService.resolveTenantContext(supabase, sessionUser.id, tenantId);
    await InvitationService.revokeInvitation(supabase, context, invitationId);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/membros");
    revalidatePath("/dashboard/atividades");
    revalidatePath("/admin/atividades");
    return { success: true, message: "Convite revogado com sucesso." };
  } catch (err: unknown) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível revogar o convite."),
    };
  }
}

/**
 * Aceitação de convite por um usuário autenticado.
 */
export async function acceptInvitationAction(rawToken: string): Promise<MembershipActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect(`/login?redirect=/convite/${rawToken}`);
  }

  try {
    await RateLimitService.consumeOrThrow(
      RATE_LIMIT_POLICIES.invitationAccept,
      sessionUser.id
    );

    const result = await InvitationService.acceptInvitation(supabase, rawToken, sessionUser.id);

    // Definir cookie do novo tenant aceito
    const cookieStore = await cookies();
    cookieStore.set(getActiveTenantCookieName(), result.tenant_id, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/membros");
    revalidatePath("/dashboard/atividades");
    revalidatePath("/admin/atividades");
    redirect("/dashboard");
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest: string }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }

    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível aceitar o convite."),
    };
  }
}

