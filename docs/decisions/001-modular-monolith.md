# ADR 001: Monólito Modular como Fundação Tecnológica

## Contexto
A DevEssent planeja comercializar múltiplos produtos SaaS (Retail, Booking, Service, CRM, Web) para micro, pequenas e médias empresas. Havia a opção de iniciar com microserviços, monorepo com pacotes separados (Turborepo) ou monólito modular.

## Decisão
Adotar inicialmente um **Monólito Modular** baseado em Next.js App Router e TypeScript strict.
Todas as regras compartilhadas (autenticação, empresas, permissões, auditoria e configurações) residem na camada `src/core/`.

## Consequências
- **Positivas:** Simplicidade de deploy, ausência de latência de rede entre serviços, compartilhamento de tipos estáticos ponta a ponta, desenvolvimento ágil com baixo custo operacional.
- **Negativas:** Requer disciplina estrita para não acoplar módulos verticais ao Core (garantida via script `check-project.ts`).

