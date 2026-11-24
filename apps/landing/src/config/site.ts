export interface ServiceItem {
  id: string;
  index: string;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  deliverables: string[];
  tag: string;
}

export interface SolutionItem {
  id: string;
  code: string;
  productName: string;
  title: string;
  shortTitle: string;
  category:
    | "Disponível sob medida"
    | "Demonstração sob consulta"
    | "Em planejamento";
  isPlanned?: boolean;
  description: string;
  highlights: string[];
  iconType: "site" | "pages" | "catalog" | "schedule" | "os" | "crm";
  ctaLabel: string;
}

export interface FeatureHighlight {
  id: string;
  title: string;
  description: string;
  icon: "code" | "layers" | "shield" | "chart";
  href: string;
}

export interface ProcessStep {
  number: string;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  deliverable: string;
}

export type PortfolioGroup =
  | "Projetos reais"
  | "Protótipos"
  | "Soluções em desenvolvimento";

export interface PortfolioBlueprint {
  id: string;
  code: string;
  title: string;
  group: PortfolioGroup;
  category: string;
  statusLabel: string;
  summary: string;
  architecturePoints: string[];
  previewModules: string[];
}

export const SITE_CONFIG = {
  name: "DevEssent",
  tagline: "Software House",
  headline: "Tecnologia essencial para negócios que evoluem.",
  supportingCopy:
    "Desenvolvemos sites, sistemas, plataformas comerciais e automações sob medida, com foco em performance, segurança e resultado.",
  altSlogan: "O essencial é evoluir.",
  conceptKanji: "本質",
  conceptLabel: "ESSENT",
  siteUrl: (
    process.env.NEXT_PUBLIC_SITE_URL || "https://devessent-landing.pages.dev"
  ).replace(/\/$/, ""),
  contact: {
    whatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "",
    instagram: process.env.NEXT_PUBLIC_CONTACT_INSTAGRAM || "",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  },
  integrations: {
    contactEndpoint: (process.env.NEXT_PUBLIC_CONTACT_ENDPOINT || "").trim(),
    supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim(),
    turnstileSiteKey: (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim(),
  },
  navItems: [
    { label: "Início", href: "/#inicio", code: "00" },
    { label: "Nossa Essência", href: "/#nossa-essencia", code: "01" },
    { label: "Serviços", href: "/#servicos", code: "02" },
    { label: "Soluções", href: "/#solucoes", code: "03" },
    { label: "Portfólio", href: "/#portfolio", code: "04" },
    { label: "Como trabalhamos", href: "/#como-trabalhamos", code: "05" },
    { label: "Sobre", href: "/#sobre", code: "06" },
  ],
  tickerPhrases: [
    "TECNOLOGIA QUE SE TORNA ESSENCIAL",
    "ENGENHARIA COM PROPÓSITO",
    "SISTEMAS PARA NEGÓCIOS REAIS",
    "O ESSENCIAL É EVOLUIR",
    "SITES · SISTEMAS · VITRINES · AUTOMAÇÃO",
  ],
  heroTechList: ["SISTEMAS", "PLATAFORMAS", "AUTOMAÇÃO", "INTEGRAÇÕES"],
  services: [
    {
      id: "desenvolvimento-de-sites",
      index: "01",
      code: "WEB",
      title: "Desenvolvimento de sites",
      subtitle: "Presença institucional veloz, responsiva e sob medida.",
      description:
        "Sites autorais em Next.js e TypeScript com identidade forte, SEO técnico e leitura impecável no celular.",
      deliverables: [
        "Design editorial sob medida",
        "SEO técnico & Core Web Vitals",
        "Responsividade desktop e mobile",
      ],
      tag: "Presença Digital",
    },
    {
      id: "landing-pages",
      index: "02",
      code: "PAGES",
      title: "Landing pages",
      subtitle: "Páginas enxutas com narrativa visual orientada à conversão.",
      description:
        "Estruturas rápidas para campanhas e lançamentos, com hierarquia clara e captação direta para o comercial.",
      deliverables: [
        "Narrativa visual focada em ação",
        "Carregamento instantâneo no mobile",
        "Formulários seguros + WhatsApp",
      ],
      tag: "Conversão",
    },
    {
      id: "sistemas-web",
      index: "03",
      code: "SYSTEMS",
      title: "Sistemas web",
      subtitle: "Painéis internos e softwares criados para sua operação.",
      description:
        "Substitua planilhas frágeis por sistemas seguros com controle de acesso, relatórios e regras do seu negócio.",
      deliverables: [
        "Perfis de acesso e segurança",
        "Painéis claros e auditáveis",
        "Arquitetura preparada para crescer",
      ],
      tag: "Operação Sob Medida",
    },
    {
      id: "plataformas-comerciais",
      index: "04",
      code: "RETAIL",
      title: "Plataformas comerciais",
      subtitle: "Vitrines digitais, catálogos interativos e pedidos organizados.",
      description:
        "Apresente produtos, variações e categorias com fluidez — do clique do cliente ao pedido estruturado.",
      deliverables: [
        "Catálogo com categorias e variantes",
        "Vitrine personalizada por marca",
        "Fluxo de pedido sem atrito",
      ],
      tag: "Vendas Digitais",
    },
    {
      id: "automacao-de-processos",
      index: "05",
      code: "AUTO",
      title: "Automação de processos",
      subtitle: "Menos tarefas manuais repetitivas, mais velocidade diária.",
      description:
        "Transformamos rotinas dispersas em fluxos digitais previsíveis com alertas, validações e registros automáticos.",
      deliverables: [
        "Eliminação de retrabalho manual",
        "Alertas e aprovações automáticas",
        "Padronização de rotinas internas",
      ],
      tag: "Eficiência",
    },
    {
      id: "integracoes",
      index: "06",
      code: "API",
      title: "Integrações",
      subtitle: "Conexão segura entre site, atendimento, APIs e webhooks.",
      description:
        "Unificamos as ferramentas que sua empresa já usa para que pedidos, leads e dados circulem sem digitação dupla.",
      deliverables: [
        "APIs REST e Webhooks validados",
        "Integração site ↔ atendimento ↔ ERP",
        "Segurança e monitoramento de falhas",
      ],
      tag: "Conectividade",
    },
  ] satisfies ServiceItem[],
  featureStrip: [
    {
      id: "desenvolvimento",
      title: "Desenvolvimento",
      description: "Sistemas, plataformas e aplicações web.",
      icon: "code",
      href: "#solucoes",
    },
    {
      id: "sob-medida",
      title: "Soluções sob Medida",
      description: "Projetos personalizados para o seu negócio.",
      icon: "layers",
      href: "#solucoes",
    },
    {
      id: "seguranca-performance",
      title: "Segurança & Performance",
      description: "Tecnologia estável, rápida e confiável.",
      icon: "shield",
      href: "#como-trabalhamos",
    },
    {
      id: "evolucao-continua",
      title: "Evolução Contínua",
      description: "Suporte, melhorias e escalabilidade.",
      icon: "chart",
      href: "/contato",
    },
  ] satisfies FeatureHighlight[],
  solutions: [
    {
      id: "devessent-web",
      code: "MOD // 01",
      productName: "DevEssent Web",
      title: "Sites institucionais e sistemas sob medida",
      shortTitle: "DevEssent Web — Site ou Sistema Sob Medida",
      category: "Disponível sob medida",
      description:
        "Presença institucional de alto impacto ou sistemas web desenhados para o ritmo real da sua empresa.",
      highlights: [
        "Código autoral em Next.js e TypeScript",
        "Identidade visual fiel à marca",
        "Performance e SEO técnico nativos",
      ],
      iconType: "site",
      ctaLabel: "Solicitar escopo Web",
    },
    {
      id: "devessent-pages",
      code: "MOD // 02",
      productName: "DevEssent Pages",
      title: "Landing pages de alta conversão",
      shortTitle: "DevEssent Pages — Landing Page",
      category: "Disponível sob medida",
      description:
        "Páginas rápidas e visuais para campanhas, lançamentos e captação qualificada de leads.",
      highlights: [
        "Hierarquia editorial voltada à decisão",
        "Experiência ágil no celular",
        "Integração com WhatsApp e formulários",
      ],
      iconType: "pages",
      ctaLabel: "Solicitar Landing Page",
    },
    {
      id: "devessent-catalog",
      code: "MOD // 03",
      productName: "DevEssent Catalog",
      title: "Catálogos digitais e gestão comercial",
      shortTitle: "DevEssent Catalog — Catálogo Digital",
      category: "Demonstração sob consulta",
      description:
        "Vitrine digital com categorias, variantes e painel operacional para organizar produtos, estoque e pedidos.",
      highlights: [
        "Vitrine personalizada por loja",
        "Controle de categorias, variantes e estoque",
        "Fluxo estruturado de carrinho e pedidos",
      ],
      iconType: "catalog",
      ctaLabel: "Agendar demo do Catalog",
    },
    {
      id: "devessent-booking",
      code: "MOD // 04",
      productName: "DevEssent Booking",
      title: "Agendamento online",
      shortTitle: "DevEssent Booking — Agendamento Online",
      category: "Demonstração sob consulta",
      description:
        "Centralize horários, profissionais e disponibilidade em tempo real, reduzindo confirmações manuais.",
      highlights: [
        "Regras flexíveis de agenda e duração",
        "Reserva rápida no celular",
        "Visão diária para recepção",
      ],
      iconType: "schedule",
      ctaLabel: "Consultar Booking",
    },
    {
      id: "devessent-service",
      code: "PLAN // 05",
      productName: "DevEssent Service",
      title: "Gestão de ordens de serviço",
      shortTitle: "DevEssent Service — Ordens de Serviço (Em planejamento)",
      category: "Em planejamento",
      isPlanned: true,
      description:
        "Em modelagem funcional: chamados técnicos, checklists, aprovações e histórico por cliente.",
      highlights: [
        "Produto em planejamento (sem entrega imediata)",
        "Disponível como escopo sob medida",
      ],
      iconType: "os",
      ctaLabel: "Registrar interesse",
    },
    {
      id: "devessent-crm",
      code: "PLAN // 06",
      productName: "DevEssent CRM",
      title: "CRM comercial",
      shortTitle: "DevEssent CRM — CRM Comercial (Em planejamento)",
      category: "Em planejamento",
      isPlanned: true,
      description:
        "Em fase de arquitetura: funil comercial enxuto, histórico de contatos e follow-ups para PMEs.",
      highlights: [
        "Produto em planejamento na suíte DevEssent",
        "Possibilidade de projeto dedicado",
      ],
      iconType: "crm",
      ctaLabel: "Registrar interesse",
    },
  ] satisfies SolutionItem[],
  processSteps: [
    {
      number: "01",
      code: "DIAGNÓSTICO",
      title: "Diagnóstico",
      subtitle: "Foco no que destrava resultado",
      description:
        "Mapeamos gargalos, metas e prioridades para construir apenas o essencial — sem complexidade gratuita.",
      deliverable: "Mapa de prioridades e escopo enxuto",
    },
    {
      number: "02",
      code: "PROPOSTA",
      title: "Proposta",
      subtitle: "Clareza de arquitetura e prazo",
      description:
        "Apresentamos solução visual, marcos objetivos e investimento transparente antes de iniciar o código.",
      deliverable: "Proposta técnica + cronograma de marcos",
    },
    {
      number: "03",
      code: "DESENVOLVIMENTO",
      title: "Desenvolvimento",
      subtitle: "Engenharia precisa com homologação",
      description:
        "Entregas incrementais em ambiente de testes, com validação visual, segurança e responsividade real.",
      deliverable: "Preview homologado e código validado",
    },
    {
      number: "04",
      code: "EVOLUÇÃO",
      title: "Implantação e evolução",
      subtitle: "Operação estável no dia a dia",
      description:
        "Publicação assistida, orientação à equipe e acompanhamento para a tecnologia crescer junto com o negócio.",
      deliverable: "Ambiente em produção + suporte evolutivo",
    },
  ] satisfies ProcessStep[],
  portfolioBlueprints: [
    {
      id: "real-devessent-platform",
      code: "REAL // 01",
      title: "Site Institucional & Identidade Interativa DevEssent",
      group: "Projetos reais",
      category: "Web & Direção de Arte",
      statusLabel: "Em Produção",
      summary:
        "Experiência institucional em Next.js 15, TypeScript e Tailwind v4 com exportação estática em Cloudflare Pages, scrollytelling e demos interativas.",
      architecturePoints: [
        "Next.js 15 + Cloudflare Pages CDN global",
        "Motion compositor-only + prefers-reduced-motion",
        "SEO técnico completo e canal /contato seguro",
      ],
      previewModules: ["Hero 100svh", "Demos Interativas", "Canal /contato"],
    },
    {
      id: "proto-catalogo-digital",
      code: "PROTO // 01",
      title: "DevEssent Catalog — Vitrine & Painel Retail",
      group: "Protótipos",
      category: "Plataforma Comercial",
      statusLabel: "Demo Verificada",
      summary:
        "Vitrine editorial e painel de gestão de catálogo, categorias, variantes e estoque construídos na arquitetura DevEssent Platform.",
      architecturePoints: [
        "Vitrine mobile-first com filtros instantâneos",
        "Gestão de produtos, variantes e pedidos",
        "Isolamento seguro multiempresa (RLS)",
      ],
      previewModules: ["Vitrine Editorial", "Catálogo & Estoque", "Pedidos"],
    },
    {
      id: "proto-booking-agenda",
      code: "PROTO // 02",
      title: "DevEssent Booking — Agenda Online",
      group: "Protótipos",
      category: "Serviços & Reservas",
      statusLabel: "Protótipo Funcional",
      summary:
        "Modelo interativo para escolha de serviço, profissional e janela de horário sem trocas manuais repetitivas.",
      architecturePoints: [
        "Seleção intuitiva no celular",
        "Regras de duração e disponibilidade",
        "Visão diária para operação",
      ],
      previewModules: ["Serviço", "Horários", "Painel Diário"],
    },
    {
      id: "real-entregas-sob-medida",
      code: "REAL // 02",
      title: "Projetos Sob Medida & Confidencialidade B2B",
      group: "Projetos reais",
      category: "Sistemas & Sites Comerciais",
      statusLabel: "Sob Consulta",
      summary:
        "Sistemas internos e sites corporativos desenvolvidos sob sigilo comercial — demonstrações técnicas guiadas disponíveis em reunião.",
      architecturePoints: [
        "Código proprietário com documentação",
        "Homologação isolada antes da produção",
        "Apresentação técnica ao vivo sob consulta",
      ],
      previewModules: ["Sob Medida", "Homologação", "Sigilo B2B"],
    },
    {
      id: "dev-service-os",
      code: "ROADMAP // 01",
      title: "DevEssent Service — Ordens de Serviço",
      group: "Soluções em desenvolvimento",
      category: "Operação Técnica",
      statusLabel: "Em Planejamento",
      summary:
        "Modelagem funcional para abertura de chamados, checklists, orçamentos e histórico técnico por cliente.",
      architecturePoints: [
        "Fluxo rastreável de ponta a ponta",
        "Disponível para desenvolvimento sob demanda",
      ],
      previewModules: ["Chamados", "Checklists", "Histórico"],
    },
    {
      id: "dev-crm-comercial",
      code: "ROADMAP // 02",
      title: "DevEssent CRM — Pipeline Comercial",
      group: "Soluções em desenvolvimento",
      category: "Gestão Comercial",
      statusLabel: "Em Planejamento",
      summary:
        "Arquitetura em estudo para funil de oportunidades, histórico de contatos e agenda de retorno para PMEs.",
      architecturePoints: [
        "Funil enxuto focado no próximo passo",
        "Integração futura com canais digitais",
      ],
      previewModules: ["Pipeline", "Contatos", "Follow-up"],
    },
  ] satisfies PortfolioBlueprint[],
};
