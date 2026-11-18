import Link from "next/link";
import { Search, Heart, Menu } from "lucide-react";
import type { StorefrontLayoutProps } from "../../types/storefront.types";
import { ExperimentalFooter } from "./experimental-footer";
import { StorefrontPreviewBanner } from "../../components/storefront-preview-banner";
import { StorefrontCartTrigger } from "../../components/storefront-cart-trigger";

export function ExperimentalLayout({
  store,
  categories,
  children,
  previewTemplate,
}: StorefrontLayoutProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0c] text-[#f2f2f4] selection:bg-[#d4ff00] selection:text-black">
      {/* Top Preview Banner (se ativo) */}
      {previewTemplate && (
        <StorefrontPreviewBanner
          currentTemplate="experimental"
          publishedTemplate={store.template}
          storeSlug={store.slug}
        />
      )}

      {/* Top Streetwear Bar */}
      <div className="bg-[#121215] text-neutral-400 text-[10px] font-mono tracking-widest uppercase py-2 px-4 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4ff00] animate-pulse" />
            <span>{store.announcementBar || "DROPS SOB DEMANDA • EDIÇÃO LIMITADA 2026"}</span>
          </span>
          <span className="hidden sm:inline text-neutral-500">
            ENGINE // DEVESSENT RETAIL EXPERIMENTAL
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-[#0a0a0c]/95 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Brand Logo Left */}
          <div className="flex items-center gap-6">
            <Link
              href={`/loja/${store.slug}${queryParam}`}
              className="text-xl sm:text-2xl font-black tracking-tight uppercase font-display text-white hover:text-[#d4ff00] transition-colors flex items-center gap-1.5"
            >
              <span>{store.storeName}</span>
              <span className="text-[#d4ff00] text-sm">®</span>
            </Link>
          </div>

          {/* Navigation Links Center */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-mono uppercase font-bold tracking-wider text-neutral-300">
            <Link
              href={`/loja/${store.slug}${queryParam}`}
              className="hover:text-[#d4ff00] transition-colors"
            >
              Home
            </Link>
            <Link
              href={`/loja/${store.slug}/produtos${queryParam}`}
              className="hover:text-[#d4ff00] transition-colors"
            >
              Coleção
            </Link>
            {categories.slice(0, 3).map((cat) => (
              <Link
                key={cat.id}
                href={`/loja/${store.slug}/categoria/${cat.slug}${queryParam}`}
                className="hover:text-[#d4ff00] transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* Action Icons Right */}
          <div className="flex items-center gap-4 text-neutral-300">
            <Link
              href={`/loja/${store.slug}/produtos${queryParam}`}
              aria-label="Buscar produtos"
              className="p-1 hover:text-[#d4ff00] transition-colors"
            >
              <Search className="w-4 h-4" />
            </Link>
            <Link
              href={`/loja/${store.slug}/produtos${queryParam}`}
              aria-label="Favoritos"
              className="p-1 hover:text-[#d4ff00] transition-colors hidden sm:block"
            >
              <Heart className="w-4 h-4" />
            </Link>
            <StorefrontCartTrigger template="experimental" />
            <div className="md:hidden">
              <Link
                href={`/loja/${store.slug}/produtos${queryParam}`}
                className="p-1 text-neutral-300 hover:text-white"
                aria-label="Menu"
              >
                <Menu className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <ExperimentalFooter
        store={store}
        categories={categories}
        previewTemplate={previewTemplate}
      />
    </div>
  );
}

