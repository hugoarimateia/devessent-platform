# DevEssent Platform — Guia Operacional de Staging (Supabase Cloud)

> **Ambiente oficial de desenvolvimento e homologação da DevEssent Platform**  
> Este documento **não contém segredos, tokens ou senhas**. Credenciais ficam exclusivamente em arquivos locais ignorados pelo Git.

---

## 1. Identificação do Projeto Cloud Autorizado

| Campo | Valor |
| --- | --- |
| **Organização Supabase** | `DevEssent` (`wctzfhlxtmmbvlalmuxe`) |
| **Nome do Projeto** | `dev-essent.stagging` (`dev-essent.staging`) |
| **Project Ref** | `auebnppzxcvtaaqqlbts` |
| **Região** | `sa-east-1` (São Paulo) |
| **Engine PostgreSQL** | PostgreSQL `17.11.0.019` |
| **Plano** | Free (staging / homologação — sem recursos pagos contratados) |
| **Finalidade** | Desenvolvimento diário, homologação funcional, segurança RLS/RBAC e validação de migrations |

> [!IMPORTANT]
> A Supabase CLI exibe `Target: project dev-essent.stagging (auebnppzxcvtaaqqlbts) · production` porque `production` é o nome padrão da instância primária de qualquer projeto no Supabase. **Este projeto inteiro é exclusivo de Staging** e não deve ser confundido com a futura produção comercial da DevEssent.

### Projetos Preservados (NÃO MODIFICAR)

- `vjoodpqjzxpmrfvjbxrq` (`devessent-platform-staging`, organização anterior — preservado como referência)
- `guppedddwnuvluhiaaas` (`EJCMONTESIAO`)
- `hhjqlkickedbnlbuxwlo` (`BrokeOS`)

Os scripts `pnpm dev:staging`, `pnpm staging:seed` e `pnpm staging:seed:status` possuem bloqueio fail-closed em [`scripts/lib/staging-env.ts`](../scripts/lib/staging-env.ts) e **abortam imediatamente** se a URL, as chaves ou o link da CLI divergirem de `auebnppzxcvtaaqqlbts`.

---

## 2. Arquitetura de Ambientes e Arquivos `.env`

A DevEssent Platform mantém ambientes estritamente isolados, **sem fallback automático** entre bancos:

| Ambiente | Banco | Arquivo Local (Gitignored) | Comando Oficial |
| --- | --- | --- | --- |
| **Supabase Cloud Staging (Preferencial)** | PostgreSQL Cloud (`auebnppzxcvtaaqqlbts`) | `.env.staging.local` | `pnpm dev:staging` |
| **XAMPP Local (Secundário, offline)** | MariaDB local (`127.0.0.1:3306`) | `.env.local` | `pnpm dev:xampp` |
| **Futura Produção (Ainda não publicada)** | Projeto Supabase dedicado futuro | Secrets do provedor (Cloudflare/CI) | Definido em fase futura |

### Configuração de `.env.staging.local`

Crie (ou mantenha) `.env.staging.local` na raiz do projeto com os nomes de variáveis abaixo (veja `.env.example` para referência):

```env
APP_BACKEND_MODE=supabase
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEVESSENT_EXPECTED_STAGING_PROJECT_REF=auebnppzxcvtaaqqlbts
NEXT_PUBLIC_SUPABASE_URL=https://auebnppzxcvtaaqqlbts.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<CHAVE_PUBLICA_DO_PROJETO_STAGING>
SUPABASE_SERVICE_ROLE_KEY=<CHAVE_SERVICE_ROLE_EXCLUSIVA_SERVIDOR>
PAYMENT_CREDENTIALS_ENCRYPTION_KEY=<CHAVE_HEX_32_BYTES_EXCLUSIVA_STAGING>
```

Regras obrigatórias:
- **Nunca** insira segredos em variáveis `NEXT_PUBLIC_*`.
- **Nunca** versionar `.env.local`, `.env.staging.local` ou arquivos `*credentials*.json`.
- O script `pnpm dev:staging` injeta as variáveis de `.env.staging.local` diretamente em `process.env` antes de iniciar o Next.js e remove variáveis conflitantes de XAMPP/local, impedindo sobrescrita silenciosa pelo `.env.local`.

---

## 3. Comandos Principais

### Iniciar a Plataforma no Staging Cloud (Sem Docker)

```bash
pnpm dev:staging
```

Acesse `http://localhost:3000`. Para confirmar em runtime que o processo está conectado ao staging autorizado, consulte:

```
GET http://localhost:3000/api/health
```

Resposta esperada (sem segredos):
```json
{
  "status": "healthy",
  "environment": "staging",
  "backendMode": "supabase",
  "databaseHost": "auebnppzxcvtaaqqlbts.supabase.co"
}
```

### Build e Execução Otimizada em Staging (Opcional / Benchmark)

```bash
pnpm build:staging
pnpm start:staging
```

### Dados Demonstrativos Permanentes (Idempotentes)

```bash
# Provisiona (ou verifica) as 2 empresas fictícias, contas Auth, catálogo, imagens no Storage e pedidos
pnpm staging:seed

# Exibe resumo somente-leitura das entidades demonstrativas disponíveis (nunca imprime senhas)
pnpm staging:seed:status
```

O script `pnpm staging:seed` é **100% idempotente**: não duplica empresas/produtos/pedidos, não sobrescreve edições feitas manualmente e nunca executa resets ou exclusões destrutivas.

### Iniciar o Ambiente Secundário XAMPP (Offline)

```bash
# Requer MariaDB ativo no painel do XAMPP em 127.0.0.1:3306
pnpm dev:xampp
```

Ao alternar entre `pnpm dev:staging` e `pnpm dev:xampp`, os launchers limpam automaticamente o cache `.next/` sempre que o modo muda para evitar chunks/bundles `NEXT_PUBLIC_*` residuais.

---

## 4. Como Acessar as Contas Demonstrativas

As 7 contas fictícias exclusivas de Staging são provisionadas no Supabase Auth de `auebnppzxcvtaaqqlbts` com senhas fortes geradas localmente.

- **Arquivo local de credenciais (ignorado pelo Git):**
  `local-test/staging/.credentials.staging.local.json`
- **Como consultar localmente (PowerShell):**
  ```powershell
  Get-Content local-test/staging/.credentials.staging.local.json
  ```

### Papéis Provisionados

| Conta (E-mail) | Papel | Escopo |
| --- | --- | --- |
| `admin.staging@devessent-demo.com` | **Platform Admin** | Administração global (`/admin`, `/admin/sites`), governança de templates e conexões Sandbox |
| `owner.atelie@devessent-demo.com` | **Owner** | Proprietária exclusiva do **Ateliê Demonstrativo** |
| `manager.atelie@devessent-demo.com` | **Manager** | Gestora operacional do **Ateliê Demonstrativo** |
| `staff.atelie@devessent-demo.com` | **Staff** | Equipe com acesso restrito no **Ateliê Demonstrativo** (bloqueada em ações administrativas/financeiras) |
| `owner.verde@devessent-demo.com` | **Owner** | Proprietário exclusivo da **Verde Demonstrativo** |
| `staff.verde@devessent-demo.com` | **Staff** | Equipe com acesso restrito na **Verde Demonstrativo** |
| `multi.gestor@devessent-demo.com` | **Manager (Multiempresa)** | Gestora vinculada às duas empresas — ideal para testar a **alternância de estabelecimento** no Dashboard |

### Lojas Públicas Demonstrativas

- **Ateliê Demonstrativo (Vitrine Editorial):** `http://localhost:3000/loja/atelie-demonstrativo`
- **Verde Demonstrativo (Vitrine Experimental):** `http://localhost:3000/loja/verde-demonstrativo`

---

## 5. Como Consultar o Banco e Verificar Migrations

### Conferir Migrations Aplicadas (Sem Alterar o Banco)

```bash
npx supabase migration list --remote
npx supabase db push --dry-run --remote
```

Antes de qualquer `npx supabase db push --remote`, confirme sempre que o destino exibido é `auebnppzxcvtaaqqlbts`. **Nunca** execute `supabase db reset` remoto nem `migration repair` para mascarar erros.

### Consultas Somente-Leitura no PostgreSQL Cloud

```bash
npx supabase db query --remote --read-only "SELECT slug, name, status FROM public.tenants ORDER BY slug;"
```

### Advisories de Segurança e Performance

```bash
npx supabase db advisors --remote
```

---

## 6. Rotinas Diárias de Teste

### Cadastrar Produtos e Fazer Upload de Imagens

1. Inicie `pnpm dev:staging` e faça login em `/login` como `owner.atelie@devessent-demo.com`.
2. Acesse `/dashboard/retail/produtos` -> **Novo Produto**.
3. Preencha nome, slug, descrição, categorias, SKU, preço, estoque e marque **Publicado**.
4. Clique em **Criar Produto**. Na tela de edição do produto criado, use **Adicionar Imagem** na seção *3. Imagens do Produto (Supabase Storage)* para enviar um arquivo JPG, PNG, WebP ou GIF (até 5 MB).
5. Abra `/loja/atelie-demonstrativo` para conferir o produto e a imagem servida diretamente do bucket `retail-media`.

### Testar Carrinho, Checkout, Pedidos e Estoque Transacional

1. Em uma aba anônima (ou sem login administrativo), acesse `/loja/atelie-demonstrativo` ou `/loja/verde-demonstrativo`.
2. Abra um produto, selecione uma variante e clique em **Adicionar à sacola**.
3. Avance para **Finalizar Pedido**, preencha dados fictícios e envie a solicitação — você receberá a página de recibo com protocolo.
4. No painel administrativo (`/dashboard/retail/pedidos`), abra o pedido recém-solicitado e clique em **Confirmar Pedido** (baixa atômica de estoque via RPC `confirm_retail_order`) ou **Cancelar Pedido** (reposição atômica via RPC `cancel_retail_order`).

---

## 7. Alternância Segura entre Staging e XAMPP (Isolamento de Cookies)

Todos os cookies de sessão e loja são isolados por ambiente:

| Finalidade | Supabase Staging (`dev:staging`) | XAMPP Local (`dev:xampp`) |
| --- | --- | --- |
| Sessão Auth | `sb-auebnppzxcvtaaqqlbts-auth-token*` | `devessent_xampp_session` |
| Tenant Ativo | `devessent_staging_active_tenant` | `devessent_xampp_active_tenant` |
| Carrinho | `devessent_staging_cart_<slug>` | `devessent_xampp_cart_<slug>` |
| Recibo | `devessent_staging_receipt_<slug>_<pedido>` | `devessent_xampp_receipt_<slug>_<pedido>` |

Se desejar limpar manualmente cookies locais de teste sem afetar outros sites ou produção:
1. Abra o DevTools em `http://localhost:3000` -> **Application** -> **Cookies** -> `http://localhost:3000`.
2. Remova apenas cookies com prefixo `sb-auebnppzxcvtaaqqlbts-`, `devessent_staging_` ou `devessent_xampp_`.

---

## 8. Comandos de Testes

```bash
# Auditoria estrutural, variáveis e tipagem
pnpm check:project
pnpm check:env
DEVESSENT_ENV_FILE=.env.staging.local pnpm check:env
pnpm typecheck
pnpm lint

# Testes unitários offline (não dependem de nuvem nem MariaDB)
pnpm vitest run tests/unit/

# Suítes PostgreSQL reais apontadas explicitamente para Staging Cloud (fixtures isoladas)
DEVESSENT_ENV_FILE=.env.staging.local pnpm vitest run --fileParallelism=false \
  tests/integration/real-db-isolation.test.ts \
  tests/integration/tenant-multitenancy.test.ts \
  tests/integration/fase5b-operational-consolidation.test.ts \
  tests/integration/retail-catalog-isolation.test.ts \
  tests/integration/retail-storefront.test.ts \
  tests/integration/retail-orders-supabase-security.test.ts \
  tests/integration/retail-payments-supabase-staging.test.ts \
  tests/security/api-security-audit.test.ts \
  tests/security/multi-tenant-isolation.test.ts
```

> [!NOTE]
> As suítes `tests/integration/retail-orders-xampp.test.ts` e `tests/security/fase6c-checkout-security.test.ts` exigem MariaDB ativo em `127.0.0.1:3306`. Já a suíte `tests/integration/sandbox-infrastructure.test.ts` (seção 4) e o teste #6 de `auth-real-flow.test.ts` (Mailpit `127.0.0.1:54324`) pressupõem Supabase Local em Docker.

---

## 9. Diagnóstico de Erros Comuns

| Sintoma | Causa Provável | Resolução |
| --- | --- | --- |
| `CONFLITO DE AMBIENTE: APP_BACKEND_MODE="xampp-test"` | Variável de ambiente XAMPP ficou exportada no shell atual | Abra um terminal limpo ou execute `Remove-Item Env:APP_BACKEND_MODE` (PowerShell) antes de `pnpm dev:staging` |
| `Arquivo de ambiente de staging não encontrado` | `.env.staging.local` ausente na raiz | Crie `.env.staging.local` conforme a Seção 2 |
| `BLOQUEIO DE DESTINO` ou `OPERAÇÃO ABORTADA` | URL ou chave aponta para projeto diferente de `auebnppzxcvtaaqqlbts` | Confira `NEXT_PUBLIC_SUPABASE_URL` e as chaves do projeto `dev-essent.stagging` |
| Timeout em `next/font/google` no Windows | Resolução DNS IPv6 lenta no Node | Já mitigado automaticamente em `pnpm dev:staging` via `NODE_OPTIONS=--dns-result-order=ipv4first`; ao rodar `pnpm build` manualmente, defina `NODE_OPTIONS=--dns-result-order=ipv4first` |
| Compilação inicial lenta (15–35s) na primeira rota | Compilação on-demand do Next.js em modo `dev` local | Comportamento normal de desenvolvimento; navegações aquecidas e `pnpm build:staging` + `pnpm start:staging` são significativamente mais rápidas |

---

## 10. Funcionalidades Ainda NÃO Prontas para Produção Comercial

- **Pagamentos Live (Mercado Pago Produção):** Bloqueados por `CHECK (environment = 'sandbox')` no PostgreSQL e pela arquitetura da Fase 6D. Apenas simulações Sandbox estão habilitadas; nenhuma cobrança real ou credencial OAuth live foi ativada.
- **Recuperação de Senha via SMTP Real:** O fluxo técnico (`/recuperar-senha` -> `resetPasswordForEmail` -> `/auth/callback` -> `/redefinir-senha`) está implementado, porém **não há provedor SMTP customizado homologado** no Supabase Cloud Staging (envio real de e-mails depende de configuração externa futura e Redirect URLs configuradas no painel Supabase Auth).
- **Deploy Automático em Produção (Cloudflare Pages/Workers):** Ainda não ativado; será avaliado em fase dedicada após revisão de SSR, webhooks e segredos de ambiente.
- **Limites do Plano Free Supabase:** Adequado para desenvolvimento e homologação moderada; antes da entrada em produção comercial com clientes reais, avaliar upgrade para plano Pro (backups automáticos, sem pausa por inatividade, maior limite de conexões e SMTP customizado).
