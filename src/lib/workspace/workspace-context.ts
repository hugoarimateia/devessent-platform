import { cache } from "react";
import { cookies } from "next/headers";
import type {
  Database,
  MembershipRole,
  TenantStatus,
} from "@/types/database.types";
import type { SessionUser } from "@/core/auth/types/auth.types";
import { AuthService } from "@/core/auth/services/auth-service";
import {
  TenantService,
  type TenantContext,
  type UserTenantSummary,
} from "@/core/tenants/services/tenant-service";
import { TenantSuspendedError } from "@/core/errors/app-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getActiveTenantCookieName,
  isXamppTestMode,
} from "@/lib/environment/backend-mode";
import type {
  RetailStore,
  RetailStoreRow,
  StorefrontTemplate,
} from "@/modules/retail/types/retail.types";
import { RetailStoreService } from "@/modules/retail/services/retail-store-service";
import { logPerfSpan, perfNow } from "@/lib/perf/perf-trace";

export type TenantSettingsRow =
  Database["public"]["Tables"]["tenant_settings"]["Row"];

export interface ResolvedWorkspaceSession {
  sessionUser: SessionUser | null;
  userTenants: UserTenantSummary[];
  selectedTenant: UserTenantSummary | null;
  activeContext: TenantContext | null;
  activeTenantSettings: TenantSettingsRow | null;
  activeRetailStore: RetailStore | null;
  isSuspended: boolean;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRetailStoreRow(row: RetailStoreRow): RetailStore {
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

function unwrapSingleRelation<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return raw as T;
}

/**
 * Lê o cookie de tenant ativo localmente (0 ms, sem rede).
 * Se for um UUID válido, pode ser usado como hint seguro para paralelizar
 * consultas RLS-enforced junto com o bootstrap do workspace.
 */
export async function getActiveTenantHintUuid(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(getActiveTenantCookieName())?.value?.trim();
    if (raw && UUID_REGEX.test(raw)) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Constrói um TenantContext especulativo APENAS para pré-busca paralela via
 * cliente Supabase autenticado do usuário (com RLS + FORCE RLS ativos no Postgres).
 * NUNCA deve ser usado em modo XAMPP (sem RLS) e seu resultado NUNCA deve ser
 * utilizado antes de confirmar `workspace.activeContext.tenantId === hintTenantId`
 * e validar explicitamente as permissões RBAC reais do usuário.
 */
export function buildSpeculativeRlsTenantContext(
  tenantId: string
): TenantContext {
  return {
    tenantId,
    tenantName: "",
    slug: "",
    status: "active",
    role: "owner",
    userId: "",
  };
}

/**
 * Memoiza `AuthService.getSessionUser` por requisição para evitar consultas
 * duplicadas entre `admin/layout.tsx` e páginas filhas `/admin/**`.
 */
export const resolveSessionUserCached = cache(
  async (): Promise<SessionUser | null> => {
    const supabase = await createClient();
    return AuthService.getSessionUser(supabase);
  }
);

/**
 * Bootstrap consolidado de sessão + tenants + contexto ativo + configurações + loja Retail.
 *
 * Em modo Supabase oficial:
 * - Reutiliza a verificação autoritativa do Middleware via ponte HMAC-SHA256 (0 RTT extra).
 * - Executa `profiles`, `platform_admins` e `tenant_memberships(tenants(tenant_settings, retail_stores))`
 *   em 1 ÚNICO roundtrip paralelo protegido por RLS + FORCE RLS.
 * - Elimina os 5–6 roundtrips sequenciais anteriores (`getUser` duplicado, `listUserTenants`,
 *   `resolveTenantContext` re-consultando `platform_admins`/`tenants`/`tenant_memberships`, e `getStore`).
 *
 * Memoizado por requisição via `React.cache`.
 */
export const resolveWorkspaceSession = cache(
  async (): Promise<ResolvedWorkspaceSession> => {
    const tTotal = perfNow();
    const supabase = await createClient();
    const cookieStore = await cookies();
    const activeTenantCookie = cookieStore.get(
      getActiveTenantCookieName()
    )?.value;

    // Modo secundário XAMPP local: mantém adaptadores MariaDB isolados sem chamar Supabase
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const sessionUser = await AuthService.getSessionUser(supabase);
      if (!sessionUser) {
        return {
          sessionUser: null,
          userTenants: [],
          selectedTenant: null,
          activeContext: null,
          activeTenantSettings: null,
          activeRetailStore: null,
          isSuspended: false,
        };
      }

      const userTenants = await TenantService.listUserTenants(
        supabase,
        sessionUser.id
      );
      let selectedTenant = userTenants.find(
        (t) =>
          t.tenantId === activeTenantCookie || t.slug === activeTenantCookie
      );
      if (!selectedTenant && userTenants.length > 0) {
        selectedTenant = userTenants[0];
      }

      if (!selectedTenant) {
        return {
          sessionUser,
          userTenants,
          selectedTenant: null,
          activeContext: null,
          activeTenantSettings: null,
          activeRetailStore: null,
          isSuspended: false,
        };
      }

      try {
        const activeContext = await TenantService.resolveTenantContext(
          supabase,
          sessionUser.id,
          selectedTenant.tenantId
        );
        const [activeTenantSettings, activeRetailStore] = await Promise.all([
          TenantService.getSettings(supabase, activeContext).catch(() => null),
          RetailStoreService.getStore(supabase, activeContext.tenantId).catch(
            () => null
          ),
        ]);
        return {
          sessionUser,
          userTenants,
          selectedTenant,
          activeContext,
          activeTenantSettings,
          activeRetailStore,
          isSuspended: false,
        };
      } catch (err: unknown) {
        if (err instanceof TenantSuspendedError) {
          return {
            sessionUser,
            userTenants,
            selectedTenant,
            activeContext: null,
            activeTenantSettings: null,
            activeRetailStore: null,
            isSuspended: true,
          };
        }
        throw err;
      }
    }

    // Modo Oficial Supabase Cloud / Local
    const authUser = await AuthService.resolveVerifiedAuthUser(supabase);
    if (!authUser) {
      return {
        sessionUser: null,
        userTenants: [],
        selectedTenant: null,
        activeContext: null,
        activeTenantSettings: null,
        activeRetailStore: null,
        isSuspended: false,
      };
    }

    const tDb = perfNow();
    interface ProfileQueryRow {
      full_name: string | null;
      avatar_path: string | null;
      created_at: string | null;
    }
    interface MembershipQueryRow {
      tenant_id: string;
      role: MembershipRole;
      tenants: unknown;
    }

    const [profileRes, adminRes, membershipsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, avatar_path, created_at")
        .eq("id", authUser.id)
        .maybeSingle<ProfileQueryRow>(),
      supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", authUser.id)
        .maybeSingle<{ user_id: string }>(),
      supabase
        .from("tenant_memberships")
        .select(
          "tenant_id, role, tenants(id, name, slug, status, tenant_settings(tenant_id, display_name, contact_email, contact_phone, timezone, locale, segment_label, primary_color, monogram, brand_description, created_at, updated_at), retail_stores(*))"
        )
        .eq("user_id", authUser.id)
        .returns<MembershipQueryRow[]>(),
    ]);
    logPerfSpan("workspace", "singleRttBootstrap", perfNow() - tDb);

    const profile = profileRes.data;
    const isPlatformAdmin = Boolean(adminRes.data);

    const sessionUser: SessionUser = {
      id: authUser.id,
      email: authUser.email,
      fullName:
        typeof profile?.full_name === "string"
          ? profile.full_name
          : authUser.fullName || "Usuário",
      avatarPath:
        typeof profile?.avatar_path === "string" ? profile.avatar_path : null,
      createdAt:
        typeof profile?.created_at === "string"
          ? profile.created_at
          : authUser.createdAt,
      isPlatformAdmin,
    };

    interface EmbeddedTenantRow {
      id: string;
      name: string;
      slug: string;
      status: TenantStatus;
      tenant_settings?: unknown;
      retail_stores?: unknown;
    }

    let rawMemberships: MembershipQueryRow[] =
      !membershipsRes.error && membershipsRes.data ? membershipsRes.data : [];

    // Fallback administrativo somente quando RLS ocultou vínculos de empresa suspensa
    if (rawMemberships.length === 0) {
      try {
        const admin = createAdminClient();
        const { data: fallbackMemberships } = await admin
          .from("tenant_memberships")
          .select(
            "tenant_id, role, tenants(id, name, slug, status, tenant_settings(tenant_id, display_name, contact_email, contact_phone, timezone, locale, segment_label, primary_color, monogram, brand_description, created_at, updated_at), retail_stores(*))"
          )
          .eq("user_id", authUser.id);
        if (fallbackMemberships && fallbackMemberships.length > 0) {
          rawMemberships = fallbackMemberships as unknown as MembershipQueryRow[];
        }
      } catch {
        // segue gracioso
      }
    }

    const settingsByTenant = new Map<string, TenantSettingsRow>();
    const storeByTenant = new Map<string, RetailStore>();

    const userTenants: UserTenantSummary[] = rawMemberships
      .filter((item) => Boolean(item.tenants))
      .map((item) => {
        const t = item.tenants as unknown as EmbeddedTenantRow;
        const s = unwrapSingleRelation<TenantSettingsRow>(t.tenant_settings);
        const rs = unwrapSingleRelation<RetailStoreRow>(t.retail_stores);

        if (s) {
          settingsByTenant.set(item.tenant_id, s);
        }
        if (rs) {
          storeByTenant.set(item.tenant_id, mapRetailStoreRow(rs));
        }

        return {
          tenantId: item.tenant_id,
          name: t.name || "Estabelecimento",
          slug: t.slug || "",
          status: t.status || "active",
          role: item.role as MembershipRole,
          displayName: s?.display_name ?? null,
          segmentLabel: s?.segment_label ?? null,
          primaryColor: s?.primary_color ?? null,
          monogram: s?.monogram ?? null,
          brandDescription: s?.brand_description ?? null,
        };
      });

    let selectedTenant =
      userTenants.find(
        (t) =>
          t.tenantId === activeTenantCookie || t.slug === activeTenantCookie
      ) || null;

    if (!selectedTenant && userTenants.length > 0) {
      selectedTenant = userTenants[0];
    }

    if (!selectedTenant) {
      logPerfSpan("workspace", "totalResolve", perfNow() - tTotal, {
        hasTenant: false,
      });
      return {
        sessionUser,
        userTenants,
        selectedTenant: null,
        activeContext: null,
        activeTenantSettings: null,
        activeRetailStore: null,
        isSuspended: false,
      };
    }

    if (selectedTenant.status === "suspended" && !isPlatformAdmin) {
      logPerfSpan("workspace", "totalResolve", perfNow() - tTotal, {
        suspended: true,
      });
      return {
        sessionUser,
        userTenants,
        selectedTenant,
        activeContext: null,
        activeTenantSettings:
          settingsByTenant.get(selectedTenant.tenantId) ?? null,
        activeRetailStore: storeByTenant.get(selectedTenant.tenantId) ?? null,
        isSuspended: true,
      };
    }

    const activeContext: TenantContext = {
      tenantId: selectedTenant.tenantId,
      tenantName: selectedTenant.name,
      slug: selectedTenant.slug,
      status: selectedTenant.status,
      role: isPlatformAdmin ? "platform_admin" : selectedTenant.role,
      userId: sessionUser.id,
    };

    logPerfSpan("workspace", "totalResolve", perfNow() - tTotal, {
      hasStore: storeByTenant.has(selectedTenant.tenantId),
    });

    return {
      sessionUser,
      userTenants,
      selectedTenant,
      activeContext,
      activeTenantSettings:
        settingsByTenant.get(selectedTenant.tenantId) ?? null,
      activeRetailStore: storeByTenant.get(selectedTenant.tenantId) ?? null,
      isSuspended: false,
    };
  }
);
