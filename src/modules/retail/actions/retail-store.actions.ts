"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { RetailStoreService } from "../services/retail-store-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import type { StorefrontTemplate } from "../types/retail.types";

export interface RetailActionState {
  success?: boolean;
  error?: string;
  message?: string;
  data?: unknown;
}

const RESTRICTED_DESIGN_FORM_KEYS = [
  "template",
  "brandHeadline",
  "brandSubheadline",
  "aboutText",
  "heroBadge",
  "accentColor",
  "secondaryColor",
  "announcementBar",
] as const;

/**
 * Atualização operacional da loja comercial pelo cliente (Owner / Manager).
 * Campos estruturais ou visuais do site público são bloqueados no servidor caso não seja `platform_admin`.
 */
export async function updateRetailStoreAction(
  tenantId: string,
  _prevState: RetailActionState | null,
  formData: FormData
): Promise<RetailActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    const attemptedDesignFields = RESTRICTED_DESIGN_FORM_KEYS.filter((k) =>
      formData.has(k)
    );
    if (attemptedDesignFields.length > 0 && context.role !== "platform_admin") {
      return {
        success: false,
        error:
          "Acesso negado: alterações de layout, template e identidade visual da vitrine são exclusivas da equipe técnica DevEssent.",
      };
    }

    const storeName = formData.get("storeName")?.toString() || "";
    const currency = formData.get("currency")?.toString() || "BRL";
    const isActive = formData.get("isActive") === "true" || formData.get("isActive") === "on";
    const inventoryMode = (formData.get("inventoryMode")?.toString() || "track_quantity") as
      | "track_quantity"
      | "untracked";

    const contactEmail = formData.get("contactEmail")?.toString() || null;
    const contactPhone = formData.get("contactPhone")?.toString() || null;

    const socialLinks = {
      instagram: formData.get("social_instagram")?.toString() || "",
      tiktok: formData.get("social_tiktok")?.toString() || "",
      youtube: formData.get("social_youtube")?.toString() || "",
      twitter: formData.get("social_twitter")?.toString() || "",
    };

    const updated = await RetailStoreService.updateOperationalSettings(supabase, context, {
      storeName,
      currency,
      isActive,
      inventoryMode,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      socialLinks,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/configuracoes");
    if (updated.slug) {
      revalidatePath(`/loja/${updated.slug}`);
      revalidatePath(`/loja/${updated.slug}/produtos`);
    }

    return {
      success: true,
      message: "Configurações operacionais da loja atualizadas com sucesso.",
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao salvar configurações da loja."),
    };
  }
}

/**
 * Customização técnica de template, hero e identidade visual da vitrine.
 * Restrito estritamente ao papel `platform_admin` (equipe DevEssent).
 */
export async function updateStorefrontDesignAction(
  tenantId: string,
  _prevState: RetailActionState | null,
  formData: FormData
): Promise<RetailActionState> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  if (!sessionUser.isPlatformAdmin) {
    return {
      success: false,
      error:
        "Acesso negado: a customização estrutural de sites é reservada exclusivamente à equipe técnica DevEssent.",
    };
  }

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    if (context.role !== "platform_admin") {
      return {
        success: false,
        error: "Acesso negado: privilégio administrativo global requerido.",
      };
    }

    const template = (formData.get("template")?.toString() || "editorial") as StorefrontTemplate;
    const brandHeadline = formData.get("brandHeadline")?.toString() || null;
    const brandSubheadline = formData.get("brandSubheadline")?.toString() || null;
    const aboutText = formData.get("aboutText")?.toString() || null;
    const heroBadge = formData.get("heroBadge")?.toString() || null;
    const accentColor = formData.get("accentColor")?.toString() || null;
    const secondaryColor = formData.get("secondaryColor")?.toString() || null;
    const announcementBar = formData.get("announcementBar")?.toString() || null;

    const adminClient = createAdminClient();
    const updated = await RetailStoreService.updateStorefrontDesign(adminClient, context, {
      template,
      brandHeadline,
      brandSubheadline,
      aboutText,
      heroBadge,
      accentColor: accentColor || undefined,
      secondaryColor: secondaryColor || undefined,
      announcementBar,
    });

    revalidatePath("/admin/sites");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/configuracoes");
    if (updated.slug) {
      revalidatePath(`/loja/${updated.slug}`);
      revalidatePath(`/loja/${updated.slug}/produtos`);
    }

    return {
      success: true,
      message: "Arquitetura visual e template da vitrine atualizados com sucesso.",
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao salvar customização técnica do site."),
    };
  }
}
