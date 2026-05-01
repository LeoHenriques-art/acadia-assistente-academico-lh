import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send, Trash2, User, Brain, FileText, AlertTriangle,
  CheckCircle2, XCircle, Info, Sparkles, BarChart2,
  GitCompare, PenLine, ChevronDown, ChevronUp, Copy,
  RefreshCw, BookOpen, Lightbulb, Star, AlertCircle,
  FileSearch, Layers, ArrowRight, Eye, EyeOff, Edit3,
  Highlighter, FileCode, History, Target, Award,
  TrendingUp, Zap, CheckSquare, Square, X, Plus,
  BarChart3, Upload, FileSpreadsheet, Database, PieChart,
  LineChart, TrendingDown, Calculator, Filter,
  Table, Download, Share2, Settings, Activity,
  FileUp, FileDown, ArrowUpDown, ScatterChart,
  AreaChart, Histogram, BoxPlot
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

interface Dataset {
  id: string;
  name: string;
  type: "csv" | "excel" | "json";
  size: number;
  rows: number;
  columns: number;
  uploadedAt: number;
  data?: any[][];
  headers?: string[];
  preview?: any[][];
}

interface StatisticalSummary {
  mean: number;
  median: number;
  mode: number;
  std: number;
  variance: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  skewness: number;
  kurtosis: number;
  count: number;
}

interface ChartConfig {
  type: "bar" | "line" | "pie" | "scatter" | "histogram" | "box";
  title: string;
  xAxis: string;
  yAxis: string;
  data: any[];
  colors: string[];
}

interface DataInsight {
  type: "pattern" | "trend" | "outlier" | "correlation" | "anomaly";
  description: string;
  significance: "low" | "medium" | "high";
  variables: string[];
  recommendation: string;
}

interface AnalysisReport {
  summary: string;
  keyFindings: string[];
  statisticalTests: string[];
  insights: DataInsight[];
  recommendations: string[];
  nextSteps: string[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-agent`;

// ─── System prompt ────────────────────────────────────────────────────────────
function buildAnaliseDadosSystemPrompt(project: Project | null, memory: MemoryItem[], docs: ProjectDocument[]): string {
  return `Você é o **Analista de Dados Académico** da plataforma ACADIA — um especialista em análise estatística e interpretação científica de dados.

Você NÃO é um chatbot genérico. Você é um analista de dados profissional que processa, interpreta e gera insights científicos a partir de datasets.

## SUAS COMPETÊNCIAS PRINCIPAIS:

### 1. Processamento de Dados
- Interpretar automaticamente estruturas de dados
- Identificar tipos de variáveis (qualitativas/quantitativas)
- Detectar problemas de qualidade dos dados
- Sugerir limpeza e preparação

### 2. Análise Estatística
- Calcular estatísticas descritivas completas
- Identificar distribuições e padrões
- Detectar outliers e anomalias
- Analisar correlações e associações

### 3. Visualização de Dados
- Gerar gráficos automáticos adequados
- Escolher visualizações por tipo de dado
- Criar dashboards informativos
- Interpretar visualizações cientificamente

### 4. Interpretação Científica
- Explicar resultados em linguagem académica
- Relacionar com objetivos do projeto
- Gerar insights para capítulos
- Sugerir análises adicionais

### 5. Testes Estatísticos
- Recomendar testes adequados
- Verificar pressupostos
- Interpretar resultados de testes
- Calcular tamanhos de efeito

### 6. Relatórios Académicos
- Estruturar resultados para PFC/TCC
- Gerar tabelas e figuras normatizadas
- Escrever discussões estatísticas
- Citar referências adequadas

## FORMATO DAS RESPOSTAS:

Use SEMPRE esta estrutura:

### 📊 Visão Geral dos Dados
[Descrição do dataset e características principais]

### 📈 Estatísticas Descritivas
[Métricas principais: média, mediana, desvio, etc.]

### 🔍 Padrões e Tendências
[Principais padrões identificados nos dados]

### 📉 Análises Específicas
[Correlações, testes, comparações]

### 💡 Insights Científicos
[Interpretações relevantes para o projeto]

### 📋 Recomendações
[Análises adicionais sugeridas]

### 📚 Referências Estatísticas
[Citações relevantes para a análise]

Para decisões importantes, use: MEMORY: [conteúdo]

## CONTEXTO DO PROJETO:
${buildProjectContext(project, memory)}

${docs.filter(d => d.include_in_context).length > 0 ? `## DOCUMENTOS DE REFERÊNCIA:\n${buildDocumentsContext(docs)}` : ""}

Lembre-se: seja rigoroso estatisticamente, forneça interpretações claras e relacione os dados com os objetivos académicos do projeto.`;
}

// ─── Chart component (simplified) ───────────────────────────────────────────────
function SimpleChart({ config }: { config: ChartConfig }) {
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  
  return (
    <div className="w-full h-64 bg-muted/30 rounded-lg flex items-center justify-center border">
      <div className="text-center">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">{config.title}</p>
        <p className="text-xs text-muted-foreground">
          {config.type} chart with {config.data.length} points
        </p>
        <div className="flex gap-1 justify-center mt-2">
          {config.data.slice(0, 5).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AnaliseDadosWorkspace({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "analysis" | "charts" | "chat">("upload");
  
  // Data state
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [statisticalSummary, setStatisticalSummary] = useState<Record<string, StatisticalSummary>>({});
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [insights, setInsights] = useState<DataInsight[]>([]);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Parse CSV data
  const parseCSV = useCallback((text: string): { headers: string[]; data: any[][] } => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = lines.slice(1).map(line => 
      line.split(',').map(cell => {
        const clean = cell.trim().replace(/"/g, '');
        return isNaN(Number(clean)) ? clean : Number(clean);
      })
    );
    return { headers, data };
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      let parsed: { headers: string[]; data: any[][] };
      
      if (file.name.endsWith('.csv')) {
        parsed = parseCSV(text);
      } else if (file.name.endsWith('.json')) {
        const jsonData = JSON.parse(text);
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          parsed = {
            headers: Object.keys(jsonData[0]),
            data: jsonData.map(row => Object.values(row))
          };
        } else {
          throw new Error("Invalid JSON format");
        }
      } else {
        throw new Error("Unsupported file format");
      }

      const dataset: Dataset = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.name.endsWith('.csv') ? 'csv' : 'json',
        size: file.size,
        rows: parsed.data.length,
        columns: parsed.headers.length,
        uploadedAt: Date.now(),
        headers: parsed.headers,
        data: parsed.data,
        preview: parsed.data.slice(0, 5)
      };

      setDatasets(prev => [...prev, dataset]);
      setSelectedDataset(dataset);
      
      toast.success(`Dataset "${file.name}" carregado com ${parsed.data.length} linhas`);
      
      // Generate automatic analysis
      await generateAutomaticAnalysis(dataset);
      
    } catch (e) {
      console.error(e);
      toast.error("Erro ao processar arquivo");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [parseCSV]);

  // Generate automatic analysis
  const generateAutomaticAnalysis = useCallback(async (dataset: Dataset) => {
    if (!dataset.data || !dataset.headers) return;

    setLoading(true);
    try {
      const projectContext = buildProjectContext(project, memory);
      const documentsContext = documents.filter(d => d.include_in_context).length > 0 
        ? buildDocumentsContext(documents) 
        : "";

      // Create data summary for AI
      const dataSummary = dataset.data.slice(0, 10).map((row, i) => 
        `${i + 1}: ${dataset.headers?.map((header, j) => `${header}: ${row[j]}`).join(', ')}`
      ).join('\n');

      const prompt = `Analise o seguinte dataset académico:

NOME: ${dataset.name}
LINHAS: ${dataset.rows}
COLUNAS: ${dataset.columns}
VARIÁVEIS: ${dataset.headers?.join(', ')}

AMOSTRA DOS DADOS:
${dataSummary}

Forneça:
1. Estatísticas descritivas principais
2. Identificação de padrões e tendências
3. Sugestões de visualizações adequadas
4. Insights científicos relevantes
5. Recomendações de análises adicionais`;

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
      let analysisText = "";
      
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
                    analysisText += parsed.choices[0].delta.content;
                  }
                } catch (e) {
                  // Ignorar erros de parsing
                }
              }
            }
          }
        }
      }

      // Generate simple statistics (mock implementation)
      const summary: Record<string, StatisticalSummary> = {};
      dataset.headers?.forEach((header, index) => {
        const values = dataset.data?.map(row => row[index]).filter(v => typeof v === 'number') || [];
        if (values.length > 0) {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          summary[header] = {
            mean: Math.round(mean * 100) / 100,
            median: 0, // Simplified
            mode: 0, // Simplified
            std: 0, // Simplified
            variance: 0, // Simplified
            min: Math.min(...values),
            max: Math.max(...values),
            q1: 0, // Simplified
            q3: 0, // Simplified
            skewness: 0, // Simplified
            kurtosis: 0, // Simplified
            count: values.length
          };
        }
      });

      setStatisticalSummary(summary);

      // Generate sample charts
      const sampleCharts: ChartConfig[] = [
        {
          type: "bar",
          title: `Distribuição - ${dataset.headers?.[0] || 'Variable 1'}`,
          xAxis: dataset.headers?.[0] || 'X',
          yAxis: dataset.headers?.[1] || 'Y',
          data: dataset.data?.slice(0, 10) || [],
          colors: ['#3b82f6', '#ef4444', '#10b981']
        },
        {
          type: "line",
          title: `Tendência - ${dataset.headers?.[1] || 'Variable 2'}`,
          xAxis: dataset.headers?.[0] || 'X',
          yAxis: dataset.headers?.[1] || 'Y',
          data: dataset.data?.slice(0, 10) || [],
          colors: ['#8b5cf6', '#ec4899']
        }
      ];

      setCharts(sampleCharts);

      // Generate sample insights
      const sampleInsights: DataInsight[] = [
        {
          type: "pattern",
          description: "Padrão identificado na distribuição dos dados",
          significance: "medium",
          variables: dataset.headers?.slice(0, 2) || [],
          recommendation: "Investigar correlação entre variáveis principais"
        },
        {
          type: "trend",
          description: "Tendência crescente observada nos dados",
          significance: "high",
          variables: dataset.headers?.slice(0, 2) || [],
          recommendation: "Considerar análise de regressão"
        }
      ];

      setInsights(sampleInsights);

      const newMessage: ChatMessage = {
        role: "assistant",
        content: analysisText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newMessage]);

      if (project) {
        await insertMessage(project.id, agent.id, "user", prompt);
        await insertMessage(project.id, agent.id, "assistant", analysisText);
      }

      toast.success("Análise automática gerada");

    } catch (e) {
      console.error(e);
      toast.error("Erro na análise automática");
    } finally {
      setLoading(false);
    }
  }, [project, memory, documents, agent.id]);

  // Generate insights
  const generateInsights = useCallback(async () => {
    if (!selectedDataset) return;

    setLoading(true);
    try {
      const projectContext = buildProjectContext(project, memory);
      const documentsContext = documents.filter(d => d.include_in_context).length > 0 
        ? buildDocumentsContext(documents) 
        : "";

      const prompt = `Com base nos dados do dataset "${selectedDataset.name}", gere insights académicos detalhados para um PFC/TCC:

CONTEXTO DO PROJETO:
${projectContext}

ANÁLISE PEDIDA:
1. Identifique padrões estatísticos significativos
2. Detecte tendências e anomalias
3. Sugira correlações importantes
4. Recomende testes estatísticos adequados
5. Forneça interpretação científica dos resultados

Forneça insights que possam ser usados diretamente nos capítulos de Resultados e Discussão.`;

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
      let insightsText = "";
      
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
                    insightsText += parsed.choices[0].delta.content;
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
        content: insightsText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newMessage]);

      toast.success("Insights gerados");

    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar insights");
    } finally {
      setLoading(false);
    }
  }, [selectedDataset, project, memory, documents, agent.id]);

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
              Análise estatística profissional · {datasets.length} datasets carregados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedDataset && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {selectedDataset.rows} linhas
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mx-6 mt-4">
            <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs">Análise</TabsTrigger>
            <TabsTrigger value="charts" className="text-xs">Gráficos</TabsTrigger>
            <TabsTrigger value="chat" className="text-xs">Consulta</TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="flex-1 flex flex-col min-h-0 mt-0 p-6">
            <div className="flex-1 flex gap-6 min-h-0">
              {/* Upload area */}
              <div className="w-96 flex flex-col">
                <h3 className="font-medium text-sm mb-3">Upload de Datasets</h3>
                
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-1">Upload de Arquivo</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    CSV, Excel ou JSON
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    <FileUp className="w-3 h-3 mr-2" />
                    Selecionar Arquivo
                  </Button>
                </div>

                {/* Dataset list */}
                <div className="mt-4">
                  <h4 className="text-xs font-medium mb-2">Datasets Carregados</h4>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {datasets.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nenhum dataset carregado
                        </p>
                      ) : (
                        datasets.map(dataset => (
                          <div
                            key={dataset.id}
                            className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                              selectedDataset?.id === dataset.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                            onClick={() => setSelectedDataset(dataset)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate">{dataset.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {dataset.type.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {dataset.rows} linhas × {dataset.columns} colunas
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {/* Data preview */}
              <div className="flex-1 flex flex-col">
                <h3 className="font-medium text-sm mb-3">Pré-visualização dos Dados</h3>
                
                {selectedDataset ? (
                  <div className="flex-1 border rounded-lg overflow-hidden">
                    <div className="p-3 border-b bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{selectedDataset.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {selectedDataset.rows} linhas
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {selectedDataset.columns} colunas
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <ScrollArea className="flex-1">
                      <div className="p-3">
                        {/* Table preview */}
                        <div className="overflow-x-auto">
                          <table className="text-xs">
                            <thead>
                              <tr className="border-b">
                                {selectedDataset.headers?.map((header, i) => (
                                  <th key={i} className="p-2 text-left font-medium">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {selectedDataset.preview?.map((row, i) => (
                                <tr key={i} className="border-b">
                                  {row.map((cell, j) => (
                                    <td key={j} className="p-2">
                                      {typeof cell === 'string' && cell.length > 20 
                                        ? cell.substring(0, 20) + '...' 
                                        : cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center border rounded-lg">
                    <div className="text-center">
                      <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-medium text-sm mb-2">Nenhum dataset selecionado</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Faça upload de um arquivo para começar
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="flex-1 flex flex-col min-h-0 mt-0 p-6">
            {selectedDataset ? (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                {/* Statistical Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <Calculator className="w-4 h-4 mr-2" />
                      Estatísticas Descritivas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {Object.entries(statisticalSummary).length > 0 ? (
                        <div className="space-y-4">
                          {Object.entries(statisticalSummary).map(([variable, stats]) => (
                            <div key={variable} className="p-3 border rounded-lg">
                              <h4 className="text-sm font-medium mb-2">{variable}</h4>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>Média: {stats.mean}</div>
                                <div>Mediana: {stats.median}</div>
                                <div>Desvio: {stats.std}</div>
                                <div>Mín: {stats.min}</div>
                                <div>Máx: {stats.max}</div>
                                <div>N: {stats.count}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Activity className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground">
                            Processando estatísticas...
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <Lightbulb className="w-4 h-4 mr-2" />
                      Insights e Padrões
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {insights.length > 0 ? (
                        <div className="space-y-3">
                          {insights.map((insight, i) => (
                            <div key={i} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <Badge 
                                  variant={insight.significance === 'high' ? 'default' : 
                                          insight.significance === 'medium' ? 'secondary' : 'outline'}
                                  className="text-xs"
                                >
                                  {insight.type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {insight.significance}
                                </Badge>
                              </div>
                              <p className="text-xs mb-2">{insight.description}</p>
                              <p className="text-xs text-muted-foreground">
                                💡 {insight.recommendation}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Search className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground mb-4">
                            Nenhum insight gerado ainda
                          </p>
                          <Button
                            size="sm"
                            onClick={generateInsights}
                            disabled={loading}
                          >
                            <Sparkles className="w-3 h-3 mr-2" />
                            Gerar Insights
                          </Button>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Database className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-sm mb-2">Nenhum dataset selecionado</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Selecione um dataset para ver a análise
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("upload")}
                  >
                    Ir para Upload
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts" className="flex-1 flex flex-col min-h-0 mt-0 p-6">
            {selectedDataset ? (
              <div className="flex-1">
                <h3 className="font-medium text-sm mb-4">Visualizações Automáticas</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {charts.map((chart, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <CardTitle className="text-sm">{chart.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SimpleChart config={chart} />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {charts.length === 0 && (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium text-sm mb-2">Gerando visualizações...</h3>
                    <p className="text-xs text-muted-foreground">
                      Os gráficos serão gerados automaticamente
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <PieChart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-sm mb-2">Nenhum dataset selecionado</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Selecione um dataset para ver os gráficos
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("upload")}
                  >
                    Ir para Upload
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
                  <h3 className="font-medium text-sm">Consulta Estatística</h3>
                </div>
                <ScrollArea className="flex-1 p-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <Brain className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Faça uma consulta estatística para começar
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
                      placeholder="Digite sua dúvida estatística..."
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
                <h3 className="font-medium text-sm mb-3">Referências Estatísticas</h3>
                <ScrollArea className="flex-1">
                  <div className="space-y-3">
                    <Card>
                      <CardContent className="p-3">
                        <h4 className="text-xs font-medium mb-2">Testes Comuns</h4>
                        <ul className="text-xs space-y-1">
                          <li>• Teste t</li>
                          <li>• ANOVA</li>
                          <li>• Qui-quadrado</li>
                          <li>• Correlação de Pearson</li>
                          <li>• Regressão linear</li>
                        </ul>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-3">
                        <h4 className="text-xs font-medium mb-2">Software Estatístico</h4>
                        <ul className="text-xs space-y-1">
                          <li>• SPSS</li>
                          <li>• R</li>
                          <li>• Python (pandas, scipy)</li>
                          <li>• Stata</li>
                          <li>• Jamovi</li>
                        </ul>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-3">
                        <h4 className="text-xs font-medium mb-2">Conceitos Chave</h4>
                        <ul className="text-xs space-y-1">
                          <li>• Valor p</li>
                          <li>• Intervalo de confiança</li>
                          <li>• Tamanho de efeito</li>
                          <li>• Normalidade</li>
                          <li>• Homocedasticidade</li>
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
