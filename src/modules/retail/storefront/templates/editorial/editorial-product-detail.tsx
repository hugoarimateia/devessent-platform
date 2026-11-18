"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ShieldCheck, RefreshCw, Truck, Heart, Info } from "lucide-react";
import type { StorefrontProductProps } from "../../types/storefront.types";
import type { RetailVariant, RetailProductImage } from "../../../types/retail.types";
import { formatCurrency } from "../../components/currency-formatter";
import { ProductImageFallback } from "../../components/product-image-fallback";
import { StorefrontAddToCartPanel } from "../../components/storefront-add-to-cart-panel";
import { EditorialProductCard } from "./editorial-product-card";

export function EditorialProductDetail({
  store,
  product,
  relatedProducts,
  previewTemplate,
}: StorefrontProductProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";

  // Variantes e Opções
  const variants = product.variants;
  const [selectedVariant, setSelectedVariant] = React.useState<RetailVariant | null>(
    variants.find((v) => v.isAvailable && v.stockQuantity > 0) || variants[0] || null
  );

  // Imagens
  const images = product.images;
  const [selectedImage, setSelectedImage] = React.useState<RetailProductImage | null>(
    product.primaryImage || images[0] || null
  );

  // Mapa de opções selecionadas
  const [selectedOptions, setSelectedOptions] = React.useState<Record<string, string>>(() => {
    return selectedVariant ? selectedVariant.optionsSummary : {};
  });

  // Atualizar variante quando uma opção é alterada
  const handleSelectOption = (optionName: string, optionValue: string) => {
    const nextOptions = { ...selectedOptions, [optionName]: optionValue };
    setSelectedOptions(nextOptions);

    // Encontrar variante que melhor satisfaça as opções selecionadas
    const matched = variants.find((v) => {
      const summary = v.optionsSummary;
      return Object.entries(nextOptions).every(([k, val]) => summary[k] === val);
    });

    if (matched) {
      setSelectedVariant(matched);
      // Se houver imagem vinculada à variante, seleciona
      if (matched.id) {
        const variantImg = images.find((img) => img.variantId === matched.id);
        if (variantImg) setSelectedImage(variantImg);
      }
    }
  };

  const currentPrice = selectedVariant ? selectedVariant.priceCents : product.minPriceCents;
  const comparePrice = selectedVariant?.compareAtPriceCents;
  const isAvailable = selectedVariant ? selectedVariant.isAvailable && selectedVariant.stockQuantity > 0 : product.totalStock > 0;
  const stockQty = selectedVariant ? selectedVariant.stockQuantity : product.totalStock;

  return (
    <div className="bg-[#faf9f6] text-stone-900 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav aria-label="Navegação estrutural" className="mb-8 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-stone-500">
          <Link href={`/loja/${store.slug}${queryParam}`} className="hover:text-stone-900">
            Início
          </Link>
          <span>/</span>
          <Link href={`/loja/${store.slug}/produtos${queryParam}`} className="hover:text-stone-900">
            Produtos
          </Link>
          {product.categories.length > 0 && (
            <>
              <span>/</span>
              <Link
                href={`/loja/${store.slug}/categoria/${product.categories[0].slug}${queryParam}`}
                className="hover:text-stone-900"
              >
                {product.categories[0].name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-stone-900 font-bold truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* Main Product Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Gallery Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="aspect-[3/4] w-full overflow-hidden bg-[#f1efe9] rounded-[2px] relative shadow-xs">
              {selectedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedImage.publicUrl}
                  alt={selectedImage.altText || product.name}
                  className="w-full h-full object-cover object-center transition-all duration-300"
                />
              ) : (
                <ProductImageFallback
                  name={product.name}
                  template="editorial"
                  className="w-full h-full"
                />
              )}

              {/* Tag de Edição Limitada */}
              <span className="absolute top-4 left-4 bg-stone-950 text-white text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded-[2px]">
                Edição Autoral
              </span>
            </div>

            {/* Thumbnails (se houver mais de 1) */}
            {images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`relative w-20 aspect-square overflow-hidden rounded-[2px] border transition-all ${selectedImage?.id === img.id
                        ? "border-stone-950 ring-1 ring-stone-950"
                        : "border-stone-300 opacity-70 hover:opacity-100"
                      }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.publicUrl}
                      alt={img.altText || "Miniatura"}
                      className="w-full h-full object-cover object-center"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details & Selection Column (5 cols) */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-stone-500 block mb-1">
                {product.categories.map((c) => c.name).join(" · ") || "MODA AUTORAL"}
              </span>

              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider font-display text-stone-950">
                {product.name}
              </h1>

              {/* Price & SKU */}
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-2xl font-mono font-bold text-stone-950">
                  {formatCurrency(currentPrice, store.currency)}
                </span>
                {comparePrice && comparePrice > currentPrice && (
                  <span className="text-sm font-mono text-stone-400 line-through">
                    {formatCurrency(comparePrice, store.currency)}
                  </span>
                )}
                {selectedVariant?.sku && (
                  <span className="text-[11px] font-mono text-stone-400 ml-auto">
                    SKU: {selectedVariant.sku}
                  </span>
                )}
              </div>

              {/* Stock Status Badge */}
              <div className="mt-3">
                {isAvailable ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-[2px] border border-emerald-200">
                    <Check className="w-3.5 h-3.5" />
                    <span>Em estoque ({stockQty} {stockQty === 1 ? "peça disponível" : "peças disponíveis"})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded-[2px] border border-rose-200">
                    <span>Sob consulta ou esgotado</span>
                  </span>
                )}
              </div>
            </div>

            {/* Product Options Selector */}
            {product.options.length > 0 && (
              <div className="space-y-5 pt-4 border-t border-stone-200">
                {product.options.map((option) => {
                  const currentValue = selectedOptions[option.name];
                  return (
                    <div key={option.id}>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold uppercase tracking-wider text-stone-800">
                          {option.name}
                        </span>
                        {currentValue && (
                          <span className="font-mono text-stone-500">{currentValue}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {option.values.map((val) => {
                          const isSelected = currentValue === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleSelectOption(option.name, val)}
                              className={`px-3.5 py-2 text-xs font-mono uppercase tracking-wider rounded-[2px] border transition-all ${isSelected
                                  ? "bg-stone-950 text-white border-stone-950 shadow-xs"
                                  : "bg-white text-stone-800 border-stone-300 hover:border-stone-500"
                                }`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <StorefrontAddToCartPanel
              productId={product.id}
              selectedVariant={selectedVariant}
              template="editorial"
            />

            {/* Description */}
            <div className="pt-4 border-t border-stone-200">
              <h3 className="text-xs uppercase font-mono tracking-widest text-stone-500 mb-2">
                Descrição da Peça
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 font-light leading-relaxed whitespace-pre-line">
                {product.description ||
                  "Peça autoral confeccionada em ateliê com atenção aos detalhes construtivos, costura reforçada e matéria-prima selecionada."}
              </p>
            </div>

            {/* Solicitação Direta de Pedido (Fase 6C) */}
            <div className="p-4 bg-stone-100 rounded-[2px] border border-stone-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-900">
                <Info className="w-4 h-4 text-stone-700 shrink-0" />
                <span>Solicitação Direta de Pedido</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed font-light">
                Adicione as peças à sua sacola e envie o pedido sem pagamento online agora.
                Nossa equipe confirmará a disponibilidade e combinará entrega e pagamento diretamente com você.
              </p>
              {store.contactEmail && (
                <p className="text-[11px] font-mono text-stone-800 pt-1">
                  Para atendimento direto: <strong>{store.contactEmail}</strong>
                </p>
              )}
            </div>

            {/* Guarantee Pills */}
            <div className="pt-4 border-t border-stone-200 grid grid-cols-2 gap-3 text-[11px] text-stone-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-stone-800 shrink-0" />
                <span>Modelagem Original</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-stone-800 shrink-0" />
                <span>Envio para todo o Brasil</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-stone-800 shrink-0" />
                <span>30 Dias para Troca</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-stone-800 shrink-0" />
                <span>Produção Sustentável</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="mt-24 pt-12 border-t border-stone-200">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-stone-500 block mb-1">
                  COMPOSIÇÃO SUGERIDA
                </span>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider font-display text-stone-950">
                  Outras Peças da Coleção
                </h2>
              </div>
              <Link
                href={`/loja/${store.slug}/produtos${queryParam}`}
                className="text-xs uppercase font-semibold tracking-wider text-stone-900 hover:text-stone-600 underline"
              >
                Ver Todas
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.slice(0, 4).map((rel) => (
                <EditorialProductCard
                  key={rel.id}
                  product={rel}
                  store={store}
                  previewTemplate={previewTemplate}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
