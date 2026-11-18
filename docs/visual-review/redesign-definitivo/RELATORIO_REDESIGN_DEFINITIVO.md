# DevEssent Platform Core — Relatório do Redesign Estrutural do Frontend

> Documento comparativo **Antes vs Depois** e registro técnico do redesign estrutural do frontend, preparado para inspeção humana prévia à Fase 5B.

## 1. Resumo das Mudanças Estruturais

Toda a camada visual e de navegação foi reconstruída sobre o núcleo funcional existente (preservando 100% das regras de negócio, Supabase Auth SSR, PostgreSQL/RLS, isolamento multiempresa e tokens dinâmicos via `tenant_settings`), combinando a densidade operacional do **DevEssent Retail OS** com a identidade tipográfica do **DevEssent CRM**:

- **Marca & Identidade:** Monograma prismático geométrico próprio (`DevEssentMark` / `DevEssentWordmark` em `src/components/brand/devessent-mark.tsx`), eliminando o badge genérico `"DE"`.
- **Tipografia & Tokens:** `Space Grotesk` (títulos), `Plus Jakarta Sans` (interface) e `IBM Plex Mono` (`tabular-nums`, slugs e códigos hexadecimais) carregadas via `next/font/google` (`src/app/layout.tsx`, `tailwind.config.ts`, `src/app/globals.css`).
- **Entrada (`/login` e fluxos públicos):** Layout editorial dividido em 2 colunas (`lg:grid-cols-[1.24fr_1fr]`), canvas escuro à esquerda e superfície limpa à direita sem pílula `"Ambiente Corporativo"` ou rodapé de copyright.
- **Chrome Administrativo:** `Sidebar` colapsável (`236px` / `68px`) com item ativo em obsidiana, topbar `h-14` com `TenantSelector` discreto, `UserMenu` popover (`Menu da conta`) abrigando `"Encerrar Sessão"`, e `MobileNavigation` implementada sobre `<dialog>` nativo modal.
- **Telas Operacionais & Administrativas:** Substituição da grade uniforme de 4 cartões por faixa contínua **Operational Strip**, tabelas contínuas (`<DataTable embedded />`), painéis distintos para `staff`, `multi.member`, `solo.user` e `platform_admin`, além de gestão de estabelecimentos com tabs com contadores e timeline de auditoria.
- **Temas Dinâmicos por Estabelecimento:** `src/lib/theme/tenant-brand.ts` calcula tokens contrast-safe Light & Dark (`DEFAULT_BRAND_HEX = "#5B46E5"`), injetados em runtime pelo `AppShell`.

## 2. Capturas Comparativas & Pacote Compactado

- Pacote completo (`20` capturas `antes/` + `25` capturas `depois/`): `docs/visual-review/redesign-definitivo.zip`
- Pasta Antes: `./antes/`
- Pasta Depois: `./depois/`

Exemplos principais de inspeção direta:
- Login Desktop Light: [Antes](./antes/login-desktop-light.png) | [Depois](./depois/login-desktop-light.png)
- Login Desktop Dark: [Antes](./antes/login-desktop-dark.png) | [Depois](./depois/login-desktop-dark.png)
- Dashboard Ateliê Light: [Antes](./antes/dashboard-atelie-light.png) | [Depois](./depois/dashboard-atelie-light.png)
- Dashboard Verde Light: [Antes](./antes/dashboard-verde-light.png) | [Depois](./depois/dashboard-verde-light.png)
- Dashboard Multiempresa Light: [Antes](./antes/dashboard-multiempresa-light.png) | [Depois](./depois/dashboard-multiempresa-light.png)
- Dashboard Sem Empresa (`solo.user`): [Antes](./antes/dashboard-sem-empresa-light.png) | [Depois](./depois/dashboard-sem-empresa-light.png)
- Gestão de Membros: [Antes](./antes/dashboard-membros-light.png) | [Depois](./depois/dashboard-membros-light.png)
- Configurações do Estabelecimento: [Antes](./antes/dashboard-configuracoes-light.png) | [Depois](./depois/dashboard-configuracoes-light.png)
- Console Admin Global Light: [Antes](./antes/admin-global-light.png) | [Depois](./depois/admin-global-light.png)
- Mobile `390x844` & Drawer `<dialog>`: [Mobile 390x844](./depois/responsive-390x844-light.png) | [Drawer Aberto](./depois/responsive-mobile-menu-open-light.png)

## 3. Verificações Automatizadas (Pós-Edição)

- `pnpm check:project`: passou (`exit 0`)
- `pnpm check:env`: passou (`exit 0`)
- `pnpm typecheck`: passou (`exit 0`)
- `pnpm lint`: passou sem erros ou avisos
- `pnpm test` (`vitest run`): 12 arquivos / 104 testes aprovados
- `pnpm exec supabase test db`: 2 arquivos / 39 asserções pgTAP aprovadas
- `pnpm sandbox:verify`: 8/8 cenários Sandbox (`A` – `H`) aprovados
- `pnpm build`: compilação Next.js 15.5.29 concluída sem falhas
- `pnpm test:e2e`: 22/22 testes Playwright aprovados

## 4. Visualização Local

1. Acesse `http://localhost:3000/login` (servidor `pnpm dev` ativo na porta 3000; Supabase local operacional).
2. Liste as credenciais locais do Sandbox com `pnpm sandbox:status --show-credentials`.
3. Navegue pelos fluxos `/dashboard`, `/dashboard/membros`, `/dashboard/configuracoes`, `/admin`, `/admin/empresas` e `/admin/empresas/nova`.

