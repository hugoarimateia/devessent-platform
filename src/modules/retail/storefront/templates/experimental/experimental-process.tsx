import { Shirt, Edit3, Eye, PackageCheck, ArrowRight } from "lucide-react";

export function ExperimentalProcess() {
  const steps = [
    {
      step: "01",
      title: "ESCOLHA",
      desc: "Selecione a peça e a modelagem base ideal para o seu estilo.",
      icon: Shirt,
    },
    {
      step: "02",
      title: "CUSTOMIZE",
      desc: "Ajuste cores, variantes, tamanhos e detalhes construtivos.",
      icon: Edit3,
    },
    {
      step: "03",
      title: "PRÉ-VISUALIZE",
      desc: "Confira todas as especificações e caimento antes de confirmar.",
      icon: Eye,
    },
    {
      step: "04",
      title: "VISTA",
      desc: "Confeccionamos com matéria-prima nobre e enviamos com rastreio.",
      icon: PackageCheck,
    },
  ];

  return (
    <section className="bg-[#0c0c0f] text-neutral-100 py-16 px-4 sm:px-6 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#d4ff00] block mb-1">
              O PROCESSO
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase font-display tracking-tight text-white">
              COMO FUNCIONA
            </h2>
          </div>
          <p className="text-xs text-neutral-400 font-mono">
            Da concepção artesanal à entrega final em 4 etapas claras.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            const isLast = idx === steps.length - 1;
            return (
              <div
                key={item.step}
                className="relative bg-[#141418] border border-neutral-800 p-6 rounded-[2px] flex flex-col justify-between hover:border-[#d4ff00]/50 transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-[#d4ff00]">
                      {item.step} {"//"}
                    </span>
                    <div className="p-2.5 rounded-[2px] bg-[#1a1a20] text-neutral-200 group-hover:text-[#d4ff00] transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="text-sm font-black font-mono uppercase tracking-wider text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs text-neutral-400 font-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                {!isLast && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-[#0c0c0f] border border-neutral-700 text-neutral-400">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
