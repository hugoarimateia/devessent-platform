# Decisões Visuais e Técnicas — DevEssent Landing Page v1.0

Este documento registra as decisões de direção de arte, engenharia de interface, reprodução cromática, tipografia e tratamento de assets aplicadas na construção da landing page institucional da **DevEssent**, seguindo integralmente `PROMPT_ANTIGRAVITY.md`, `GUIA_IDENTIDADE.md`, `CONCEITO_E_ROTEIRO.md` e `01_landing_page_referencia.png`.

---

## 1. Fidelidade à Paleta Cromática e Tokens (`tokens.css`)

Todas as cores seguem estritamente os tokens especificados na identidade oficial, centralizados em `src/app/globals.css`:

- **Background Principal (`--de-bg`):** `#0B0B0B` — Preto espacial profundo, evitando cinzas lavados.
- **Superfície (`--de-surface`):** `#1A1A1A` e `--de-surface-elevated: #24212D` — Aplicados com translúcidez controlada e `backdrop-filter: blur(12px)` sobre os cartões.
- **Tom Atmosférico (`--de-atmosphere`):** `#161124` — Usado em gradientes radiais suaves no topo esquerdo e atrás do capacete do astronauta para reproduzir a profundidade índigo/violeta da referência `01_landing_page_referencia.png`.
- **Destaque Primário (`--de-accent`):** `#A782FF` — Aplicado na palavra **EVOLUEM.**, sublinhado ativo da navegação, botão primário, nós orbitais e indicadores HUD.
- **Lilás de Apoio (`--de-accent-soft`):** `#B695FF` — Aplicado em gradientes sutis de botões, bordas de foco/hover e ícones lineares.
- **Texto Principal (`--de-text`):** `#E9E7DF` — Branco quente editorial de alto contraste sobre `#0B0B0B` e `#1A1A1A`.
- **Texto Secundário (`--de-text-muted`):** `#BAB5C5` — Reservado para parágrafos de apoio e descrições técnicas.

Nenhuma cor fora da identidade (como ciano, neon saturado, amarelo ou laranja) foi introduzida nos componentes da marca.

---

## 2. Tipografia e Hierarquia Editorial

Carregadas via `next/font/google` em `src/app/layout.tsx` com variáveis CSS:

1. **Títulos e Wordmark (`Space Grotesk` — `--font-space-grotesk`):**
   - Escolhida pela geometria técnica e excelente leitura em caixa-alta espaçada na Headline principal (`TECNOLOGIA ESSENCIAL PARA NEGÓCIOS QUE EVOLUEM.`), bem como na reconstrução inclinada (`-skew-x-10`) do wordmark **DevEssent**.
2. **Corpo e Interface (`Inter` — `--font-inter`):**
   - Aplicada em parágrafos comerciais, descrições de cards, inputs e textos longos sem excesso de `letter-spacing`.
3. **Microtexto Técnico HUD (`Orbitron` — `--font-orbitron`):**
   - Uso pontual e disciplinado em índices (`782`, `SYS // 01`, `STEP // DIAG`), eyebrows (`SOFTWARE HOUSE`) e rótulos técnicos (`ESSENT`).
4. **Elemento Editorial Japonês (`本質`):**
   - Marcado semanticamente com `lang="ja"` dentro do componente `<EssentOctagonBadge />`, acompanhado da legenda `ESSENT` ou `ESSÊNCIA` e barra luminosa `#A782FF`.

---

## 3. Vetorização do Logotipo e Elementos Gráficos

- **`<DevEssentLogo />` (`src/components/DevEssentLogo.tsx`):**
  - Reconstruído manualmente em SVG vetorial a partir de `03_logo_wordmark.png` e `09_logo_variacoes.png`, preservando a haste diagonal inferior esquerda em `#E9E7DF` e os segmentos geométricos angulosos em `#A782FF`/`#B695FF`.
  - O símbolo `®` presente nos mockups rasterizados foi **intencionalmente omitido**, cumprindo a diretriz explícita de não exibir marca registrada sem confirmação de registro ativo.
- **Componentes HUD (`src/components/TechDecor.tsx`):**
  - Barras paralelas inclinadas (`//////` com 4 preenchidas e 2 vazadas), mira circular, código de barras lilás, globo em wireframe com cantoneiras, selo octogonal `本質 / ESSENT` e os 6 ícones lineares de sistemas foram todos reconstruídos em SVG puro e semântico.

---

## 4. Tratamento do Asset do Astronauta e Lista de Assets Faltantes/Futuros

### O que foi feito nesta implementação (`scripts/process_astronaut.py`):
Como o kit de referência forneceu apenas imagens rasterizadas sem transparência (`04_hero_astronauta_contexto.png`), executamos um pipeline automatizado e reprodutível em Python/Pillow que:
1. **Removeu a insígnia de terceiros (`NASA`)** do traje no peito do astronauta, reconstruindo a textura escura do patch tático sem marcas externas.
2. **Removeu os textos rasterizados à direita e no topo** (`[782]`, quadro `本質 / ESSENT`, barras `//////` e lista `// SISTEMAS...`) para que todos esses elementos sejam renderizados como **DOM e SVG reais, nítidos e acessíveis** em `<AstronautScene />`.
3. **Aplicou máscara gradual de borda (feathering)** e exportou `public/images/astronaut-hero.webp` (39 KB) e `public/images/astronaut-hero.png` para integração contínua com o fundo espacial `#0B0B0B` / `#161124`.

### Lista Explícita de Assets Oficiais Recomendados para Substituição Futura:
Para evolução futura da marca em materiais de altíssima resolução (4K+) ou animações em camadas independentes, recomenda-se a produção/entrega dos seguintes arquivos-fonte:
1. `public/images/astronaut-hero-isolated.webp` (e `.png` 24-bit com canal Alpha nativo):
   - Render ou ilustração original do astronauta em resolução mínima de `1600x1400px`, com fundo 100% transparente (recorte nativo sem o grid traseiro nem a tipografia vertical `ESSENT` atrás da luva) e traje livre de insígnias de terceiros.
2. `public/brand/devessent-logo-official.svg`:
   - Arquivo vetorial mestre exportado diretamente do software de design original (Illustrator/Figma) com curvas convertidas em contornos oficiais.
3. `public/portfolio/case-*.webp`:
   - Capturas reais de projetos entregues ou telas reais de sistemas homologados para substituir os cards arquiteturais em preparação na seção `#portfolio`.

