import React from "react";
import { TechWireframeGlobe } from "./TechDecor";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

/**
 * SEÇÃO 06 — SOBRE A DEVESSENT (#sobre)
 * Posicionamento institucional objetivo sem repetir a decomposição da Seção 01.
 * Conecta engenharia, design, proximidade com PMEs/MEIs e evolução contínua.
 */
export function About() {
  const principles = [
    {
      code: "01",
      title: "Engenharia + Direção de Arte",
      text: "Interfaces claras e código de alto padrão caminhando juntos em cada entrega.",
    },
    {
      code: "02",
      title: "Proximidade com o negócio real",
      text: "Pensado para PMEs, MEIs e empresas em expansão que precisam de resultado sem burocracia.",
    },
    {
      code: "03",
      title: "Base preparada para escalar",
      text: "Projetos seguros e modulares que acompanham o crescimento da sua operação.",
    },
  ];

  return (
    <section
      id="sobre"
      aria-labelledby="about-heading"
      className="relative py-20 sm:py-28"
    >
      <SectionTransition
        number="06"
        code="SOBRE A DEVESSENT"
        label="SOFTWARE HOUSE BRASILEIRA"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Coluna Editorial Principal (7 cols) */}
            <div className="lg:col-span-7">
              <h2
                id="about-heading"
                className="font-display text-2xl leading-[1.16] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl lg:text-[2.6rem]"
              >
                Tecnologia de software house,{" "}
                <span className="text-[#A782FF]">
                  acessível para quem faz o negócio acontecer.
                </span>
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#BAB5C5] sm:text-base">
                Falamos a língua do empreendedor e entregamos com rigor de
                engenharia — profissionalizando presença digital, vendas e
                operação com clareza em cada decisão.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {principles.map((item) => (
                  <div
                    key={item.code}
                    className="rounded-2xl border border-[#E9E7DF]/14 bg-[#14111F]/80 p-5 transition-colors hover:border-[#A782FF]/45"
                  >
                    <span className="font-tech text-[10px] tracking-[0.22em] text-[#B695FF]">
                      {item.code}
                    </span>
                    <h3 className="mt-2 font-display text-sm font-bold text-[#E9E7DF]">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#BAB5C5]">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna Visual Compacta (5 cols) */}
            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-[22px] border border-[#A782FF]/30 bg-gradient-to-br from-[#171226]/92 to-[#0E0C16]/95 p-7 sm:p-8">
                <div className="flex items-center justify-between gap-4 border-b border-[#E9E7DF]/10 pb-5">
                  <div>
                    <span className="block font-tech text-[10px] tracking-[0.26em] text-[#B695FF] uppercase">
                      VISÃO DE FUTURO
                    </span>
                    <p className="mt-1 font-display text-base font-bold text-[#E9E7DF]">
                      Exploração com pé no chão
                    </p>
                  </div>
                  <TechWireframeGlobe className="h-16 w-16 shrink-0" />
                </div>

                <blockquote className="mt-5 font-display text-lg leading-relaxed font-semibold text-[#E9E7DF]">
                  “A tecnologia certa não complica a empresa — ela libera tempo
                  para crescer.”
                </blockquote>

                <div className="mt-6 flex items-center justify-between border-t border-[#E9E7DF]/10 pt-4 font-tech text-[10px] tracking-[0.2em] text-[#BAB5C5] uppercase">
                  <span>BRASIL · REMOTO</span>
                  <span className="text-[#B695FF]">DEVESSENT</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
