import { describe, it, expect, vi } from "vitest";
import { TenantService } from "@/core/tenants/services/tenant-service";
import {
  ForbiddenError,
  NotFoundError,
  TenantSuspendedError,
} from "@/core/errors/app-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

function createMockSupabase(options: {
  isPlatformAdmin?: boolean;
  tenant?: { id: string; name: string; slug: string; status: "active" | "suspended" } | null;
  membership?: { role: "owner" | "manager" | "staff" } | null;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "platform_admins") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: options.isPlatformAdmin ? { user_id: "admin-user-id" } : null,
            error: null,
          }),
        };
      }
      if (table === "tenants") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: options.tenant ?? null,
            error: null,
          }),
        };
      }
      if (table === "tenant_memberships") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: options.membership ?? null,
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("Security Test Suite — Multi-Tenant Isolation & Authorization", () => {
  it("Cenário A: Usuário da Empresa A tenta resolver contexto da Empresa B (sem vínculo)", async () => {
    // Empresa B existe, mas o usuário não tem membership nela
    const mockClient = createMockSupabase({
      isPlatformAdmin: false,
      tenant: {
        id: "tenant-b-id",
        name: "Verde Sandbox",
        slug: "verde-sandbox",
        status: "active",
      },
      membership: null, // Sem vínculo!
    });

    await expect(
      TenantService.resolveTenantContext(mockClient, "user-empresa-a", "verde-sandbox")
    ).rejects.toThrow(ForbiddenError);
  });

  it("Cenário B: Usuário com vínculo legítimo acessa a sua própria empresa", async () => {
    const mockClient = createMockSupabase({
      isPlatformAdmin: false,
      tenant: {
        id: "tenant-a-id",
        name: "Ateliê Sandbox",
        slug: "atelier-sandbox",
        status: "active",
      },
      membership: { role: "owner" },
    });

    const context = await TenantService.resolveTenantContext(
      mockClient,
      "user-empresa-a",
      "atelier-sandbox"
    );

    expect(context.tenantId).toBe("tenant-a-id");
    expect(context.role).toBe("owner");
    expect(context.status).toBe("active");
  });

  it("Cenário C: Platform Admin acessa qualquer empresa com papel de platform_admin", async () => {
    const mockClient = createMockSupabase({
      isPlatformAdmin: true,
      tenant: {
        id: "tenant-b-id",
        name: "Verde Sandbox",
        slug: "verde-sandbox",
        status: "active",
      },
      membership: null,
    });

    const context = await TenantService.resolveTenantContext(
      mockClient,
      "admin-devessent",
      "verde-sandbox"
    );

    expect(context.tenantId).toBe("tenant-b-id");
    expect(context.role).toBe("platform_admin");
  });

  it("Cenário D: Tentativa de resolução de empresa inexistente", async () => {
    const mockClient = createMockSupabase({
      isPlatformAdmin: false,
      tenant: null,
    });

    await expect(
      TenantService.resolveTenantContext(mockClient, "user-id", "empresa-fantasma")
    ).rejects.toThrow(NotFoundError);
  });

  it("Cenário E: Usuário tenta acessar empresa com status suspenso", async () => {
    const mockClient = createMockSupabase({
      isPlatformAdmin: false,
      tenant: {
        id: "tenant-a-id",
        name: "Ateliê Sandbox",
        slug: "atelier-sandbox",
        status: "suspended", // Suspenso!
      },
      membership: { role: "owner" },
    });

    await expect(
      TenantService.resolveTenantContext(mockClient, "user-empresa-a", "atelier-sandbox")
    ).rejects.toThrow(TenantSuspendedError);
  });
});

