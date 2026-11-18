"use client";

import Link from "next/link";
import { ArrowRight, Instagram, Youtube, Twitter } from "lucide-react";
import type { PublicStorefront, RetailCategory } from "../../../types/retail.types";

interface ExperimentalFooterProps {
  store: PublicStorefront;
  categories: RetailCategory[];
  previewTemplate?: string;
}

export function ExperimentalFooter({
  store,
  categories,
  previewTemplate,
}: ExperimentalFooterProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";

  return (
    <footer className="bg-[#070709] text-neutral-200 border-t border-neutral-800 pt-16 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-neutral-800">
          {/* Brand Column */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-2xl font-black font-display uppercase tracking-widest text-white">
              {store.storeName}
            </h3>
            <p className="text-xs text-neutral-400 font-light leading-relaxed max-w-sm">
              {store.aboutText ||
                "A plataforma comercial de streetwear autoral e customização sob medida. Design inovador e fabricação consciente para peças que duram."}
            </p>
            {store.contactEmail && (
              <p className="text-xs font-mono text-neutral-500">
                Contato Direto: <span className="text-[#d4ff00]">{store.contactEmail}</span>
              </p>
            )}

            {/* Social Links */}
            <div className="flex items-center gap-4 pt-2 text-neutral-400">
              <a
                href={store.socialLinks?.instagram || "#"}
                aria-label="Instagram"
                className="hover:text-[#d4ff00] transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={store.socialLinks?.youtube || "#"}
                aria-label="YouTube"
                className="hover:text-[#d4ff00] transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href={store.socialLinks?.twitter || "#"}
                aria-label="X / Twitter"
                className="hover:text-[#d4ff00] transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links: Loja & Categorias */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-white font-bold">
              Coleção
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400 font-mono">
              <li>
                <Link
                  href={`/loja/${store.slug}/produtos${queryParam}`}
                  className="hover:text-[#d4ff00] transition-colors"
                >
                  Todos os Modelos
                </Link>
              </li>
              {categories.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/loja/${store.slug}/categoria/${c.slug}${queryParam}`}
                    className="hover:text-[#d4ff00] transition-colors"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links: Customização */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-white font-bold">
              Customização
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400 font-mono">
              <li>
                <span className="text-neutral-500">Guia de Estamparia</span>
              </li>
              <li>
                <span className="text-neutral-500">Tabela de Medidas</span>
              </li>
              <li>
                <span className="text-neutral-500">Arquivo Lookbook</span>
              </li>
              <li>
                <span className="text-neutral-500">Sustentabilidade</span>
              </li>
            </ul>
          </div>

          {/* Newsletter Box */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-white font-bold">
              Fique por Dentro
            </h4>
            <p className="text-xs text-neutral-400 font-light">
              Receba drops exclusivos, cupons antecipados e convites para lançamentos da
              comunidade.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert("Inscrito com sucesso no radar de drops!");
              }}
              className="flex items-center gap-1.5 pt-1"
            >
              <input
                type="email"
                placeholder="seu.email@exemplo.com"
                required
                className="w-full px-3 py-2 text-xs bg-[#141418] border border-neutral-700 rounded-[2px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#d4ff00]"
              />
              <button
                type="submit"
                aria-label="Inscrever-se"
                className="p-2 bg-[#d4ff00] text-black font-bold rounded-[2px] hover:bg-white transition-colors shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-500 font-mono">
          <p>© {new Date().getFullYear()} {store.storeName}. Powered by DevEssent Retail OS.</p>
          <div className="flex items-center gap-4">
            <span>Privacidade</span>
            <span>·</span>
            <span>Termos de Uso</span>
            <span>·</span>
            <span>Envios & Trocas</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
