import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "out");
if (!fs.existsSync(outDir)) {
  console.error("❌ Diretório estático apps/landing/out não encontrado. Execute pnpm build.");
  process.exit(1);
}

const requiredFiles = [
  "index.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "_headers",
  "images/astronaut-hero.webp",
  "images/astronaut-hero.png",
  "brand/devessent-logo.png",
];

const missing = [];
for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(outDir, rel))) {
    missing.push(rel);
  }
}

const hasContato =
  fs.existsSync(path.join(outDir, "contato.html")) ||
  fs.existsSync(path.join(outDir, "contato", "index.html"));
if (!hasContato) {
  missing.push("contato.html (ou contato/index.html)");
}

// Verificar ausência de sourcemaps públicos (.map)
const sourceMaps = [];
function scanMaps(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanMaps(full);
    } else if (entry.name.endsWith(".map")) {
      sourceMaps.push(path.relative(outDir, full));
    }
  }
}
scanMaps(outDir);

if (missing.length > 0 || sourceMaps.length > 0) {
  if (missing.length > 0) {
    console.error("❌ Arquivos essenciais ausentes em out/:");
    for (const m of missing) console.error(`  - ${m}`);
  }
  if (sourceMaps.length > 0) {
    console.error("❌ Sourcemaps públicos encontrados em out/:");
    for (const s of sourceMaps) console.error(`  - ${s}`);
  }
  process.exit(1);
}

console.log("✅ Artefato estático Cloudflare Pages (out/) validado com sucesso.");
