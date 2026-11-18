import * as React from "react";
import type {
  StorefrontLayoutProps,
  StorefrontHomeProps,
  StorefrontCatalogProps,
  StorefrontProductProps,
} from "../types/storefront.types";
import type { StorefrontTemplate } from "../../types/retail.types";

// Editorial Components
import { EditorialLayout } from "../templates/editorial/editorial-layout";
import { EditorialHome } from "../templates/editorial/editorial-home";
import { EditorialCatalog } from "../templates/editorial/editorial-catalog";
import { EditorialProductDetail } from "../templates/editorial/editorial-product-detail";

// Experimental Components
import { ExperimentalLayout } from "../templates/experimental/experimental-layout";
import { ExperimentalHome } from "../templates/experimental/experimental-home";
import { ExperimentalCatalog } from "../templates/experimental/experimental-catalog";
import { ExperimentalProductDetail } from "../templates/experimental/experimental-product-detail";
import { StorefrontCartDrawer } from "./storefront-cart-drawer";

/**
 * Determina o template ativo respeitando a precedência:
 * 1. Parâmetro de URL `preview_template` (permite visualização segura sem alterar template publicado).
 * 2. Template persistido nas configurações da loja (`store.template`).
 * 3. Fallback: "editorial".
 */
export function resolveActiveTemplate(
  publishedTemplate: StorefrontTemplate,
  previewTemplate?: string
): StorefrontTemplate {
  if (previewTemplate === "editorial" || previewTemplate === "experimental") {
    return previewTemplate;
  }
  return publishedTemplate || "editorial";
}

/**
 * Shell de Layout do Storefront (Header, Nav, Preview Banner, Rodapé e Drawer do Carrinho).
 */
export function StorefrontLayoutResolver(props: StorefrontLayoutProps) {
  const activeTemplate = resolveActiveTemplate(props.store.template, props.previewTemplate);

  return (
    <>
      {activeTemplate === "experimental" ? (
        <ExperimentalLayout {...props} />
      ) : (
        <EditorialLayout {...props} />
      )}
      <StorefrontCartDrawer
        store={props.store}
        template={activeTemplate}
        previewTemplate={props.previewTemplate}
      />
    </>
  );
}

/**
 * Página Inicial da Loja (Hero, Destaques, Vitrine, Pilares).
 */
export function StorefrontHomeResolver(props: StorefrontHomeProps) {
  const activeTemplate = resolveActiveTemplate(props.store.template, props.previewTemplate);

  if (activeTemplate === "experimental") {
    return <ExperimentalHome {...props} />;
  }

  return <EditorialHome {...props} />;
}

/**
 * Página de Catálogo Comercial com busca, filtros e paginação.
 */
export function StorefrontCatalogResolver(props: StorefrontCatalogProps) {
  const activeTemplate = resolveActiveTemplate(props.store.template, props.previewTemplate);

  if (activeTemplate === "experimental") {
    return <ExperimentalCatalog {...props} />;
  }

  return <EditorialCatalog {...props} />;
}

/**
 * Página de Detalhes do Produto com galeria, seleção de variantes e estoque real.
 */
export function StorefrontProductResolver(props: StorefrontProductProps) {
  const activeTemplate = resolveActiveTemplate(props.store.template, props.previewTemplate);

  if (activeTemplate === "experimental") {
    return <ExperimentalProductDetail {...props} />;
  }

  return <EditorialProductDetail {...props} />;
}

