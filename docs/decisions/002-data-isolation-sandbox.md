# ADR 002: Isolamento Físico e Lógico de Dados Sintéticos (Sandbox)

## Contexto
O risco de contaminação de ambientes reais com dados fictícios ou vazamento de dados de teste em produção é crítico para a confiabilidade de uma plataforma multiempresa.

## Decisão
Centralizar todos os dados artificiais, fixtures, factories e rotinas de seed/reset exclusivamente no diretório raiz `sandbox-data/`.
A aplicação real em `src/` está estritamente proibida de importar qualquer arquivo de `sandbox-data/`.
Os scripts de seed/reset possuem proteção fail-closed que bloqueia a execução fora do ambiente local identificado (`devessent-platform-local`).

## Consequências
- **Positivas:** Impossibilidade de execução acidental de seed em produção; separação física e lógica cristalina; bundles de produção limpos de dados fictícios.

