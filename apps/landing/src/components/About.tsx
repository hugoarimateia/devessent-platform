import React from "react";
import {
  EssentOctagonBadge,
  TechSlantedBars,
  TechWireframeGlobe,
} from "./TechDecor";
import { ScrollReveal } from "./ScrollReveal";
import { SectionTransition } from "./SectionTransition";

/**
 * SEÇÃO 06 — SOBRE A DEVESSENT (#sobre)
 * Apresenta conceito, propósito e visão de tecnologia essencial.
 */
export function About() {
  const pillars = [
    {
      code: "01 // PROPÓSITO",
      title: "Tecnologia essencial, não por aparência",
      description:
        "Não criamos funcionalidades apenas para preencher listas. Identificamos o que está no centro da sua operação para resolver problemas reais de atendimento, vendas e gestão.",
    },
    {
      code: "02 // CLAREZA",
      title: "Processo compreensível do início ao fim",
      description:
        "Traduzimos decisões técnicas em linguagem clara. Você sabe exatamente o que será entregue, como funcionará e qual resultado prático trará para sua rotina.",
    },
    {
      code: "03 // PROXIMIDADE",
      title: "Parceria direta com quem constrói",
      description:
        "Atuamos próximos da realidade de negócios locais e empresas em crescimento, adaptando a arquitetura ao momento atual da sua operação.",
    },
    {
      code: "04 // EVOLUÇÃO",
      title: "Estrutura preparada para o futuro",
      description:
        "Cada site ou sistema nasce com base sólida, segura e escalável para crescer junto com a empresa sem exigir retrabalho constante.",
    },
  ];

  return (
    <section
      id="sobre"
      aria-labelledby="about-heading"
      className="relative border-t border-[#E9E7DF]/10 bg-gradient-to-b from-[#0B0B0B] via-[#130F1E] to-[#0B0B0B] py-20 sm:py-28"
    >
      <SectionTransition
        number="06"
        code="SEC // SOBRE A DEVESSENT"
        label="PROPÓSITO & VISÃO"
      />

      <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-14 sm:px-8 lg:px-12">
        <ScrollReveal>
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Coluna Conceitual Esquerda (5 cols): Núcleo da Marca + Globo Wireframe + Selo 本質 */}
            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-[22px] border border-[#A782FF]/35 bg-[#120E1C]/90 p-7 sm:p-9">
                <div className="mb-6 flex items-center justify-between gap-4 border-b border-[#E9E7DF]/12 pb-6">
                  <div>
                    <span className="block font-tech text-xs tracking-[0.28em] text-[#B695FF] uppercase">
                      NÚCLEO DA MARCA
                    </span>
                    <span className="mt-1 block text-xs text-[#BAB5C5]">
                      Dev (Desenvolvimento) + Essent (Essência)
                    </span>
                  </div>
                  <EssentOctagonBadge
                    subtitle="ESSÊNCIA"
                    className="h-26 w-24 shrink-0"
                  />
                </div>

                <blockquote className="font-display text-lg leading-relaxed font-semibold text-[#E9E7DF] sm:text-xl">
                  “E se a tecnologia deixasse de ser um acessório e passasse a
                  fazer parte do que torna uma empresa melhor todos os dias?”
                </blockquote>

                <p className="mt-4 text-sm leading-relaxed text-[#BAB5C5]">
                  Na DevEssent, o astronauta simboliza a exploração do futuro
                  sem perder o contato com a realidade. As órbitas e os grids
                  representam método; o lilás, transformação; e o preto, foco e
                  precisão.
                </p>

                <div className="mt-8 flex items-center justify-between gap-4 border-t border-[#E9E7DF]/12 pt-6">
                  <TechWireframeGlobe className="h-20 w-20 shrink-0" />
                  <div className="space-y-1.5 text-right">
                    <span className="block font-tech text-xs tracking-[0.22em] text-[#A782FF] uppercase">
                      O ESSENCIAL É EVOLUIR
                    </span>
                    <p className="text-xs text-[#BAB5C5]">
                      Soluções escaláveis, seguras e indispensáveis para o dia
                      a dia do negócio.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita (7 cols): Manifesto e 4 Pilares */}
            <div className="lg:col-span-7">
              <div className="mb-4 inline-flex items-center gap-3">
                <span className="font-tech text-xs font-semibold tracking-[0.3em] text-[#A782FF] uppercase">
                  06 {"//"} SOBRE A DEVESSENT
                </span>
                <span className="h-[1px] w-10 bg-[#A782FF]/45" />
                <TechSlantedBars />
              </div>

              <h2
                id="about-heading"
                className="font-display text-2xl leading-[1.2] font-bold tracking-tight text-[#E9E7DF] sm:text-4xl"
              >
                Unimos a ambição do futuro às necessidades concretas de{" "}
                <span className="text-[#A782FF]">
                  negócios que existem hoje.
                </span>
              </h2>

              <p className="mt-4 text-sm leading-relaxed text-[#BAB5C5] sm:text-base">
                Somos uma software house focada em construir tecnologia útil,
                estrutural e adaptada ao que cada empresa realmente precisa
                para atender melhor, vender com organização, operar com
                confiança e crescer com clareza.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                {pillars.map((pillar) => (
                  <div
                    key={pillar.code}
                    className="rounded-[16px] border border-[#E9E7DF]/15 bg-[#15121F]/80 p-5 transition-colors hover:border-[#A782FF]/45 sm:p-6"
                  >
                    <span className="font-tech text-[0.65rem] tracking-[0.22em] text-[#B695FF] uppercase">
                      {pillar.code}
                    </span>
                    <h3 className="mt-2 font-display text-base font-bold text-[#E9E7DF] sm:text-lg">
                      {pillar.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#BAB5C5] sm:text-sm">
                      {pillar.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
