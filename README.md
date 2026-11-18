# DevEssent Platform Core

> **Fundação SaaS Multiempresa da DevEssent**  
> *Engenharia compartilhada, produtos independentes, identidade personalizada.*

---

## 1. Visão Geral
A **DevEssent Platform Core** é a espinha dorsal modular e segura desenvolvida para sustentar o ecossistema de soluções SaaS da DevEssent. O Core gerencia a autenticação, controle de estabelecimentos (tenants), permissões (RBAC), auditoria e configurações compartilhadas, permitindo a futura acoplagem de produtos comerciais independentes (Retail, Booking, Service, CRM, etc.) sem duplicação de esforço de engenharia.

---

## 2. Princípios Fundamentais
- **Simplicidade Estrutural:** Monólito modular pragmático sem camadas desnecessárias de microserviços ou mensageria prematura.
- **Isolamento Multiempresa:** Políticas duplas de segurança com PostgreSQL Row-Level Security (RLS) e validação de contexto na aplicação.
- **Proteção Sandbox:** Separação física e lógica estrita entre dados sintéticos (`sandbox-data/`) e código de produção (`src/`).
- **Negação por Padrão (Fail-Closed):** Operações não autorizadas ou variáveis ausentes encerram imediatamente o fluxo com segurança.

---

## 3. Stack Tecnológica
- **Framework:** Next.js 15 (App Router, Server Components & Server Actions)
- **Linguagem:** TypeScript strict
- **Banco de Dados:** PostgreSQL (Supabase) com RLS ativado
- **Estilização:** Tailwind CSS (Paleta sóbria DevEssent: `#0B0B0B`, `#1A1A1A`, `#A782FF`)
- **Validação:** Zod
- **Gerenciador de Pacotes:** pnpm
- **Testes:** Vitest & Playwright

---

## 4. Guia Rápido de Instalação e Execução

```bash
# Instalação das dependências
pnpm install

# Configuração de variáveis de ambiente locais
cp .env.example .env.local

# Verificação de ambiente e projeto
pnpm check:env
pnpm check:project

# Execução de testes
pnpm test

# Inicialização do servidor em desenvolvimento
pnpm dev
```

Consulte a pasta [`docs/`](./docs) para a documentação técnica completa:
- [Arquitetura Geral](./docs/architecture.md)
- [Modelagem do Banco de Dados](./docs/database.md)
- [Arquitetura de Segurança e RBAC](./docs/security.md)
- [Guia de Desenvolvimento](./docs/development.md)
- [Estratégia de Testes](./docs/testing.md)
- [Procedimentos de Implantação](./docs/deployment.md)

