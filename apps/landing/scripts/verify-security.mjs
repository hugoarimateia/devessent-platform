import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

// 1. Verificar ausência de arquivos .env reais versionados dentro da landing
for (const entry of fs.readdirSync(root)) {
  if (entry === ".env" || (entry.startsWith(".env.") && entry !== ".env.example")) {
    errors.push(`Arquivo de ambiente sensível encontrado em apps/landing: ${entry}`);
  }
}

// 2. Verificar ausência de segredos ou acoplamento com a Platform no código frontend
const forbiddenPatterns = [
  { regex: /SUPABASE_SERVICE_ROLE_KEY/g, label: "Referência a SUPABASE_SERVICE_ROLE_KEY no frontend" },
  { regex: /service_role/gi, label: "Referência a service_role no frontend" },
  { regex: /TURNSTILE_SECRET_KEY/g, label: "Referência a TURNSTILE_SECRET_KEY no frontend" },
  { regex: /@\/core\/|@\/modules\/|\.\.\/\.\.\/src\//g, label: "Import acoplado à DevEssent Platform" },
];

function walkSrc(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSrc(fullPath);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const rule of forbiddenPatterns) {
        if (rule.regex.test(content)) {
          errors.push(`${rule.label} em ${path.relative(root, fullPath)}`);
        }
      }
    }
  }
}

walkSrc(path.join(root, "src"));

if (errors.length > 0) {
  console.error("❌ Falhas na auditoria de segurança/isolamento da landing:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("✅ Auditoria de segurança e isolamento da landing aprovada.");
