# DevEssent Platform Core — Ambiente Sandbox & Dados Fictícios Controlados

> [!CAUTION]
> **ISOLAMENTO ABSOLUTO E DADOS EXCLUSIVAMENTE SINTÉTICOS**  
> Os dados contidos e gerados por este diretório são **100% fictícios**, destinados exclusivamente ao desenvolvimento local, testes automatizados e demonstrações do **DevEssent Platform Core**.  
> **REGRA DE OURO:** Nenhum arquivo dentro de `src/` (código de produção) pode importar ou depender direta ou indiretamente deste diretório. Violações são bloqueadas pelo guardião de arquitetura (`pnpm check:project`).

---

## 1. Objetivo do Sandbox

O ambiente Sandbox fornece uma infraestrutura determinística, reproduzível e isolada para simular todos os fluxos e papéis operacionais do sistema SaaS multiempresa, permitindo:

1. Provisionamento de contas de demonstração integradas ao Supabase Auth local.
2. Criação de estabelecimentos comerciais fictícios com configurações e identidades visuais completas.
3. Atribuição de papéis RBAC (`owner`, `manager`, `staff` e `platform_admin`).
4. Simulação de usuários com múltiplos vínculos operacionais (chaveamento dinâmico de empresas).
5. Cenários controlados de convites de membros (`pending`, `expired`, `revoked`).
6. Validação automatizada de isolamento multiempresa e políticas de Row-Level Security (RLS).
7. Limpeza seletiva com integridade referencial que preserva dados de desenvolvimento reais ou manuais fora do sandbox.

---

## 2. Isolamento de Ambiente e Arquitetura Fail-Closed (`LocalGuard`)

Toda e qualquer operação executada pelos utilitários do Sandbox passa obrigatoriamente pela validação síncrona e assíncrona da classe `LocalGuard` (`sandbox-data/lib/local-guard.ts`).

A execução é abortada imediatamente com `SandboxSecurityError` (Fail-Closed) se:

- `NODE_ENV` não for `development` ou `test`.
- `NEXT_PUBLIC_APP_ENV` for `production` ou `staging`.
- `AUTHORIZED_SANDBOX_PROJECT_ID` for diferente de `devessent-platform-local`.
- `NEXT_PUBLIC_SUPABASE_URL` apontar para domínios de nuvem remota (`supabase.co`, `.aws.`, `.azure.`, `.cloud` ou IPs não-loopback).
- `DATABASE_URL` contiver indicadores de banco remoto (`pooler.supabase.com`, `.render.com`, `.railway.app`, `.neon.tech`).
- O PostgreSQL local não responder ou não contiver as tabelas estruturais obrigatórias.

---

## 3. Relação Completa de Fixtures

### 3.1 Estabelecimentos Fictícios (`sandbox-data/fixtures/companies.ts`)

| Estabelecimento | Slug Canônico | Segmento Comercial | Nome Fantasia Configurado | Cores de Identidade |
| :--- | :--- | :--- | :--- | :--- |
| **Empresa A** | `atelier-sandbox` | Moda / Alta Costura | Ateliê Sandbox & Alta Costura | `#D4C5B9` / `#2C2C2C` |
| **Empresa B** | `verde-sandbox` | Serviços Sustentáveis | Verde Sandbox Sustentabilidade | `#1B4332` / `#FFFFF0` |

### 3.2 Contas de Demonstração (`sandbox-data/fixtures/users.ts`)

Todas as contas utilizam o domínio sintético `@sandbox.devessent.test`:

| Identificador / E-mail | Papel / Responsabilidade | Vínculos de Estabelecimento |
| :--- | :--- | :--- |
| `admin.global@sandbox.devessent.test` | Administrador Geral da Plataforma | Acesso soberano global (`platform_admins`) |
| `owner.atelie@sandbox.devessent.test` | Proprietária (Owner) do Ateliê | Ateliê Sandbox (`owner`) |
| `owner.verde@sandbox.devessent.test` | Proprietário (Owner) do Verde | Verde Sandbox (`owner`) |
| `manager.atelie@sandbox.devessent.test` | Gestora (Manager) do Ateliê | Ateliê Sandbox (`manager`) |
| `staff.atelie@sandbox.devessent.test` | Funcionário (Staff) do Ateliê | Ateliê Sandbox (`staff`) |
| `multi.member@sandbox.devessent.test` | Usuário com Múltiplos Vínculos | Ateliê (`staff`) e Verde (`manager`) |
| `solo.user@sandbox.devessent.test` | Usuário Autenticado Sem Empresa | Nenhum vínculo (Estado Vazio) |

---

## 4. Cenários de Teste e Validação Cobertos (A a H)

O utilitário `pnpm sandbox:verify` executa a homologação automatizada dos 8 cenários essenciais:

- **Cenário A (Proprietário):** Acesso legítimo ao estabelecimento, listagem de membros autorizada e bloqueio absoluto de leitura de outros tenants via RLS.
- **Cenário B (Gestor):** Acesso operacional ao estabelecimento, capacidade de convidar funcionários (`staff`) e bloqueio de elevação para `owner` ou `manager`.
- **Cenário C (Funcionário):** Operação cotidiana com privilégios mínimos; tentativa de alteração de configurações institucionais bloqueada via RLS.
- **Cenário D (Usuário Multiempresa):** Chaveamento consistente de contexto entre Ateliê Sandbox (`staff`) e Verde Sandbox (`manager`) mantendo integridade de permissões.
- **Cenário E (Usuário Sem Empresa):** Autenticação válida no Supabase Auth, visualização de estado vazio amigável ("Nenhum Estabelecimento Vinculado") e rejeição de acesso a tenants arbitrários.
- **Cenário F (Administrador Global):** Validação de acesso ao Painel Central (`/admin`) e inspeção de qualquer estabelecimento registrado.
- **Cenário G (Suspensão e Restauração):** Teste de transição de status para `suspended` com bloqueio imediato (`TenantSuspendedError`) e restauração automática do estado `active`.
- **Cenário H (Ciclo de Vida de Convites):** Validação de tokens pendentes, rejeição de convites expirados e bloqueio de aceitação de convite por e-mail divergente.

---

## 5. Comandos Padronizados no Terminal

| Comando | Descrição |
| :--- | :--- |
| `pnpm sandbox:seed` | Provisiona ou atualiza de forma idempotente todas as fixtures no Supabase Auth e PostgreSQL locais. |
| `pnpm sandbox:status` | Relata o estado operacional do Sandbox (empresas, membros, usuários, convites) sem expor senhas. |
| `pnpm sandbox:status --show-credentials` | Exibe as credenciais de teste para login manual pelo desenvolvedor. |
| `pnpm sandbox:verify` | Executa a bateria de testes automatizados dos 8 cenários (A a H) contra o banco local. |
| `pnpm sandbox:cleanup --dry-run` | Exibe prévia dos registros sintéticos que serão removidos sem aplicar alterações. |
| `pnpm sandbox:cleanup --force` | Executa a remoção seletiva e segura dos dados do Sandbox respeitando integridade referencial. |

---

## 6. Gerenciamento Local e Seguro de Credenciais

Para evitar que senhas e credenciais sejam acidentalmente registradas em histórico de versão:

1. **Nenhuma senha de demonstração consta neste arquivo de documentação.**
2. Ao executar `pnpm sandbox:seed`, as credenciais são salvas localmente em:
   `sandbox-data/.credentials.local.json`
3. O arquivo `sandbox-data/.credentials.local.json` é explicitamente ignorado pelo Git (`.gitignore`).
4. Para consultar as contas e senhas ativas para navegação no browser, execute no terminal local:
   ```bash
   pnpm sandbox:status --show-credentials
   ```

---

## 7. Relação com o Git e Arquivos Ignorados

Os seguintes arquivos locais gerados pelo Sandbox são ignorados pelo Git:
- `sandbox-data/.credentials.local.json` — Cofre local de senhas de teste.
- `sandbox-data/.sandbox-manifest.json` — Manifesto dinâmico de IDs de tenants e usuários sintéticos.
- `sandbox-data/*.local.json` — Qualquer snapshot ou dump local temporário.

---

## 8. Extensibilidade: Como Adicionar Novos Dados Sintéticos via Factories

Utilize as fábricas centralizadas em `sandbox-data/factories/` para instanciar novas entidades sintéticas sem acoplamento a código de produção:

```typescript
import { UserFactory } from "../factories/user.factory";
import { TenantFactory } from "../factories/tenant.factory";
import { MembershipFactory } from "../factories/membership.factory";
import { InvitationFactory } from "../factories/invitation.factory";

// Criar nova empresa sintética
const novaEmpresa = TenantFactory.buildTenant({
  name: "Padaria Modelo Sandbox",
  slug: "padaria-sandbox",
  segmentMetadata: "alimentação e panificação",
});

// Criar novo usuário sintético
const novoUsuario = UserFactory.buildUser({
  fullName: "Padeiro Teste",
  idKey: "padeiro.teste",
  roleDescription: "Padeiro Chefe",
});

// Criar vínculo de membro
const vinculo = MembershipFactory.buildMembership("padeiro.teste", "padaria-sandbox", "staff");

// Criar convite sintético
const convite = InvitationFactory.buildInvitation("padaria-sandbox", "owner.padaria", "staff", "pending");
```

---

## 9. Procedimento para Testes Automatizados

Para testar a infraestrutura do Sandbox de ponta a ponta:

```bash
# 1. Executar testes unitários e de integração do Sandbox com Vitest
pnpm test tests/integration/sandbox-infrastructure.test.ts

# 2. Executar validação funcional de banco dos Cenários A a H
pnpm sandbox:verify

# 3. Executar testes de ponta a ponta no navegador via Playwright
pnpm test:e2e tests/e2e/sandbox-flow.spec.ts
```

---

## 10. Solução de Problemas Comuns (Troubleshooting)

### Banco de Dados Desconectado ou Inacessível
- **Sintoma:** Erro `Tentativa de execução fora do ambiente local autorizado ou contra infraestrutura remota.`
- **Causa:** Containers Docker do Supabase estão parados ou a porta `54322` não está respondendo.
- **Solução:** Execute `pnpm exec supabase start` ou `pnpm exec supabase status` para confirmar que os serviços estão saudáveis.

### Porta em Uso ou Falha no WebServer Playwright
- **Sintoma:** `Port 3000 is already in use.`
- **Solução:** Encerre instâncias residuais do `next dev` ou utilize `playwright.config.ts` com `reuseExistingServer: true`.

### Dados Residuais ou Inconsistência de IDs
- **Sintoma:** Divergência de IDs ou erro de unicidade ao alterar fixtures manualmente.
- **Solução:** Execute a limpeza e re-semeadura:
  ```bash
  pnpm sandbox:cleanup --force
  pnpm sandbox:seed
  ```
