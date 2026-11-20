# DevEssent Landing Page (`apps/landing`)

Site institucional, portfólio e canal comercial oficial da **DevEssent** (*"Tecnologia essencial para negócios que evoluem"*), hospedado em **Cloudflare Pages** com exportação estática Next.js 15 e infraestrutura de marketing isolada da DevEssent Platform.

## Origem e Isolamento

- **Localização original preservada:** `D:\Documentos\Projetos\DevEssent`
- **Localização no monorepo:** `apps/landing/` (repositório `hugoarimateia/devessent-platform`)
- **Framework:** Next.js 15.3 (App Router, `output: "export"`), React 19, TypeScript 5.8, Tailwind CSS v4
- **Independência total:** Possui `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, testes, CI (`.github/workflows/landing-ci.yml`) e escopo Supabase (`apps/landing/supabase/`) próprios. Não importa autenticação, componentes, Retail ou tabelas da Platform.

## Estrutura

```text
apps/landing/
├── public/
│   ├── _headers                    # Security Headers + Cache HTTP nativo do Cloudflare Pages
│   ├── brand/                      # Logotipo e símbolo oficiais
│   └── images/                     # Astronauta protagonista (WebP + PNG)
├── scripts/
│   ├── verify-export.mjs           # Validação dos artefatos estáticos em out/
│   └── verify-security.mjs         # Auditoria de segredos e isolamento da Platform
├── src/
│   ├── app/                        # Rotas estáticas (/, /contato, /404, robots.txt, sitemap.xml)
│   ├── components/                 # Identidade DevEssent, Hero 100svh, Portfólio, Contato
│   ├── config/site.ts              # Conteúdo institucional e variáveis públicas
│   └── lib/contact.ts              # Validação, sanitização e formatação de briefing
├── supabase/
│   ├── config.toml                 # Configuração Supabase dedicada (sem Auth/Realtime/Storage)
│   ├── migrations/                 # Tabela marketing_leads com RLS deny-by-default
│   └── functions/marketing-contact/# Edge Function pública com Turnstile, CORS e rate-limit
├── tests/                          # Testes unitários do formulário e da Edge Function
├── .env.example                    # Modelo de variáveis públicas (zero segredos)
└── next.config.ts                  # output: "export", images.unoptimized, sem sourcemaps públicos
```

## Instalação e Desenvolvimento Local

Execute todos os comandos a partir de `apps/landing`:

```bash
cd apps/landing
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

A aplicação sobe em `http://localhost:3001` (porta separada da Platform `3000`).

## Scripts Disponíveis

| Script | Finalidade |
| --- | --- |
| `pnpm dev` | Servidor local de desenvolvimento na porta `3001` |
| `pnpm lint` | Validação ESLint + regras Next.js |
| `pnpm typecheck` | Verificação estrita TypeScript (`tsc --noEmit`) |
| `pnpm test` | Testes unitários (validação de contato e segurança da Edge Function) |
| `pnpm check:security` | Verifica ausência de `.env`, `service_role` e acoplamento com a Platform |
| `pnpm build` | Gera exportação estática em `apps/landing/out` |
| `pnpm check:export` | Confirma arquivos obrigatórios em `out/` e ausência de sourcemaps `.map` |

## Variáveis de Ambiente Públicas

Configurar no painel do Cloudflare Pages (Production e Preview) apenas variáveis públicas (`NEXT_PUBLIC_*`):

- `NEXT_PUBLIC_SITE_URL`: URL canônica publicada (ex.: `https://devessent-landing.pages.dev` ou domínio próprio)
- `NEXT_PUBLIC_CONTACT_WHATSAPP`: WhatsApp comercial com DDI + DDD (somente dígitos)
- `NEXT_PUBLIC_CONTACT_INSTAGRAM`: URL ou `@usuario` oficial do Instagram
- `NEXT_PUBLIC_CONTACT_EMAIL`: E-mail comercial público
- `NEXT_PUBLIC_CONTACT_ENDPOINT` *(opcional)*: URL da Edge Function `marketing-contact` do projeto Supabase dedicado
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(opcional)*: Chave pública `anon` do projeto Supabase de marketing (nunca `service_role`)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` *(opcional)*: Site Key pública do Cloudflare Turnstile

Quando `NEXT_PUBLIC_CONTACT_ENDPOINT` não estiver preenchido, o formulário `/contato` opera em modo transparente de **encaminhamento assistido**, validando os campos e gerando o briefing estruturado pronto para WhatsApp, e-mail ou cópia.

## Documentação Operacional

- Deploy e Cloudflare Pages: [`docs/LANDING_CLOUDFLARE_DEPLOY.md`](../../docs/LANDING_CLOUDFLARE_DEPLOY.md)
- Supabase Marketing, RLS e Edge Functions: [`docs/LANDING_SUPABASE_INTEGRATION.md`](../../docs/LANDING_SUPABASE_INTEGRATION.md)
- GitHub Actions e Isolamento de CI: [`docs/LANDING_GITHUB_WORKFLOW.md`](../../docs/LANDING_GITHUB_WORKFLOW.md)
