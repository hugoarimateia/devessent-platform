import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TenantContext } from "@/core/tenants/services/tenant-service";
import { RetailPermissionService } from "../permissions/retail-permissions";
import {
  STOREFRONT_DESIGN_FIELD_KEYS,
  updateRetailOperationalSettingsSchema,
  updateRetailStoreSchema,
  type UpdateRetailOperationalSettingsInput,
  type UpdateRetailStoreInput,
} from "../schemas/store.schema";
import {
  storefrontSettingsSchema,
  type StorefrontSettingsInput,
} from "../schemas/storefront.schema";
import type { RetailStore, RetailStoreRow, StorefrontTemplate } from "../types/retail.types";
import { AuditService } from "@/core/audit/services/audit-service";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

export interface AdminRetailStoreOverview extends RetailStore {
  tenantName: string;
  tenantSlug: string;
  tenantStatus: "active" | "suspended";
}

export class RetailStoreService {
  private static mapStoreRow(row: RetailStoreRow): RetailStore {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      storeName: row.store_name,
      slug: row.slug || "",
      currency: row.currency,
      template: (row.template as StorefrontTemplate) || "editorial",
      brandHeadline: row.brand_headline,
      brandSubheadline: row.brand_subheadline,
      aboutText: row.about_text,
      heroBadge: row.hero_badge,
      heroImagePath: row.hero_image_path,
      accentColor: row.accent_color,
      secondaryColor: row.secondary_color,
      announcementBar: row.announcement_bar,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      socialLinks: (row.social_links as Record<string, string>) || {},
      isActive: row.is_active,
      inventoryMode: row.inventory_mode as "track_quantity" | "untracked",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Obtém as configurações comerciais do Retail para o estabelecimento.
   */
  public static async getStore(
    supabase: AppSupabaseClient,
    tenantId: string
  ): Promise<RetailStore | null> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.getStore(tenantId);
    }

    const { data, error } = await supabase
      .from("retail_stores")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error || !data) return null;

    return this.mapStoreRow(data);
  }

  /**
   * Lista todas as lojas Retail para governança técnica da equipe DevEssent (`platform_admin`).
   */
  public static async listAllStoresForAdmin(
    supabase: AppSupabaseClient,
    actorRole: string
  ): Promise<AdminRetailStoreOverview[]> {
    RetailPermissionService.assertPermission(
      actorRole as TenantContext["role"],
      "manage_storefront_design"
    );

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.listAllStoresForAdmin();
    }

    const { data, error } = await supabase
      .from("retail_stores")
      .select("*, tenants!inner(name, slug, status)")
      .order("updated_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => {
      const joined = row as RetailStoreRow & {
        tenants: { name: string; slug: string; status: "active" | "suspended" };
      };
      return {
        ...this.mapStoreRow(joined),
        tenantName: joined.tenants.name,
        tenantSlug: joined.tenants.slug,
        tenantStatus: joined.tenants.status,
      };
    });
  }

  /**
   * Garante a existência do registro da loja Retail para a empresa.
   */
  public static async ensureStore(
    supabase: AppSupabaseClient,
    tenantId: string,
    defaultStoreName: string
  ): Promise<RetailStore> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.ensureStore(tenantId, defaultStoreName);
    }

    const existing = await this.getStore(supabase, tenantId);
    if (existing) return existing;

    const { data, error } = await supabase
      .from("retail_stores")
      .insert({
        tenant_id: tenantId,
        store_name: defaultStoreName || "Loja Comercial",
        currency: "BRL",
        is_active: true,
        inventory_mode: "track_quantity",
        template: "editorial",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Falha ao inicializar loja Retail: ${error?.message}`);
    }

    return this.mapStoreRow(data);
  }

  /**
   * Atualiza exclusivamente os parâmetros operacionais e contatos comerciais da loja.
   * Permitido para `owner`, `manager` e `platform_admin`. Preserva intactos os campos de design da vitrine.
   */
  public static async updateOperationalSettings(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: UpdateRetailOperationalSettingsInput
  ): Promise<RetailStore> {
    RetailPermissionService.assertPermission(context.role, "manage_retail_settings");

    const validated = updateRetailOperationalSettingsSchema.parse(input);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.updateOperationalSettings(context, validated);
    }

    await this.ensureStore(supabase, context.tenantId, validated.storeName);

    const { data, error } = await supabase
      .from("retail_stores")
      .update({
        store_name: validated.storeName,
        currency: validated.currency,
        is_active: validated.isActive,
        inventory_mode: validated.inventoryMode,
        contact_email: validated.contactEmail ?? null,
        contact_phone: validated.contactPhone ?? null,
        social_links: validated.socialLinks ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao atualizar configurações operacionais da loja: ${error?.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.store_updated",
      resourceType: "retail_store",
      resourceId: data.id,
      metadata: {
        storeName: data.store_name,
        currency: data.currency,
        isActive: data.is_active,
        inventoryMode: data.inventory_mode,
      },
    });

    return this.mapStoreRow(data);
  }

  /**
   * Atualiza a arquitetura visual, template e elementos estruturais do site público.
   * Operação estritamente reservada à equipe DevEssent (`platform_admin`).
   */
  public static async updateStorefrontDesign(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: Partial<StorefrontSettingsInput>
  ): Promise<RetailStore> {
    RetailPermissionService.assertPermission(context.role, "manage_storefront_design");

    const validated = storefrontSettingsSchema.parse(input);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.updateStorefrontDesign(context, validated);
    }

    await this.ensureStore(supabase, context.tenantId, context.tenantName);

    const { data, error } = await supabase
      .from("retail_stores")
      .update({
        template: validated.template,
        brand_headline: validated.brandHeadline ?? null,
        brand_subheadline: validated.brandSubheadline ?? null,
        about_text: validated.aboutText ?? null,
        hero_badge: validated.heroBadge ?? null,
        accent_color: validated.accentColor ?? null,
        secondary_color: validated.secondaryColor ?? null,
        announcement_bar: validated.announcementBar ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao atualizar arquitetura visual da vitrine: ${error?.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.storefront_design_updated",
      resourceType: "retail_store",
      resourceId: data.id,
      metadata: {
        template: data.template,
        accentColor: data.accent_color,
      },
    });

    return this.mapStoreRow(data);
  }

  /**
   * Atualiza as configurações da loja Retail.
   * Campos visuais e estruturais da vitrine exigem explicitamente `manage_storefront_design` (`platform_admin`).
   */
  public static async updateStore(
    supabase: AppSupabaseClient,
    context: TenantContext,
    input: UpdateRetailStoreInput
  ): Promise<RetailStore> {
    RetailPermissionService.assertPermission(context.role, "manage_retail_settings");

    const hasDesignFields = STOREFRONT_DESIGN_FIELD_KEYS.some(
      (key) => input[key] !== undefined
    );

    if (hasDesignFields) {
      RetailPermissionService.assertPermission(context.role, "manage_storefront_design");
    } else {
      return this.updateOperationalSettings(supabase, context, input);
    }

    const validated = updateRetailStoreSchema.parse(input);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppRetailAdapter } = await import("@/infrastructure/xampp-test/retail-adapter");
      return XamppRetailAdapter.updateStore(context, validated);
    }

    const { data, error } = await supabase
      .from("retail_stores")
      .upsert(
        {
          tenant_id: context.tenantId,
          store_name: validated.storeName,
          currency: validated.currency,
          is_active: validated.isActive,
          inventory_mode: validated.inventoryMode,
          template: validated.template,
          brand_headline: validated.brandHeadline ?? null,
          brand_subheadline: validated.brandSubheadline ?? null,
          about_text: validated.aboutText ?? null,
          hero_badge: validated.heroBadge ?? null,
          accent_color: validated.accentColor ?? null,
          secondary_color: validated.secondaryColor ?? null,
          announcement_bar: validated.announcementBar ?? null,
          contact_email: validated.contactEmail ?? null,
          contact_phone: validated.contactPhone ?? null,
          social_links: validated.socialLinks ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      )
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao atualizar configurações comerciais: ${error?.message}`);
    }

    await AuditService.recordEvent({
      supabase,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: "retail.storefront_design_updated",
      resourceType: "retail_store",
      resourceId: data.id,
      metadata: {
        storeName: data.store_name,
        template: data.template,
      },
    });

    return this.mapStoreRow(data);
  }

  /**
   * Verifica se o Retail está ativado e operacional para o estabelecimento.
   */
  public static async isRetailActive(
    supabase: AppSupabaseClient,
    tenantId: string
  ): Promise<boolean> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const store = await this.getStore(supabase, tenantId);
      return Boolean(store?.isActive);
    }

    const { data } = await supabase.rpc("is_retail_active", {
      p_tenant_id: tenantId,
    });
    return Boolean(data);
  }
}
