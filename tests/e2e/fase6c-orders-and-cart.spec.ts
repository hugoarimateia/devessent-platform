import fs from "fs";
import path from "path";
import { test, expect, type Page } from "@playwright/test";

const ARTIFACTS_DIR = "C:/Users/hugoa/.gemini/antigravity/brain/3c653b81-8bb6-4041-932c-bc5ef43ab6fd";
const DOCS_SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs/screenshots");

function ensureDirs() {
  if (!fs.existsSync(DOCS_SCREENSHOTS_DIR)) {
    fs.mkdirSync(DOCS_SCREENSHOTS_DIR, { recursive: true });
  }
}

function readXamppDemoPassword(): string {
  const vaultPath = path.resolve(process.cwd(), "local-test/xampp/.credentials.local.json");
  if (fs.existsSync(vaultPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(vaultPath, "utf-8")) as { defaultPassword?: string };
      if (parsed.defaultPassword) return parsed.defaultPassword;
    } catch {
      // usa fallback padrão de dev local
    }
  }
  return "XamppTest#2026!";
}

async function saveShot(page: Page, filename: string, fullPage = true) {
  ensureDirs();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename), fullPage });
  await page.screenshot({ path: path.join(DOCS_SCREENSHOTS_DIR, filename), fullPage });
}

async function setDashboardTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate((t) => {
    window.localStorage.setItem("color-scheme", t);
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.themeMode = t;
    document.documentElement.classList.toggle("dark", t === "dark");
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", t);
  }, theme);
  await page.waitForTimeout(200);
}

test.describe.serial("E2E Suite — Fase 6C: Carrinho, Checkout de Solicitação, Estoque e Painel de Pedidos (XAMPP)", () => {
  test.beforeEach(() => {
    test.setTimeout(180_000);
  });
  const password = readXamppDemoPassword();
  let createdOrderNumber = "";
  let createdOrderAdminUrl = "";

  test("1. Jornada Pública Editorial Desktop: Produto -> Sacola -> Drawer -> Checkout -> Confirmação (Screenshots 1-4)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/loja/atelie-xampp/produto/camisa-linho-teste-xampp", {
      waitUntil: "networkidle",
    });

    await expect(
      page.getByRole("heading", { name: /Camisa Linho Teste XAMPP/i })
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("add-to-cart-button")).toBeVisible();

    // Screenshot 1: Editorial produto com CTA e sacola
    await saveShot(page, "fase6c-01-editorial-produto-sacola.png", true);

    // Adiciona 1 unidade -> abre drawer nativo
    await page.getByTestId("add-to-cart-button").click();
    await expect(page.getByRole("heading", { name: /Sacola \(1\)/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/Nenhuma cobrança online/i)).toBeVisible();

    // Screenshot 2: Carrinho lateral aberto no Editorial
    await saveShot(page, "fase6c-02-editorial-drawer-aberto.png", false);

    // Navega para /finalizar via CTA do drawer
    await page.getByRole("link", { name: /Finalizar Solicitação/i }).click();
    await expect(page).toHaveURL(/\/loja\/atelie-xampp\/finalizar/, { timeout: 45000 });
    await expect(
      page.getByRole("heading", { name: /Solicitação de Pedido/i })
    ).toBeVisible();

    await page.getByLabel(/Nome completo/i).fill("Juliana Ribeiro E2E");
    await page.getByLabel(/Telefone \/ WhatsApp/i).fill("(11) 99123-4567");
    await page.getByLabel(/E-mail/i).fill("juliana.e2e@teste.local");
    await page.getByLabel(/Observações/i).fill("Teste E2E Fase 6C - retirada presencial.");

    // Screenshot 3: Checkout Editorial preenchido antes do envio
    await saveShot(page, "fase6c-03-editorial-checkout.png", true);

    await page.getByTestId("submit-order-request").click();
    await expect(page).toHaveURL(/\/loja\/atelie-xampp\/pedido\/PED-/, { timeout: 45000 });
    expect(page.url()).not.toContain("t=");

    const headingText = await page.getByRole("heading", { level: 1 }).textContent();
    createdOrderNumber = headingText?.replace("Pedido ", "").trim() || "";
    expect(createdOrderNumber).toMatch(/^PED-/);
    await expect(page.getByText(/Aguardando confirmação/i).first()).toBeVisible();

    // Screenshot 4: Confirmação pública do pedido solicitado
    await saveShot(page, "fase6c-04-confirmacao-pedido.png", true);
  });

  test("2. Vitrine Experimental (Preview Admin) e Responsividade Mobile 390x844 (Screenshots 5-6)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("admin.global@xampp.devessent.test");
    await page.getByLabel("Senha de Acesso").fill(password);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });

    // Desktop Experimental Produto + Drawer
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      "/loja/atelie-xampp/produto/camisa-linho-teste-xampp?preview_template=experimental",
      { waitUntil: "networkidle" }
    );
    await expect(page.getByTestId("add-to-cart-button")).toBeVisible({ timeout: 20000 });
    // Produto com botão adicionar — Experimental (§55 #2)
    await saveShot(page, "fase6c-02b-experimental-produto-sacola.png", true);

    await page.getByTestId("add-to-cart-button").click();
    await expect(page.getByRole("heading", { name: /Sacola \(1\)/i })).toBeVisible({
      timeout: 20000,
    });

    // Screenshot 5: Experimental drawer
    await saveShot(page, "fase6c-05-experimental-drawer.png", false);

    // Carrinho — Mobile 390x844 (§55 #5)
    await page.setViewportSize({ width: 390, height: 844 });
    await saveShot(page, "fase6c-05b-mobile-drawer.png", false);

    // Mobile 390x844 Editorial Checkout
    await page.goto("/loja/atelie-xampp/finalizar", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /Solicitação de Pedido/i })
    ).toBeVisible();

    // Screenshot 6: Mobile checkout
    await saveShot(page, "fase6c-06-storefront-mobile-checkout.png", true);
  });

  test("3. Painel Administrativo Pedidos (Light/Dark, Detalhes, Confirmação com Baixa e Estorno, Dashboard KPIs, Mobile) + Bloqueio Staff (Screenshots 7-12)", async ({
    page,
  }) => {
    // Primeiro verifica bloqueio do papel staff
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("staff.atelie@xampp.devessent.test");
    await page.getByLabel("Senha de Acesso").fill(password);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });

    await page.goto("/dashboard/retail/pedidos", { waitUntil: "networkidle", timeout: 45000 });
    await expect(page).toHaveURL(/\/forbidden/, { timeout: 25000 });

    // Screenshot 12: Bloqueio de acesso para staff em /dashboard/retail/pedidos
    await saveShot(page, "fase6c-12-staff-bloqueio-pedidos.png", true);

    // Login como Owner do Ateliê
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("owner.atelie@xampp.devessent.test");
    await page.getByLabel("Senha de Acesso").fill(password);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });

    // Dashboard principal refletindo métricas reais de pedidos (Screenshot 10)
    await expect(page.getByText(/Pedidos Recebidos/i).first()).toBeVisible({ timeout: 25000 });
    await setDashboardTheme(page, "dark");
    await saveShot(page, "fase6c-10-dashboard-metricas-reais.png", true);

    // Lista de pedidos em Light Mode (Screenshot 7) e Dark Mode (Screenshot 8)
    await page.goto("/dashboard/retail/pedidos", { waitUntil: "networkidle", timeout: 45000 });
    await expect(page.getByRole("heading", { name: /Gestão de Pedidos/i })).toBeVisible({
      timeout: 25000,
    });
    if (createdOrderNumber) {
      await expect(page.getByText(createdOrderNumber).first()).toBeVisible();
    }

    await setDashboardTheme(page, "light");
    await saveShot(page, "fase6c-07-admin-pedidos-light.png", true);

    await setDashboardTheme(page, "dark");
    await saveShot(page, "fase6c-08-admin-pedidos-dark.png", true);

    // Mobile 390x844 na lista de pedidos (Screenshot 11)
    await page.setViewportSize({ width: 390, height: 844 });
    await saveShot(page, "fase6c-11-admin-pedidos-mobile.png", false);

    // Detalhes do pedido + Confirmação com baixa transacional de estoque (Screenshot 9)
    await page.setViewportSize({ width: 1440, height: 900 });
    if (createdOrderNumber) {
      await page.getByRole("link", { name: createdOrderNumber }).first().click();
    } else {
      await page.getByRole("link", { name: /Gerenciar/i }).first().click();
    }
    await expect(page).toHaveURL(/\/dashboard\/retail\/pedidos\//, { timeout: 30000 });
    createdOrderAdminUrl = page.url();

    await page.getByTestId("transition-to-confirmed").click();
    await expect(page.getByText(/Pedido confirmado e estoque atualizado/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/Estoque baixado/i)).toBeVisible();

    await saveShot(page, "fase6c-09-admin-pedido-detalhe-confirmado.png", true);

    // Cancela ao final para estornar a 1 unidade e manter estoque limpo no banco local
    await page.goto(createdOrderAdminUrl, { waitUntil: "networkidle" });
    await page.getByTestId("transition-to-cancelled").click();
    await expect(page.getByText("Pedido cancelado.", { exact: true })).toBeVisible({ timeout: 15000 });
    // Histórico completo de status após solicitação -> confirmação -> cancelamento (§55 #12)
    await saveShot(page, "fase6c-12b-historico-status.png", true);
  });
});
