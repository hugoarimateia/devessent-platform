import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicStorefront } from "../../../types/retail.types";

interface ExperimentalStatementProps {
  store: PublicStorefront;
  previewTemplate?: string;
}

export function ExperimentalStatement({
  store,
  previewTemplate,
}: ExperimentalStatementProps) {
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const catalogHref = `/loja/${store.slug}/produtos${queryParam}`;

  return (
    <section className="bg-[#0f0f12] text-neutral-100 py-16 px-4 sm:px-6 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Visual Highlight */}
        <div className="lg:col-span-4 relative aspect-[4/3] sm:aspect-square bg-[#16161a] border border-neutral-800 rounded-[2px] p-6 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4ff00]">
            ESTÉTICA // BRUTALISTA
          </span>
          <div className="my-auto">
            <span className="text-4xl sm:text-5xl font-black font-mono text-white block">
              100%
            </span>
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 mt-1 block">
              Produção Autoral & Sob Demanda
            </span>
          </div>
          <span className="text-[10px] font-mono text-neutral-500">
            DevEssent Retail Experimental Architecture
          </span>
        </div>

        {/* Center Column: Mission Statement */}
        <div className="lg:col-span-5 space-y-4">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#d4ff00]">
            SOBRE A MARCA
          </span>

          <h2 className="text-2xl sm:text-3xl font-black uppercase font-display tracking-tight text-white">
            UMA PLATAFORMA PARA <br />
            <span className="text-[#d4ff00]">MODA PESSOAL</span>.
          </h2>

          <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed">
            {store.aboutText ||
              "Combinamos moda contemporânea, tecnologia e liberdade expressiva. Cada peça do catálogo é confeccionada para quem não aceita o comum, unindo materiais nobres e atitude urbana."}
          </p>

          <div className="pt-2">
            <Link
              href={catalogHref}
              className="inline-flex items-center gap-2 text-xs font-mono uppercase font-bold tracking-wider text-white hover:text-[#d4ff00] transition-colors"
            >
              <span>Ver Todos os Modelos</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Right Column: 4 Bold Stat Blocks */}
        <div className="lg:col-span-3 grid grid-cols-2 gap-4">
          <div className="bg-[#141418] border border-neutral-800 p-4 rounded-[2px]">
            <span className="text-2xl font-black font-mono text-white block">50K+</span>
            <span className="text-[10px] font-mono uppercase text-neutral-400 mt-1 block">
              Peças Entregues
            </span>
          </div>

          <div className="bg-[#141418] border border-neutral-800 p-4 rounded-[2px]">
            <span className="text-2xl font-black font-mono text-[#d4ff00] block">98%</span>
            <span className="text-[10px] font-mono uppercase text-neutral-400 mt-1 block">
              Satisfação
            </span>
          </div>

          <div className="bg-[#141418] border border-neutral-800 p-4 rounded-[2px]">
            <span className="text-2xl font-black font-mono text-white block">120+</span>
            <span className="text-[10px] font-mono uppercase text-neutral-400 mt-1 block">
              Modelos Criados
            </span>
          </div>

          <div className="bg-[#141418] border border-neutral-800 p-4 rounded-[2px]">
            <span className="text-2xl font-black font-mono text-[#d4ff00] block">24/7</span>
            <span className="text-[10px] font-mono uppercase text-neutral-400 mt-1 block">
              Suporte Direto
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

