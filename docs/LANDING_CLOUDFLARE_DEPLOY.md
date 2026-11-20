# Deploy da DevEssent Landing Page no Cloudflare Pages

Guia operacional para publicação, atualização, rollback, diagnóstico e domínio personalizado da landing page (`apps/landing`) utilizando a conta Cloudflare exclusiva da DevEssent.

## 1. Arquitetura de Hospedagem

- **Plataforma:** Cloudflare Pages (plano gratuito)
- **Conta:** Conta Cloudflare exclusiva da DevEssent (**nunca** usar a conta do EJC)
- **Tipo de artefato:** Exportação estática pura do Next.js 15 (`output: "export"`) gerada em `apps/landing/out`
- **Sem SSR/Workers para renderização:** HTML, CSS, fontes self-hosted (`next/font/google`) e imagens WebP são entregues diretamente da borda global do Cloudflare, garantindo latência mínima e zero custo de compute por visualização.
- **Cabeçalhos de segurança e cache:** Gerenciados nativamente por `apps/landing/public/_headers` (HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy e cache imutável em `/_next/static/*`).

## 2. Configuração no Cloudflare Pages (Integração Oficial GitHub)

No painel da conta Cloudflare exclusiva da DevEssent:

1. Acesse **Workers & Pages → Create → Pages → Import an existing Git repository**.
2. Conecte a conta GitHub e selecione o repositório privado **`hugoarimateia/devessent-platform`**.
3. Configure os parâmetros exatos abaixo:

| Campo | Valor |
| --- | --- |
| **Project name** | `devessent-landing` (ou nome disponível atribuído pelo Cloudflare) |
| **Production branch** | `main` |
| **Framework preset** | `None` (ou `Next.js (Static HTML Export)`) |
| **Root directory (advanced)** | `apps/landing` |
| **Build command** | `pnpm install --frozen-lockfile && pnpm build && pnpm check:export` |
| **Build output directory** | `out` |

4. **Build system / Environment variables (Production e Preview):**
   - `NODE_VERSION` = `22`
   - `NEXT_PUBLIC_SITE_URL` = URL real atribuída pelo Cloudflare (ex.: `https://devessent-landing.pages.dev`)
   - `NEXT_PUBLIC_CONTACT_WHATSAPP` = número comercial com DDI+DDD (quando definido)
   - `NEXT_PUBLIC_CONTACT_INSTAGRAM` = perfil oficial (quando definido)
   - `NEXT_PUBLIC_CONTACT_EMAIL` = e-mail comercial público (quando definido)
   - `NEXT_PUBLIC_CONTACT_ENDPOINT`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = somente quando o projeto Supabase dedicado de marketing estiver ativo.
   - **Nunca** cadastrar `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY` ou credenciais da Platform no Cloudflare Pages.

5. **Build watch paths (Settings → Builds & deployments → Build watch paths):**
   - **Include paths:**
     ```text
     apps/landing/*
     ```
   - Isso impede que alterações restritas à DevEssent Platform na raiz do repositório disparem deploys desnecessários da landing page.
   - A Platform não está conectada a este projeto Pages e não sofre deploy em nenhuma hipótese.

6. **Preview deployments:**
   - Habilitado para branches não-produção (ex.: `feature/landing-cloudflare`), permitindo validar o Preview antes do merge para `main`.

## 3. Fluxo Seguro de Atualização

1. Crie uma branch a partir de `main` (ex.: `feat/landing-ajuste-copy`).
2. Faça alterações apenas em `apps/landing/**`.
3. Valide localmente dentro de `apps/landing`:
   ```bash
   pnpm check:security && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:export
   ```
4. Envie a branch para o GitHub e abra Pull Request para `main`.
5. Aguarde aprovação do workflow **Landing CI** e valide a URL de **Preview** do Cloudflare Pages (desktop + mobile + `/contato` + console sem erros).
6. Faça o merge em `main` — o Cloudflare Pages publicará automaticamente em produção via integração GitHub (sem pipeline Wrangler duplicado no GitHub Actions).

## 4. Rollback para um Deploy Anterior

1. Acesse o projeto `devessent-landing` no painel do Cloudflare Pages.
2. Abra a aba **Deployments**.
3. Localize o último deploy estável da branch `main`.
4. Clique no menu `•••` daquele deploy e selecione **Rollback to this deployment**.
5. A reversão ocorre instantaneamente na borda sem precisar reconstruir o código.

## 5. Diagnóstico de Falhas Comuns

- **Build tenta compilar a Platform:** verifique se **Root directory** está estritamente como `apps/landing`.
- **Erro de lockfile (`ERR_PNPM_OUTDATED_LOCKFILE`):** execute `pnpm install` dentro de `apps/landing` e commite apenas `apps/landing/pnpm-lock.yaml`.
- **Erro 404 ao acessar `/contato` diretamente:** confirme que `apps/landing/out/contato.html` foi gerado (`pnpm check:export`).
- **CSP bloqueando Turnstile ou Edge Function:** verifique `apps/landing/public/_headers` (`script-src`, `frame-src` para `https://challenges.cloudflare.com` e `connect-src` para `https://*.supabase.co`).

## 6. Limites Gratuitos e Custos Potenciais

- **Cloudflare Pages Free:**
  - Requests e largura de banda estática: ilimitados no plano gratuito.
  - Builds: até **500 builds/mês** (1 build concorrente).
  - Previews ilimitados por branch/PR.
  - **Risco de consumo:** apenas se forem feitos > 500 commits/mês em `apps/landing/**` (mitigado por `Build watch paths`).
- **Cloudflare Turnstile Free:** gratuito para sites padrão dentro dos limites da conta gratuita.
- **Nenhum plano pago foi contratado.**

## 7. Próximos Passos para Domínio Personalizado

Quando o domínio oficial da DevEssent (ex.: `devessent.com.br`) estiver registrado:

1. No Cloudflare Pages (`devessent-landing` → **Custom domains**), adicione o domínio apex (`devessent.com.br`) e `www.devessent.com.br`.
2. Aponte os nameservers ou registros CNAME conforme instrução do Cloudflare e aguarde emissão automática do certificado TLS/HTTPS.
3. Atualize `NEXT_PUBLIC_SITE_URL` para `https://devessent.com.br` nas variáveis de produção do Cloudflare Pages e dispare um novo build (para atualizar `canonical`, OpenGraph, `robots.txt` e `sitemap.xml`).
4. Caso a Edge Function `marketing-contact` esteja ativa, atualize `MARKETING_ALLOWED_ORIGINS` e `TURNSTILE_ALLOWED_HOSTNAMES` com o novo domínio.
