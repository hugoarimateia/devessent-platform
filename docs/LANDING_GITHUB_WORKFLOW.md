# GitHub Actions e Isolamento de Workflows — DevEssent Monorepo

Documentação da estratégia de CI independente entre a **DevEssent Platform** (raiz) e a **DevEssent Landing Page** (`apps/landing`).

## 1. Separação de Workflows

| Workflow | Arquivo | Escopo | Gatilho |
| --- | --- | --- | --- |
| **Platform CI** | `.github/workflows/ci.yml` | Aplicação SaaS na raiz | Preservado integralmente, sem alterações nesta fase |
| **Landing CI** | `.github/workflows/landing-ci.yml` | Exclusivamente `apps/landing/**` | `push` (`main`, `feature/landing-cloudflare`), `pull_request` (`main`) filtrados por `paths: ["apps/landing/**", ".github/workflows/landing-ci.yml"]` e `workflow_dispatch` |

## 2. Etapas Executadas pelo `landing-ci.yml`

Todas executadas com `working-directory: apps/landing`, `permissions: { contents: read }` e sem acesso a segredos reais:

1. **Checkout e ambiente:** Node.js `22` + pnpm `10` com cache apontando exclusivamente para `apps/landing/pnpm-lock.yaml`.
2. **Instalação determinística:** `pnpm install --frozen-lockfile`.
3. **Auditoria de segurança e isolamento:** `pnpm check:security` (garante ausência de `.env`, `service_role`, `TURNSTILE_SECRET_KEY` e imports da Platform).
4. **Tipagem estrita:** `pnpm typecheck` (`tsc --noEmit`).
5. **Lint:** `pnpm lint` (ESLint + Next.js).
6. **Testes unitários:** `pnpm test` (validação de formulário + todos os cenários de segurança da Edge Function `marketing-contact`).
7. **Build estático de produção:** `pnpm build` (gera `apps/landing/out`).
8. **Validação do artefato estático:** `pnpm check:export` (confirma `index.html`, `contato.html`, `404.html`, `robots.txt`, `sitemap.xml`, `_headers`, assets da marca/hero e ausência de sourcemaps `.map`).

## 3. Proteção da Platform no Monorepo

- O `pnpm-workspace.yaml` da raiz permanece restrito a `packages: ['.']`, mantendo o `pnpm-lock.yaml` e o `pnpm install --frozen-lockfile` da Platform intactos.
- O `tsconfig.json` da raiz recebeu apenas `"apps"` em `exclude`, evitando que `pnpm typecheck` da Platform tente compilar o código independente da landing.
- Nenhuma dependência de marketing foi adicionada à raiz.

## 4. Política de Deploy

- **Landing Page:** publicada pela integração nativa **GitHub → Cloudflare Pages** (com Root Directory `apps/landing` e Build watch paths `apps/landing/*`). Não existe job duplicado de `wrangler pages deploy` no GitHub Actions.
- **Supabase Migrations e Edge Functions:** nunca implantados automaticamente em commits ou PRs. Exigem execução explícita com verificação do projeto destino e plano de rollback (ver `docs/LANDING_SUPABASE_INTEGRATION.md`).
- **DevEssent Platform:** nenhum deploy automático da Platform foi ativado nesta fase.
