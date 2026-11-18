import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { resolveSandboxPassword } from "../../sandbox-data/fixtures/users";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

test.describe("E2E Suite — DevEssent Retail (Catálogo, Produtos, Categorias e RLS)", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("1. Proprietário do Ateliê acessa Dashboard Retail e visualiza KPIs e navegação comercial", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("owner.atelie@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("owner.atelie@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // Clica no link de navegação Painel Retail no Sidebar
    const retailNavLink = page.getByRole("link", { name: "Painel Retail" }).first();
    await expect(retailNavLink).toBeVisible({ timeout: 15000 });
    await retailNavLink.click();

    await expect(page).toHaveURL(/\/dashboard\/retail$/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /Catálogo & Gestão de Produtos/i }).first()
    ).toBeVisible();

    // Valida os cartões de KPI
    await expect(page.getByText("Total no Catálogo").first()).toBeVisible();
    await expect(page.getByText("Publicados (Ativos)").first()).toBeVisible();
  });

  test("2. Gerenciamento de Categorias no Ateliê Sandbox: listagem e criação com diálogo nativo", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("owner.atelie@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("owner.atelie@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/dashboard/retail/categorias");

    // Verifica que categorias seeded existem
    await expect(page.getByText("Moda Masculina").first()).toBeVisible({ timeout: 15000 });

    // Abre diálogo para criar nova categoria
    const openDialogBtn = page.getByRole("button", { name: "Nova Categoria" });
    await expect(openDialogBtn).toBeVisible();
    await openDialogBtn.click();

    const uniqueCatName = `Coleção Cápsula E2E ${Date.now()}`;
    await page.getByLabel("Nome da Categoria *").fill(uniqueCatName);
    await page.getByLabel("Descrição").fill("Peças exclusivas de teste e2e");

    // Enviar formulário
    await page.getByRole("button", { name: "Criar Categoria" }).click();

    // Confirma que a nova categoria aparece na lista
    await expect(page.getByText(uniqueCatName)).toBeVisible({ timeout: 15000 });
  });

  test("3. Catálogo de Produtos: navegação, listagem e filtro de produtos", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("owner.atelie@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("owner.atelie@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/dashboard/retail/produtos");

    // Produtos seeded do Ateliê devem estar visíveis
    await expect(page.getByText("Camiseta Essential Linho").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Moletom Oversized Street").first()).toBeVisible();

    // Filtro por busca
    const searchInput = page.getByPlaceholder(/Buscar por nome ou slug/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Cargo");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Calça Cargo Utilitária").first()).toBeVisible();
    await expect(page.getByText("Camiseta Essential Linho")).toHaveCount(0);
  });

  test("4. Criação de Novo Produto com Variantes e redirecionamento para edição", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("owner.atelie@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("owner.atelie@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/dashboard/retail/produtos/novo");

    const uniqueProdName = `Camisa Linho Puro ${Date.now()}`;
    await page.getByLabel("Nome do Produto *").fill(uniqueProdName);
    await page.getByLabel("Descrição do Produto").fill("Camisa confeccionada em linho puro italiano.");

    // Seleciona uma categoria clicando no botão correspondente
    await page.getByRole("button", { name: "Moda Masculina" }).click();

    // Preenche SKU único para a variante padrão
    const skuInput = page.locator("table tbody tr").first().locator("input").first();
    await skuInput.fill(`E2E-${Date.now().toString().slice(-6)}`);

    // Submete o formulário com o botão "Criar Produto"
    const submitBtn = page.getByRole("button", { name: "Criar Produto" });
    await submitBtn.click();

    // Deve redirecionar para a página de edição do produto
    await expect(page).toHaveURL(/\/dashboard\/retail\/produtos\/[0-9a-f-]{36}/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Editar Produto" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("Nome do Produto *")).toHaveValue(uniqueProdName);
  });

  test("5. Isolamento Multiempresa: Verde Sandbox não visualiza produtos de moda do Ateliê", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("owner.verde@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("owner.verde@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Verde Sandbox" })).toBeVisible({
      timeout: 15000,
    });

    await page.goto("/dashboard/retail/produtos");

    // Deve visualizar produtos botânicos do Verde Sandbox
    await expect(page.getByText("Monstera Deliciosa Variegata").first()).toBeVisible({
      timeout: 15000,
    });

    // JAMAIS deve visualizar produtos de vestuário do Ateliê Sandbox
    await expect(page.getByText("Camiseta Essential Linho")).toHaveCount(0);
    await expect(page.getByText("Moletom Oversized Street")).toHaveCount(0);
    await expect(page.getByText("Calça Cargo Utilitária")).toHaveCount(0);
  });
});
