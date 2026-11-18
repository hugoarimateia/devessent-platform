import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { resolveSandboxPassword } from "../../sandbox-data/fixtures/users";
import { createAdminClient } from "../../src/lib/supabase/admin";

const ARTIFACT_DIR =
  "C:/Users/hugoa/.gemini/antigravity/brain/3c653b81-8bb6-4041-932c-bc5ef43ab6fd";
const DEPOIS_DIR = path.resolve(
  process.cwd(),
  "docs/visual-review/redesign-definitivo/depois"
);

async function saveCapture(page: Page, filename: string) {
  fs.mkdirSync(DEPOIS_DIR, { recursive: true });
  const targetPath = path.join(DEPOIS_DIR, filename);
  await page.screenshot({
    path: targetPath,
    fullPage: false,
  });

  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(targetPath, path.join(ARTIFACT_DIR, `depois-${filename}`));
  }
}

async function setThemeAndVerify(page: Page, target: "light" | "dark") {
  const buttonName = target === "light" ? "Tema Claro" : "Tema Escuro";
  await page.getByRole("button", { name: buttonName }).first().click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", target);
  if (target === "dark") {
    await expect(page.locator("html")).toHaveClass(/dark/);
  } else {
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }
  await page.waitForTimeout(250);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
    );
  });
  expect(overflow).toBe(false);
}

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible({
    timeout: 20000,
  });
  await page.getByLabel("E-mail Corporativo").fill(email);
  await page.getByLabel("Senha de Acesso").fill(resolveSandboxPassword(email));
  await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
  await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
}

test.describe("E2E Suite — Redesign Estrutural Completo: Tipografia, Layout, Temas & Multiempresa", () => {
  test.beforeAll(async () => {
    const admin = createAdminClient();
    const { data: allTenants } = await admin.from("tenants").select("id, slug");
    const ephemeralIds = (allTenants || [])
      .filter(
        (t) => t.slug !== "atelier-sandbox" && t.slug !== "verde-sandbox"
      )
      .map((t) => t.id);

    if (ephemeralIds.length > 0) {
      await admin
        .from("tenant_invitations")
        .delete()
        .in("tenant_id", ephemeralIds);
      await admin
        .from("tenant_settings")
        .delete()
        .in("tenant_id", ephemeralIds);
      await admin.from("audit_logs").delete().in("tenant_id", ephemeralIds);
      await admin
        .from("tenant_memberships")
        .delete()
        .in("tenant_id", ephemeralIds);
      await admin.from("tenants").delete().in("id", ephemeralIds);
    }
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("1. Tela de Login Assimétrica (Desktop 1440px e Mobile 390px) em Light e Dark Mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
    await expect(page.getByText("Ambiente Corporativo")).toHaveCount(0);
    await expect(page.getByText("Acesso à Plataforma")).toHaveCount(0);

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "login-desktop-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "login-desktop-dark.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "login-mobile-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "login-mobile-dark.png");
  });

  test("2. Admin Global & Gestão de Empresas em Light e Dark Mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "admin.global@sandbox.devessent.test");

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Painel Central de Gestão SaaS" })
    ).toBeVisible({ timeout: 20000 });

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "admin-global-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "admin-global-dark.png");

    // Persistência de tema após reload
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.goto("/admin/empresas");
    await expect(
      page.getByRole("heading", { name: "Gestão de Estabelecimentos SaaS" })
    ).toBeVisible({ timeout: 20000 });

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "admin-empresas-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "admin-empresas-dark.png");
  });

  test("3. Multiempresa (Camila Duarte): Verde Sandbox (Gestor) & Ateliê Sandbox (Equipe) + UserMenu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "multi.member@sandbox.devessent.test");
    await expect(page.locator("main h1").first()).toBeVisible({ timeout: 20000 });

    // Selecionar Verde Sandbox como Gestor
    const isVerdeActive = await page
      .getByRole("heading", { name: "Verde Sandbox" })
      .isVisible()
      .catch(() => false);

    if (!isVerdeActive) {
      await page
        .locator("header button")
        .filter({ hasText: /Sandbox/i })
        .first()
        .click();
      await page
        .locator("header button")
        .filter({ hasText: "Verde Sandbox" })
        .click();
    }

    await expect(page.getByRole("heading", { name: "Verde Sandbox" })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText("Botânica & Paisagismo").first()).toBeVisible();
    await expect(page.getByText(/Papel:\s*Gestor/i)).toBeVisible();
    await expect(page.getByText("Convites Abertos")).toBeVisible();

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-multiempresa-light.png");
    await saveCapture(page, "dashboard-verde-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-multiempresa-dark.png");
    await saveCapture(page, "dashboard-verde-dark.png");

    // Alternar para Ateliê Sandbox como Equipe (visão operacional diferenciada)
    await page
      .locator("header button")
      .filter({ hasText: "Verde Sandbox" })
      .first()
      .click();
    await page
      .locator("header button")
      .filter({ hasText: "Ateliê Sandbox" })
      .click();

    await expect(page.getByRole("heading", { name: "Ateliê Sandbox" })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(/Papel:\s*Equipe/i)).toBeVisible();
    await expect(page.getByText("Convites Abertos")).toHaveCount(0);

    // Validar UserMenu dropdown sem botão gigante permanente na barra superior
    const accountTrigger = page.getByRole("button", { name: "Menu da conta" });
    await expect(accountTrigger).toBeVisible();
    await accountTrigger.click();
    await expect(
      page.getByRole("menuitem", { name: /encerrar sessão/i })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("menuitem", { name: /encerrar sessão/i })
    ).toBeHidden();
  });

  test("4. Proprietária (Ateliê Sandbox), Membros, Configurações e Collapse da Sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "owner.atelie@sandbox.devessent.test");

    await expect(page.getByRole("heading", { name: "Ateliê Sandbox" })).toBeVisible();

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-atelie-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-atelie-dark.png");

    // Validar colapsar/expandir sidebar no desktop
    await page.getByRole("button", { name: "Recolher barra lateral" }).click();
    await expect(
      page.getByRole("button", { name: "Expandir barra lateral" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Expandir barra lateral" }).click();

    await page.goto("/dashboard/membros");
    await expect(
      page.getByRole("heading", {
        name: "Membros do Estabelecimento",
        exact: true,
      })
    ).toBeVisible({ timeout: 20000 });

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-membros-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-membros-dark.png");

    await page.goto("/dashboard/configuracoes");
    await expect(
      page.getByRole("heading", { name: "Configurações do Estabelecimento" })
    ).toBeVisible({ timeout: 20000 });

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-configuracoes-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-configuracoes-dark.png");
  });

  test("5. Usuário Sem Empresa (Lucas Martins) + Matriz Completa de Viewports (1280, 768, 390, 375)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "solo.user@sandbox.devessent.test");

    await expect(
      page.getByRole("heading", { name: "Nenhum Estabelecimento Vinculado" })
    ).toBeVisible();
    await expect(page.getByText("Sessão Ativa e Segura")).toHaveCount(0);
    await expect(page.getByText("Membro de Estabelecimento")).toHaveCount(0);

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-sem-empresa-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-sem-empresa-dark.png");

    // Validar múltiplos tamanhos de tela com usuário de estabelecimento ativo
    await page.context().clearCookies();
    await loginAs(page, "owner.verde@sandbox.devessent.test");

    for (const vp of [
      { width: 1280, height: 800, capture: "responsive-1280x800-light.png" },
      { width: 768, height: 1024, capture: "responsive-768x1024-light.png" },
      { width: 390, height: 844, capture: "responsive-390x844-light.png" },
      { width: 375, height: 667, capture: "responsive-375x667-light.png" },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setThemeAndVerify(page, "light");
      await assertNoHorizontalOverflow(page);
      await saveCapture(page, vp.capture);
    }

    // Menu mobile nativo em 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
    const mobileDialog = page.locator("dialog[open]");
    await expect(mobileDialog).toBeVisible();
    await saveCapture(page, "responsive-mobile-menu-open-light.png");
    await page.getByRole("button", { name: "Fechar menu de navegação" }).click();
    await expect(mobileDialog).toBeHidden();
  });
});
