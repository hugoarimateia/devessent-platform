import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { PublicStorefront } from "../../../types/retail.types";

interface ExperimentalLookbookProps {
  store: PublicStorefront;
  previewTemplate?: string;
}

export function ExperimentalLookbook({
  store,
  previewTemplate,
}: ExperimentalLookbookProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const catalogHref = `/loja/${store.slug}/produtos${queryParam}`;

  const lookbookTiles = [
    { id: "01", title: "Oversized Fit", tag: "Drop 01", desc: "Algodão 400g e silhueta boxy" },
    { id: "02", title: "Cargo Heavy", tag: "Techwear", desc: "Bolsos utilitários reforçados" },
    { id: "03", title: "Acid Graphic", tag: "Art Edition", desc: "Silk de alta densidade" },
    { id: "04", title: "Minimal Hood", tag: "Essential", desc: "Forro duplo e capuz estruturado" },
    { id: "05", title: "Raw Finish", tag: "Archive", desc: "Barra a fio e tingimento estonado" },
    { id: "06", title: "Custom Cap", tag: "Headwear", desc: "Bordado frontal em alto relevo" },
  ];

  return (
    <section className="bg-[#09090b] text-neutral-100 py-16 px-4 sm:px-6 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#d4ff00] block mb-1">
              LOOKBOOK & COMUNIDADE
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase font-display tracking-tight text-white">
              {store.storeName.toUpperCase()} ARCHIVE™
            </h2>
          </div>
          <Link
            href={catalogHref}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#d4ff00] hover:text-white transition-colors"
          >
            <span>Ver Lookbook Completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 6-Tile Streetwear Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {lookbookTiles.map((tile) => (
            <div
              key={tile.id}
              className="group relative aspect-[3/4] bg-[#141418] border border-neutral-800 rounded-[2px] overflow-hidden p-4 flex flex-col justify-between hover:border-[#d4ff00]/60 transition-all"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                <span>#{tile.id}</span>
                <span className="text-[#d4ff00] font-bold">{tile.tag}</span>
              </div>

              {/* Graphical Center Silhouette */}
              <div className="my-auto text-center opacity-60 group-hover:opacity-100 transition-opacity">
                <Sparkles className="w-6 h-6 mx-auto text-[#d4ff00] mb-2" />
                <span className="text-xs font-mono font-bold uppercase text-neutral-200 block">
                  {tile.title}
                </span>
              </div>

              <div className="pt-2 border-t border-neutral-800 text-[10px] font-mono text-neutral-400">
                {tile.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

