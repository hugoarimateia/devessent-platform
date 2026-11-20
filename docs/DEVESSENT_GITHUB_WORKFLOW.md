# DevEssent Platform — Fluxo de Trabalho Git, GitHub e CI

> **Repositório Privado Oficial:** `https://github.com/hugoarimateia/devessent-platform`  
> **Branch Padrão:** `main` (linha estável revisada — **não equivale a deploy automático em produção comercial**)

---

## 1. Identidade do Repositório e Escopo

- **Remote HTTPS:** `https://github.com/hugoarimateia/devessent-platform.git`
- **Visibilidade:** Privado (`hugoarimateia/devessent-platform`)
- **Escopo exclusivo:** Código-fonte, migrations SQL oficiais (`supabase/migrations/`), testes, scripts e documentação da **DevEssent Platform**.
- **Fora de escopo:** A landing page institucional da DevEssent permanece separada e não deve ser misturada neste repositório sem decisão formal.

---

## 2. Padrão de Branches

| Branch | Finalidade |
| --- | --- |
| `main` | Linha estável e revisada da DevEssent Platform. Recebe alterações validadas por checklist de segurança e CI. |
| `feature/<assunto>` | Desenvolvimento isolado de novas funcionalidades (ex.: `feature/retail-shipping-rules`). |
| `fix/<assunto>` | Correções pontuais de bugs ou segurança (ex.: `fix/order-receipt-timezone`). |

Regras estritas:
- **Proibido** `git push --force`, `git push --mirror`, `git reset --hard` em histórico compartilhado ou desativação de checks para forçar merge.
- Evite criar dezenas de branches temporárias sem necessidade.

---

## 3. Procedimentos Diários de Git

### Consultar Estado Local

```bash
git status -sb
git branch -vv
git log --oneline --decorate -n 10
```

### Atualizar com o Remoto (Sem Reescrever Histórico)

```bash
git fetch origin
git pull --ff-only origin main
```

### Criar Branch de Trabalho, Commitar e Publicar

```bash
# 1. Criar branch a partir de main atualizada
git checkout main
git pull --ff-only origin main
git checkout -b feature/minha-entrega

# 2. Revisar o que será incluído
git status
git diff

# 3. Adicionar apenas arquivos auditados
git add <arquivos>
git diff --cached --stat

# 4. Commitar com mensagem clara (Conventional Commits)
git commit -m "feat(retail): descricao objetiva da alteracao"

# 5. Enviar branch para o GitHub
git push -u origin feature/minha-entrega
```

---

## 4. Como Trabalhar com o Antigravity Sem Sobrescrever Alterações

1. **Antes de iniciar uma sessão com o Antigravity:** execute `git status` e garanta que alterações manuais em andamento estejam commitadas em uma branch ou guardadas em `git stash`.
2. **Use branches isoladas** (`feature/...` ou `fix/...`) para tarefas grandes, mantendo `main` limpa e sempre recuperável.
3. **Antes de sincronizar com outra pessoa:** faça `git fetch origin` e revise `git log HEAD..origin/main --oneline` antes de fazer merge ou pull.
4. **Conflitos:** nunca resolva com `--force`; resolva conflitos localmente, reexecute `pnpm typecheck`, `pnpm lint` e testes antes de commitar o merge.

---

## 5. Fluxo de Pull Request e Revisão

1. Abra um Pull Request no GitHub apontando para `main`.
2. Aguarde a conclusão verde do workflow **CI (`ci.yml`)**.
3. Revise o diff completo verificando:
   - Ausência de arquivos `.env*`, tokens, senhas ou credenciais.
   - Ausência de alterações não intencionais em migrations já aplicadas (`supabase/migrations/`).
   - Preservação do isolamento multiempresa (RLS/RBAC) e das proteções de pagamento Sandbox.
4. Após aprovação (ou revisão manual documentada quando branch protection não estiver disponível no plano privado atual do GitHub), realize o merge em `main`.

> [!NOTE]
> Em repositórios privados no plano **GitHub Free**, regras avançadas de *Branch Protection* e *Required Status Checks* podem ter disponibilidade restrita. Quando indisponíveis no plano atual, a revisão manual do PR e a verificação do CI verde permanecem obrigatórias como disciplina operacional.

---

## 6. Checklist Obrigatório Pré-Push (Segredos e Qualidade)

Antes de executar `git push`, confirme **todos** os itens abaixo:

- [ ] `git status` não lista `.env.local`, `.env.staging.local`, `*credentials*.json`, `local-test/staging/`, `local-test/xampp/.credentials.local.json`, `supabase/.temp/`, `backups/`, `scratch/`, `*.pem` ou `*.key`.
- [ ] Nenhum arquivo staged contém `SUPABASE_SERVICE_ROLE_KEY`, senhas PostgreSQL, `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`, tokens OAuth, chaves Mercado Pago, `XAMPP_SESSION_SECRET` ou strings JWT/HMAC reais.
- [ ] `.env.example` possui apenas nomes de variáveis e placeholders inofensivos.
- [ ] `pnpm check:project` aprovado.
- [ ] `pnpm typecheck` aprovado com 0 erros.
- [ ] `pnpm lint` aprovado com 0 avisos/erros.
- [ ] `pnpm vitest run tests/unit/` aprovado 100%.
- [ ] Build validado (`NODE_OPTIONS="--dns-result-order=ipv4first" pnpm build` ou via CI).

---

## 7. GitHub Actions — Estrutura do CI Seguro e Econômico

O workflow oficial está em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

- **Gatilhos:** `pull_request` e `push` na branch `main` (com `concurrency` cancelando execuções obsoletas do mesmo PR/ref para economizar minutos).
- **Menor privilégio:** `permissions: contents: read` (sem permissão de escrita no repositório nem acesso a segredos de nuvem).
- **Supply-chain:** Actions oficiais fixadas por **commit SHA** (`actions/checkout`, `pnpm/action-setup`, `actions/setup-node`) com cache de store do `pnpm` e instalação determinística `pnpm install --frozen-lockfile`.
- **Verificações executadas (100% offline e seguras):**
  1. `pnpm check:project` — validação de arquitetura modular e isolamento de `sandbox-data/`.
  2. `pnpm typecheck` — checagem estrita TypeScript (`tsc --noEmit`).
  3. `pnpm lint` — validação ESLint / Next.js.
  4. `pnpm vitest run tests/unit/` — suíte completa de testes unitários offline (incluindo invariantes de pedidos, pagamentos, criptografia e guarda de staging).
  5. `pnpm build` — compilação de produção do Next.js utilizando **variáveis dummy explícitas de CI** (`NEXT_PUBLIC_SUPABASE_URL=https://ci-placeholder.invalid`, etc.), sem conectar nenhum banco real, sem `service_role` real e sem enfraquecer validações do runtime.

### O Que o CI Intencionalmente NÃO Executa

- **Não** executa `supabase db push`, seeds ou testes destrutivos contra o Supabase Cloud (`auebnppzxcvtaaqqlbts`).
- **Não** depende de MariaDB/XAMPP nem de gateways externos.
- **Não** utiliza `SUPABASE_SERVICE_ROLE_KEY` real, credenciais financeiras ou tokens de produção.
- **Não** aciona deploy automático no Cloudflare.

---

## 8. Como Recuperar Alterações via Git Sem Afetar o Banco de Dados

O histórico Git controla exclusivamente o código e os arquivos de migration; reverter código no Git **nunca apaga dados** no Supabase Cloud.

```bash
# Inspecionar commits anteriores
git log --oneline -n 15

# Restaurar um arquivo específico a partir de um commit anterior (sem reescrever histórico)
git checkout <commit-sha> -- caminho/do/arquivo.ts

# Reverter um commit já publicado de forma segura (criando novo commit reverso)
git revert <commit-sha>
```

> [!WARNING]
> **Nunca** apague ou edite retroativamente migrations SQL que já foram aplicadas no Supabase Cloud (`supabase/migrations/20260301000001`–`000014`). Correções de schema devem sempre ser criadas como **novas migrations aditivas versionadas**.

---

## 9. Separação de Responsabilidades: GitHub × Supabase × Cloudflare

| Plataforma | Responsabilidade Atual | Automação Ativa |
| --- | --- | --- |
| **GitHub** (`hugoarimateia/devessent-platform`) | Versionamento privado, revisão de código e CI offline (`ci.yml`) | Apenas CI offline (sem deploy, sem DB push) |
| **Supabase Cloud** (`auebnppzxcvtaaqqlbts`) | PostgreSQL gerenciado, RLS/RBAC, Auth e Storage (`retail-media`) de Staging | Migrations aplicadas localmente via CLI após conferência explícita do `project-ref` |
| **Cloudflare** (Futura fase) | Hospedagem futura da aplicação web (Pages/Workers) | **Não ativado nesta fase** |

### Requisitos Registrados para Futura Integração Cloudflare

Quando a hospedagem no Cloudflare Pages/Workers for avaliada em fase dedicada, validar:
1. Compatibilidade de **Next.js App Router SSR / Server Actions** (OpenNext Cloudflare adapter ou equivalente homologado).
2. Configuração de **Supabase Auth Redirect URLs** e `NEXT_PUBLIC_APP_URL` para o domínio oficial HTTPS.
3. Roteamento seguro de **Webhooks financeiros** (`/api/webhooks/retail/payments/[provider]`) com validação HMAC-SHA256 e proteção contra replay.
4. Armazenamento de segredos exclusivos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`) exclusivamente no cofre encriptado do Cloudflare com escopo por ambiente (`staging` vs `production`) e aprovação manual.
