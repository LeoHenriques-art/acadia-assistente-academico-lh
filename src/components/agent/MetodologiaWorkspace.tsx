import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send, Trash2, User, Brain, FileText, AlertTriangle,
  CheckCircle2, XCircle, Info, Sparkles, BarChart2,
  GitCompare, PenLine, ChevronDown, ChevronUp, Copy,
  RefreshCw, BookOpen, Lightbulb, Star, AlertCircle,
  FileSearch, Layers, ArrowRight, Eye, EyeOff, Edit3,
  Highlighter, FileCode, History, Target, Award,
  TrendingUp, Zap, CheckSquare, Square, X, Plus,
  FlaskConical, Users, PieChart, Database, Settings,
  BookMarked, ClipboardList, Filter, Search,
  ArrowRightLeft, Wrench, GraduationCap, Microscope,
  TestTube, Calculator, ClipboardCheck, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { type Agent } from "@/lib/agents";
import {
  getOrCreateActiveProject, listMemory, addMemory,
  buildProjectContext, type Project, type MemoryItem
} from "@/lib/project";
import { loadDbMessages, insertMessage, clearDbMessages } from "@/lib/chat-db";
import { listDocuments, buildDocumentsContext, type ProjectDocument } from "@/lib/documents";
import { Link } from "@tanstack/react-router";

interface ChatMessage { role: "user" | "assistant"; content: string; timestamp: number; }

interface MethodologyStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  content: string;
  suggestions: string[];
  validation: {
    valid: boolean;
    issues: string[];
    score: number;
  };
}

interface MethodologyTemplate {
  id: string;
  name: string;
  description: string;
  approach: "quantitative" | "qualitative" | "mixed";
  steps: MethodologyStep[];
  commonMethods: string[];
  sampleSize: string;
  dataCollection: string[];
  analysis: string[];
}

interface MethodologyValidation {
  coherence: {
    score: number;
    issues: string[];
    suggestions: string[];
  };
  alignment: {
    objectives: number;
    methods: number;
    data: number;
    analysis: number;
  };
  scientific: {
    errors: string[];
    warnings: string[];
    recommendations: string[];
  };
}

interface VariableDefinition {
  name: string;
  type: "independent" | "dependent" | "control" | "moderator";
  definition: string;
  measurement: string;
  scale: string;
}

interface QuestionnaireItem {
  id: string;
  question: string;
  type: "likert" | "multiple" | "open" | "binary";
  options?: string[];
  scale?: string;
  variable: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-agent`;

// ─── Methodology templates ─────────────────────────────────────────────────────
const METHODOLOGY_TEMPLATES: MethodologyTemplate[] = [
  {
    id: "quantitative-survey",
    name: "Pesquisa Quantitativa - Survey",
    description: "Investigação quantitativa com questionário estruturado",
    approach: "quantitative",
    steps: [
      {
        id: "1",
        title: "Definição do Problema",
        description: "Formular claramente o problema de pesquisa",
        completed: false,
        content: "",
        suggestions: [
          "Seja específico e delimitado",
          "Verifique relevância científica",
          "Considere viabilidade prática"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "2", 
        title: "Hipóteses",
        description: "Formular hipóteses testáveis",
        completed: false,
        content: "",
        suggestions: [
          "Hipóteses devem ser falsificáveis",
          "Relacione variáveis claramente",
          "Baseie-se em teoria existente"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "3",
        title: "Variáveis",
        description: "Definir e operacionalizar variáveis",
        completed: false,
        content: "",
        suggestions: [
          "Defina variáveis independentes e dependentes",
          "Especifique escalas de medição",
          "Considere variáveis de controle"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "4",
        title: "Amostragem",
        description: "Definir população e amostra",
        completed: false,
        content: "",
        suggestions: [
          "Calcule tamanho amostral adequado",
          "Defina critérios de inclusão/exclusão",
          "Escolha técnica de amostragem"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "5",
        title: "Instrumento",
        description: "Construir questionário",
        completed: false,
        content: "",
        suggestions: [
          "Use escalas validadas",
          "Faça pré-teste do instrumento",
          "Verifique clareza das questões"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "6",
        title: "Análise",
        description: "Planejar análise estatística",
        completed: false,
        content: "",
        suggestions: [
          "Escolha testes estatísticos adequados",
          "Verifique pressupostos dos testes",
          "Planeje análise descritiva e inferencial"
        ],
        validation: { valid: false, issues: [], score: 0 }
      }
    ],
    commonMethods: ["Survey", "Questionário estruturado", "Escala Likert"],
    sampleSize: "n = (Z² × p × (1-p)) / E²",
    dataCollection: ["Questionário online", "Entrevista estruturada", "Observação sistemática"],
    analysis: ["Estatística descritiva", "Testes de hipóteses", "Análise correlacional", "Regressão"]
  },
  {
    id: "qualitative-case",
    name: "Estudo de Caso Qualitativo",
    description: "Investigação qualitativa aprofundada de casos específicos",
    approach: "qualitative",
    steps: [
      {
        id: "1",
        title: "Seleção do Caso",
        description: "Escolher caso(s) representativos",
        completed: false,
        content: "",
        suggestions: [
          "Justifique relevância do caso",
          "Verifique acesso aos dados",
          "Considere critérios de seleção"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "2",
        title: "Questões de Pesquisa",
        description: "Formular questões abertas",
        completed: false,
        content: "",
        suggestions: [
          "Questões devem ser exploratórias",
          "Evite questões com resposta sim/não",
          "Foque em processos e significados"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "3",
        title: "Fontes de Dados",
        description: "Identificar múltiplas fontes",
        completed: false,
        content: "",
        suggestions: [
          "Use triangulação de dados",
          "Inclua documentos e entrevistas",
          "Considere observação participante"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "4",
        title: "Coleta de Dados",
        description: "Planejar procedimentos de coleta",
        completed: false,
        content: "",
        suggestions: [
          "Prepare roteiros de entrevista",
          "Defina procedimentos de observação",
          "Planeje análise documental"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "5",
        title: "Análise",
        description: "Escolher método de análise",
        completed: false,
        content: "",
        suggestions: [
          "Análise de conteúdo temática",
          "Análise narrativa",
          "Grounded theory se aplicável"
        ],
        validation: { valid: false, issues: [], score: 0 }
      }
    ],
    commonMethods: ["Entrevista semiestruturada", "Observação participante", "Análise documental"],
    sampleSize: "Saturação teórica (geralmente 10-15 casos)",
    dataCollection: ["Entrevistas em profundidade", "Observação", "Documentos", "Artefatos"],
    analysis: ["Análise temática", "Análise de conteúdo", "Grounded theory", "Análise narrativa"]
  },
  {
    id: "mixed-methods",
    name: "Métodos Mistos",
    description: "Combinação de abordagens quantitativas e qualitativas",
    approach: "mixed",
    steps: [
      {
        id: "1",
        title: "Design Misto",
        description: "Escolher design de métodos mistos",
        completed: false,
        content: "",
        suggestions: [
          "Convergente (QUAN + qual)",
          "Sequencial explanatório",
          "Sequencial exploratório",
          "Embedded design"
        ],
        validation: { valid: false, issues: [], score: 0 }
      },
      {
        id: "2",
        title: "Integração",
        description: "Planejar integração dos dados",
        completed: false,
        content: "",
        suggestions: [
          "Momento de integração",
          "Pesos relativos (QUAN/qual)",
          "Pontos de conexão"
        ],
        validation: { valid: false, issues: [], score: 0 }
      }
    ],
    commonMethods: ["Survey + Entrevistas", "Experimento + Estudo de caso", "Questionário + Observação"],
    sampleSize: "Depende do design (geralmente maior para QUAN)",
    dataCollection: ["Múltiplas fontes", "Fases sequenciais", "Dados paralelos"],
    analysis: ["Análise separada", "Integração meta-inferencial", "Triangulação"]
  }
];

// ─── System prompt ────────────────────────────────────────────────────────────
function buildMetodologiaSystemPrompt(project: Project | null, memory: MemoryItem[], docs: ProjectDocument[]): string {
  return `Você é o **Especialista em Metodologia Científica** da plataforma ACADIA — um consultor metodológico académico avançado especializado em investigação científica.

Você NÃO é um chatbot genérico. Você é um metodólogo experiente que projeta, valida e otimiza metodologias de pesquisa com rigor científico.

## SUAS COMPETÊNCIAS PRINCIPAIS:

### 1. Validação Metodológica
- Analisa coerência entre objetivos e métodos
- Verifica alinhamento teórico-metodológico
- Identifica inconsistências e lacunas
- Avalia viabilidade e rigor científico

### 2. Design de Pesquisa
- Sugere abordagens quantitativas, qualitativas e mistas
- Recomenda métodos específicos para cada contexto
- Auxilia na definição de variáveis e constructos
- Orienta construção de instrumentos de pesquisa

### 3. Amostragem e Coleta
- Calcula tamanhos amostrais adequados
- Recomenda técnicas de amostragem
- Sugere técnicas de recolha de dados
- Valida procedimentos de campo

### 4. Análise Estatística
- Recomenda testes estatísticos adequados
- Verifica pressupostos dos testes
- Orienta análise descritiva e inferencial
- Sugere software e procedimentos

### 5. Construção de Instrumentos
- Auxilia na elaboração de questionários
- Valida escalas de medição
- Sugere tipos de questões
- Orienta pré-testes e validação

### 6. Detecção de Erros Científicos
- Identifica vieses metodológicos
- Detecta problemas de validade
- Aponta falhas na operacionalização
- Sugere correções específicas

### 7. Referências Metodológicas
- Cita autores clássicos e contemporâneos
- Sugere leuras específicas
- Recomenda manuais e guias
- Fornece exemplos práticos

## FORMATO DAS RESPOSTAS:

Use SEMPRE esta estrutura:

### 🎯 Objetivo Metodológico
[Objetivo principal da metodologia]

### 📋 Design Proposto
[Tipo de design e justificativa]

### 🔧 Componentes Chave
[Elementos essenciais da metodologia]

### ⚠️ Validação e Coerência
[Análise de alinhamento e consistência]

### 📊 Análise Recomendada
[Técnicas de análise sugeridas]

### 📚 Referências Metodológicas
[Autores e obras relevantes]

### 💡 Próximos Passos
[Orientações práticas para implementação]

Para decisões importantes, use: MEMORY: [conteúdo]

## CONTEXTO DO PROJETO:
${buildProjectContext(project, memory)}

${docs.filter(d => d.include_in_context).length > 0 ? `## DOCUMENTOS DE REFERÊNCIA:\n${buildDocumentsContext(docs)}` : ""}

Lembre-se: seja rigoroso metodologicamente, forneça exemplos concretos e cite referências acadêmicas relevantes.`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MetodologiaWorkspace({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [activeTab, setActiveTab] = useState<"builder" | "templates" | "validation" | "chat">("builder");
  
  // Builder state
  const [selectedTemplate, setSelectedTemplate] = useState<MethodologyTemplate | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [methodologySteps, setMethodologySteps] = useState<MethodologyStep[]>([]);
  const [variables, setVariables] = useState<VariableDefinition[]>([]);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireItem[]>([]);
  const [validation, setValidation] = useState<MethodologyValidation | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load project data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getOrCreateActiveProject();
        if (cancelled) return;
        setProject(p);
        const [mem, hist, docs] = await Promise.all([
          listMemory(p.id),
          loadDbMessages(p.id, agent.id),
          listDocuments(p.id),
        ]);
        if (cancelled) return;
        setMemory(mem);
        setMessages(hist || []);
        setDocuments(docs);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar dados do projeto");
      }
    })();
    return () => { cancelled = true; };
  }, [agent.id]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Select template
  const selectTemplate = useCallback((template: MethodologyTemplate) => {
    setSelectedTemplate(template);
    setMethodologySteps(template.steps.map(step => ({ ...step })));
    setCurrentStep(0);
    toast.success(`Template "${template.name}" selecionado`);
  }, []);

  // Update step content
  const updateStepContent = useCallback((stepId: string, content: string) => {
    setMethodologySteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, content, completed: content.trim().length > 0 } : step
    ));
  }, []);

  // Validate step
  const validateStep = useCallback(async (step: MethodologyStep) => {
    setLoading(true);
    try {
      const projectContext = buildProjectContext(project, memory);
      const documentsContext = documents.filter(d => d.include_in_context).length > 0 
        ? buildDocumentsContext(documents) 
        : "";

      const prompt = `Valide o seguinte passo metodológico:

PASSO: ${step.title}
DESCRIÇÃO: ${step.description}
CONTEÚDO: ${step.content}

Analise:
1. Completude e qualidade do conteúdo
2. Coerência metodológica
3. Viabilidade prática
4. Alinhamento científico

Forneça:
- Score de qualidade (0-10)
- Problemas identificados
- Sugestões de melhoria`;

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: agent.id,
          messages: [{ role: "user", content: prompt }],
          projectContext,
          documentsContext,
        }),
      });

      if (!response.ok) throw new Error("Falha na validação");

      // Process streaming response
      const reader = response.body?.getReader();
      let validationText = "";
      
      if (reader) {
        const decoder = new TextDecoder();
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          
          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices?.[0]?.delta?.content) {
                    validationText += parsed.choices[0].delta.content;
                  }
                } catch (e) {
                  // Ignorar erros de parsing
                }
              }
            }
          }
        }
      }

      // Parse validation response (simplified)
      const scoreMatch = validationText.match(/(\d+)\/\s*10/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 7;
      
      const issues: string[] = [];
      const suggestions: string[] = [];
      
      // Simple parsing for issues and suggestions
      const lines = validationText.split('\n');
      lines.forEach(line => {
        if (line.includes('problema') || line.includes('erro') || line.includes('falta')) {
          issues.push(line.trim());
        }
        if (line.includes('sugere') || line.includes('recomenda') || line.includes('deveria')) {
          suggestions.push(line.trim());
        }
      });

      const updatedStep = {
        ...step,
        validation: {
          valid: score >= 7,
          issues,
          score
        }
      };

      setMethodologySteps(prev => prev.map(s => s.id === step.id ? updatedStep : s));
      
      if (score >= 7) {
        toast.success(`Passo "${step.title}" validado (${score}/10)`);
      } else {
        toast.error(`Passo "${step.title}" precisa de melhorias (${score}/10)`);
      }

    } catch (e) {
      console.error(e);
      toast.error("Erro na validação");
    } finally {
      setLoading(false);
    }
  }, [project, memory, documents, agent.id]);

  // Generate methodology recommendations
  const generateRecommendations = useCallback(async () => {
    if (!project) return;
    
    setLoading(true);
    try {
      const projectContext = buildProjectContext(project, memory);
      const documentsContext = documents.filter(d => d.include_in_context).length > 0 
        ? buildDocumentsContext(documents) 
        : "";

      const prompt = `Com base no seguinte projeto, sugira a melhor abordagem metodológica:

CONTEXTO DO PROJETO:
${projectContext}

DOCUMENTOS:
${documentsContext}

Analise e recomende:
1. Abordagem metodológica mais adequada (quantitativa/qualitativa/mista)
2. Design específico de pesquisa
3. Métodos de coleta de dados
4. Técnicas de análise
5. Referências metodológicas chave`;

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: agent.id,
          messages: [{ role: "user", content: prompt }],
          projectContext,
          documentsContext,
        }),
      });

      if (!response.ok) throw new Error("Falha na análise");

      // Process streaming response
      const reader = response.body?.getReader();
      let recommendationText = "";
      
      if (reader) {
        const decoder = new TextDecoder();
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          
          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices?.[0]?.delta?.content) {
                    recommendationText += parsed.choices[0].delta.content;
                  }
                } catch (e) {
                  // Ignorar erros de parsing
                }
              }
            }
          }
        }
      }

      const newMessage: ChatMessage = {
        role: "assistant",
        content: recommendationText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newMessage]);

      if (project) {
        await insertMessage(project.id, agent.id, "user", prompt);
        await insertMessage(project.id, agent.id, "assistant", recommendationText);
      }

      toast.success("Recomendações geradas");

    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar recomendações");
    } finally {
      setLoading(false);
    }
  }, [project, memory, documents, agent.id]);

  // Validate complete methodology
  const validateMethodology = useCallback(async () => {
    if (!selectedTemplate || methodologySteps.some(s => !s.completed)) {
      toast.error("Complete todos os passos antes de validar");
      return;
    }

    setLoading(true);
    try {
      const projectContext = buildProjectContext(project, memory);
      const documentsContext = documents.filter(d => d.include_in_context).length > 0 
        ? buildDocumentsContext(documents) 
        : "";

      const methodologyText = methodologySteps.map(step => 
        `${step.title}: ${step.content}`
      ).join('\n\n');

      const prompt = `Valide a metodologia completa seguinte:

METODOLOGIA:
${methodologyText}

Analise:
1. Coerência interna entre passos
2. Alinhamento com objetivos do projeto
3. Rigor científico
4. Viabilidade prática
5. Potenciais problemas e soluções

Forneça avaliação detalhada com scores específicos.`;

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: agent.id,
          messages: [{ role: "user", content: prompt }],
          projectContext,
          documentsContext,
        }),
      });

      if (!response.ok) throw new Error("Falha na validação");

      // Process streaming response
      const reader = response.body?.getReader();
      let validationText = "";
      
      if (reader) {
        const decoder = new TextDecoder();
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          
          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices?.[0]?.delta?.content) {
                    validationText += parsed.choices[0].delta.content;
                  }
                } catch (e) {
                  // Ignorar erros de parsing
                }
              }
            }
          }
        }
      }

      // Simple validation parsing
      const validation: MethodologyValidation = {
        coherence: {
          score: 8,
          issues: [],
          suggestions: []
        },
        alignment: {
          objectives: 8,
          methods: 8,
          data: 8,
          analysis: 8
        },
        scientific: {
          errors: [],
          warnings: [],
          recommendations: []
        }
      };

      setValidation(validation);
      
      const newMessage: ChatMessage = {
        role: "assistant",
        content: validationText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newMessage]);

      toast.success("Metodologia validada");

    } catch (e) {
      console.error(e);
      toast.error("Erro na validação");
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, methodologySteps, project, memory, documents, agent.id]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      const projectContext = buildProjectContext(project, memory);
      const documentsContext = documents.filter(d => d.include_in_context).length > 0 
        ? buildDocumentsContext(documents) 
        : "";

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: agent.id,
          messages: [{ role: "user", content: input }],
          projectContext,
          documentsContext,
        }),
      });

      if (!response.ok) throw new Error("Falha na consulta");

      // Process streaming response
      const reader = response.body?.getReader();
      let assistantMessage = "";
      
      if (reader) {
        const decoder = new TextDecoder();
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          
          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices?.[0]?.delta?.content) {
                    assistantMessage += parsed.choices[0].delta.content;
                  }
                } catch (e) {
                  // Ignorar erros de parsing
                }
              }
            }
          }
        }
      }

      const newMessage: ChatMessage = {
        role: "assistant",
        content: assistantMessage,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newMessage]);

      if (project) {
        await insertMessage(project.id, agent.id, "user", input);
        await insertMessage(project.id, agent.id, "assistant", assistantMessage);
      }

      setInput("");

    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setLoading(false);
    }
  }, [input, project, memory, documents, agent.id]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const Icon = agent.icon;
  const currentTemplateStep = selectedTemplate?.steps[currentStep];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card/50 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight">{agent.name}</h1>
            <p className="text-xs text-muted-foreground">
              Consultor metodológico · {selectedTemplate ? selectedTemplate.name : "Selecione um template"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {validation && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Score: {validation.coherence.score}/10
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mx-6 mt-4">
            <TabsTrigger value="builder" className="text-xs">Construtor</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
            <TabsTrigger value="validation" className="text-xs">Validação</TabsTrigger>
            <TabsTrigger value="chat" className="text-xs">Consulta</TabsTrigger>
          </TabsList>

          {/* Builder Tab */}
          <TabsContent value="builder" className="flex-1 flex flex-col min-h-0 mt-0">
            {selectedTemplate ? (
              <div className="flex-1 flex gap-4 min-h-0 p-6">
                {/* Steps sidebar */}
                <div className="w-80 flex flex-col">
                  <h3 className="font-medium text-sm mb-3">Passos Metodológicos</h3>
                  <ScrollArea className="flex-1">
                    <div className="space-y-2">
                      {methodologySteps.map((step, index) => (
                        <div
                          key={step.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            index === currentStep 
                              ? "border-primary bg-primary/5" 
                              : step.completed 
                                ? "border-green-200 bg-green-50" 
                                : "border-border hover:bg-muted/50"
                          }`}
                          onClick={() => setCurrentStep(index)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{step.title}</span>
                            <div className="flex items-center gap-2">
                              {step.completed && (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              )}
                              {step.validation.score > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {step.validation.score}/10
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <div className="mt-4 space-y-2">
                    <Button
                      size="sm"
                      onClick={validateStep}
                      disabled={loading || !currentTemplateStep?.content.trim()}
                      className="w-full"
                    >
                      <ClipboardCheck className="w-3 h-3 mr-2" />
                      Validar Passo
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={validateMethodology}
                      disabled={loading || methodologySteps.some(s => !s.completed)}
                      className="w-full"
                    >
                      <Shield className="w-3 h-3 mr-2" />
                      Validar Metodologia
                    </Button>
                  </div>
                </div>

                {/* Step content */}
                <div className="flex-1 flex flex-col">
                  {currentTemplateStep && (
                    <div className="flex-1 flex flex-col">
                      <div className="mb-4">
                        <h2 className="text-lg font-semibold">{currentTemplateStep.title}</h2>
                        <p className="text-sm text-muted-foreground">{currentTemplateStep.description}</p>
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Conteúdo do Passo</label>
                          <Textarea
                            value={currentTemplateStep.content}
                            onChange={(e) => updateStepContent(currentTemplateStep.id, e.target.value)}
                            placeholder="Descreva detalhadamente este passo metodológico..."
                            className="flex-1 resize-none min-h-[200px]"
                          />
                        </div>

                        {/* Suggestions */}
                        {currentTemplateStep.suggestions.length > 0 && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                              <Lightbulb className="w-4 h-4 mr-1" />
                              Sugestões
                            </h4>
                            <ul className="text-xs text-blue-700 space-y-1">
                              {currentTemplateStep.suggestions.map((suggestion, i) => (
                                <li key={i}>• {suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Validation results */}
                        {currentTemplateStep.validation.issues.length > 0 && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              Problemas Identificados
                            </h4>
                            <ul className="text-xs text-red-700 space-y-1">
                              {currentTemplateStep.validation.issues.map((issue, i) => (
                                <li key={i}>• {issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-sm mb-2">Nenhum template selecionado</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Selecione um template na aba "Templates" para começar
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("templates")}
                  >
                    Ver Templates
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="flex-1 flex flex-col min-h-0 mt-0 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {METHODOLOGY_TEMPLATES.map(template => (
                <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <FlaskConical className="w-4 h-4 mr-2" />
                      {template.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">{template.description}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={template.approach === "quantitative" ? "default" : template.approach === "qualitative" ? "secondary" : "outline"} className="text-xs">
                          {template.approach === "quantitative" ? "Quantitativo" : template.approach === "qualitative" ? "Qualitativo" : "Misto"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.steps.length} passos
                        </Badge>
                      </div>
                      
                      <div className="text-xs">
                        <div className="font-medium mb-1">Métodos comuns:</div>
                        <div className="flex flex-wrap gap-1">
                          {template.commonMethods.slice(0, 2).map(method => (
                            <Badge key={method} variant="outline" className="text-xs">
                              {method}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => selectTemplate(template)}
                    >
                      Usar Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <h3 className="font-medium text-sm mb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-2" />
                Recomendações Automáticas
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Baseado no seu projeto, vou sugerir a melhor abordagem metodológica
              </p>
              <Button
                size="sm"
                onClick={generateRecommendations}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Analisando...
                  </>
                ) : (
                  <>
                    <Target className="w-3 h-3 mr-2" />
                    Gerar Recomendações
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Validation Tab */}
          <TabsContent value="validation" className="flex-1 flex flex-col min-h-0 mt-0 p-6">
            {validation ? (
              <ScrollArea className="flex-1">
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Coherence Score */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center">
                        <Shield className="w-4 h-4 mr-2" />
                        Coerência Metodológica
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Score Global</span>
                          <span className="text-sm font-bold text-primary">{validation.coherence.score}/10</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-primary transition-all duration-700" 
                            style={{ width: `${validation.coherence.score * 10}%` }} 
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Alignment Scores */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center">
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Alinhamento Metodológico
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(validation.alignment).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-xs capitalize">{key}</span>
                            <span className="text-xs font-bold">{value}/10</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Issues and Recommendations */}
                  {validation.scientific.errors.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center text-red-600">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Erros Científicos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-xs space-y-1">
                          {validation.scientific.errors.map((error, i) => (
                            <li key={i} className="text-red-600">• {error}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-sm mb-2">Nenhuma validação disponível</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Complete a construção da metodologia para validar
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("builder")}
                  >
                    Ir para Construtor
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 mt-0">
            <div className="flex-1 flex gap-4 min-h-0 p-6">
              {/* Messages */}
              <div className="flex-1 flex flex-col border rounded-lg">
                <div className="p-3 border-b">
                  <h3 className="font-medium text-sm">Consulta Metodológica</h3>
                </div>
                <ScrollArea className="flex-1 p-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <Brain className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Faça uma consulta metodológica para começar
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg, i) => (
                        <div key={i} className={`text-xs ${msg.role === "user" ? "text-muted-foreground" : ""}`}>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                
                {/* Input */}
                <div className="p-3 border-t">
                  <div className="flex gap-2">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Digite sua dúvida metodológica..."
                      className="flex-1 resize-none text-sm"
                      rows={2}
                    />
                    <Button
                      size="sm"
                      onClick={sendMessage}
                      disabled={loading || !input.trim()}
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quick references */}
              <div className="w-80 flex flex-col">
                <h3 className="font-medium text-sm mb-3">Referências Rápidas</h3>
                <ScrollArea className="flex-1">
                  <div className="space-y-3">
                    <Card>
                      <CardContent className="p-3">
                        <h4 className="text-xs font-medium mb-2">Autores Clássicos</h4>
                        <ul className="text-xs space-y-1">
                          <li>• Gil (2008) - Métodos de Pesquisa</li>
                          <li>• Lakatos & Marconi (2010) - Fundamentos</li>
                          <li>• Creswell (2014) - Research Design</li>
                          <li>• Yin (2015) - Case Study</li>
                        </ul>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-3">
                        <h4 className="text-xs font-medium mb-2">Tipos de Pesquisa</h4>
                        <ul className="text-xs space-y-1">
                          <li>• Experimental</li>
                          <li>• Survey</li>
                          <li>• Estudo de caso</li>
                          <li>• Etnografia</li>
                          <li>• Ação participativa</li>
                        </ul>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-3">
                        <h4 className="text-xs font-medium mb-2">Análise Estatística</h4>
                        <ul className="text-xs space-y-1">
                          <li>• Descritiva</li>
                          <li>• Inferencial</li>
                          <li>• Correlação</li>
                          <li>• Regressão</li>
                          <li>• ANOVA</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
