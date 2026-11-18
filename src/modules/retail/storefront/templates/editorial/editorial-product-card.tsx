import Link from "next/link";
import { Heart } from "lucide-react";
import type { RetailProductWithDetails, PublicStorefront } from "../../../types/retail.types";
import { formatCurrency } from "../../components/currency-formatter";
import { ProductImageFallback } from "../../components/product-image-fallback";

interface EditorialProductCardProps {
  product: RetailProductWithDetails;
  store: PublicStorefront;
  previewTemplate?: string;
}

export function EditorialProductCard({
  product,
  store,
  previewTemplate,
}: EditorialProductCardProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const href = `/loja/${store.slug}/produto/${product.slug}${queryParam}`;

  const primaryImage = product.primaryImage;
  const priceDisplay = formatCurrency(product.minPriceCents, store.currency);
  const hasVariants = product.variants.length > 1;

  // Resumo de opções (ex: "P, M, G" ou "3 cores")
  const sizeOption = product.options.find((o) => o.name.toLowerCase().includes("tam"));
  const colorOption = product.options.find((o) => o.name.toLowerCase().includes("cor"));

  return (
    <article className="group relative flex flex-col bg-transparent">
      {/* Container de Imagem */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#f3f1ec] rounded-[2px] transition-all duration-300">
        <Link href={href} className="block w-full h-full">
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage.publicUrl}
              alt={primaryImage.altText || product.name}
              className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <ProductImageFallback
              name={product.name}
              template="editorial"
              className="w-full h-full"
            />
          )}
        </Link>

        {/* Botão de Wishlist / Favorito estético */}
        <button
          type="button"
          aria-label={`Salvar ${product.name} nos favoritos`}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/80 backdrop-blur-xs text-stone-700 hover:text-stone-950 transition-colors shadow-xs"
        >
          <Heart className="w-4 h-4" />
        </button>

        {/* Tag de Disponibilidade */}
        {product.totalStock <= 3 && product.totalStock > 0 && (
          <span className="absolute bottom-2.5 left-2.5 bg-stone-900/90 text-white text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-[2px]">
            Últimas {product.totalStock} peças
          </span>
        )}
      </div>

      {/* Informações do Produto */}
      <div className="pt-3.5 pb-2 flex flex-col flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-900 group-hover:text-stone-600 transition-colors">
            <Link href={href}>{product.name}</Link>
          </h3>
          <span className="text-xs font-mono font-medium text-stone-950 whitespace-nowrap">
            {priceDisplay}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500 font-light">
          <span>
            {colorOption
              ? `${colorOption.values.length} ${colorOption.values.length === 1 ? "opção de cor" : "opções de cores"}`
              : sizeOption
                ? sizeOption.values.slice(0, 4).join(" · ")
                : "Edição Autoral"}
          </span>
          {hasVariants && (
            <span className="text-[10px] text-stone-400">Variantes disponíveis</span>
          )}
        </div>
      </div>
    </article>
  );
}

