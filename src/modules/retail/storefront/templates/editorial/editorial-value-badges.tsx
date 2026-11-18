import { Box, ShieldCheck, RefreshCw, Truck } from "lucide-react";

export function EditorialValueBadges() {
  const pillars = [
    {
      icon: Box,
      title: "MATERIAIS NOBRES",
      description: "Fibras naturais, linho e tecidos selecionados para alta durabilidade.",
    },
    {
      icon: ShieldCheck,
      title: "ALFAIATARIA AUTORAL",
      description: "Construção precisa, acabamentos manuais e caimento contemporâneo.",
    },
    {
      icon: RefreshCw,
      title: "TROCAS SIMPLES",
      description: "30 dias para trocas com comodidade e atendimento personalizado.",
    },
    {
      icon: Truck,
      title: "ENVIO RASTREADO",
      description: "Logística ágil e entrega segura para todas as regiões do país.",
    },
  ];

  return (
    <section className="border-y border-stone-200/80 bg-[#fbfaf8] py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {pillars.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="flex items-start gap-3.5">
              <div className="p-2 rounded-full bg-stone-200/60 text-stone-800 shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold tracking-widest uppercase text-stone-900">
                  {item.title}
                </h4>
                <p className="mt-1 text-xs text-stone-500 font-light leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

