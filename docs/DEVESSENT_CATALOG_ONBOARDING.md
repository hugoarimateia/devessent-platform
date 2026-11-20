# DevEssent Catalog Scanner — Manual Técnico e Operacional

> **Ferramenta privativa e exclusiva do proprietário da DevEssent** para digitalização, identificação assistida, revisão comercial e implantação em lote de catálogos de novos clientes no módulo **DevEssent Retail**.
>
> - **Localização isolada no repositório:** `tools/catalog-onboarding/`
> - **Status atual:** Homologada em ambiente **Supabase Cloud Staging** (`auebnppzxcvtaaqqlbts.supabase.co`)
> - **Exposição pública:** **Nenhuma** (execução privativa em `http://127.0.0.1:3020`; invisível nos menus e rotas da DevEssent Platform e da Landing Page)

---

## 1. Visão Geral e Problema Resolvido

Quando a DevEssent fecha contrato com um estabelecimento que possui centenas de produtos físicos (em prateleiras, etiquetas, embalagens, planilhas Excel/CSV ou catálogos PDF), o cadastro manual item por item na interface web gera alto custo operacional e atrasa o lançamento da loja.

O **DevEssent Catalog Scanner** resolve esse gargalo de implantação oferecendo uma estação multimodal de captura e revisão que:

1. **Captura rapidamente** itens por código de barras (câmera, leitor USB ou digitação), fotografia de etiqueta/embalagem (OCR local), planilha CSV/Excel (`.xlsx`) ou catálogo PDF textual.
2. **Enriquece apenas com fontes autorizadas**, registrando origem e nível de confiança por campo, sem jamais fabricar dados nem fazer scraping de terceiros.
3. **Exige conferência humana e confirmação comercial explícita** de preço e estoque antes de aprovar cada item.
4. **Implanta de forma idempotente, auditada e controlada** utilizando exclusivamente os serviços oficiais do DevEssent Retail (`RetailCategoryService`, `RetailProductService`, `RetailVariantService`, `RetailImageService` e `AuditService`), criando todo produto novo obrigatoriamente em **rascunho (`status: "draft"`)**.

---

## 2. Arquitetura e Isolamento Total

O Catalog Scanner foi projetado como um aplicativo Next.js 15 independente dentro de `tools/catalog-onboarding/`, com `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `eslint.config.mjs` e testes próprios:

- **Zero contaminação da DevEssent Platform (`src/`):** nenhuma rota, item de menu, ação ou componente do scanner existe na aplicação principal. O dashboard do lojista (`owner`, `manager`, `staff`) e o painel global (`/admin`) permanecem intactos.
- **Zero impacto em `apps/landing` e CI:** `tsconfig.json` e `eslint.config.mjs` da raiz ignoram `tools/**`, e a branch da Fase 6E (`feat/cloudflare-workers-staging`) não sofre nenhum conflito.
- **Reutilização integral da regra de negócio oficial:** via `experimental.externalDir: true` e alias `@/* -> ../../src/*`, o importador chama diretamente:
  - `RetailCategoryService`
  - `RetailProductService`
  - `RetailVariantService`
  - `RetailImageService` (Storage bucket oficial `retail-media`)
  - `ProductInvariants` & `VariantInvariants`
  - `AuditService.recordEvent` (ação `retail.catalog_onboarding_batch_executed`)
- **Zero alteração em migrations, RLS ou RBAC:** nenhuma migration PostgreSQL foi modificada, e as permissões de `owner`, `manager` e `staff` continuam exatamente como homologadas nas Fases 6C/6D.

```
tools/catalog-onboarding/          (App Next.js privativo — 127.0.0.1:3020)
 ├── src/lib/auth.ts               (Dupla autorização + cookie HMAC-SHA256)
 ├── src/lib/barcode.ts            (Validação GS1 Módulo-10: EAN-13/8, UPC-A, GTIN-14)
 ├── src/lib/lookup.ts             (Duplicidade no tenant + fontes autorizadas)
 ├── src/lib/ocr.ts                (OCR local gratuito com tesseract.js por+eng)
 ├── src/lib/importers.ts          (CSV, Excel .xlsx via exceljs, PDF via unpdf)
 ├── src/lib/images.ts             (Magic bytes, dimensões, SHA-256, anti-SSRF)
 ├── src/lib/batch-store.ts        (Persistência atômica local de lotes + idempotência)
 ├── src/lib/retail-importer.ts    (Dry-run + importador em chunks + single-flight categorias)
 ├── src/app/api/**                (Endpoints privativos 100% protegidos no servidor)
 └── src/components/**             (Fluxo operacional de 6 telas)
```

---

## 3. Como Iniciar a Ferramenta (Ambiente Staging)

### Pré-requisitos

- Node.js 20+ e `pnpm` instalados.
- Arquivo `.env.staging.local` configurado na raiz do repositório (apontando para o projeto Supabase Cloud Staging autorizado).

### Passo a passo

1. **Instalar dependências do scanner (somente na primeira vez):**
   ```powershell
   cd tools/catalog-onboarding
   pnpm install
   ```

2. **Gerar automaticamente a configuração local de Staging (sem versionar segredos):**
   ```powershell
   pnpm setup:staging-env
   ```
   O script lê `.env.staging.local` na raiz, consulta `platform_admins` no Supabase Staging para preencher `CATALOG_SCANNER_ALLOWED_USER_IDS`, gera um segredo criptográfico `CATALOG_SCANNER_SESSION_SECRET` e cria o arquivo ignorado pelo Git `tools/catalog-onboarding/.env.scanner.local`.
   > Nunca edite ou versione `.env.scanner.local`. Um modelo seguro sem segredos está em `tools/catalog-onboarding/.env.scanner.example`.

3. **Iniciar em modo desenvolvimento ou produção local:**
   ```powershell
   # Desenvolvimento (hot reload)
   pnpm dev

   # Ou build otimizado + start
   pnpm build
   pnpm start
   ```

4. **Acessar exclusivamente localmente:**
   - URL privativa: `http://127.0.0.1:3020`
   - O runner (`scripts/run-scanner.ts`) recusa iniciar (*fail-closed*) caso `CATALOG_SCANNER_ENVIRONMENT !== "staging"` (a menos que explicitamente autorizado no futuro) ou se a URL do Supabase não corresponder ao projeto Staging esperado.

---

## 4. Autenticação e Controle de Acesso (Dupla Autorização)

Todas as rotas `/api/**` (exceto login/logout) e operações sensíveis passam obrigatoriamente por `requireScannerOwner()` no servidor:

1. **Sessão Supabase Auth real:** o operador informa e-mail e senha da conta proprietária DevEssent; o servidor autentica via Supabase Auth e emite um cookie de sessão `HttpOnly; SameSite=Strict; Path=/` assinado com **HMAC-SHA256** (`CATALOG_SCANNER_SESSION_SECRET`).
2. **Validação de `platform_admins`:** o usuário precisa estar registrado como administrador global da plataforma na tabela `platform_admins`.
3. **Allowlist explícita do proprietário (`CATALOG_SCANNER_ALLOWED_USER_IDS`):** mesmo outro `platform_admin` que **não** conste na lista de UUIDs autorizados recebe `403 Forbidden`.
4. **Bloqueio absoluto para perfis de clientes:** `owner`, `manager` e `staff` de qualquer empresa recebem `403 Forbidden`.
5. **Cabeçalhos defensivos:** `X-Robots-Tag: noindex, nofollow, noarchive`, `X-Frame-Options: DENY` e `Permissions-Policy: camera=(self)`.

---

## 5. Seleção e Travamento de Empresa/Loja de Destino (Tela 1)

Na **Tela 1**, o operador visualiza todas as empresas com loja Retail ativa em Staging (nome, slug público, template, quantidade atual de produtos/categorias e modo de estoque).

- Ao iniciar um novo lote, o par **`(tenantId, storeId)` fica travado permanentemente no registro do lote**.
- A barra superior exibe continuamente o selo `DESTINO TRAVADO: <Empresa> · /loja/<slug> · <batchId>`.
- Qualquer tentativa via API de alterar silenciosamente o `tenantId` ou `storeId` de um lote já aberto é bloqueada no servidor com **`403 Forbidden`**.
- Antes da implantação final, a API exige novamente a confirmação explícita de `confirmTenantId` e `confirmStoreId`.

---

## 6. Captura por Código de Barras (Telas 2 e 3)

O módulo suporta quatro modos de leitura de códigos de barras:

1. **Câmera em tempo real** (`@zxing/browser`, `BrowserMultiFormatReader`): funciona em webcam desktop ou celular, com botão de alternância de câmera frontal/traseira e disparo de bip sonoro via Web Audio API a cada leitura aceita.
2. **Leitor USB físico (modo teclado HID):** basta manter o foco no campo de leitor contínuo; o leitor digita o código e envia `Enter`.
3. **Digitação manual assistida:** entrada direta com validação imediata.
4. **Upload de foto de código de barras:** decodificação direta da imagem no navegador via `@zxing/browser`.

### Regras de validação e operação contínua

- **Formatos aceitos:** `EAN-13`, `EAN-8`, `UPC-A`, `GTIN-14`.
- **Dígito verificador GS1 Módulo-10:** códigos com dígito inválido ou sequências degeneradas (ex.: `0000000000000`) são rejeitados imediatamente (`400 Bad Request`).
- **Debounce anti-leitura dupla:** leituras repetidas do mesmo código em intervalo inferior a `1500 ms` são descartadas no leitor contínuo.
- **Política configurável para repetições intencionais no mesmo lote:**
  - `ignore` (padrão): mantém o item único sem duplicar na fila.
  - `increment_stock`: incrementa `+1` no estoque do item já na fila (útil para contagem física de prateleira).
  - `add_variant`: adiciona uma nova variante ao item existente.

---

## 7. Captura por Foto + OCR Local (Custo R$ 0)

Para produtos sem código de barras ou com etiqueta física de loja:

- O operador envia uma ou mais fotos (PNG, JPEG ou WebP, até 5 MB) pela **Tela 3**.
- O servidor executa **OCR 100% local e gratuito** com `tesseract.js` (`por+eng`).
- O analisador determinístico (`src/lib/ocr.ts`) extrai **exclusivamente o que foi efetivamente reconhecido no texto**:
  - Nome sugerido do produto
  - Marca (`Marca:` / `Fabricante:`)
  - Código/SKU candidato (`REF:` / `SKU:` / `COD:`)
  - Apresentação (`250ml`, `190g`, `2kg`, etc.)
  - Cor e tamanho quando explícitos
  - Eventual GTIN impresso na etiqueta
  - **Preço detectado na etiqueta:** sempre marcado com confiança `unconfirmed` e `priceConfirmedByMerchant = false` — o operador **precisa** confirmar com o lojista antes de aprovar.
- Quando a confiança do OCR é baixa ou faltam informações, o item é marcado como ambíguo/pendente na fila, sem jamais inventar texto ou valores.
- A imagem original passa por validação binária (magic bytes + dimensões) e pode ser anexada diretamente ao produto.

---

## 8. Importação de Planilhas (CSV / Excel `.xlsx`) e Catálogos PDF

### CSV e Excel (`.xlsx`)

- **CSV:** detecção automática de delimitador (`;`, `,` ou `\t`), remoção de BOM UTF-8 (`\uFEFF`) e parser compatível com RFC-4180 (aspas e quebras internas).
- **Excel (`.xlsx`):** leitura nativa com `exceljs`, suportando planilhas com múltiplas abas (seleciona a primeira aba populada).
- **Parser monetário brasileiro:** interpreta corretamente `R$ 1.259,90`, `249,90`, `89.9` ou centavos inteiros.
- **Mapeamento assistido de colunas:** sugere automaticamente `Nome`, `SKU`, `GTIN/EAN`, `Categoria`, `Descrição`, `Marca`, `Apresentação`, `Preço`, `Preço Comparativo`, `Estoque`, `Cor`, `Tamanho`, `Variante` e `URL de Imagem` — com prévia editável antes de confirmar na fila.
- **Agrupamento automático de variantes:** linhas consecutivas com o mesmo nome de produto e atributos distintos (ex.: tamanhos `P`, `M`, `G` ou cores) são agrupadas em um único produto com múltiplas variantes.

### Catálogos PDF

- Extração de texto real via `unpdf` (sem custo externo).
- Detecta automaticamente PDFs puramente escaneados (sem camada textual) e orienta o operador a utilizar a aba **Foto + OCR** página a página, evitando falhas silenciosas.

---

## 9. Estação de Revisão, Imagens e Proteção Contra Duplicidade (Tela 4)

Nenhum item é importado automaticamente após captura. Todos entram na **Estação de Revisão**:

- **Filtros rápidos:** Todos, Pendentes, Duplicados, Aprovados, Prontos para aprovar, Importados e Com erro, além de busca instantânea por nome/SKU/GTIN/categoria.
- **Rastreabilidade por campo:** cada campo indica sua origem (`authorized_catalog`, `client_spreadsheet`, `ocr_photo`, `open_database`, `manual_operator`, `missing`) e confiança (`verified`, `high`, `medium`, `low`, `unconfirmed`).
- **Travas obrigatórias para aprovação:**
  1. Nome comercial válido (mínimo 2 caracteres).
  2. Pelo menos 1 variante com SKU normalizado válido (`VariantInvariants.normalizeSku`), preço `> R$ 0,00` e estoque `>= 0`.
  3. **`priceConfirmedByMerchant === true`** e **`stockConfirmedByMerchant === true`** (confirmação explícita em item ou em lote pelo operador após validação com o lojista).
- **Ações em lote:** aplicar categoria em massa, confirmar preço/estoque em lote, aprovar todos os prontos e re-identificar itens pendentes.
- **Proteção contra duplicidade no catálogo do cliente:**
  - Verifica em tempo real no tenant atual se já existe produto com mesmo **SKU**, **GTIN** ou **slug**.
  - Três resoluções explícitas:
    - `skip` (padrão seguro): ignora o duplicado sem alterar o catálogo existente.
    - `update_selected`: atualiza somente os campos selecionados (ex.: descrição, categoria, imagens); preço e estoque **nunca** são sobrescritos sem marcar `allowOverwritePrice` / `allowOverwriteStock`.
    - `create_variant`: adiciona novas variantes ao produto existente sem duplicar o produto pai.
- **Segurança e qualidade de imagens:**
  - Validação real por **assinatura binária (magic bytes)** para PNG, JPEG, WebP e GIF (rejeita arquivos disfarçados por extensão).
  - Leitura binária de largura/altura e limite de **5 MB** por arquivo.
  - **Deduplicação por SHA-256** dentro do item (evita enviar fotos repetidas ao Storage).
  - **Proteção anti-SSRF** para URLs de imagens autorizadas de fornecedores: exige `HTTPS`, bloqueia IPs privados/loopback/link-local/metadata (`127.0.0.1`, `169.254.169.254`, `10.x`, `192.168.x`, `::1`, etc.) e exige correspondência com `CATALOG_SCANNER_ALLOWED_IMAGE_HOSTS` e confirmação explícita de direitos de uso (`rightsConfirmed`).

---

## 10. Implantação em Lote e Fluxo de Publicação (Telas 5 e 6)

### Prévia obrigatória (*Dry-Run*) — Tela 5

Antes de gravar qualquer dado no Supabase, o operador visualiza a prévia exata do que ocorrerá:
- Quantos novos produtos serão criados em **rascunho (`draft`)**
- Quantos existentes serão atualizados ou receberão variantes
- Quantos duplicados serão ignorados (`skip`)
- Quais novas categorias serão criadas
- Quantas imagens serão enviadas ao Supabase Storage (`retail-media`)
- Eventuais bloqueios pendentes

### Execução controlada em chunks

- Executa com concorrência controlada (1 a 3 itens simultâneos; padrão 2) e deduplicação *single-flight* na criação de categorias para evitar *race conditions* por slug.
- Persiste o progresso do lote em disco após cada chunk.
- **Regra comercial inviolável:** todo produto novo é gravado com `status: "draft"`.
- Ao final, registra um evento consolidado na trilha corporativa `audit_logs` (`action: "retail.catalog_onboarding_batch_executed"`).

### Publicação na DevEssent Platform oficial

1. O lojista (ou equipe autorizada) acessa a **DevEssent Platform** em `/dashboard/retail/produtos`.
2. Revisa os produtos importados em situação **Rascunho**, conferindo fotos, categorias, variantes, preços e estoque.
3. Publica os produtos aprovados pela interface oficial da plataforma (`status: "published"`).
4. Os produtos ficam imediatamente disponíveis na vitrine pública `/loja/<slug>`, prontos para carrinho, solicitação de pedido, baixa transacional de estoque e pagamento.

---

## 11. Fontes de Dados Autorizadas e Política Anti-Scraping

O Catalog Scanner adota uma arquitetura de provedores extensível (`src/lib/lookup.ts`) estritamente legal e auditável:

| Ordem | Fonte | Padrão no MVP | Observações |
|---|---|---|---|
| 1 | Catálogo atual do cliente no Supabase | Sempre ativo | Apenas para detectar duplicidades no tenant alvo |
| 2 | Catálogos autorizados de fornecedores / clientes (`data/authorized-catalogs/*.json`) | Ativo | Arquivos JSON autorizados fornecidos pelo cliente ou distribuidor |
| 3 | Planilhas CSV/XLSX e PDFs enviados pelo cliente | Ativo | Importação direta pela Tela 3 |
| 4 | Open Food Facts (licença aberta ODbL) | **Opt-in** (`CATALOG_SCANNER_ENABLE_OPEN_FOOD_FACTS=true`) | Somente para alimentos/bebidas; desativado por padrão |

**Proibições permanentes:** o sistema **não realiza** scraping de marketplaces, varejistas ou buscadores, **não** copia fotos sem confirmação de direitos e **não** inventa marca, descrição, categoria, preço ou estoque quando um GTIN não é encontrado.

---

## 12. Limitações Reais do Lookup Externo

Para manter expectativas realistas na operação comercial da DevEssent:

- **Cobertura parcial de GTINs no Brasil:** bases abertas gratuitas (como Open Food Facts) cobrem principalmente alimentos e bebidas industrializados; moda, decoração, artesanato, acessórios e marcas próprias raramente existem em bases públicas.
- **Preço e estoque nunca vêm de bases externas:** cada lojista tem margem, tabela promocional e saldo físico próprios; portanto, preço e estoque sempre dependem de planilha do cliente, etiqueta conferida ou digitação na revisão.
- **Qualidade de OCR em campo:** etiquetas com fonte estilizada, reflexo, baixa iluminação ou códigos curtos podem gerar trocas pontuais de caracteres (ex.: `6` vs `S`, `O` vs `0`, como observado na própria homologação). A revisão humana na Tela 4 é indispensável.
- **PDFs escaneados (imagem pura):** não possuem texto extraível diretamente por `unpdf` e exigem captura via aba Foto + OCR.

---

## 13. Integrações Futuras Opcionais

Nenhuma integração paga ou exposição pública é ativada automaticamente nesta fase. Quando a operação da DevEssent justificar, o design já está pronto para:

1. **GS1 Brasil (Cadastro Nacional de Produtos — CNP) / APIs comerciais autorizadas:** basta implementar um novo adaptador na interface `CatalogLookupProvider` em `src/lib/lookup.ts`, controlado por variável de ambiente dedicada e chaves do proprietário.
2. **Acesso privativo pelo celular em campo (via Cloudflare Access / Zero Trust):** caso deseje usar a câmera do smartphone fora da rede local com HTTPS, publique o scanner em subdomínio privado (ex.: `scanner.devessent.internal`) protegido por **Cloudflare Access** (OTP/e-mail exclusivo do proprietário) somado à dupla autorização interna já existente — mantendo o scanner 100% fora de motores de busca e inacessível a terceiros.

---

## 14. Segurança, Privacidade e Limites Operacionais

- **Isolamento de ambiente:** o runner bloqueia execução se o host do Supabase divergir do ambiente autorizado.
- **Dados operacionais locais fora do Git:** `tools/catalog-onboarding/data/batches/`, `tools/catalog-onboarding/data/uploads/` e `.env.scanner.local` estão explicitamente protegidos no `.gitignore`.
- **Auditoria completa:** cada execução de lote grava metadados (ID do lote, loja, contagens de importados/ignorados/falhos, imagens, categorias criadas e duração) na tabela `audit_logs` do tenant.
- **Sem exposição de segredos:** nenhuma chave `service_role`, senha ou segredo HMAC é enviada ao navegador ou gravada em logs/documentação.

---

## 15. Custos Envolvidos

| Componente | Custo Atual (MVP) | Observações |
|---|---|---|
| Next.js local (`tools/catalog-onboarding`) | **R$ 0,00** | Execução local em máquina da equipe |
| Leitor de código de barras (`@zxing/browser`) | **R$ 0,00** | Open-source, 100% no navegador |
| OCR local (`tesseract.js`) | **R$ 0,00** | Open-source, 100% local (sem API paga) |
| Importadores CSV / Excel (`exceljs`) / PDF (`unpdf`) | **R$ 0,00** | Open-source, processamento local |
| Supabase Staging (Storage + Banco) | **R$ 0,00** | Plano Free já provisionado para Staging |
| **Integrações opcionais futuras** (GS1 Brasil CNP, APIs comerciais de GTIN, Vision AI paga) | **Sob decisão futura** | **Não ativadas**; só devem ser contratadas se o volume comercial justificar |

---

## 16. Resultados Reais da Homologação em Staging

Homologação executada integralmente contra o **Supabase Cloud Staging real (`auebnppzxcvtaaqqlbts.supabase.co`)** e a **DevEssent Platform real (`http://localhost:3000`)**, usando o cliente fictício `Ateliê Demonstrativo` (com limpeza atômica ao final preservando intacto o seed permanente).

### Testes automatizados de unidade (`tools/catalog-onboarding`)

- `pnpm typecheck`: **PASS** (0 erros)
- `pnpm lint`: **PASS** (0 erros / 0 avisos)
- `pnpm test` (`tests/scanner-core.test.ts`): **7/7 PASS** (GS1 Módulo-10, dupla autorização + HMAC, validação binária + anti-SSRF, parser OCR, CSV brasileiro + `.xlsx` real, travas comerciais + duplicidade, idempotência na retomada de lote)
- `pnpm build`: **PASS** (`/` = `19.2 kB`, First Load JS `122 kB`)

### Controles de segurança validados em tempo real

- Requisições sem sessão em `/api/tenants` e `/api/batches`: **`401 Unauthorized`**
- Tentativa de login com `owner` de tenant e `staff` de tenant: **`403 Forbidden`**
- Login com proprietário DevEssent (dupla autorização): **`200 OK`** com cookie `HttpOnly; SameSite=Strict`
- Tentativa de troca silenciosa de `tenantId` em lote aberto: **`403 Forbidden`**
- Barra lateral da DevEssent Platform inspecionada após login do lojista: **nenhuma referência ao Catalog Scanner**

### Métricas reais observadas nos lotes de homologação (Execução `S6EEIN1O`)

- **Lote 1 — Fluxo multimodal (códigos de barras + OCR + manual + duplicado + imagens):**
  - Total de itens capturados na fila: **17**
  - Códigos de barras válidos testados: **10** (todos auto-identificados via catálogo autorizado local; 1 repetição ignorada pela política `ignore`)
  - Códigos desconhecidos testados: **2** (ambos registrados honestamente como `not_found`, sem fabricação de dados; 1 deixado intencionalmente sem nome/preço e bloqueado na aprovação)
  - Código com dígito verificador GS1 inválido: **1** (rejeitado com `400 Bad Request`)
  - Produtos manuais sem código de barras: **2** (1 completo aprovado; 1 sem preço/estoque bloqueado com `400` na tentativa de aprovação)
  - Fotos reais de etiqueta/embalagem processadas via **Tesseract.js (`por+eng`)**: **2** (confiança medida: `91%` e `91%`; ambos extraindo nome, marca, SKU, apresentação e marcando o preço de etiqueta como `priceConfirmedByMerchant: false`)
  - Deduplicação de imagem por SHA-256: **validada** (upload repetido da mesma foto não duplicou o anexo)
  - Revisados e aprovados: **15** (2 incompletos mantidos fora da importação)
  - Resultado da implantação no Supabase Staging: **14 importados em `draft`**, **1 duplicado evitado (`skipped`)**, **1 categoria criada**, **3 imagens reais enviadas ao bucket `retail-media`**, **0 falhas**, tempo total: **`5,6 s` (`5.600 ms`)**

- **Lote 2 — Planilha `.xlsx` realista (~50 produtos, variantes, duplicados e incompletos):**
  - Linhas na planilha `.xlsx` gerada via `exceljs`: **55 linhas** agrupadas em **50 produtos distintos**
  - Aprovados: **47** | Incompletos bloqueados: **3**
  - Resultado da implantação no Supabase Staging: **45 importados em `draft`**, **2 duplicados evitados (`skipped`)**, **1 categoria criada**, **0 falhas**, tempo total: **`10,6 s` (`10.639 ms`)**
  - **Retomada idempotente do Lote 2:** reexecução imediata resultou em **`0` produtos duplicados / `0` reimportações**.

- **Fluxo comercial final na DevEssent Platform real (`http://localhost:3000`):**
  - Produto importado localizado no catálogo oficial da Platform como **Rascunho** com 2 variantes (`P` e `M`), preço `R$ 259,00`, categoria e imagem no Storage.
  - Publicado pela interface oficial da Platform (`status: "published"`).
  - Renderizado na vitrine pública `/loja/atelie-demonstrativo/produto/camisa-linho-scanner-s6eein1o` com foto real, preço promocional, seletor de variantes e saldo de estoque.
  - Adicionado à sacola, checkout finalizado (pedido `PED-9KKJTD`), confirmado pelo lojista no dashboard com **baixa transacional real de estoque (`14 -> 13` na variante `S6EEIN1O-LINHO-P`)**, e link de pagamento **Sandbox** gerado e validado sem erros.

### Bugs reais encontrados e corrigidos durante a homologação

1. **Dígito verificador EAN-8 inválido em item de demonstração (`78910008`):** corrigido para o EAN-8 matematicamente válido `78910003` e adicionado teste unitário validando 100% dos GTINs do catálogo autorizado.
2. **Bug real de idempotência na retomada de lote (`retail-importer.ts`):** itens duplicados com status `"skipped"` guardavam `importedProductId` (apontando para o produto existente) e não eram filtrados fora na retomada, entrando indevidamente no ramo de retomada de imagem parcial e incrementando `importedCount`. Corrigido excluindo `"skipped"` em `selectEligibleBatchItems` e restringindo a retomada de imagem estritamente a `previousStatus === "partial_image_failed"`, com novo teste unitário cobrindo o cenário.
3. **Race condition real na criação concorrente de categorias (`ensureCategoryId`):** sob `concurrency = 2`, dois itens do primeiro chunk solicitaram simultaneamente a criação da mesma nova categoria, causando 1 erro de conflito de slug no segundo item. Corrigido com deduplicação *single-flight* por slug (`inFlightCategories`) + fallback seguro por releitura, reduzindo falhas do Lote 1 de `1` para **`0`**.

---

## 17. Pausar, Retomar e Reprocessar Falhas de Lote

Os lotes ficam salvos atomicamente em `tools/catalog-onboarding/data/batches/<batchId>.json` (fora do Git):

- **Pausar durante a implantação:** clique em **Pausar Lote** na Tela 5. O importador conclui o chunk em andamento, salva o estado atual em disco e interrompe antes do próximo chunk (`status: "paused"`).
- **Retomar após pausa ou fechamento do navegador:** abra a Tela 1, selecione o lote na coluna **Retomar Lote Anterior** e execute novamente a implantação. Itens já marcados como `imported`, `updated` ou `skipped` são preservados sem duplicação.
- **Reprocessar apenas itens com falha ou falha parcial de imagem:** utilize a opção **Reprocessar apenas falhas** (`onlyFailedOrPending: true`).
  - Se um produto foi criado em `draft` mas falhou apenas no upload de uma imagem (`status: "partial_image_failed"`), a retomada reaproveita `importedProductId` e reenvia **apenas** as imagens ainda sem `uploadedStoragePath`, sem jamais duplicar o produto no Retail.
