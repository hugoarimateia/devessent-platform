import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { resolveSandboxPassword } from "../../sandbox-data/fixtures/users";

const ARTIFACT_DIR = "C:/Users/hugoa/.gemini/antigravity/brain/3c653b81-8bb6-4041-932c-bc5ef43ab6fd";
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs/screenshots");

function resolveTestEnvUsers() {
  const xamppVaultPath = path.resolve(process.cwd(), "local-test/xampp/.credentials.local.json");
  if (fs.existsSync(xamppVaultPath)) {
    const parsed = JSON.parse(fs.readFileSync(xamppVaultPath, "utf-8")) as {
      defaultPassword?: string;
    };
    if (parsed.defaultPassword) {
      return {
        mode: "xampp" as const,
        ownerEmail: "owner.atelie@xampp.devessent.test",
        multiEmail: "multi.member@xampp.devessent.test",
        staffEmail: "staff.atelie@xampp.devessent.test",
        adminEmail: "admin.global@xampp.devessent.test",
        storeSlug: "atelie-xampp",
        passwordFor: () => parsed.defaultPassword!,
      };
    }
  }

  return {
    mode: "supabase" as const,
    ownerEmail: "owner.atelie@sandbox.devessent.test",
    multiEmail: "multi.member@sandbox.devessent.test",
    staffEmail: "staff.atelie@sandbox.devessent.test",
    adminEmail: "admin.global@sandbox.devessent.test",
    storeSlug: "atelier-sandbox",
    passwordFor: (email: string) => resolveSandboxPassword(email),
  };
}

async function capture(page: Page, filename: string, fullPage = false) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const docPath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: docPath, fullPage });
  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(docPath, path.join(ARTIFACT_DIR, filename));
  }
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByLabel("E-mail Corporativo").fill(email);
  await page.getByLabel("Senha de Acesso").fill(password);
  await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
}

test.describe("Fase 6B.1 — Dashboard Premium, Permissões & Separação Gestão vs Customização", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("1. Novo Dashboard (Desktop & Mobile — Dark & Light Mode) com KPIs, Gráficos Reais, Ações e Painel de Atenção", async ({
    page,
  }) => {
    const envUsers = resolveTestEnvUsers();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, envUsers.ownerEmail, envUsers.passwordFor(envUsers.ownerEmail));

    // Valida elementos reais do novo dashboard (sem dados inventados)
    await expect(page.getByText("Ações Rápidas")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Painel de Atenção")).toBeVisible();
    await expect(page.getByText("Atividades Recentes")).toBeVisible();
    await expect(page.getByText("Produtos por Categoria")).toBeVisible();
    await expect(page.getByText("Equipe do Estabelecimento")).toBeVisible();

    // Garante que módulos futuros NÃO aparecem como ferramentas funcionais prontas
    await expect(page.getByText("R$ 1.248.560")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "CRM" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Financeiro" })).toHaveCount(0);

    // Captura Desktop Dark & Light
    await page.getByRole("button", { name: "Tema Escuro" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.waitForTimeout(300);
    const overflowDesktopDark = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflowDesktopDark).toBe(false);
    await capture(page, "fase6b1-dashboard-desktop-dark.png", false);
    await capture(page, "fase6b1-dashboard-graficos-indicadores.png", true);

    await page.getByRole("button", { name: "Tema Claro" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.waitForTimeout(300);
    const overflowDesktopLight = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflowDesktopLight).toBe(false);
    await capture(page, "fase6b1-dashboard-desktop-light.png", false);

    // Captura Mobile Dark & Light (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);

    await page.getByRole("button", { name: "Tema Escuro" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.waitForTimeout(250);
    const overflowMobDark = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflowMobDark).toBe(false);
    await capture(page, "fase6b1-dashboard-mobile-dark.png", false);

    await page.getByRole("button", { name: "Tema Claro" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.waitForTimeout(250);
    const overflowMobLight = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflowMobLight).toBe(false);
    await capture(page, "fase6b1-dashboard-mobile-light.png", false);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("2. Separação de Permissões: Owner não edita layout/template, Staff restrito e Admin Global acessa /admin/sites", async ({
    page,
  }) => {
    const envUsers = resolveTestEnvUsers();
    await page.setViewportSize({ width: 1440, height: 900 });

    // A) Proprietário (Owner): acessa /dashboard/retail/configuracoes somente com campos operacionais
    await loginAs(page, envUsers.ownerEmail, envUsers.passwordFor(envUsers.ownerEmail));
    await page.goto("/dashboard/retail/configuracoes", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: /Configurações Operacionais da Loja/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Direção A — Editorial/i)).toHaveCount(0);
    await expect(page.getByText(/Direção B — Experimental/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Preview Editorial/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Visualizar Vitrine Ativa/i })).toBeVisible();
    await capture(page, "fase6b1-retail-config-operacional.png", true);

    // Owner bloqueado ao tentar acessar rota técnica /admin/sites
    await page.goto("/admin/sites", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/forbidden/);

    // Owner NÃO consegue trocar template da vitrine pública via ?preview_template=experimental
    await page.goto(`/loja/${envUsers.storeSlug}?preview_template=experimental`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByText(/Modo de Pré-visualização/i)).toHaveCount(0);
    await capture(page, "fase6b1-vitrine-cliente-sem-edicao.png", false);

    // B) Staff: não vê Convites Abertos nem Atividades Recentes no dashboard
    await page.context().clearCookies();
    await loginAs(page, envUsers.staffEmail, envUsers.passwordFor(envUsers.staffEmail));
    await expect(page.getByText("Convites Abertos")).toHaveCount(0);
    await expect(page.getByText("Permissões de Acesso")).toBeVisible();

    // C) Platform Admin (Equipe DevEssent): acessa Console Técnico /admin/sites e realiza preview autorizado
    await page.context().clearCookies();
    await loginAs(page, envUsers.adminEmail, envUsers.passwordFor(envUsers.adminEmail));
    await page.goto("/admin/sites", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: /Customização Técnica de Sites/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Direção A — Editorial/i)).toBeVisible();
    await expect(page.getByText(/Direção B — Experimental/i)).toBeVisible();
    await capture(page, "fase6b1-admin-sites-tecnico.png", true);

    // Admin autenticado consegue pré-visualizar template alternativo via URL
    await page.goto(`/loja/${envUsers.storeSlug}?preview_template=experimental`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByText(/Modo de Pré-visualização/i)).toBeVisible({ timeout: 15000 });
  });
});
