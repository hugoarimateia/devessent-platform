"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { RetailImageService } from "../services/retail-image-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import type { RetailActionState } from "./retail-store.actions";

export async function uploadProductImageAction(
  tenantId: string,
  productId: string,
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

    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File) || file.size === 0) {
      return {
        success: false,
        error: "Selecione uma imagem válida para upload.",
      };
    }

    const altText = formData.get("altText")?.toString() || null;
    const isPrimary = formData.get("isPrimary") === "true";
    const variantId = formData.get("variantId")?.toString() || null;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const image = await RetailImageService.uploadProductImage(
      supabase,
      context,
      productId,
      {
        buffer,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      },
      altText,
      isPrimary,
      variantId
    );

    revalidatePath(`/dashboard/retail/produtos/${productId}`);
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: "Imagem enviada com sucesso.",
      data: image,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha no upload da imagem."),
    };
  }
}

export async function deleteProductImageAction(
  tenantId: string,
  productId: string,
  imageId: string
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

    await RetailImageService.deleteProductImage(supabase, context, imageId);

    revalidatePath(`/dashboard/retail/produtos/${productId}`);
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: "Imagem excluída com sucesso.",
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao remover imagem."),
    };
  }
}

export async function setPrimaryImageAction(
  tenantId: string,
  productId: string,
  imageId: string
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

    await RetailImageService.setPrimaryImage(supabase, context, imageId);

    revalidatePath(`/dashboard/retail/produtos/${productId}`);
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: "Imagem definida como principal.",
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao definir imagem principal."),
    };
  }
}

