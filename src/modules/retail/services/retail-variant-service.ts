import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import { RetailPermissionService } from "../permissions/retail-permissions";
import { adjustStockSchema, type AdjustStockInput } from "../schemas/variant.schema";
import type { RetailVariant } from "../types/retail.types";
import { AuditService } from "@/core/audit/services/audit-service";
import { NotFoundError, ValidationError } from "@/core/errors/app-error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

export class RetailVariantService {
  /**
   * Ajusta manualmente o estoque de uma variante com validação RBAC e auditoria.
   */
  public static async adjustStock(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: AdjustStockInput
  ): Promise<RetailVariant> {
    RetailPermissionService.assertPermission(context.role, "manage_inventory");

    const validated = adjustStockSchema.parse(input);

    const { data: existing, error: findErr } = await supabase
      .from("retail_variants")
      .select("*, retail_products(name)")
      .eq("id", validated.variantId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (findErr || !existing) {
      throw new NotFoundError("Variante não encontrada nesta empresa.");
    }

    const prevStock = existing.stock_quantity;

    const { data, error } = await supabase
      .from("retail_variants")
      .update({
        stock_quantity: validated.newStockQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao atualizar estoque: ${error?.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.stock_adjusted",
      resourceType: "retail_variant",
      resourceId: data.id,
      metadata: {
        sku: data.sku,
        previousStock: prevStock,
        newStock: data.stock_quantity,
      },
    });

    return {
      id: data.id,
      tenantId: data.tenant_id,
      productId: data.product_id,
      sku: data.sku,
      name: data.name,
      priceCents: data.price_cents,
      compareAtPriceCents: data.compare_at_price_cents,
      stockQuantity: data.stock_quantity,
      isAvailable: data.is_available,
      optionsSummary: (data.options_summary as Record<string, string>) || {},
      sortOrder: data.sort_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Altera preço de venda e comparativo de uma variante.
   */
  public static async updatePrice(
    supabase: AppSupabaseClient,
    context: TenantContext,
    variantId: string,
    priceCents: number,
    compareAtPriceCents: number | null = null
  ): Promise<RetailVariant> {
    RetailPermissionService.assertPermission(context.role, "manage_prices");

    if (priceCents < 0) {
      throw new ValidationError("Preço não pode ser negativo.");
    }
    if (compareAtPriceCents !== null && compareAtPriceCents < priceCents) {
      throw new ValidationError("Preço comparativo não pode ser menor que o preço de venda.");
    }

    const { data: existing, error: findErr } = await supabase
      .from("retail_variants")
      .select("*")
      .eq("id", variantId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (findErr || !existing) {
      throw new NotFoundError("Variante não encontrada.");
    }

    const { data, error } = await supabase
      .from("retail_variants")
      .update({
        price_cents: priceCents,
        compare_at_price_cents: compareAtPriceCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", variantId)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao atualizar preço: ${error?.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.price_updated",
      resourceType: "retail_variant",
      resourceId: data.id,
      metadata: {
        sku: data.sku,
        previousPriceCents: existing.price_cents,
        newPriceCents: data.price_cents,
        compareAtPriceCents: data.compare_at_price_cents,
      },
    });

    return {
      id: data.id,
      tenantId: data.tenant_id,
      productId: data.product_id,
      sku: data.sku,
      name: data.name,
      priceCents: data.price_cents,
      compareAtPriceCents: data.compare_at_price_cents,
      stockQuantity: data.stock_quantity,
      isAvailable: data.is_available,
      optionsSummary: (data.options_summary as Record<string, string>) || {},
      sortOrder: data.sort_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

