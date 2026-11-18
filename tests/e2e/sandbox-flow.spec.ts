import { test, expect } from "@playwright/test";
import { resolveSandboxPassword } from "../../sandbox-data/fixtures/users";

test.describe("E2E Suite — Sandbox Multi-Tenant & Demonstration Accounts", () => {
  test.beforeEach(async ({ context }) => {
    // Limpeza de cookies para garantir isolamento absoluto entre cenários
    await context.clearCookies();
  });

  test("1. Proprietário do Ateliê Sandbox autentica e acessa contexto empresarial ativo", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail Corporativo").fill("owner.atelie@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("owner.atelie@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Ateliê Sandbox" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/Papel:\s*Proprietário/i)).toBeVisible();
    await expect(page.getByText("Sessão Ativa e Segura")).toHaveCount(0);

    // Links de navegação de membros e configurações visíveis para o proprietário
    await expect(page.getByRole("link", { name: "Membros", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Configurações", exact: true })).toBeVisible();
  });

  test("2. Usuário com múltiplos vínculos realiza alternância entre estabelecimentos", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail Corporativo").fill("multi.member@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("multi.member@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(page.getByRole("heading", { name: /Sandbox/i }).first()).toBeVisible({
      timeout: 15000,
    });

    // Seletor de tenant deve estar presente no cabeçalho
    const selectorButton = page
      .locator("header")
      .locator("button")
      .filter({ hasText: /Sandbox/i })
      .first();
    await expect(selectorButton).toBeVisible();

    // Clicar para abrir opções de alternância
    await selectorButton.click();

    // Deve listar as empresas disponíveis
    const verdeOption = page.locator("header button").filter({ hasText: "Verde Sandbox" });
    const atelieOption = page.locator("header button").filter({ hasText: "Ateliê Sandbox" });

    // Alternar para o outro estabelecimento
    if (await verdeOption.isVisible()) {
      await verdeOption.click();
      await expect(page.getByRole("heading", { name: "Verde Sandbox" })).toBeVisible({
        timeout: 20000,
      });
    } else if (await atelieOption.isVisible()) {
      await atelieOption.click();
      await expect(page.getByRole("heading", { name: "Ateliê Sandbox" })).toBeVisible({
        timeout: 20000,
      });
    }
  });

  test("3. Usuário sem vínculos corporativos visualiza estado de onboarding de forma amigável", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail Corporativo").fill("solo.user@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("solo.user@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(page.getByText("Nenhum Estabelecimento Vinculado")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText(/Sua conta ainda não está associada a nenhuma empresa na plataforma/i)
    ).toBeVisible();
    await expect(page.getByText("Sessão Ativa e Segura")).toHaveCount(0);
    await expect(page.getByText("Membro de Estabelecimento")).toHaveCount(0);
  });

  test("4. Administrador Geral acessa /admin e audita todas as empresas do sandbox", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail Corporativo").fill("admin.global@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("admin.global@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(page.getByText("Administrador Global DevEssent")).toBeVisible({ timeout: 15000 });

    // Navegar para o painel restrito de administração global
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Painel Central de Gestão SaaS" })).toBeVisible({
      timeout: 25000,
    });
    await expect(page.getByRole("cell", { name: "atelier-sandbox", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "verde-sandbox", exact: true })).toBeVisible();
  });
});
