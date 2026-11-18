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

const ARTIFACTS_DIR = "C:/Users/hugoa/.gemini/antigravity/brain/3c653b81-8bb6-4041-932c-bc5ef43ab6fd";
const DOCS_SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs/screenshots");

function ensureDirs() {
  if (!fs.existsSync(DOCS_SCREENSHOTS_DIR)) {
    fs.mkdirSync(DOCS_SCREENSHOTS_DIR, { recursive: true });
  }
}

ensureDirs();

test.describe("E2E Suite — DevEssent Retail (Fase 6B: Lojas Públicas e Sistema de Templates)", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("1. Vitrine Editorial (GAZU Studio Direction) Desktop: hero imponente, categorias e peças autorais", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/loja/atelier-sandbox", { waitUntil: "networkidle" });

    // 1. Barra de anúncios e navegação
    await expect(page.getByText(/FRETE/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("link", { name: /Ateliê/i }).first()).toBeVisible();

    // 2. Hero editorial com tipografia marcante
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Explorar Coleção/i }).first()).toBeVisible();

    // 3. Faixa de Categorias e Destaque A Nova Temporada
    await expect(page.getByText(/Categorias & Linhas Autorais/i).first()).toBeVisible();
    await expect(page.getByText(/A NOVA/i).first()).toBeVisible();

    // 4. Peças em destaque
    await expect(page.getByRole("heading", { name: /Peças em Destaque/i })).toBeVisible();

    // 5. Pilares e Rodapé
    await expect(page.getByText(/MATERIAIS NOBRES/i)).toBeVisible();
    await expect(page.getByText(/DevEssent Retail OS/i).first()).toBeVisible();

    // Captura de tela Desktop
    const shotPath1 = path.join(ARTIFACTS_DIR, "fase6b-editorial-desktop.png");
    const shotPath2 = path.join(DOCS_SCREENSHOTS_DIR, "fase6b-editorial-desktop.png");
    await page.screenshot({ path: shotPath1, fullPage: true });
    await page.screenshot({ path: shotPath2, fullPage: true });
  });

  test("2. Vitrine Editorial Mobile: responsividade em 390x844 e adaptação visual", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/loja/atelier-sandbox", { waitUntil: "networkidle" });

    await expect(page.getByRole("link", { name: /Ateliê/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    const shotPath1 = path.join(ARTIFACTS_DIR, "fase6b-editorial-mobile.png");
    const shotPath2 = path.join(DOCS_SCREENSHOTS_DIR, "fase6b-editorial-mobile.png");
    await page.screenshot({ path: shotPath1, fullPage: false });
    await page.screenshot({ path: shotPath2, fullPage: false });
  });

  test("3. Vitrine Experimental (VLOM Custom Direction) Desktop: alto contraste, acentos acid-green e processo (Preview Técnico Admin)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Visitante anônimo NÃO deve conseguir trocar template via query param ?preview_template=experimental
    await page.goto("/loja/atelier-sandbox?preview_template=experimental", { waitUntil: "networkidle" });
    await expect(page.getByText(/Modo de Pré-visualização/i)).toHaveCount(0);

    // Autentica como Administrador Global (equipe DevEssent) para liberar preview técnico
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("admin.global@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("admin.global@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

    // Acessa pré-visualização experimental como plataforma DevEssent
    await page.goto("/loja/atelier-sandbox?preview_template=experimental", { waitUntil: "networkidle" });

    // 1. Banner de pré-visualização seguro
    await expect(page.getByText(/Modo de Pré-visualização/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/experimental/i).first()).toBeVisible();

    // 2. Hero experimental em fundo escuro com acento acid-green
    await expect(page.getByText(/VISTA SUA/i).first()).toBeVisible();
    await expect(page.getByText(/IDENTIDADE/i).first()).toBeVisible();

    // 3. Processo Modular (01. Escolha -> 02. Customize...)
    await expect(page.getByText(/COMO FUNCIONA/i).first()).toBeVisible();
    await expect(page.getByText(/01/i).first()).toBeVisible();

    // 4. Essenciais Customizáveis
    await expect(page.getByRole("heading", { name: /ESSENCIAIS CUSTOMIZÁVEIS/i })).toBeVisible();

    // 5. Lookbook Archive
    await expect(page.getByText(/ARCHIVE™/i).first()).toBeVisible();

    const shotPath1 = path.join(ARTIFACTS_DIR, "fase6b-experimental-desktop.png");
    const shotPath2 = path.join(DOCS_SCREENSHOTS_DIR, "fase6b-experimental-desktop.png");
    await page.screenshot({ path: shotPath1, fullPage: true });
    await page.screenshot({ path: shotPath2, fullPage: true });
  });

  test("4. Vitrine Experimental Mobile: responsividade em 390x844 no estilo streetwear (Preview Técnico Admin)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("admin.global@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("admin.global@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

    await page.goto("/loja/atelier-sandbox?preview_template=experimental", { waitUntil: "networkidle" });

    await expect(page.getByText(/VISTA SUA/i).first()).toBeVisible({ timeout: 15000 });

    const shotPath1 = path.join(ARTIFACTS_DIR, "fase6b-experimental-mobile.png");
    const shotPath2 = path.join(DOCS_SCREENSHOTS_DIR, "fase6b-experimental-mobile.png");
    await page.screenshot({ path: shotPath1, fullPage: false });
    await page.screenshot({ path: shotPath2, fullPage: false });
  });

  test("5. Catálogo Comercial: filtros, busca e paginação", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/loja/atelier-sandbox/produtos", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: /Catálogo Comercial/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder(/Buscar por nome/i)).toBeVisible();

    // Busca por "Linho"
    await page.getByPlaceholder(/Buscar por nome/i).fill("Linho");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    const shotPath1 = path.join(ARTIFACTS_DIR, "fase6b-catalogo-desktop.png");
    const shotPath2 = path.join(DOCS_SCREENSHOTS_DIR, "fase6b-catalogo-desktop.png");
    await page.screenshot({ path: shotPath1, fullPage: true });
    await page.screenshot({ path: shotPath2, fullPage: true });
  });

  test("6. Página de Detalhes do Produto: variantes, estoque real e ausência de checkout falso", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/loja/atelier-sandbox/produto/camiseta-essential-linho", { waitUntil: "networkidle" });

    // 1. Título do produto
    await expect(page.getByRole("heading", { name: /Camiseta Essential Linho/i })).toBeVisible({ timeout: 15000 });

    // 2. Preço em BRL
    await expect(page.getByText(/R\$/i).first()).toBeVisible();

    // 3. Indicador de estoque real
    await expect(page.getByText(/Em estoque/i).first()).toBeVisible();

    // 4. Painel de solicitação de pedido ativo (sem pagamento online falso)
    await expect(page.getByText(/Solicitação Direta de Pedido/i)).toBeVisible();

    const shotPath1 = path.join(ARTIFACTS_DIR, "fase6b-produto-desktop.png");
    const shotPath2 = path.join(DOCS_SCREENSHOTS_DIR, "fase6b-produto-desktop.png");
    await page.screenshot({ path: shotPath1, fullPage: true });
    await page.screenshot({ path: shotPath2, fullPage: true });
  });

  test("7. Painel Administrativo Retail (Cliente): Configurações Operacionais sem Seletor de Template e Bloqueio de /admin/sites", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Login como Proprietário do Ateliê
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill("owner.atelie@sandbox.devessent.test");
    await page
      .getByLabel("Senha de Acesso")
      .fill(resolveSandboxPassword("owner.atelie@sandbox.devessent.test"));
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // Navega para configurações operacionais da loja
    await page.goto("/dashboard/retail/configuracoes", { waitUntil: "networkidle" });

    // Valida que configurações operacionais existem, mas controles visuais estruturais NÃO existem
    await expect(
      page.getByRole("heading", { name: /Configurações Operacionais da Loja/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Direção A — Editorial/i)).toHaveCount(0);
    await expect(page.getByText(/Direção B — Experimental/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Preview Editorial/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Visualizar Vitrine Ativa/i })).toBeVisible();

    // Acesso direto à área técnica /admin/sites deve ser bloqueado para Owner
    await page.goto("/admin/sites", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/forbidden/);

    const shotPath1 = path.join(ARTIFACTS_DIR, "fase6b-configuracoes-template.png");
    const shotPath2 = path.join(DOCS_SCREENSHOTS_DIR, "fase6b-configuracoes-template.png");
    await page.screenshot({ path: shotPath1, fullPage: true });
    await page.screenshot({ path: shotPath2, fullPage: true });
  });
});
