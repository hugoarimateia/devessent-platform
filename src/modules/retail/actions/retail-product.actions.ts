"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { RetailProductService } from "../services/retail-product-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import type { CreateProductInput, UpdateProductInput } from "../schemas/product.schema";
import type { RetailActionState } from "./retail-store.actions";

export async function createProductAction(
  tenantId: string,
  input: CreateProductInput
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

    const product = await RetailProductService.createProduct(supabase, context, input);

    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: `Produto '${product.name}' criado com sucesso.`,
      data: product,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao cadastrar produto."),
    };
  }
}

export async function updateProductAction(
  tenantId: string,
  input: UpdateProductInput
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

    const product = await RetailProductService.updateProduct(supabase, context, input);

    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/produtos");
    revalidatePath(`/dashboard/retail/produtos/${product.id}`);

    return {
      success: true,
      message: `Produto '${product.name}' atualizado com sucesso.`,
      data: product,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao atualizar produto."),
    };
  }
}

export async function publishProductAction(
  tenantId: string,
  productId: string
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

    const product = await RetailProductService.publishProduct(supabase, context, productId);

    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/produtos");
    revalidatePath(`/dashboard/retail/produtos/${productId}`);

    return {
      success: true,
      message: `Produto '${product.name}' publicado com sucesso.`,
      data: product,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao publicar produto."),
    };
  }
}

export async function archiveProductAction(
  tenantId: string,
  productId: string
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

    const product = await RetailProductService.archiveProduct(supabase, context, productId);

    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/produtos");
    revalidatePath(`/dashboard/retail/produtos/${productId}`);

    return {
      success: true,
      message: `Produto '${product.name}' arquivado com sucesso.`,
      data: product,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao arquivar produto."),
    };
  }
}

export async function deleteProductAction(
  tenantId: string,
  productId: string
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

    await RetailProductService.deleteProduct(supabase, context, productId);

    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/produtos");

    return {
      success: true,
      message: "Produto excluído do catálogo.",
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao excluir produto."),
    };
  }
}

