import Link from "next/link";
import { Sparkles, Eye } from "lucide-react";
import type { RetailProductWithDetails, PublicStorefront } from "../../../types/retail.types";
import { formatCurrency } from "../../components/currency-formatter";
import { ProductImageFallback } from "../../components/product-image-fallback";

interface ExperimentalProductCardProps {
  product: RetailProductWithDetails;
  store: PublicStorefront;
  index?: number;
  previewTemplate?: string;
}

export function ExperimentalProductCard({
  product,
  store,
  index = 0,
  previewTemplate,
}: ExperimentalProductCardProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const href = `/loja/${store.slug}/produto/${product.slug}${queryParam}`;

  const primaryImage = product.primaryImage;
  const priceDisplay = formatCurrency(product.minPriceCents, store.currency);

  const formattedIndex = String(index + 1).padStart(2, "0");

  return (
    <article className="group relative flex flex-col bg-[#121215] border border-neutral-800 rounded-[4px] p-4 hover:border-[#d4ff00]/60 transition-all duration-300">
      {/* Top Tag & Number */}
      <div className="flex items-center justify-between pb-3 text-[11px] font-mono text-neutral-400">
        <span className="inline-flex items-center gap-1 bg-[#1a1a1f] text-[#d4ff00] px-2 py-0.5 rounded-[2px] font-semibold text-[10px] uppercase tracking-wider border border-neutral-800">
          <Sparkles className="w-2.5 h-2.5" />
          <span>Customizável</span>
        </span>
        <span className="text-neutral-500 font-mono tracking-widest">{formattedIndex} {"//"}</span>
      </div>

      {/* Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#18181d] rounded-[2px] border border-neutral-800/80 my-2">
        <Link href={href} className="block w-full h-full">
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage.publicUrl}
              alt={primaryImage.altText || product.name}
              className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <ProductImageFallback
              name={product.name}
              template="experimental"
              className="w-full h-full"
            />
          )}
        </Link>

        {/* Quick View Floating Pill */}
        <Link
          href={href}
          className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#d4ff00] text-black p-2 rounded-[2px] shadow-md hover:bg-white"
          aria-label={`Ver detalhes de ${product.name}`}
        >
          <Eye className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Product Details */}
      <div className="pt-3 flex flex-col flex-1 justify-between">
        <div>
          <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-neutral-100 group-hover:text-[#d4ff00] transition-colors">
            <Link href={href}>{product.name}</Link>
          </h3>
          <p className="mt-1 text-[11px] text-neutral-400 line-clamp-1 font-light">
            {product.description || "Personalize estampas, tecidos e corte sob demanda."}
          </p>
        </div>

        {/* Swatches & Price */}
        <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5" title="Cores disponíveis">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 border border-neutral-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-700 border border-neutral-600" />
          </div>

          <span className="text-sm font-mono font-bold text-[#d4ff00]">
            {priceDisplay}
          </span>
        </div>
      </div>
    </article>
  );
}
