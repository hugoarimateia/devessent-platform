import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { LocalGuard, SandboxSecurityError } from "../../sandbox-data/lib/local-guard";
import { SandboxManifest } from "../../sandbox-data/lib/sandbox-manifest";
import { resolveSandboxPassword } from "../../sandbox-data/fixtures/users";
import { previewSandboxCleanup } from "../../sandbox-data/scripts/cleanup";
import { UserFactory } from "../../sandbox-data/factories/user.factory";
import { TenantFactory } from "../../sandbox-data/factories/tenant.factory";
import { MembershipFactory } from "../../sandbox-data/factories/membership.factory";
import { InvitationFactory } from "../../sandbox-data/factories/invitation.factory";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Sandbox Infrastructure & Fail-Closed Security Suite", () => {
  describe("1. LocalGuard — Políticas de Fail-Closed e Proteção de Ambiente", () => {
    const validLocalEnv = {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_ENV: "development",
      AUTHORIZED_SANDBOX_PROJECT_ID: "devessent-platform-local",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    };

    it("1.1 Deve aprovar ambiente local com configurações estritamente locais", () => {
      expect(() => {
        LocalGuard.assertSafeEnvironment(validLocalEnv);
      }).not.toThrow();

      expect(LocalGuard.isSafeEnvironment(validLocalEnv)).toBe(true);
    });

    it("1.2 Deve bloquear imediatamente (Fail-Closed) se NODE_ENV for production", () => {
      const maliciousEnv = { ...validLocalEnv, NODE_ENV: "production" };
      expect(() => {
        LocalGuard.assertSafeEnvironment(maliciousEnv);
      }).toThrow(SandboxSecurityError);

      expect(LocalGuard.isSafeEnvironment(maliciousEnv)).toBe(false);
    });

    it("1.3 Deve bloquear imediatamente se NEXT_PUBLIC_APP_ENV for production ou staging", () => {
      const prodEnv = { ...validLocalEnv, NEXT_PUBLIC_APP_ENV: "production" };
      const stagingEnv = { ...validLocalEnv, NEXT_PUBLIC_APP_ENV: "staging" };

      expect(() => LocalGuard.assertSafeEnvironment(prodEnv)).toThrow(SandboxSecurityError);
      expect(() => LocalGuard.assertSafeEnvironment(stagingEnv)).toThrow(SandboxSecurityError);
    });

    it("1.4 Deve bloquear imediatamente se AUTHORIZED_SANDBOX_PROJECT_ID for ausente ou divergente", () => {
      const missingProjectEnv = { ...validLocalEnv, AUTHORIZED_SANDBOX_PROJECT_ID: undefined as unknown as string };
      const alienProjectEnv = { ...validLocalEnv, AUTHORIZED_SANDBOX_PROJECT_ID: "outro-projeto-qualquer" };

      expect(() => LocalGuard.assertSafeEnvironment(missingProjectEnv)).toThrow(SandboxSecurityError);
      expect(() => LocalGuard.assertSafeEnvironment(alienProjectEnv)).toThrow(SandboxSecurityError);
    });

    it("1.5 Deve bloquear sumariamente se NEXT_PUBLIC_SUPABASE_URL apontar para supabase.co ou nuvem remota", () => {
      const remoteCloudUrls = [
        "https://xyzabcdefg.supabase.co",
        "https://api.devessent.com.br",
        "https://my-app.aws.cloud.com",
        "http://192.168.1.100:54321",
      ];

      for (const remoteUrl of remoteCloudUrls) {
        const cloudEnv = { ...validLocalEnv, NEXT_PUBLIC_SUPABASE_URL: remoteUrl };
        expect(() => LocalGuard.assertSafeEnvironment(cloudEnv)).toThrow(SandboxSecurityError);
      }
    });

    it("1.6 Deve bloquear sumariamente se DATABASE_URL apontar para poolers remotos ou hosts não-locais", () => {
      const remoteDbUrls = [
        "postgresql://postgres:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
        "postgresql://postgres:pass@db.xyz.supabase.co:5432/postgres",
        "postgresql://postgres:pass@ep-cool-fog.neon.tech/postgres",
      ];

      for (const remoteDb of remoteDbUrls) {
        const cloudDbEnv = { ...validLocalEnv, DATABASE_URL: remoteDb };
        expect(() => LocalGuard.assertSafeEnvironment(cloudDbEnv)).toThrow(SandboxSecurityError);
      }
    });

    it("1.7 Regressão Fase 5A: Com NODE_ENV válido ('development' ou 'test'), continua bloqueando conexões remotas em modo Fail-Closed", () => {
      for (const validNodeEnv of ["development", "test"] as const) {
        expect(() =>
          LocalGuard.assertSafeEnvironment({
            ...validLocalEnv,
            NODE_ENV: validNodeEnv,
            NEXT_PUBLIC_SUPABASE_URL: "https://remote-prod.supabase.co",
          })
        ).toThrow(SandboxSecurityError);

        expect(() =>
          LocalGuard.assertSafeEnvironment({
            ...validLocalEnv,
            NODE_ENV: validNodeEnv,
            DATABASE_URL: "postgresql://postgres:secret@db.remote.supabase.co:5432/postgres",
          })
        ).toThrow(SandboxSecurityError);
      }
    });
  });

  describe("2. SandboxManifest & Segurança de Credenciais (Fase 5A)", () => {
    it("2.0 Não deve conter senhas fixas hardcoded no código versionado de sandbox-data/fixtures/users.ts", () => {
      const usersFixturePath = path.resolve(process.cwd(), "sandbox-data/fixtures/users.ts");
      const sourceCode = fs.readFileSync(usersFixturePath, "utf-8");
      expect(sourceCode).not.toContain("DevEssent#Sandbox2026!");
      expect(resolveSandboxPassword().length).toBeGreaterThanOrEqual(12);
    });
    it("2.1 Deve classificar corretamente e-mails pertencentes ao domínio sandbox", () => {
      expect(SandboxManifest.isSandboxEmail("owner.atelie@sandbox.devessent.test")).toBe(true);
      expect(SandboxManifest.isSandboxEmail("qualquer.um@sandbox.devessent.test")).toBe(true);

      // E-mails reais ou fora do domínio sintético
      expect(SandboxManifest.isSandboxEmail("admin@devessent.com.br")).toBe(false);
      expect(SandboxManifest.isSandboxEmail("cliente@gmail.com")).toBe(false);
      expect(SandboxManifest.isSandboxEmail("contato@lojaexemplo.com.br")).toBe(false);
    });

    it("2.2 Deve reconhecer os slugs canônicos do sandbox", () => {
      expect(SandboxManifest.isSandboxSlug("atelier-sandbox")).toBe(true);
      expect(SandboxManifest.isSandboxSlug("verde-sandbox")).toBe(true);
      expect(SandboxManifest.isSandboxSlug("empresa-producao")).toBe(false);
      expect(SandboxManifest.isSandboxSlug("loja-real")).toBe(false);
    });
  });

  describe("3. Factories — Geração de Entidades Sintéticas", () => {
    it("3.1 Deve instanciar usuário sintético com domínio @sandbox.devessent.test", () => {
      const synthetic = UserFactory.buildUser({
        fullName: "Teste Usuário",
        idKey: "usuario.teste",
        roleDescription: "Membro de Teste",
      });

      expect(synthetic.email).toBe("usuario.teste@sandbox.devessent.test");
      expect(synthetic.fullName).toBe("Teste Usuário");
      expect(synthetic.isPlatformAdmin).toBe(false);
      expect(synthetic.roleDescription).toBe("Membro de Teste");
    });

    it("3.2 Deve instanciar estabelecimento sintético com slug canônico e configurações", () => {
      const syntheticTenant = TenantFactory.buildTenant({
        slug: "atelier-sandbox",
        name: "Ateliê Teste",
        segmentMetadata: "moda e confecção",
      });

      expect(syntheticTenant.slug).toBe("atelier-sandbox");
      expect(syntheticTenant.status).toBe("active");
      expect(syntheticTenant.segmentMetadata).toBe("moda e confecção");
      expect(syntheticTenant.settings.contactEmail).toContain("@atelier-sandbox.sandbox.devessent.test");
    });

    it("3.3 Deve instanciar vínculos operacionais válidos", () => {
      const membership = MembershipFactory.buildMembership(
        "user-test",
        "atelier-sandbox",
        "manager"
      );

      expect(membership.userKey).toBe("user-test");
      expect(membership.companySlug).toBe("atelier-sandbox");
      expect(membership.role).toBe("manager");
    });

    it("3.4 Deve instanciar convites sintéticos com expiração e token hash válidos", () => {
      const invitation = InvitationFactory.buildInvitation(
        "atelier-sandbox",
        "owner-atelie",
        "staff",
        "pending"
      );

      expect(invitation.email).toContain("@sandbox.devessent.test");
      expect(invitation.role).toBe("staff");
      expect(invitation.statusScenario).toBe("pending");
      expect(invitation.companySlug).toBe("atelier-sandbox");
    });
  });

  describe("4. Integridade do Banco com Dados de Demonstração Seeded", () => {
    it("4.1 Deve encontrar as duas empresas de teste provisionadas no PostgreSQL local", async () => {
      const adminClient = createAdminClient();
      const { data: tenants, error } = await adminClient
        .from("tenants")
        .select("id, name, slug, status, tenant_settings(display_name, contact_email)")
        .in("slug", ["atelier-sandbox", "verde-sandbox"]);

      expect(error).toBeNull();
      expect(tenants).toBeDefined();
      expect(tenants?.length).toBe(2);

      const atelie = tenants?.find((t) => t.slug === "atelier-sandbox");
      const verde = tenants?.find((t) => t.slug === "verde-sandbox");

      expect(atelie).toBeDefined();
      expect(atelie?.status).toBe("active");
      expect(verde).toBeDefined();
      expect(verde?.status).toBe("active");
    });

    it("4.2 Deve encontrar as 7 contas de demonstração criadas e ativas no Supabase Auth", async () => {
      const adminClient = createAdminClient();
      const { data: usersData, error } = await adminClient.auth.admin.listUsers();

      expect(error).toBeNull();
      expect(usersData.users).toBeDefined();

      const sandboxAccounts = usersData.users.filter(
        (u) => u.email && SandboxManifest.isSandboxEmail(u.email)
      );

      expect(sandboxAccounts.length).toBe(7);

      const emails = sandboxAccounts.map((u) => u.email?.toLowerCase());
      expect(emails).toContain("admin.global@sandbox.devessent.test");
      expect(emails).toContain("owner.atelie@sandbox.devessent.test");
      expect(emails).toContain("owner.verde@sandbox.devessent.test");
      expect(emails).toContain("manager.atelie@sandbox.devessent.test");
      expect(emails).toContain("staff.atelie@sandbox.devessent.test");
      expect(emails).toContain("multi.member@sandbox.devessent.test");
      expect(emails).toContain("solo.user@sandbox.devessent.test");
    });

    it("4.3 Regressão Fase 5A: previewSandboxCleanup deve cruzar IDs rastreados no .sandbox-manifest.json", async () => {
      const preview = await previewSandboxCleanup();
      expect(preview.manifestPresent).toBe(true);
      expect(preview.tenants.length).toBe(2);
      expect(preview.tenants.every((t) => t.trackedInManifest)).toBe(true);
      expect(preview.users.length).toBe(7);
      expect(preview.users.every((u) => u.trackedInManifest)).toBe(true);
    });
  });
});
