"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveTenantCookieName } from "@/lib/environment/backend-mode";
import { isSecureCookieContext } from "@/lib/environment/cookie-options";
import { AuthService } from "@/core/auth/services/auth-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import { RATE_LIMIT_POLICIES, RateLimitService } from "@/core/security";
import {
  TenantService,
  createTenantSchema,
  updateTenantSettingsSchema,
} from "@/core/tenants";
import type { TenantStatus } from "@/types/database.types";

export interface TenantActionState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
}

/**
 * Alterna a empresa ativa salva no cookie do usuário.
 * O servidor SEMPRE valida o acesso real em cada requisição protegida.
 */
export async function switchTenantAction(tenantSlugOrId: string) {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login");
  }

  // Validação estrita no servidor: verificar se o usuário realmente tem acesso à empresa alvo
  const resolvedContext = await TenantService.resolveTenantContext(
    supabase,
    sessionUser.id,
    tenantSlugOrId
  );

  // Armazenar UUID canônico de tenant ativo em cookie seguro
  const cookieStore = await cookies();
  cookieStore.set(getActiveTenantCookieName(), resolvedContext.tenantId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: isSecureCookieContext(),
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

/**
 * Criação administrativa de novo estabelecimento pela plataforma DevEssent.
 */
export async function createTenantAction(
  _prevState: TenantActionState | null,
  formData: FormData
): Promise<TenantActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser || !sessionUser.isPlatformAdmin) {
    return {
      success: false,
      error: "Acesso negado: operação exclusiva para administradores globais da plataforma.",
    };
  }

  const rawData = {
    name: formData.get("name")?.toString() || "",
    slug: formData.get("slug")?.toString() || "",
    ownerEmail: formData.get("ownerEmail")?.toString() || "",
    ownerFullName: formData.get("ownerFullName")?.toString() || "",
  };

  const validated = createTenantSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      error: "Preencha todos os campos obrigatórios corretamente.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    await RateLimitService.consumeOrThrow(
      RATE_LIMIT_POLICIES.adminTenantOp,
      sessionUser.id
    );

    const adminSupabase = createAdminClient();
    await TenantService.createTenantWithAdmin(adminSupabase, sessionUser.id, validated.data);

    revalidatePath("/admin");
    revalidatePath("/admin/empresas");
    revalidatePath("/admin/atividades");
  } catch (err: unknown) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível cadastrar o estabelecimento."),
    };
  }

  redirect("/admin/empresas");
}

/**
 * Atualização administrativa do status da empresa (ativo / suspenso).
 */
export async function updateTenantStatusAction(
  tenantId: string,
  status: TenantStatus
): Promise<TenantActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser || !sessionUser.isPlatformAdmin) {
    return {
      success: false,
      error: "Acesso negado: operação exclusiva para administradores globais da plataforma.",
    };
  }

  try {
    await RateLimitService.consumeOrThrow(
      RATE_LIMIT_POLICIES.adminTenantOp,
      sessionUser.id
    );

    const adminSupabase = createAdminClient();
    await TenantService.updateTenantStatus(adminSupabase, sessionUser.id, tenantId, status);

    revalidatePath("/admin");
    revalidatePath("/admin/empresas");
    revalidatePath("/admin/atividades");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/atividades");
    return {
      success: true,
      message:
        status === "suspended"
          ? "Estabelecimento suspenso com sucesso. O acesso da unidade foi bloqueado."
          : "Estabelecimento reativado com sucesso.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível alterar o status da empresa."),
    };
  }
}

/**
 * Atualização das configurações operacionais da empresa ativa.
 */
export async function updateTenantSettingsAction(
  tenantId: string,
  _prevState: TenantActionState | null,
  formData: FormData
): Promise<TenantActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login");
  }

  const rawSegment = formData.get("segment_label")?.toString().trim();
  const rawPrimaryColor = formData.get("primary_color")?.toString().trim();
  const rawMonogram = formData.get("monogram")?.toString().trim().toUpperCase();
  const rawBrandDesc = formData.get("brand_description")?.toString().trim();

  const rawData = {
    display_name: formData.get("display_name")?.toString() || "",
    contact_email: formData.get("contact_email")?.toString() || null,
    contact_phone: formData.get("contact_phone")?.toString() || null,
    segment_label: rawSegment || undefined,
    primary_color: rawPrimaryColor || undefined,
    monogram: rawMonogram !== undefined ? rawMonogram : undefined,
    brand_description: rawBrandDesc !== undefined ? rawBrandDesc : undefined,
    timezone: formData.get("timezone")?.toString() || "America/Sao_Paulo",
    locale: formData.get("locale")?.toString() || "pt-BR",
  };

  const validated = updateTenantSettingsSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      error: "Revise os campos destacados antes de salvar as configurações.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    const context = await TenantService.resolveTenantContext(supabase, sessionUser.id, tenantId);
    await TenantService.updateSettings(supabase, context, validated.data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/configuracoes");
    revalidatePath("/dashboard/atividades");
    revalidatePath("/admin/atividades");
    return {
      success: true,
      message: "Configurações atualizadas com sucesso.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível salvar as configurações da empresa."),
    };
  }
}

