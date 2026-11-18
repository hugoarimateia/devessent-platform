import fs from "fs";
import path from "path";
import { chromium, type Page } from "@playwright/test";
import { resolveSandboxPassword } from "../sandbox-data/fixtures/users";

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

const CAPTURE_DIR = path.resolve(process.cwd(), "docs/visual-review/fase-6a");
const ARTIFACT_DIR = path.resolve(
  "C:/Users/hugoa/.gemini/antigravity/brain/3c653b81-8bb6-4041-932c-bc5ef43ab6fd"
);

fs.mkdirSync(CAPTURE_DIR, { recursive: true });
if (fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function saveCapture(page: Page, filename: string) {
  const destPath1 = path.join(CAPTURE_DIR, filename);
  await page.screenshot({ path: destPath1, fullPage: true });
  console.log(`📸 Capturado: ${filename}`);

  if (fs.existsSync(ARTIFACT_DIR)) {
    const destPath2 = path.join(ARTIFACT_DIR, filename);
    fs.copyFileSync(destPath1, destPath2);
  }
}

async function setTheme(page: Page, mode: "light" | "dark") {
  const label = mode === "light" ? "Tema Claro" : "Tema Escuro";
  const btn = page.locator("header").getByRole("button", { name: label }).first();
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(500);
  } else {
    await page.evaluate((theme) => {
      document.documentElement.setAttribute("data-theme", theme);
    }, mode);
  }
}

async function loginUser(page: Page, email: string) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("E-mail Corporativo").fill(email);
  await page.getByLabel("Senha de Acesso").fill(resolveSandboxPassword(email));
  await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log("=== Iniciando Capturas Visuais da Fase 6A (Retail) ===");

  // 1. Login Ateliê
  await loginUser(page, "owner.atelie@sandbox.devessent.test");

  // A. Retail Dashboard
  await page.goto("http://localhost:3000/dashboard/retail");
  await page.waitForLoadState("networkidle");
  await setTheme(page, "light");
  await saveCapture(page, "fase6a-retail-dashboard-light.png");
  await setTheme(page, "dark");
  await saveCapture(page, "fase6a-retail-dashboard-dark.png");

  // B. Produtos (Catálogo)
  await page.goto("http://localhost:3000/dashboard/retail/produtos");
  await page.waitForLoadState("networkidle");
  await setTheme(page, "light");
  await saveCapture(page, "fase6a-retail-produtos-light.png");
  await setTheme(page, "dark");
  await saveCapture(page, "fase6a-retail-produtos-dark.png");

  // C. Novo Produto Form
  await page.goto("http://localhost:3000/dashboard/retail/produtos/novo");
  await page.waitForLoadState("networkidle");
  await setTheme(page, "light");
  await saveCapture(page, "fase6a-retail-produto-novo-light.png");
  await setTheme(page, "dark");
  await saveCapture(page, "fase6a-retail-produto-novo-dark.png");

  // D. Editar Produto (primeiro produto do Ateliê)
  await page.goto("http://localhost:3000/dashboard/retail/produtos");
  await page.waitForLoadState("networkidle");
  const editLink = page.getByRole("link", { name: "Editar" }).first();
  if (await editLink.isVisible()) {
    await editLink.click();
    await page.waitForLoadState("networkidle");
    await setTheme(page, "light");
    await saveCapture(page, "fase6a-retail-produto-edit-light.png");
    await setTheme(page, "dark");
    await saveCapture(page, "fase6a-retail-produto-edit-dark.png");
  }

  // E. Categorias
  await page.goto("http://localhost:3000/dashboard/retail/categorias");
  await page.waitForLoadState("networkidle");
  await setTheme(page, "light");
  await saveCapture(page, "fase6a-retail-categorias-light.png");
  await setTheme(page, "dark");
  await saveCapture(page, "fase6a-retail-categorias-dark.png");

  // F. Configurações da Loja
  await page.goto("http://localhost:3000/dashboard/retail/configuracoes");
  await page.waitForLoadState("networkidle");
  await setTheme(page, "light");
  await saveCapture(page, "fase6a-retail-configuracoes-light.png");
  await setTheme(page, "dark");
  await saveCapture(page, "fase6a-retail-configuracoes-dark.png");

  // 2. Verde Sandbox - Isolamento Comercial
  await context.clearCookies();
  await loginUser(page, "owner.verde@sandbox.devessent.test");
  await page.goto("http://localhost:3000/dashboard/retail/produtos");
  await page.waitForLoadState("networkidle");
  await setTheme(page, "light");
  await saveCapture(page, "fase6a-retail-verde-produtos-light.png");
  await setTheme(page, "dark");
  await saveCapture(page, "fase6a-retail-verde-produtos-dark.png");

  await browser.close();
  console.log("=== Todas as capturas visuais da Fase 6A concluídas com sucesso! ===");
}

main().catch((err) => {
  console.error("Falha capturando visuais:", err);
  process.exit(1);
});

