"use client";

import Link from "next/link";
import { ArrowRight, Instagram, Youtube, Twitter } from "lucide-react";
import type { PublicStorefront, RetailCategory } from "../../../types/retail.types";

interface EditorialFooterProps {
  store: PublicStorefront;
  categories: RetailCategory[];
  previewTemplate?: string;
}

export function EditorialFooter({
  store,
  categories,
  previewTemplate,
}: EditorialFooterProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";

  return (
    <footer className="bg-[#faf9f6] text-stone-900 border-t border-stone-200 pt-16 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-stone-200">
          {/* Brand Manifesto Column */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xl font-bold tracking-widest uppercase font-display text-stone-950">
              {store.storeName}
            </h3>
            <p className="text-xs text-stone-600 font-light leading-relaxed max-w-sm">
              {store.aboutText ||
                "Peças autorais e atemporais desenvolvidas com dedicação ao corte perfeito e materiais nobres. Cada criação traduz nossa visão de moda contemporânea e consciente."}
            </p>
            {store.contactEmail && (
              <p className="text-xs text-stone-500 font-mono">
                Contato: <span className="text-stone-900">{store.contactEmail}</span>
              </p>
            )}

            {/* Social Icons */}
            <div className="flex items-center gap-4 pt-2 text-stone-600">
              <a
                href={store.socialLinks?.instagram || "#"}
                aria-label="Instagram"
                className="hover:text-stone-950 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={store.socialLinks?.youtube || "#"}
                aria-label="YouTube"
                className="hover:text-stone-950 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href={store.socialLinks?.twitter || "#"}
                aria-label="X / Twitter"
                className="hover:text-stone-950 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links: Catálogo & Categorias */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-stone-900 font-bold">
              Catálogo
            </h4>
            <ul className="space-y-2 text-xs text-stone-600 font-light">
              <li>
                <Link
                  href={`/loja/${store.slug}/produtos${queryParam}`}
                  className="hover:text-stone-950 transition-colors"
                >
                  Todas as Peças
                </Link>
              </li>
              {categories.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/loja/${store.slug}/categoria/${c.slug}${queryParam}`}
                    className="hover:text-stone-950 transition-colors"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links: Ateliê / Institucional */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-stone-900 font-bold">
              Ateliê
            </h4>
            <ul className="space-y-2 text-xs text-stone-600 font-light">
              <li>
                <span className="text-stone-600">Nossa História</span>
              </li>
              <li>
                <span className="text-stone-600">Sustentabilidade</span>
              </li>
              <li>
                <span className="text-stone-600">Guia de Medidas</span>
              </li>
              <li>
                <span className="text-stone-600">Cuidados com Tecidos</span>
              </li>
            </ul>
          </div>

          {/* Newsletter / Fique Conectado */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-stone-900 font-bold">
              Fique Conectado
            </h4>
            <p className="text-xs text-stone-500 font-light">
              Receba avisos exclusivos sobre lançamentos de coleções cápsula e tiragens
              especiais.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert("Obrigado pelo interesse! Seu e-mail foi cadastrado para novidades.");
              }}
              className="flex items-center gap-1.5 pt-1"
            >
              <input
                type="email"
                placeholder="seu.email@exemplo.com"
                required
                className="w-full px-3 py-2 text-xs bg-stone-100 border border-stone-300 rounded-[2px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900"
              />
              <button
                type="submit"
                aria-label="Assinar newsletter"
                className="p-2 bg-stone-950 text-white rounded-[2px] hover:bg-stone-800 transition-colors shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-500 font-light">
          <p>
            © {new Date().getFullYear()} {store.storeName}. Todos os direitos reservados.
          </p>
          <p className="flex items-center gap-2">
            <span>Powered by</span>
            <span className="font-semibold text-stone-800">DevEssent Retail OS</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
