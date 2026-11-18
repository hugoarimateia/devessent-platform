import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import { RetailPermissionService } from "../permissions/retail-permissions";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "../schemas/category.schema";
import { ProductInvariants } from "../domain/product-invariants";
import type { RetailCategory } from "../types/retail.types";
import { AuditService } from "@/core/audit/services/audit-service";
import { NotFoundError, ValidationError } from "@/core/errors/app-error";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

export class RetailCategoryService {
  /**
   * Lista categorias do estabelecimento com contagem de produtos vinculados.
   */
  public static async listCategories(
    supabase: AppSupabaseClient,
    tenantId: string,
    includeInactive = false
  ): Promise<RetailCategory[]> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.listCategories(tenantId, !includeInactive);
    }

    let query = supabase
      .from("retail_categories")
      .select("*, retail_product_categories(count)")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao listar categorias: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      productCount: (row as { retail_product_categories?: Array<{ count: number }> }).retail_product_categories?.[0]?.count || 0,
    }));
  }

  /**
   * Busca uma categoria por ID garantindo escopo do tenant.
   */
  public static async getCategoryById(
    supabase: AppSupabaseClient,
    tenantId: string,
    categoryId: string
  ): Promise<RetailCategory> {
    const { data, error } = await supabase
      .from("retail_categories")
      .select("*")
      .eq("id", categoryId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundError("Categoria não encontrada.");
    }

    return {
      id: data.id,
      tenantId: data.tenant_id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Cria nova categoria com validação e auditoria.
   */
  public static async createCategory(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: CreateCategoryInput
  ): Promise<RetailCategory> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      const validated = createCategorySchema.parse(input);
      return XamppRetailAdapter.createCategory(context, validated);
    }

    RetailPermissionService.assertPermission(context.role, "manage_categories");

    const validated = createCategorySchema.parse(input);
    const slug = validated.slug || ProductInvariants.slugify(validated.name);

    if (!slug) {
      throw new ValidationError("Não foi possível gerar um slug válido a partir do nome.");
    }

    const { data, error } = await supabase
      .from("retail_categories")
      .insert({
        tenant_id: context.tenantId,
        name: validated.name,
        slug,
        description: validated.description || null,
        sort_order: validated.sortOrder,
        is_active: validated.isActive,
      })
      .select()
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        throw new ValidationError("Já existe uma categoria cadastrada com este slug nesta empresa.");
      }
      throw new Error(`Erro ao cadastrar categoria: ${error?.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.category_created",
      resourceType: "retail_category",
      resourceId: data.id,
      metadata: {
        name: data.name,
        slug: data.slug,
      },
    });

    return {
      id: data.id,
      tenantId: data.tenant_id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      productCount: 0,
    };
  }

  /**
   * Atualiza uma categoria existente com validação e auditoria.
   */
  public static async updateCategory(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: UpdateCategoryInput
  ): Promise<RetailCategory> {
    RetailPermissionService.assertPermission(context.role, "manage_categories");

    const validated = updateCategorySchema.parse(input);
    const existing = await this.getCategoryById(supabase, context.tenantId, validated.id);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validated.name !== undefined) updatePayload.name = validated.name;
    if (validated.slug !== undefined) updatePayload.slug = validated.slug;
    if (validated.description !== undefined) updatePayload.description = validated.description;
    if (validated.sortOrder !== undefined) updatePayload.sort_order = validated.sortOrder;
    if (validated.isActive !== undefined) updatePayload.is_active = validated.isActive;

    const { data, error } = await supabase
      .from("retail_categories")
      .update(updatePayload)
      .eq("id", existing.id)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        throw new ValidationError("Já existe uma categoria com este slug nesta empresa.");
      }
      throw new Error(`Erro ao atualizar categoria: ${error?.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.category_updated",
      resourceType: "retail_category",
      resourceId: data.id,
      metadata: {
        name: data.name,
        slug: data.slug,
        changes: updatePayload,
      },
    });

    return {
      id: data.id,
      tenantId: data.tenant_id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Exclui uma categoria da empresa.
   */
  public static async deleteCategory(
    supabase: AppSupabaseClient,
    context: TenantContext,
    categoryId: string
  ): Promise<void> {
    RetailPermissionService.assertPermission(context.role, "manage_categories");

    const existing = await this.getCategoryById(supabase, context.tenantId, categoryId);

    const { error } = await supabase
      .from("retail_categories")
      .delete()
      .eq("id", existing.id)
      .eq("tenant_id", context.tenantId);

    if (error) {
      throw new Error(`Erro ao excluir categoria: ${error.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.category_deleted",
      resourceType: "retail_category",
      resourceId: existing.id,
      metadata: {
        name: existing.name,
        slug: existing.slug,
      },
    });
  }
}

