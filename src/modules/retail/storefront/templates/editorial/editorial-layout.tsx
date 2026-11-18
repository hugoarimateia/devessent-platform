import Link from "next/link";
import { Search, Heart, Menu } from "lucide-react";
import type { StorefrontLayoutProps } from "../../types/storefront.types";
import { EditorialFooter } from "./editorial-footer";
import { StorefrontPreviewBanner } from "../../components/storefront-preview-banner";
import { StorefrontCartTrigger } from "../../components/storefront-cart-trigger";

export function EditorialLayout({
  store,
  categories,
  children,
  previewTemplate,
}: StorefrontLayoutProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f6] text-stone-900 selection:bg-stone-900 selection:text-white">
      {/* Top Preview Banner (se preview ativo) */}
      {previewTemplate && (
        <StorefrontPreviewBanner
          currentTemplate="editorial"
          publishedTemplate={store.template}
          storeSlug={store.slug}
        />
      )}

      {/* Top Announcement Bar */}
      <div className="bg-stone-950 text-stone-100 text-[11px] font-mono tracking-widest uppercase py-2 px-4 text-center">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="hidden sm:inline">
            {store.announcementBar || "FRETE GRÁTIS EM COMPRAS ACIMA DE R$ 250 • PRIMEIRA TROCA GRÁTIS"}
          </span>
          <span className="sm:hidden mx-auto">
            {store.announcementBar || "FRETE GRÁTIS ACIMA DE R$ 250"}
          </span>
          <span className="hidden md:inline text-stone-400">
            NOVA TEMPORADA — {new Date().getFullYear()}
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-[#faf9f6]/95 backdrop-blur-md border-b border-stone-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Left Nav */}
          <nav className="hidden md:flex items-center gap-8 text-xs uppercase font-medium tracking-widest text-stone-700">
            <Link
              href={`/loja/${store.slug}${queryParam}`}
              className="hover:text-stone-950 transition-colors"
            >
              Início
            </Link>
            <Link
              href={`/loja/${store.slug}/produtos${queryParam}`}
              className="hover:text-stone-950 transition-colors"
            >
              Produtos
            </Link>
            {categories.slice(0, 3).map((cat) => (
              <Link
                key={cat.id}
                href={`/loja/${store.slug}/categoria/${cat.slug}${queryParam}`}
                className="hover:text-stone-950 transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Icon */}
          <div className="md:hidden flex items-center">
            <Link
              href={`/loja/${store.slug}/produtos${queryParam}`}
              className="p-2 text-stone-800"
              aria-label="Abrir catálogo"
            >
              <Menu className="w-5 h-5" />
            </Link>
          </div>

          {/* Center Brand Logo */}
          <div className="text-center">
            <Link
              href={`/loja/${store.slug}${queryParam}`}
              className="text-xl sm:text-2xl font-black tracking-[0.2em] uppercase font-display text-stone-950 hover:opacity-85 transition-opacity"
            >
              {store.storeName}
            </Link>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-4 sm:gap-6 text-stone-800">
            <Link
              href={`/loja/${store.slug}/produtos${queryParam}`}
              aria-label="Buscar produtos"
              className="p-1 hover:text-stone-950 transition-colors"
            >
              <Search className="w-4 h-4" />
            </Link>
            <Link
              href={`/loja/${store.slug}/produtos${queryParam}`}
              aria-label="Favoritos"
              className="p-1 hover:text-stone-950 transition-colors hidden sm:block"
            >
              <Heart className="w-4 h-4" />
            </Link>
            <StorefrontCartTrigger template="editorial" />
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <EditorialFooter
        store={store}
        categories={categories}
        previewTemplate={previewTemplate}
      />
    </div>
  );
}

