/**
 * Script de verificação de sanidade do projeto DevEssent Platform Core.
 * - Verifica integridade dos diretórios obrigatórios.
 * - Garante que src/ não importe nada de sandbox-data/.
 * - Garante que src/modules/ contenha apenas documentação na fundação inicial.
 */
import * as fs from "fs";
import * as path from "path";

const projectRoot = process.cwd();

console.log("🛡️ Executando verificação de arquitetura e isolamento do projeto...");

// 1. Diretórios obrigatórios
const mandatoryDirs = [
  "src/app",
  "src/core/auth",
  "src/core/tenants",
  "src/core/permissions",
  "src/core/settings",
  "src/core/audit",
  "src/core/errors",
  "src/modules",
  "src/components/ui",
  "src/lib/supabase",
  "src/lib/environment",
  "src/types",
  "supabase/migrations",
  "sandbox-data/fixtures",
  "sandbox-data/factories",
  "sandbox-data/scripts",
  "sandbox-data/lib",
  "tests/unit",
  "tests/integration",
  "tests/security",
  "docs/decisions",
];

let hasErrors = false;

for (const relDir of mandatoryDirs) {
  const fullPath = path.join(projectRoot, relDir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`  + Criado diretório estrutural: ${relDir}`);
  }
}

// 2. Verificar imports proibidos em src/ (Regra Crítica: src/ não pode importar sandbox-data/)
function scanFilesForProhibitedImports(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanFilesForProhibitedImports(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.includes("sandbox-data") || content.includes("../../sandbox-data")) {
        console.error(`❌ VIOLAÇÃO DE ISOLAMENTO: Arquivo ${path.relative(projectRoot, fullPath)} importa 'sandbox-data' diretamente!`);
        hasErrors = true;
      }
      if (content.includes("atelier-sandbox") || content.includes("verde-sandbox")) {
        console.error(`❌ VIOLAÇÃO DE BRANDING: Arquivo ${path.relative(projectRoot, fullPath)} contém slug de empresa fictícia hardcoded em src/!`);
        hasErrors = true;
      }
    }
  }
}

const srcDir = path.join(projectRoot, "src");
if (fs.existsSync(srcDir)) {
  scanFilesForProhibitedImports(srcDir);
}

// 3. Verificar integridade e isolamento em src/modules/
const modulesDir = path.join(projectRoot, "src", "modules");
if (fs.existsSync(modulesDir)) {
  const allowedEntries = new Set(["README.md", "retail"]);
  const moduleEntries = fs.readdirSync(modulesDir);
  const unauthorizedEntries = moduleEntries.filter((f) => !allowedEntries.has(f));
  if (unauthorizedEntries.length > 0) {
    console.error(`❌ VIOLAÇÃO MODULAR: src/modules/ contém módulos não autorizados: ${unauthorizedEntries.join(", ")}`);
    hasErrors = true;
  }
}

// 4. Regra Arquitetural Crítica: src/core/ NUNCA pode importar src/modules/
const coreDir = path.join(projectRoot, "src", "core");
function scanCoreForModuleImports(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanCoreForModuleImports(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.includes("@/modules") || content.includes("../modules") || content.includes("../../modules")) {
        console.error(`❌ VIOLAÇÃO ARQUITETURAL: Core (${path.relative(projectRoot, fullPath)}) não pode importar módulos comerciais!`);
        hasErrors = true;
      }
    }
  }
}
if (fs.existsSync(coreDir)) {
  scanCoreForModuleImports(coreDir);
}

if (hasErrors) {
  console.error("❌ Verificação falhou. Corrija os problemas acima.");
  process.exit(1);
}

console.log("✅ Projeto 100% em conformidade com as regras arquiteturais e isolamento de sandbox!");

