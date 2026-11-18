"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ShieldAlert, Cpu, Sparkles, Terminal, Info } from "lucide-react";
import type { StorefrontProductProps } from "../../types/storefront.types";
import type { RetailVariant, RetailProductImage } from "../../../types/retail.types";
import { formatCurrency } from "../../components/currency-formatter";
import { ProductImageFallback } from "../../components/product-image-fallback";
import { StorefrontAddToCartPanel } from "../../components/storefront-add-to-cart-panel";
import { ExperimentalProductCard } from "./experimental-product-card";

export function ExperimentalProductDetail({
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

  const handleSelectOption = (optionName: string, optionValue: string) => {
    const nextOptions = { ...selectedOptions, [optionName]: optionValue };
    setSelectedOptions(nextOptions);

    const matched = variants.find((v) => {
      const summary = v.optionsSummary;
      return Object.entries(nextOptions).every(([k, val]) => summary[k] === val);
    });

    if (matched) {
      setSelectedVariant(matched);
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
    <div className="bg-[#0a0a0c] text-neutral-100 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav aria-label="Navegação estrutural" className="mb-8 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-neutral-500">
          <Link href={`/loja/${store.slug}${queryParam}`} className="hover:text-[#d4ff00]">
            Home
          </Link>
          <span>/</span>
          <Link href={`/loja/${store.slug}/produtos${queryParam}`} className="hover:text-[#d4ff00]">
            Coleção
          </Link>
          {product.categories.length > 0 && (
            <>
              <span>/</span>
              <Link
                href={`/loja/${store.slug}/categoria/${product.categories[0].slug}${queryParam}`}
                className="hover:text-[#d4ff00]"
              >
                {product.categories[0].name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-white font-bold truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* Product Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Gallery View Left */}
          <div className="lg:col-span-7 space-y-4">
            <div className="aspect-square w-full overflow-hidden bg-[#121215] rounded-[4px] border border-neutral-800 relative">
              {selectedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedImage.publicUrl}
                  alt={selectedImage.altText || product.name}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <ProductImageFallback
                  name={product.name}
                  template="experimental"
                  className="w-full h-full"
                />
              )}

              {/* Distressed Corner Tag */}
              <div className="absolute top-4 left-4 bg-[#141418]/90 border border-neutral-700 text-[#d4ff00] text-[10px] font-mono uppercase px-3 py-1 rounded-[2px] flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                <span>DROP_SPEC // CUSTOMIZÁVEL</span>
              </div>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`relative w-20 aspect-square overflow-hidden rounded-[2px] border transition-all ${selectedImage?.id === img.id
                      ? "border-[#d4ff00] ring-1 ring-[#d4ff00]"
                      : "border-neutral-800 opacity-60 hover:opacity-100"
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

          {/* Details & Selectors Right */}
          <div className="lg:col-span-5 space-y-7">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#d4ff00] block mb-1">
                {product.categories.map((c) => c.name).join(" // ") || "STREETWEAR"}
              </span>

              <h1 className="text-3xl sm:text-4xl font-black uppercase font-display tracking-tight text-white">
                {product.name}
              </h1>

              {/* Price & SKU */}
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-3xl font-mono font-bold text-[#d4ff00]">
                  {formatCurrency(currentPrice, store.currency)}
                </span>
                {comparePrice && comparePrice > currentPrice && (
                  <span className="text-sm font-mono text-neutral-500 line-through">
                    {formatCurrency(comparePrice, store.currency)}
                  </span>
                )}
                {selectedVariant?.sku && (
                  <span className="text-[11px] font-mono text-neutral-500 ml-auto">
                    SKU: {selectedVariant.sku}
                  </span>
                )}
              </div>

              {/* Availability Indicator */}
              <div className="mt-3">
                {isAvailable ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#d4ff00] bg-[#d4ff00]/10 px-2.5 py-1 rounded-[2px] border border-[#d4ff00]/30">
                    <Check className="w-3.5 h-3.5" />
                    <span>Disponível ({stockQty} {stockQty === 1 ? "unidade pronta" : "unidades prontas"})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 bg-rose-950/40 px-2.5 py-1 rounded-[2px] border border-rose-800">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Esgotado ou sob encomenda</span>
                  </span>
                )}
              </div>
            </div>

            {/* Product Options */}
            {product.options.length > 0 && (
              <div className="space-y-5 pt-4 border-t border-neutral-800 font-mono">
                {product.options.map((option) => {
                  const currentValue = selectedOptions[option.name];
                  return (
                    <div key={option.id}>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold uppercase tracking-wider text-neutral-300">
                          {option.name}
                        </span>
                        {currentValue && (
                          <span className="text-[#d4ff00]">[{currentValue}]</span>
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
                              className={`px-3.5 py-2 text-xs font-mono font-bold uppercase rounded-[2px] border transition-all ${isSelected
                                ? "bg-[#d4ff00] text-black border-[#d4ff00] shadow-[0_0_12px_rgba(212,255,0,0.3)]"
                                : "bg-[#141418] text-neutral-300 border-neutral-700 hover:border-neutral-400"
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
              template="experimental"
            />

            {/* Description */}
            <div className="pt-4 border-t border-neutral-800">
              <h3 className="text-xs uppercase font-mono tracking-widest text-[#d4ff00] mb-2">
                Especificações da Peça
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed whitespace-pre-line">
                {product.description ||
                  "Modelagem streetwear arrojada produzida sob demanda com tecidos pesados, acabamento reforçado e tingimento industrial exclusivo."}
              </p>
            </div>

            {/* Solicitação Direta de Pedido (Fase 6C) */}
            <div className="p-4 bg-[#141418] rounded-[2px] border border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#d4ff00]">
                <Info className="w-4 h-4 shrink-0" />
                <span>Solicitação de Pedido Direta</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-light">
                Os dados de preço e estoque apresentados são reais. Adicione os itens à sacola e
                finalize sua solicitação para confirmação pela equipe da loja.
              </p>
              {store.contactEmail && (
                <p className="text-[11px] font-mono text-neutral-300 pt-1">
                  Atendimento: <strong className="text-white">{store.contactEmail}</strong>
                </p>
              )}
            </div>

            {/* Technical Badges */}
            <div className="pt-4 border-t border-neutral-800 grid grid-cols-2 gap-3 text-[11px] font-mono text-neutral-400">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#d4ff00] shrink-0" />
                <span>Modelagem Boxy Heavy</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#d4ff00] shrink-0" />
                <span>Estamparia Silk HD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-24 pt-12 border-t border-neutral-800">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#d4ff00] block mb-1">
                  OUTROS DROPS
                </span>
                <h2 className="text-xl sm:text-2xl font-black uppercase font-display tracking-tight text-white">
                  Peças Relacionadas
                </h2>
              </div>
              <Link
                href={`/loja/${store.slug}/produtos${queryParam}`}
                className="text-xs font-mono uppercase font-bold text-[#d4ff00] hover:underline"
              >
                Ver Todas
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.slice(0, 4).map((rel, idx) => (
                <ExperimentalProductCard
                  key={rel.id}
                  product={rel}
                  store={store}
                  index={idx}
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

