"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { RetailCategoryService } from "../services/retail-category-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import type { RetailActionState } from "./retail-store.actions";

export async function createCategoryAction(
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

    const name = formData.get("name")?.toString() || "";
    const slug = formData.get("slug")?.toString() || undefined;
    const description = formData.get("description")?.toString() || undefined;
    const sortOrder = Number(formData.get("sortOrder") || 0);
    const isActive = formData.get("isActive") !== "false";

    const created = await RetailCategoryService.createCategory(supabase, context, {
      name,
      slug,
      description,
      sortOrder,
      isActive,
    });

    revalidatePath("/dashboard/retail/categorias");
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: `Categoria '${created.name}' criada com sucesso.`,
      data: created,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao criar categoria."),
    };
  }
}

export async function updateCategoryAction(
  tenantId: string,
  categoryId: string,
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

    const name = formData.get("name")?.toString() || undefined;
    const slug = formData.get("slug")?.toString() || undefined;
    const description = formData.get("description")?.toString() || undefined;
    const sortOrder = formData.has("sortOrder") ? Number(formData.get("sortOrder")) : undefined;
    const isActive = formData.has("isActive") ? formData.get("isActive") !== "false" : undefined;

    const updated = await RetailCategoryService.updateCategory(supabase, context, {
      id: categoryId,
      name,
      slug,
      description,
      sortOrder,
      isActive,
    });

    revalidatePath("/dashboard/retail/categorias");
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: `Categoria '${updated.name}' atualizada com sucesso.`,
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao atualizar categoria."),
    };
  }
}

export async function deleteCategoryAction(
  tenantId: string,
  categoryId: string
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

    await RetailCategoryService.deleteCategory(supabase, context, categoryId);

    revalidatePath("/dashboard/retail/categorias");
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: "Categoria excluída com sucesso.",
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao excluir categoria."),
    };
  }
}

