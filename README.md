# DevEssent Platform

> **Infraestrutura SaaS Multiempresa da DevEssent**  
> *Engenharia compartilhada, módulos comerciais independentes, identidade personalizada por cliente.*

---

## 1. Visão Geral

A **DevEssent Platform** é a plataforma própria da software house **DevEssent** para administração multiempresa, governança de sites de clientes e operações comerciais (**DevEssent Retail** — catálogo, vitrines públicas Editorial e Experimental, carrinho persistente, pedidos transacionais com controle de estoque e camada financeira em modo Sandbox).

---

## 2. Princípios Arquiteturais

- **Monólito Modular Pragmático:** `src/core/` isolado de módulos comerciais (`src/modules/retail/`).
- **Segurança Multiempresa em Camadas:** PostgreSQL Row-Level Security (`ENABLE` + `FORCE ROW LEVEL SECURITY` em todas as tabelas), RBAC (`platform_admin`, `owner`, `manager`, `staff`) e RPCs `SECURITY DEFINER` com proteção explícita contra spoofing.
- **Governança Comercial:** Clientes operam seus produtos, estoque e pedidos no painel; customizações estruturais de template/design e conexões de pagamento permanecem sob governança técnica da equipe DevEssent.
- **Negação por Padrão (Fail-Closed):** Sem fallback silencioso entre ambientes; pagamentos bloqueados estritamente em modo `sandbox` no banco de dados.

---

## 3. Stack Tecnológica

- **Framework:** Next.js 15 (App Router, Server Components & Server Actions)
- **Linguagem:** TypeScript (`strict`)
- **Banco Oficial:** PostgreSQL 17 (Supabase Cloud — RLS, Auth e Storage `retail-media`)
- **Ambiente Secundário Local:** MariaDB / XAMPP (`xampp-test`, sem Docker)
- **Estilização:** Tailwind CSS + Design System DevEssent (modos claro e escuro)
- **Validação:** Zod
- **Gerenciador de Pacotes:** `pnpm`
- **Testes:** Vitest (unitários, integração real PostgreSQL e segurança) e Playwright (E2E)

---

## 4. Ambientes Disponíveis

| Ambiente | Banco | Arquivo Local (Gitignored) | Comando |
| --- | --- | --- | --- |
| **Supabase Cloud Staging (Preferencial)** | PostgreSQL Cloud (`auebnppzxcvtaaqqlbts`) | `.env.staging.local` | `pnpm dev:staging` |
| **XAMPP Local (Secundário, offline)** | MariaDB local (`127.0.0.1:3306`) | `.env.local` | `pnpm dev:xampp` |
| **Futura Produção** | Projeto Supabase dedicado (futuro) | Secrets da hospedagem | Em fase futura |

---

## 5. Início Rápido (Supabase Cloud Staging — Sem Docker)

```bash
# 1. Instalar dependências
pnpm install

# 2. Garantir .env.staging.local configurado (veja .env.example e docs/DEVESSENT_STAGING_SETUP.md)

# 3. Provisionar ou verificar dados demonstrativos permanentes (idempotente)
pnpm staging:seed
pnpm staging:seed:status

# 4. Iniciar a plataforma conectada ao Supabase Cloud Staging
pnpm dev:staging
```

Acesse `http://localhost:3000`. As credenciais das contas demonstrativas ficam armazenadas exclusivamente no arquivo local ignorado pelo Git `local-test/staging/.credentials.staging.local.json`.

---

## 6. Verificações e Testes

```bash
# Arquitetura, ambiente, tipagem e lint
pnpm check:project
pnpm check:env
pnpm typecheck
pnpm lint

# Testes unitários offline
pnpm vitest run tests/unit/

# Build otimizado
pnpm build
```

---

## 7. Documentação Técnica e Operacional

- **[Guia Operacional de Staging (Supabase Cloud)](./docs/DEVESSENT_STAGING_SETUP.md)**
- **[Fluxo Git, GitHub e CI](./docs/DEVESSENT_GITHUB_WORKFLOW.md)**
- [Arquitetura Geral](./docs/architecture.md)
- [Modelagem do Banco de Dados](./docs/database.md)
- [Arquitetura de Segurança e RBAC](./docs/security.md)
- [Guia de Desenvolvimento](./docs/development.md)
- [Estratégia de Testes](./docs/testing.md)
- [Procedimentos de Implantação](./docs/deployment.md)
