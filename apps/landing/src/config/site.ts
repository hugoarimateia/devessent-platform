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
  category: "Disponível sob medida" | "Demonstração sob consulta" | "Em planejamento";
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
    "Desenvolvemos sites, sistemas e soluções digitais sob medida, com foco em performance, segurança e resultado.",
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
    { label: "Serviços", href: "/#servicos", code: "02" },
    { label: "Soluções", href: "/#solucoes", code: "03" },
    { label: "Portfólio", href: "/#portfolio", code: "04" },
    { label: "Como trabalhamos", href: "/#como-trabalhamos", code: "05" },
    { label: "Sobre a DevEssent", href: "/#sobre", code: "06" },
  ],
  tickerPhrases: [
    "TECNOLOGIA QUE SE TORNA ESSENCIAL",
    "DESENVOLVIMENTO COM PROPÓSITO",
    "SISTEMAS PARA NEGÓCIOS REAIS",
    "O ESSENCIAL É EVOLUIR",
    "DIGITAL SOLUTIONS / DEVESSENT",
    "BUILDING WHAT MATTERS",
    "SITES / SYSTEMS / PLATFORMS / AUTOMATION",
  ],
  heroTechList: [
    "SISTEMAS",
    "PLATAFORMAS",
    "AUTOMAÇÃO",
    "INTEGRAÇÕES",
  ],
  services: [
    {
      id: "desenvolvimento-de-sites",
      index: "01",
      code: "SRV // WEB",
      title: "Desenvolvimento de sites",
      subtitle: "Arquitetura institucional de alta performance e presença autoral",
      description:
        "Projetamos e construímos plataformas institucionais velozes, responsivas e estruturadas para transmitir autoridade técnica e posicionar sua marca com clareza.",
      deliverables: [
        "Engenharia front-end em Next.js e TypeScript",
        "Performance Core Web Vitals e SEO técnico",
        "Design editorial sob medida sem templates genéricos",
      ],
      tag: "Presença Digital",
    },
    {
      id: "landing-pages",
      index: "02",
      code: "SRV // LP",
      title: "Landing pages",
      subtitle: "Páginas de alta precisão focadas em narrativa comercial e conversão",
      description:
        "Estruturas enxutas e persuasivas desenhadas para lançamentos, captação qualificada de oportunidades e campanhas de tráfego com carregamento imediato.",
      deliverables: [
        "Hierarquia visual orientada à tomada de decisão",
        "Formulários validados e integração direta com atendimento",
        "Otimização extrema para dispositivos móveis",
      ],
      tag: "Conversão & Captação",
    },
    {
      id: "sistemas-web",
      index: "03",
      code: "SRV // SYS",
      title: "Sistemas web",
      subtitle: "Software sob medida para operações que superaram planilhas",
      description:
        "Desenvolvemos aplicações web proprietárias, painéis administrativos e ferramentas internas moldadas exatamente às regras de negócio da sua empresa.",
      deliverables: [
        "Modelagem de dados e fluxos operacionais dedicados",
        "Controle de acesso, segurança e rastreabilidade",
        "Interfaces escuras ou claras de alta legibilidade operacional",
      ],
      tag: "Engenharia Sob Medida",
    },
    {
      id: "plataformas-comerciais",
      index: "04",
      code: "SRV // COM",
      title: "Plataformas comerciais",
      subtitle: "Vitrines digitais, catálogos interativos e fluxos de pedidos",
      description:
        "Organizamos produtos, serviços, agendas e regras comerciais em ambientes digitais que reduzem o atrito de compra e aceleram o fechamento de negócios.",
      deliverables: [
        "Catálogos estruturados com busca e filtros instantâneos",
        "Montagem de pedidos e reservas em tempo real",
        "Experiência fluida do primeiro clique ao envio comercial",
      ],
      tag: "Operação Comercial",
    },
    {
      id: "automacao-de-processos",
      index: "05",
      code: "SRV // AUTO",
      title: "Automação de processos",
      subtitle: "Eliminação de tarefas manuais repetitivas e gargalos internos",
      description:
        "Transformamos rotinas manuais sujeitas a falhas em fluxos digitais automatizados, liberando sua equipe para focar em atividades estratégicas.",
      deliverables: [
        "Disparo automático de notificações, resumos e alertas",
        "Padronização de cadastros, aprovações e relatórios",
        "Redução mensurável de retrabalho operacional",
      ],
      tag: "Eficiência Operacional",
    },
    {
      id: "integracoes",
      index: "06",
      code: "SRV // API",
      title: "Integrações",
      subtitle: "Conexão segura entre sistemas, APIs, webhooks e serviços",
      description:
        "Unificamos a comunicação entre as ferramentas que sua empresa já utiliza, garantindo que os dados fluam com consistência e segurança ponta a ponta.",
      deliverables: [
        "Integração via APIs REST, GraphQL e Webhooks",
        "Sincronização entre site, atendimento, ERP e meios de contato",
        "Monitoramento de falhas e validação estrita de payloads",
      ],
      tag: "Conectividade & Dados",
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
        "Arquitetura web proprietária para empresas que exigem presença institucional de alto impacto ou sistemas operacionais desenhados exatamente para sua rotina.",
      highlights: [
        "Código autoral em Next.js e TypeScript com alta performance",
        "Modelagem fiel às regras de negócio e identidade da empresa",
        "Estrutura preparada para evolução contínua e novas integrações",
      ],
      iconType: "site",
      ctaLabel: "Solicitar escopo DevEssent Web",
    },
    {
      id: "devessent-pages",
      code: "MOD // 02",
      productName: "DevEssent Pages",
      title: "Landing pages de alta conversão",
      shortTitle: "DevEssent Pages — Landing Page",
      category: "Disponível sob medida",
      description:
        "Páginas focadas em velocidade de carregamento, clareza de proposta de valor e captação qualificada de leads para produtos, serviços e campanhas.",
      highlights: [
        "Narrativa visual editorial que guia o visitante à ação",
        "Otimização para Core Web Vitals e dispositivos móveis",
        "Integração imediata com WhatsApp, e-mail e webhooks",
      ],
      iconType: "pages",
      ctaLabel: "Solicitar DevEssent Pages",
    },
    {
      id: "devessent-catalog",
      code: "MOD // 03",
      productName: "DevEssent Catalog",
      title: "Catálogos digitais com pedidos",
      shortTitle: "DevEssent Catalog — Catálogo Digital",
      category: "Demonstração sob consulta",
      description:
        "Organize produtos, variações e condições comerciais em uma vitrine ágil que estrutura o pedido do cliente sem atrito e envia diretamente para sua operação.",
      highlights: [
        "Busca rápida, filtros por categoria e organização de itens",
        "Montagem de carrinho com resumo estruturado do pedido",
        "Fechamento ágil integrado ao fluxo comercial da empresa",
      ],
      iconType: "catalog",
      ctaLabel: "Conversar sobre DevEssent Catalog",
    },
    {
      id: "devessent-booking",
      code: "MOD // 04",
      productName: "DevEssent Booking",
      title: "Agendamento online",
      shortTitle: "DevEssent Booking — Agendamento Online",
      category: "Demonstração sob consulta",
      description:
        "Centralize horários, profissionais e disponibilidade em tempo real, reduzindo faltas e liberando sua equipe de confirmações manuais repetitivas.",
      highlights: [
        "Regras flexíveis de agenda, duração e intervalos operacionais",
        "Experiência mobile intuitiva para o cliente final",
        "Painel organizado de gestão diária e histórico de reservas",
      ],
      iconType: "schedule",
      ctaLabel: "Consultar DevEssent Booking",
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
        "Controle estruturado de chamados técnicos, checklists, aprovações de orçamento, status de execução e histórico por cliente ou equipamento.",
      highlights: [
        "Em fase de planejamento e modelagem funcional na suíte DevEssent",
        "Rastreabilidade ponta a ponta entre abertura, execução e entrega",
        "Disponível para avaliação como escopo sob medida ou lista prioritária",
      ],
      iconType: "os",
      ctaLabel: "Registrar interesse no Service",
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
        "Visão clara de oportunidades, etapas do funil, histórico de contatos e próximos passos comerciais — concebido para equipes que precisam vender com método.",
      highlights: [
        "Em fase de arquitetura de produto — sem promessa de entrega imediata",
        "Foco em simplicidade operacional para pequenas e médias empresas",
        "Possibilidade de desenvolvimento dedicado ou aviso de lançamento",
      ],
      iconType: "crm",
      ctaLabel: "Registrar interesse no CRM",
    },
  ] satisfies SolutionItem[],
  processSteps: [
    {
      number: "01",
      code: "STEP // DIAG",
      title: "Diagnóstico",
      subtitle: "Entendimento do que é essencial",
      description:
        "Ouvimos a realidade do seu negócio para mapear gargalos operacionais, objetivos comerciais e o que realmente precisa ser construído agora — sem empurrar funcionalidades desnecessárias.",
      deliverable: "Mapa de necessidades e definição de prioridade técnica",
    },
    {
      number: "02",
      code: "STEP // PROP",
      title: "Proposta",
      subtitle: "Clareza de escopo, prazos e investimento",
      description:
        "Traduzimos a solução em uma proposta transparente, com arquitetura definida, etapas claras de entrega e comunicação compreensível para quem toma decisão.",
      deliverable: "Escopo detalhado, cronograma de marcos e arquitetura",
    },
    {
      number: "03",
      code: "STEP // DEV",
      title: "Desenvolvimento",
      subtitle: "Engenharia precisa e acompanhamento próximo",
      description:
        "Construímos a solução com padrão visual elevado, código limpo, validações de segurança e testes de responsividade, mantendo você atualizado a cada avanço.",
      deliverable: "Ambiente de homologação validado e código de alta performance",
    },
    {
      number: "04",
      code: "STEP // EVOL",
      title: "Implantação e evolução",
      subtitle: "Operação confiável no dia a dia",
      description:
        "Realizamos a publicação assistida, orientamos sua equipe e acompanhamos a evolução do sistema para que a tecnologia continue servindo ao crescimento da empresa.",
      deliverable: "Sistema em produção, orientação de uso e suporte evolutivo",
    },
  ] satisfies ProcessStep[],
  portfolioBlueprints: [
    {
      id: "real-devessent-platform",
      code: "REAL // WEB-01",
      title: "Plataforma Institucional & Identidade Interativa DevEssent",
      group: "Projetos reais",
      category: "Web & Experiência de Marca",
      statusLabel: "Em Produção",
      summary:
        "Implementação proprietária em Next.js 15, TypeScript e Tailwind CSS com hero cinematográfico 100svh, vetorização fiel de marca, revelação progressiva e canal exclusivo de atendimento.",
      architecturePoints: [
        "Next.js 15 App Router com renderização híbrida e SEO técnico completo",
        "Animações baseadas em compositor (transform/opacity) com suporte a prefers-reduced-motion",
        "API de contato com validação estrita, proteção honeypot e rate-limiting",
      ],
      previewModules: ["Hero 100svh", "Menu Off-Canvas", "Canal /contato"],
    },
    {
      id: "real-entregas-sob-medida",
      code: "REAL // B2B-02",
      title: "Implantações Sob Medida & Confidencialidade Comercial",
      group: "Projetos reais",
      category: "Sistemas & Sites Comerciais",
      statusLabel: "Escopo Sob Consulta",
      summary:
        "Desenvolvemos sites institucionais, landing pages e sistemas internos sob demanda. Por respeito à confidencialidade operacional de cada cliente, demonstrações guiadas são apresentadas em reunião de diagnóstico.",
      architecturePoints: [
        "Código proprietário entregue com documentação e governança técnica",
        "Ambientes isolados de homologação antes de cada publicação em produção",
        "Apresentação técnica ao vivo mediante solicitação comercial",
      ],
      previewModules: ["Diagnóstico Técnico", "Homologação Dedicada", "Entrega Assistida"],
    },
    {
      id: "proto-catalogo-digital",
      code: "PROTO // CAT-01",
      title: "DevEssent Catalog — Vitrine Digital & Pedido Estruturado",
      group: "Protótipos",
      category: "Comércio & Catálogo",
      statusLabel: "Protótipo Funcional",
      summary:
        "Arquitetura demonstrativa para operações comerciais que desejam organizar produtos, variações e envio estruturado de pedidos sem depender de longas trocas manuais de mensagens.",
      architecturePoints: [
        "Indexação instantânea por categorias, buscas e filtros dinâmicos",
        "Cálculo claro de itens e geração de resumo padronizado do pedido",
        "Interface mobile-first de resposta imediata para o comprador",
      ],
      previewModules: ["Busca Instantânea", "Sacola de Pedido", "Resumo Estruturado"],
    },
    {
      id: "proto-booking-agenda",
      code: "PROTO // AGD-02",
      title: "DevEssent Booking — Motor de Agendamento Online",
      group: "Protótipos",
      category: "Serviços & Reservas",
      statusLabel: "Protótipo de Arquitetura",
      summary:
        "Modelo interativo voltado à centralização de horários, profissionais e regras de disponibilidade em tempo real para clínicas, estúdios e operações de atendimento.",
      architecturePoints: [
        "Seleção intuitiva de serviço, profissional e janela de horário",
        "Regras configuráveis de duração, antecedência e bloqueio de agenda",
        "Visão diária clara para recepção e gestão de confirmações",
      ],
      previewModules: ["Seletor de Horários", "Regras de Agenda", "Painel Diário"],
    },
    {
      id: "dev-service-os",
      code: "DEV // SRV-01",
      title: "DevEssent Service — Gestão de Ordens de Serviço",
      group: "Soluções em desenvolvimento",
      category: "Operação Técnica",
      statusLabel: "Em Planejamento",
      summary:
        "Módulo da suíte DevEssent em fase de modelagem funcional para controle ponta a ponta de chamados técnicos, checklists operacionais, aprovação de orçamentos e histórico por cliente.",
      architecturePoints: [
        "Fluxo rastreável desde a abertura do chamado até o termo de entrega",
        "Histórico técnico unificado por equipamento, cliente ou unidade",
        "Aberto para validação com empresas parceiras que buscam escopo dedicado",
      ],
      previewModules: ["Abertura de OS", "Checklist Técnico", "Status em Tempo Real"],
    },
    {
      id: "dev-crm-comercial",
      code: "DEV // CRM-02",
      title: "DevEssent CRM — Pipeline & Relacionamento Comercial",
      group: "Soluções em desenvolvimento",
      category: "Gestão Comercial",
      statusLabel: "Em Planejamento",
      summary:
        "Solução própria em fase de arquitetura voltada a pequenas e médias operações que precisam acompanhar oportunidades, etapas do funil e histórico de interações sem complexidade excessiva.",
      architecturePoints: [
        "Quadro visual de oportunidades com foco em próximo passo comercial",
        "Registro enxuto de propostas, contatos e retorno agendado",
        "Planejado para integração nativa com formulários e canais DevEssent",
      ],
      previewModules: ["Funil Essencial", "Histórico de Lead", "Agenda de Follow-up"],
    },
  ] satisfies PortfolioBlueprint[],
};
