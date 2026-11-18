import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import { RetailPermissionService } from "../permissions/retail-permissions";
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from "../schemas/image.schema";
import type { RetailProductImage } from "../types/retail.types";
import { RetailProductService } from "./retail-product-service";
import { NotFoundError, ValidationError } from "@/core/errors/app-error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

export interface UploadImageFileParams {
  buffer: Uint8Array | ArrayBuffer;
  fileName: string;
  contentType: string;
  size: number;
}

export class RetailImageService {
  /**
   * Realiza upload de imagem para o Supabase Storage e associa ao produto.
   */
  public static async uploadProductImage(
    supabase: AppSupabaseClient,
    context: TenantContext,
    productId: string,
    file: UploadImageFileParams,
    altText?: string | null,
    isPrimary = false,
    variantId?: string | null
  ): Promise<RetailProductImage> {
    RetailPermissionService.assertPermission(context.role, "manage_products");

    // 1. Validar tamanho e tipo
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError("O arquivo excede o limite máximo permitido de 5 MB.");
    }

    if (!ALLOWED_MIME_TYPES.includes(file.contentType.toLowerCase())) {
      throw new ValidationError(
        "Formato de imagem inválido. Formatos permitidos: JPG, PNG, WebP e GIF."
      );
    }

    // 2. Validar que o produto pertence ao tenant
    const { data: product, error: prodErr } = await supabase
      .from("retail_products")
      .select("id")
      .eq("id", productId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (prodErr || !product) {
      throw new NotFoundError("Produto não encontrado nesta empresa.");
    }

    // 3. Montar caminho seguro no Storage: retail/{tenant_id}/products/{product_id}/{random_uuid}.ext
    const extension = file.fileName.split(".").pop()?.toLowerCase() || "jpg";
    const safeStoragePath = `retail/${context.tenantId}/products/${productId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("retail-media")
      .upload(safeStoragePath, file.buffer, {
        contentType: file.contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Falha no upload para o storage: ${uploadError.message}`);
    }

    // 4. Se esta imagem for a primeira ou marcada como primária, desmarca anteriores
    if (isPrimary) {
      await supabase
        .from("retail_product_images")
        .update({ is_primary: false })
        .eq("product_id", productId)
        .eq("tenant_id", context.tenantId);
    } else {
      // Se for a primeira imagem do produto, torna-a primária automaticamente
      const { count } = await supabase
        .from("retail_product_images")
        .select("*", { count: "exact", head: true })
        .eq("product_id", productId);

      if ((count || 0) === 0) {
        isPrimary = true;
      }
    }

    // 5. Inserir registro no banco
    const { data: imgRow, error: insertError } = await supabase
      .from("retail_product_images")
      .insert({
        tenant_id: context.tenantId,
        product_id: productId,
        storage_path: safeStoragePath,
        alt_text: altText || null,
        is_primary: isPrimary,
        variant_id: variantId || null,
        sort_order: 0,
      })
      .select()
      .single();

    if (insertError || !imgRow) {
      // Se falhar o insert no banco, remove o arquivo do storage para não deixar órfão
      await supabase.storage.from("retail-media").remove([safeStoragePath]);
      throw new Error(`Erro ao registrar imagem: ${insertError?.message}`);
    }

    return RetailProductService.mapImageRow(supabase, imgRow);
  }

  /**
   * Remove uma imagem do produto e do storage.
   */
  public static async deleteProductImage(
    supabase: AppSupabaseClient,
    context: TenantContext,
    imageId: string
  ): Promise<void> {
    RetailPermissionService.assertPermission(context.role, "manage_products");

    const { data: imgRow, error: findError } = await supabase
      .from("retail_product_images")
      .select("*")
      .eq("id", imageId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (findError || !imgRow) {
      throw new NotFoundError("Imagem não encontrada.");
    }

    // Exclui do banco
    const { error: delDbError } = await supabase
      .from("retail_product_images")
      .delete()
      .eq("id", imageId)
      .eq("tenant_id", context.tenantId);

    if (delDbError) {
      throw new Error(`Erro ao remover imagem: ${delDbError.message}`);
    }

    // Exclui do Storage
    await supabase.storage.from("retail-media").remove([imgRow.storage_path]);
  }

  /**
   * Define uma imagem como imagem principal do produto.
   */
  public static async setPrimaryImage(
    supabase: AppSupabaseClient,
    context: TenantContext,
    imageId: string
  ): Promise<void> {
    RetailPermissionService.assertPermission(context.role, "manage_products");

    const { data: targetImg, error: findError } = await supabase
      .from("retail_product_images")
      .select("*")
      .eq("id", imageId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (findError || !targetImg) {
      throw new NotFoundError("Imagem não encontrada.");
    }

    // Desmarca anteriores
    await supabase
      .from("retail_product_images")
      .update({ is_primary: false })
      .eq("product_id", targetImg.product_id)
      .eq("tenant_id", context.tenantId);

    // Marca esta como primária
    await supabase
      .from("retail_product_images")
      .update({ is_primary: true })
      .eq("id", imageId)
      .eq("tenant_id", context.tenantId);
  }
}

