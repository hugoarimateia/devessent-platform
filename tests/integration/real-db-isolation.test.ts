import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/core/errors/app-error";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("Real Database Integration Suite — PostgreSQL & Supabase Local", () => {
  let adminClient: SupabaseClient<Database>;
  const testTenantSlug = `test-homolog-${Date.now()}`;
  let createdTenantId: string | null = null;
  let testAdminUserId: string | null = null;

  beforeAll(async () => {
    adminClient = createAdminClient();

    // Criar usuário administrativo legítimo via auth.admin para satisfazer foreign keys
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email: `admin.homolog.${Date.now()}@devessent.test`,
      password: "TestPassword123!Safe",
      email_confirm: true,
      user_metadata: {
        full_name: "Admin Homologador Real",
      },
    });

    if (authErr || !authUser.user) {
      throw new Error(`Falha ao provisionar usuário de teste: ${authErr?.message}`);
    }

    testAdminUserId = authUser.user.id;

    // Conceder papel em platform_admins
    await adminClient.from("platform_admins").insert({
      user_id: testAdminUserId,
    });
  });

  afterAll(async () => {
    if (createdTenantId) {
      await adminClient.from("tenants").delete().eq("id", createdTenantId);
    }
    if (testAdminUserId) {
      await adminClient.auth.admin.deleteUser(testAdminUserId);
    }
  });

  it("1. Deve confirmar a integridade e conectividade com as 6 tabelas no PostgreSQL real", async () => {
    const tables = [
      "profiles",
      "tenants",
      "tenant_memberships",
      "tenant_settings",
      "platform_admins",
      "audit_logs",
    ] as const;

    for (const table of tables) {
      const { error } = await adminClient.from(table).select("*", { count: "exact", head: true });
      expect(error).toBeNull();
    }
  });

  it("2. Deve persistir um novo estabelecimento com criação atômica de settings e audit_log", async () => {
    const newTenant = await TenantService.createTenantWithAdmin(adminClient, testAdminUserId!, {
      name: "Empresa Homologação Real",
      slug: testTenantSlug,
      ownerEmail: "owner.real@homolog.test",
      ownerFullName: "Proprietário Homolog Real",
    });

    expect(newTenant).toBeDefined();
    expect(newTenant.slug).toBe(testTenantSlug);
    expect(newTenant.status).toBe("active");
    createdTenantId = newTenant.id;

    // Verificar se tenant_settings foi criado no banco real
    const { data: settings, error: settingsErr } = await adminClient
      .from("tenant_settings")
      .select("*")
      .eq("tenant_id", newTenant.id)
      .single();

    expect(settingsErr).toBeNull();
    expect(settings).not.toBeNull();
    expect(settings!.display_name).toBe("Empresa Homologação Real");
    expect(settings!.contact_email).toBe("owner.real@homolog.test");
    expect(settings!.timezone).toBe("America/Sao_Paulo");
    expect(settings!.locale).toBe("pt-BR");

    // Verificar se audit_logs registrou o evento no banco real
    const { data: audit, error: auditErr } = await adminClient
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", newTenant.id)
      .eq("action", "tenant.created")
      .single();

    expect(auditErr).toBeNull();
    expect(audit).not.toBeNull();
    expect(audit!.resource_type).toBe("tenant");
  });

  it("3. Deve rejeitar a criação de estabelecimento com slug duplicado no PostgreSQL real", async () => {
    await expect(
      TenantService.createTenantWithAdmin(adminClient, testAdminUserId!, {
        name: "Empresa Slug Duplicado",
        slug: testTenantSlug,
        ownerEmail: "outro@teste.test",
        ownerFullName: "Outro Nome",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("4. Deve bloquear resolução de contexto para usuário sem vínculo na empresa", async () => {
    const unlinkedUserId = "00000000-0000-0000-0000-000000000088";

    await expect(
      TenantService.resolveTenantContext(adminClient, unlinkedUserId, testTenantSlug)
    ).rejects.toThrow(ForbiddenError);
  });

  it("5. Deve disparar NotFoundError para empresa inexistente no banco real", async () => {
    await expect(
      TenantService.resolveTenantContext(adminClient, testAdminUserId!, "empresa-que-nao-existe-999")
    ).rejects.toThrow(NotFoundError);
  });
});

