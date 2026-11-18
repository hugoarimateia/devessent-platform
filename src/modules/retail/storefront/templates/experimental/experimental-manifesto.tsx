import { CheckCircle2, Shield, Zap, Sparkles } from "lucide-react";

export function ExperimentalManifesto() {
  const pillars = [
    {
      icon: CheckCircle2,
      title: "SUAS REGRAS, SEU DESIGN",
      desc: "Autonomia criativa completa para expressar o que você é.",
    },
    {
      icon: Shield,
      title: "QUALIDADE DE ATELIÊ",
      desc: "Costura dupla, ribana pesada e tecidos com toque encorpado.",
    },
    {
      icon: Zap,
      title: "PRODUÇÃO SOB DEMANDA",
      desc: "Menos desperdício têxtil e maior valor em cada unidade feita.",
    },
    {
      icon: Sparkles,
      title: "MODA COM ATITUDE",
      desc: "Fuja do padrão comercial tradicional com estética autêntica.",
    },
  ];

  return (
    <section className="bg-[#101014] text-neutral-100 py-16 px-4 sm:px-6 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Banner with Quote */}
        <div className="bg-[#16161c] border border-neutral-800 rounded-[4px] p-8 sm:p-12 relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black uppercase font-display tracking-tight text-white leading-tight">
              O QUE É <br />
              <span className="text-[#d4ff00] underline decoration-[#d4ff00]/40">
                CUSTOMIZAÇÃO?
              </span>
            </h2>

            <p className="text-sm sm:text-base text-neutral-300 font-light leading-relaxed">
              &ldquo;Customização é a liberdade de tornar a moda verdadeiramente sua. É mais do
              que adicionar uma estampa ou um detalhe — é converter uma silhueta clássica em
              uma afirmação pessoal, expressiva e duradoura.&rdquo;
            </p>
          </div>

          {/* Decorative Corner Tag */}
          <div className="hidden sm:block absolute -right-6 -bottom-6 w-36 h-36 bg-[#d4ff00]/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* 4 Guarantee Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-[#141418] border border-neutral-800 p-5 rounded-[2px] flex items-start gap-3.5 hover:border-[#d4ff00]/50 transition-colors"
              >
                <div className="p-2 rounded-[2px] bg-[#1f1f26] text-[#d4ff00] shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-neutral-400 font-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

