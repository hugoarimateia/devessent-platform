import { randomBytes, randomUUID, scryptSync } from "crypto";
import * as fs from "fs";
import * as path from "path";
import mysql from "mysql2/promise";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function resolveDemoPassword(): string {
  if (process.env.XAMPP_DEMO_PASSWORD && process.env.XAMPP_DEMO_PASSWORD.trim().length >= 8) {
    return process.env.XAMPP_DEMO_PASSWORD.trim();
  }
  const vaultPath = path.resolve(process.cwd(), "local-test/xampp/.credentials.local.json");
  if (fs.existsSync(vaultPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(vaultPath, "utf-8")) as { defaultPassword?: string };
      if (parsed.defaultPassword) return parsed.defaultPassword;
    } catch {
      // ignora e gera nova senha
    }
  }
  return "XamppTest#2026!";
}

async function main() {
  const host = process.env.XAMPP_DB_HOST || "127.0.0.1";
  const port = Number(process.env.XAMPP_DB_PORT || 3306);
  const user = process.env.XAMPP_DB_USER || "root";
  const password = process.env.XAMPP_DB_PASSWORD || "";
  const database = process.env.XAMPP_DB_NAME || "devessent_test";

  let conn: mysql.Connection;
  try {
    conn = await mysql.createConnection({ host, port, user, password, database });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
      console.error(
        "❌ Banco de testes XAMPP indisponível. Inicie o MySQL/MariaDB no painel do XAMPP."
      );
      process.exit(1);
    }
    throw err;
  }

  const demoPassword = resolveDemoPassword();
  const passwordHash = hashPassword(demoPassword);

  const users = [
    {
      id: "11111111-1111-4111-8111-111111111101",
      email: "admin.global@xampp.devessent.test",
      fullName: "Admin Global (XAMPP Teste)",
      isPlatformAdmin: 1,
    },
    {
      id: "11111111-1111-4111-8111-111111111102",
      email: "owner.atelie@xampp.devessent.test",
      fullName: "Clara Rocha (Proprietária Teste)",
      isPlatformAdmin: 0,
    },
    {
      id: "11111111-1111-4111-8111-111111111103",
      email: "manager.atelie@xampp.devessent.test",
      fullName: "Beatriz Lima (Gestora Teste)",
      isPlatformAdmin: 0,
    },
    {
      id: "11111111-1111-4111-8111-111111111104",
      email: "staff.atelie@xampp.devessent.test",
      fullName: "Thiago Neves (Equipe Teste)",
      isPlatformAdmin: 0,
    },
    {
      id: "11111111-1111-4111-8111-111111111105",
      email: "multi.member@xampp.devessent.test",
      fullName: "Camila Duarte (Multiempresa Teste)",
      isPlatformAdmin: 0,
    },
    {
      id: "11111111-1111-4111-8111-111111111106",
      email: "solo.user@xampp.devessent.test",
      fullName: "Lucas Martins (Sem Empresa Teste)",
      isPlatformAdmin: 0,
    },
  ];

  const tenants = [
    {
      id: "22222222-2222-4222-8222-222222222201",
      name: "Ateliê Teste XAMPP",
      slug: "atelie-xampp",
      segment: "Moda & Confecção Autoral",
      color: "#C06C3E",
      monogram: "AX",
      description: "Loja de demonstração local para testes de moda autoral no MariaDB.",
      template: "editorial",
    },
    {
      id: "22222222-2222-4222-8222-222222222202",
      name: "Verde Teste XAMPP",
      slug: "verde-xampp",
      segment: "Botânica & Paisagismo",
      color: "#1B8A5A",
      monogram: "VX",
      description: "Empresa secundária para testes multiempresa locais no MariaDB.",
      template: "experimental",
    },
  ];

  try {
    console.log("🌱 Semeando contas e empresas demonstrativas no MariaDB (devessent_test)...");

    for (const u of users) {
      await conn.execute(
        `INSERT INTO users (id, email, password_hash, full_name, is_platform_admin)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash)`,
        [u.id, u.email, passwordHash, u.fullName, u.isPlatformAdmin]
      );
    }

    for (const t of tenants) {
      await conn.execute(
        `INSERT INTO tenants (id, name, slug, status)
         VALUES (?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [t.id, t.name, t.slug]
      );

      await conn.execute(
        `INSERT INTO tenant_settings (tenant_id, segment_label, primary_color, monogram, brand_description)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE segment_label = VALUES(segment_label), primary_color = VALUES(primary_color)`,
        [t.id, t.segment, t.color, t.monogram, t.description]
      );

      await conn.execute(
        `INSERT INTO retail_stores (id, tenant_id, store_name, slug, currency, template, brand_headline, brand_subheadline, announcement_bar, is_active, inventory_mode)
         VALUES (?, ?, ?, ?, 'BRL', ?, ?, ?, 'AMBIENTE DE TESTES LOCAIS XAMPP', 1, 'track_quantity')
         ON DUPLICATE KEY UPDATE store_name = VALUES(store_name), template = VALUES(template)`,
        [randomUUID(), t.id, t.name, t.slug, t.template, t.name, t.description]
      );
    }

    const memberships = [
      { tenantId: tenants[0].id, userId: users[1].id, role: "owner" },
      { tenantId: tenants[0].id, userId: users[2].id, role: "manager" },
      { tenantId: tenants[0].id, userId: users[3].id, role: "staff" },
      { tenantId: tenants[0].id, userId: users[4].id, role: "staff" },
      { tenantId: tenants[1].id, userId: users[4].id, role: "manager" },
    ];

    for (const m of memberships) {
      await conn.execute(
        `INSERT INTO tenant_memberships (id, tenant_id, user_id, role)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [randomUUID(), m.tenantId, m.userId, m.role]
      );
    }

    // Categorias e Produtos de Teste
    const catId = "33333333-3333-4333-8333-333333333301";
    await conn.execute(
      `INSERT INTO retail_categories (id, tenant_id, name, slug, description, sort_order, is_active)
       VALUES (?, ?, 'Alfaiataria Teste', 'alfaiataria-teste', 'Linha demonstrativa local', 1, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [catId, tenants[0].id]
    );

    const prodId = "44444444-4444-4444-8444-444444444401";
    await conn.execute(
      `INSERT INTO retail_products (id, tenant_id, name, slug, description, status, published_at)
       VALUES (?, ?, 'Camisa Linho Teste XAMPP', 'camisa-linho-teste-xampp', 'Produto de demonstração para testes locais sem Docker.', 'published', NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [prodId, tenants[0].id]
    );

    await conn.execute(
      `INSERT IGNORE INTO retail_product_categories (product_id, category_id, tenant_id)
       VALUES (?, ?, ?)`,
      [prodId, catId, tenants[0].id]
    );

    await conn.execute(
      `INSERT INTO retail_variants (id, tenant_id, product_id, sku, name, price_cents, stock_quantity, is_available, options_summary_json)
       VALUES (?, ?, ?, 'XAMPP-LINHO-M', 'Tamanho M', 18900, 12, 1, '{"Tamanho":"M"}')
       ON DUPLICATE KEY UPDATE price_cents = VALUES(price_cents), stock_quantity = VALUES(stock_quantity)`,
      [randomUUID(), tenants[0].id, prodId]
    );

    // Salva cofre local não versionado com credenciais de teste
    const vaultPath = path.resolve(process.cwd(), "local-test/xampp/.credentials.local.json");
    fs.writeFileSync(
      vaultPath,
      JSON.stringify(
        {
          description: "Credenciais locais exclusivas para testes XAMPP/MariaDB. NÃO VERSIONADO.",
          defaultPassword: demoPassword,
          users: users.map((u) => ({
            email: u.email,
            fullName: u.fullName,
            isPlatformAdmin: Boolean(u.isPlatformAdmin),
          })),
        },
        null,
        2
      ),
      "utf-8"
    );

    console.log("✅ Seed XAMPP concluído com sucesso! Credenciais salvas em local-test/xampp/.credentials.local.json");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("❌ Erro no seed XAMPP:", err);
  process.exit(1);
});

