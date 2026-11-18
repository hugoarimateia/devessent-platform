# DevEssent Platform — Estratégia de Testes

## 1. Pirâmide de Testes

1. **Testes Unitários (Vitest)**
   - Validação de regras de negócio de Tenants (nomes, formatos de slugs, sanitização, reservas de palavras do sistema).
   - Validação de Esquemas de Configurações (`tenant_settings`, fuso horário, formatos de contato).
   - Matriz completa de permissões RBAC (`role-matrix`).
   - Hierarquia de erros customizados da aplicação (`AppError`).

2. **Testes de Segurança e Isolamento Multiempresa (Vitest)**
   - Simulação de leitura cruzada entre Empresa A e Empresa B (deve ser bloqueada).
   - Simulação de mutação não autorizada de dados alheios (deve ser rejeitada).
   - Simulação de tentativa de escalonamento de privilégio (staff tentando se tornar owner ou platform admin).
   - Simulação de acesso de usuário com tenant em status suspenso.

3. **Testes de Integração e E2E (Futuros)**
   - Fluxos de autenticação, alternância de estabelecimentos e persistência com instância ativa de banco.

