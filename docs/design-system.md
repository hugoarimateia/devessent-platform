# Design System — DevEssent Platform Core

Este documento registra a arquitetura visual do **DevEssent Platform Core** após o redesign estrutural definitivo, unificando a precisão operacional do **DevEssent Retail OS** com a identidade editorial do **DevEssent CRM**.

---

## 1. Família Tipográfica & Escala

O projeto carrega fontes oficiais via `next/font/google` em `src/app/layout.tsx`, vinculadas às variáveis CSS em `tailwind.config.ts` e `src/app/globals.css`:

- **Display (`font-display`)**: `Space Grotesk` (pesos `500`, `600`, `700`) — empregada em `h1`, títulos de página, números de destaque, cabeçalhos de seção e marca `DevEssent`. Tracking fechado (`-0.025em` a `-0.035em`) e `text-wrap: balance`.
- **UI & Texto (`font-sans`)**: `Plus Jakarta Sans` (pesos `400`, `500`, `600`, `700`) — empregada em tabelas, formulários, rótulos de navegação e microcopy com `line-height: 1.5`.
- **Monospace (`font-mono`)**: `IBM Plex Mono` (pesos `400`, `500`, `600`) — empregada em slugs, timestamps (`tabular-nums`), códigos hexadecimais, monogramas e eyebrows técnicos.

---

## 2. Identidade Visual e Marca DevEssent

- Componente canônico em `src/components/brand/devessent-mark.tsx`:
  - `DevEssentMark`: símbolo geométrico autoral em SVG vetorial com duas camadas prismáticas intertravadas e acento prismático violeta (sem caixas `"DE"` genéricas).
  - `DevEssentWordmark`: combina `DevEssentMark` e tipografia `Space Grotesk`, com suporte a modo compacto (sidebar colapsada), invertido (superfícies escuras) e subtítulo contextual (`Platform Core`, `Workspace`, `Admin`).

---

## 3. Tokens Semânticos (Light Mode First + Dark Mode Completo)

As variáveis raiz ficam em `src/app/globals.css` seguindo `:root { color-scheme: light dark; }` e seletores baseados no atributo `<meta name="color-scheme">` / `.dark`:

| Token Semântico | Light Mode (Editorial Studio) | Dark Mode (Obsidian Studio) | Finalidade |
| --- | --- | --- | --- |
| `--background` | `#F3F4F8` | `#0A0C12` | Canvas principal da aplicação |
| `--surface` | `#FFFFFF` | `#12151F` | Superfícies primárias, tabelas e formulários |
| `--surface-sidebar` | `#FAFAFC` | `#0E1119` | Navegação lateral |
| `--surface-muted` | `#EBEDF3` | `#1A1E2B` | Fundos secundários e segmentadores |
| `--surface-border` | `#DCE0EB` | `#232839` | Linhas divisórias e filetes de 1px |
| `--foreground` | `#10131C` | `#F2F4F8` | Texto e títulos principais |
| `--foreground-muted` | `#555D75` | `#9CA4BA` | Descrições e metadados |
| `--accent` | `#5B46E5` | `#8575F2` | Destaque institucional DevEssent |

---

## 4. Identidade Dinâmica Multiempresa (`tenant_settings`)

`src/lib/theme/tenant-brand.ts` (`resolveTenantBrand`) converte os metadados persistidos no banco (`primary_color`, `segment_label`, `monogram`, `brand_description`, `display_name`) em tokens acessíveis e variáveis CSS por empresa (`--t-ink`, `--t-fill`, `--t-tint`, `--t-badge-bg`, `--t-badge-text`, `--t-border`), injetadas no `AppShell`:

- **Light & Dark automáticos**: `--t-ink-light` / `--t-ink-dark` alternam dinamicamente via CSS sem re-render ou mismatch de hidratação.
- **Zero hardcode de sandbox**: nenhuma slug fictícia é referenciada em `src/`.
- **Validação estrita**: apenas cores hexadecimais `#RRGGBB` são aceitas, com fallback seguro para `#5B46E5`.

---

## 5. Composições Estruturais Implementadas

1. **Autenticação Assimétrica (`/login`, `/recuperar-senha`, `/redefinir-senha`)**: divisão desktop `56% / 44%` com painel editorial escuro DevEssent à esquerda e formulário direto em superfície contínua à direita (sem caixa flutuante nem badges redundantes).
2. **Navegação Enxuta (`Sidebar` + `Topbar` + `UserMenu` + `MobileNavigation`)**:
   - Sidebar desktop colapsável (`236px` / `68px`), sem repetição do cartão da empresa no topo.
   - `Topbar` (`56px`) contendo um único seletor de estabelecimento e o `UserMenu` interativo (logout dentro de popover `role="menu"`, sem botão permanente na barra superior).
   - Menu móvel baseado em `<dialog>` nativo (`showModal()` e `overscroll-contain`).
3. **Dashboard (`/dashboard`) Sensível ao Papel e Estado**:
   - Eliminação da grade de 4 cartões iguais e eliminação de tabelas em dupla borda (`<DataTable embedded />`).
   - Faixa operacional contínua com filete dinâmico da empresa + composição 8/4 assimétrica.
   - Separação visível entre perfis gestores (`owner`/`manager` com indicador de convites e CTAs administrativos), `staff` (diretório operacional sem métricas vazias), `solo.user` (onboarding editorial em 3 passos) e `platform_admin` (transição para `/admin`).
4. **Administração Global (`/admin`, `/admin/empresas`, `/admin/empresas/nova`)**:
   - Bloco hero obsidian assimétrico + ledger triplo de indicadores + tabela unificada com abas e timeline vertical de auditoria.
