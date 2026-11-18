# DevEssent Platform — Guia de Desenvolvimento

## 1. Requisitos do Ambiente
- Node.js >= 20 (recomendado 22+ ou 24+)
- pnpm >= 9 (recomendado 12+)
- Git

## 2. Instalação e Execução

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local

# 3. Validar ambiente e integridade da estrutura
pnpm check:env
pnpm check:project

# 4. Executar suíte de testes
pnpm test

# 5. Iniciar servidor de desenvolvimento
pnpm dev
```

## 3. Comandos Padronizados

- `pnpm dev`: Inicia o servidor local Next.js na porta 3000.
- `pnpm build`: Constrói a aplicação para produção com checagem rigorosa de tipos e lint.
- `pnpm start`: Inicia o servidor otimizado de produção.
- `pnpm lint`: Executa análise estática de código com ESLint.
- `pnpm typecheck`: Executa validação de tipos TypeScript sem emitir arquivos.
- `pnpm test`: Executa testes unitários e de segurança com Vitest.
- `pnpm check:env`: Valida sanidade das variáveis de ambiente.
- `pnpm check:project`: Garante integridade arquitetural e isolamento de `sandbox-data/`.

