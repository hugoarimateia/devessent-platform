# ADR 003: Segurança Multiempresa via Row-Level Security e RBAC Duplo

## Contexto
Em arquiteturas multi-tenant, o vazamento de dados entre empresas distintas representa uma quebra fatal de segurança e conformidade.

## Decisão
Implementar isolamento duplo:
1. **Camada de Banco (PostgreSQL):** Row-Level Security ativado com `FORCE ROW LEVEL SECURITY` em todas as tabelas compartilhadas.
2. **Camada de Aplicação:** Serviços e policies de autorização baseados em RBAC estrito (`platform_admin`, `owner`, `manager`, `staff`), validando o contexto de tenant em cada requisição.

## Consequências
- **Positivas:** Mesmo que uma consulta de backend seja executada incorretamente sem filtro explícito de `tenant_id`, o PostgreSQL recusa a leitura/escrita com base no token da sessão autenticada.

