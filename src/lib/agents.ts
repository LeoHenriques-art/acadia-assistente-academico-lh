import { LayoutDashboard, GraduationCap, FileSearch, BookOpen, FlaskConical, BarChart3, Users, FolderKanban, FileText } from "lucide-react";

 export type AgentId = "orientador" | "revisor" | "leitor-pfc" | "metodologia" | "analise-dados" | "simulador-juri";

export interface Agent {
  id: AgentId;
  name: string;
  short: string;
  description: string;
  intro: string;
  icon: typeof GraduationCap;
}

export const AGENTS: Agent[] = [
  {
    id: "orientador",
    name: "Orientador IA",
    short: "Orientador",
    description: "Orientação académica contínua — tema, objetivos, estrutura, progresso e coerência do PFC.",
    intro: "Olá! Sou o seu orientador académico inteligente. Vamos construir o seu PFC juntos — desde a definição do tema até à estrutura final. Por onde quer começar?",
    icon: GraduationCap,
  },
  {
    id: "revisor",
    name: "Revisor Científico Profissional",
    short: "Revisor",
    description: "Revisão científica avançada com editor inline, comparação de versões, score de qualidade e análise contextual completa.",
    intro: "Sou seu revisor científico profissional. Cole seu texto para análise gramatical, coerência, estrutura e qualidade académica. Ofereço sugestões inline e comparação entre versões.",
    icon: FileSearch,
  },
  {
    id: "leitor-pfc",
    name: "Leitor de PFCs",
    short: "Leitor PFC",
    description: "Upload e análise automática de PFCs, TCCs e artigos.",
    intro: "Carregue um PDF e eu extraio tema, objetivos, metodologia, conclusões e disponibilizo tudo para os outros agentes.",
    icon: BookOpen,
  },
  {
    id: "metodologia",
    name: "Especialista em Metodologia",
    short: "Metodologia",
    description: "Consultor metodológico avançado com construtor passo a passo, validação automática e modelos de investigação.",
    intro: "Sou seu consultor metodológico académico especializado. Vamos construir uma metodologia científica robusta com validação automática e recomendações personalizadas.",
    icon: FlaskConical,
  },
  {
    id: "analise-dados",
    name: "Analista de Dados Académico",
    short: "Dados",
    description: "Analista profissional com upload de datasets, gráficos automáticos, estatísticas descritivas e interpretação científica.",
    intro: "Sou seu analista de dados académico especializado. Upload seus dados Excel/CSV e vou gerar análises, gráficos e interpretações científicas automáticas.",
    icon: BarChart3,
  },
  {
   id: "simulador-juri",
   name: "Simulador de Juri",
   short: "Juri",
    description: "Treine sua defesa com perguntas críticas de uma banca.",
    intro: "Apresente seu trabalho em poucas linhas e eu, como banca, começarei a arguir.",
    icon: Users,
  },
];

export const NAV_ITEMS = [
  { id: "dashboard" as const, name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { id: "project" as const, name: "Projeto PFC", icon: FolderKanban, path: "/project" },
  { id: "documents" as const, name: "Documentos", icon: FileText, path: "/documents" },
  ...AGENTS.map(a => ({ id: a.id, name: a.name, icon: a.icon, path: `/agent/${a.id}` })),
];
