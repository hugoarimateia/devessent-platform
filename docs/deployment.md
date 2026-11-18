# DevEssent Platform — Procedimentos de Implantação

## 1. Princípios Operacionais de Deploy
- **Ambiente Imutável:** O bundle gerado para produção não contém scripts de seed nem fixtures de desenvolvimento.
- **Fail-Closed:** A aplicação não sobe caso as variáveis de ambiente obrigatórias não passem no schema de validação (`src/lib/environment/env.ts`).
- **Segurança de Segredos:** A chave `SUPABASE_SERVICE_ROLE_KEY` é estritamente confidencial e nunca deve ser configurada em variáveis com prefixo `NEXT_PUBLIC_`.

## 2. Checklist Pré-Deploy
- [ ] `pnpm check:project` executado com sucesso (zero violações de import de sandbox-data).
- [ ] `pnpm check:env` validado com configurações de homologação/produção.
- [ ] `pnpm typecheck` aprovado sem qualquer erro.
- [ ] `pnpm test` aprovado com 100% dos testes unitários e de segurança passando.
- [ ] `pnpm build` finalizado com sucesso.
- [ ] Migrations SQL aplicadas no PostgreSQL do destino.

