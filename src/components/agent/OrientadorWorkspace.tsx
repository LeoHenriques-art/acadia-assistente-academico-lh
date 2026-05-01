import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send, Trash2, Sparkles, User, Brain, ChevronRight,
  CheckCircle2, Circle, Clock, BookOpen, Target, Lightbulb,
  LayoutList, TrendingUp, FileText, RefreshCw, ChevronDown,
  ChevronUp, Zap, GraduationCap, AlertCircle, ArrowRight,
  PenLine, ListChecks, Calendar, BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { type Agent } from "@/lib/agents";
import {
  getOrCreateActiveProject, listMemory, addMemory,
  buildProjectContext, updateProject, type Project, type MemoryItem
} from "@/lib/project";
import { loadDbMessages, insertMessage, clearDbMessages } from "@/lib/chat-db";
import { listDocuments, buildDocumentsContext, type ProjectDocument } from "@/lib/documents";
import { Link } from "@tanstack/react-router";

interface ChatMessage { role: "user" | "assistant"; content: string; timestamp: number; }

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-agent`;

// ─── PFC checklist items ─────────────────────────────────────────────────────
const CHECKLIST_SECTIONS = [
  {
    id: "base", label: "Fundação do Projeto", icon: Target,
    items: [
      { id: "tema", label: "Tema definido e delimitado" },
      { id: "titulo", label: "Título académico refinado" },
      { id: "problema", label: "Problema de investigação formulado" },
      { id: "justificativa", label: "Justificativa elaborada" },
    ],
  },
  {
    id: "objetivos", label: "Objetivos", icon: ListChecks,
    items: [
      { id: "obj-geral", label: "Objetivo geral definido" },
      { id: "obj-especificos", label: "Objetivos específicos (≥3)" },
      { id: "hipoteses", label: "Hipóteses formuladas" },
    ],
  },
  {
    id: "metodologia", label: "Metodologia", icon: Zap,
    items: [
      { id: "abordagem", label: "Abordagem metodológica escolhida" },
      { id: "tipo-pesquisa", label: "Tipo de pesquisa definido" },
      { id: "instrumentos", label: "Instrumentos de coleta definidos" },
      { id: "populacao", label: "População/amostra identificada" },
    ],
  },
  {
    id: "estrutura", label: "Estrutura do PFC", icon: LayoutList,
    items: [
      { id: "capitulos", label: "Capítulos planeados" },
      { id: "ref-teorico", label: "Referencial teórico iniciado" },
      { id: "cronograma", label: "Cronograma elaborado" },
    ],
  },
  {
    id: "producao", label: "Produção", icon: PenLine,
    items: [
      { id: "intro", label: "Introdução redigida" },
      { id: "revisao", label: "Revisão de literatura redigida" },
      { id: "metodologia-cap", label: "Capítulo de metodologia redigido" },
      { id: "resultados", label: "Resultados e análise redigidos" },
      { id: "conclusao", label: "Conclusão redigida" },
      { id: "refs", label: "Referências bibliográficas completas" },
    ],
  },
];

// ─── Timeline phases ──────────────────────────────────────────────────────────
const TIMELINE_PHASES = [
  { id: "concepcao", label: "Conceção", desc: "Tema, título, problema" },
  { id: "planeamento", label: "Planeamento", desc: "Objetivos, metodologia, estrutura" },
  { id: "revisao-lit", label: "Revisão de Literatura", desc: "Fundamentação teórica" },
  { id: "recolha", label: "Recolha de Dados", desc: "Aplicação da metodologia" },
  { id: "analise", label: "Análise", desc: "Tratamento e interpretação" },
  { id: "redacao", label: "Redação Final", desc: "Escrita, revisão, entrega" },
];

// ─── Quick prompts ────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: "Definir tema", prompt: "Preciso definir o tema do meu PFC. Pode ajudar-me a delimitar e formular um tema académico adequado?" },
  { label: "Refinar título", prompt: "Quero refinar o título do meu PFC para que seja mais académico e preciso." },
  { label: "Construir problema", prompt: "Ajuda-me a construir o problema de investigação do meu PFC." },
  { label: "Criar objetivos", prompt: "Preciso criar objetivos gerais e específicos para o meu PFC." },
  { label: "Sugerir hipóteses", prompt: "Pode sugerir hipóteses adequadas para o meu projeto de investigação?" },
  { label: "Gerar estrutura", prompt: "Gera a estrutura completa de capítulos para o meu PFC." },
  { label: "Próximos passos", prompt: "Com base no progresso atual do meu projeto, quais são os próximos passos que devo seguir?" },
  { label: "Avaliar progresso", prompt: "Faz uma avaliação crítica do progresso atual do meu PFC e indica o que ainda falta." },
];

// ─── System prompt for the Orientador ────────────────────────────────────────
function buildOrientadorSystemPrompt(project: Project | null, memory: MemoryItem[], docs: ProjectDocument[]): string {
  return `Você é o **Orientador Académico IA** da plataforma ACADIA — um sistema avançado de orientação de Projeto de Final de Curso (PFC/TCC).

Você NÃO é um chatbot genérico. Você é um orientador académico real, contínuo e especializado que:

1. **Conhece profundamente o projeto do estudante** — usa o contexto do projeto e memória para dar respostas personalizadas.
2. **Orienta com estrutura** — sempre que relevante, use MEMORY: para salvar decisões na memória partilhada.
3. **Age como orientador real** — faz perguntas pertinentes, desafia o estudante, sugere melhorias, identifica lacunas.
4. **Mantém coerência** — verifica se as novas decisões são coerentes com o que já foi definido anteriormente.
5. **Usa linguagem académica** — português académico formal, mas acessível.

## SUAS COMPETÊNCIAS PRINCIPAIS:

### 1. Definição e Refinamento de Tema
- Ajuda a delimitar e formular temas académicos precisos
- Verifica viabilidade, relevância e originalidade
- Sugere subtemas e recortes temáticos

### 2. Formulação do Problema
- Constrói perguntas de investigação claras e investigáveis
- Verifica se o problema justifica o PFC
- Distingue problema de tema e de objetivo

### 3. Títulos Académicos
- Refina títulos para serem precisos, académicos e informativos
- Sugere variações e formatos (descritivo, interrogativo, etc.)
- Verifica adequação ao conteúdo

### 4. Objetivos (Geral e Específicos)
- Formula objetivos com verbos de ação precisos (Taxonomia de Bloom)
- Verifica coerência entre objetivo geral, específicos e metodologia
- Garante que os objetivos são mensuráveis

### 5. Hipóteses
- Sugere hipóteses adequadas ao problema e metodologia
- Distingue hipótese de objetivo e de conclusão
- Verifica testabilidade das hipóteses

### 6. Estrutura do PFC
- Gera estrutura completa com capítulos, subcapítulos e descrições
- Adapta à área de conhecimento e metodologia escolhida
- Mantém coerência lógica entre capítulos

### 7. Acompanhamento de Progresso
- Identifica o estágio atual do projeto
- Sugere próximos passos prioritários
- Alerta sobre inconsistências ou lacunas

### 8. Coerência entre Capítulos
- Verifica se todos os elementos do projeto são coerentes entre si
- Alerta sobre contradições ou lacunas
- Sugere ajustes para manter harmonia

## FORMATO DAS RESPOSTAS:

- Use **markdown** com estrutura clara
- Para decisões importantes, SEMPRE termine com: MEMORY: [decisão salva de forma concisa]
- Para múltiplos itens, use listas numeradas ou com bullets
- Para sugestões de próximos passos, use: **📍 Próximo passo:** ...
- Seja direto, académico e útil — não seja vago ou genérico

## CONTEXTO ATUAL DO PROJETO:
${buildProjectContext(project, memory)}

${docs.filter(d => d.include_in_context).length > 0 ? `## DOCUMENTOS DE REFERÊNCIA:\n${buildDocumentsContext(docs)}` : ""}

Lembre-se: você é um orientador contínuo. Use TODA a informação do contexto para dar respostas personalizadas e coerentes com o projeto específico deste estudante.`;
}

// ─── Progress calculation ─────────────────────────────────────────────────────
function calcProgress(checked: Set<string>): number {
  const total = CHECKLIST_SECTIONS.reduce((a, s) => a + s.items.length, 0);
  return Math.round((checked.size / total) * 100);
}

function getPhaseFromProgress(progress: number): number {
  if (progress < 15) return 0;
  if (progress < 30) return 1;
  if (progress < 50) return 2;
  if (progress < 65) return 3;
  if (progress < 80) return 4;
  return 5;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function OrientadorWorkspace({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [currentPhase, setCurrentPhase] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<"progress" | "checklist" | "timeline">("progress");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["base"]));
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load data
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
        setDocuments(docs);
        setMessages(hist.map((m) => ({ role: m.role, content: m.content, timestamp: new Date(m.created_at).getTime() })));

        // Infer checklist from project data
        const c = new Set<string>();
        if (p.theme) { c.add("tema"); }
        if (p.title && p.title !== "Meu PFC") { c.add("titulo"); }
        if (p.research_question) { c.add("problema"); }
        if (p.objectives) { c.add("obj-geral"); c.add("obj-especificos"); }
        if (p.methodology) { c.add("abordagem"); c.add("tipo-pesquisa"); }
        if (p.structure) { c.add("capitulos"); }
        setChecked(c);
        setCurrentPhase(getPhaseFromProgress(calcProgress(c)));
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar projeto");
      }
    })();
    return () => { cancelled = true; };
  }, [agent.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      setCurrentPhase(getPhaseFromProgress(calcProgress(next)));
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const extractMemoryLines = (text: string) => {
    const memos: string[] = [];
    const lines = text.split("\n");
    const kept: string[] = [];
    for (const l of lines) {
      const m = l.match(/^\s*MEMORY:\s*(.+)$/i);
      if (m) memos.push(m[1].trim());
      else kept.push(l);
    }
    return { clean: kept.join("\n").trim(), memos };
  };

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    if (!project) { toast.error("Projeto não carregado"); return; }

    const userMsg: ChatMessage = { role: "user", content: text, timestamp: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setShowQuickPrompts(false);
    insertMessage(project.id, agent.id, "user", text).catch(console.error);

    let acc = "";
    const updateAssistant = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        return [...prev, { role: "assistant", content: acc, timestamp: Date.now() }];
      });
    };

    try {
      const systemPrompt = buildOrientadorSystemPrompt(project, memory, documents);
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          agent: agent.id,
          systemPrompt,
          projectContext: buildProjectContext(project, memory),
          documentsContext: buildDocumentsContext(documents),
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Falha ao iniciar a conversa" }));
        toast.error(err.error || "Erro ao enviar mensagem");
        setMessages(next);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) updateAssistant(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      if (acc) {
        const { clean, memos } = extractMemoryLines(acc);
        if (memos.length > 0) {
          setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 && m.role === "assistant" ? { ...m, content: clean } : m)));
          for (const memo of memos) {
            try { await addMemory(project.id, agent.id, memo, "decision"); } catch (e) { console.error(e); }
          }
          const fresh = await listMemory(project.id);
          setMemory(fresh);
        }
        await insertMessage(project.id, agent.id, "assistant", clean || acc);

        // Auto-update project fields based on AI response
        autoUpdateProject(project, clean || acc);
      }
    } catch (e) {
      toast.error("Erro de conexão");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [input, loading, project, memory, documents, messages, agent.id]);

  // Auto-detect and update project fields from AI suggestions
  const autoUpdateProject = async (p: Project, aiText: string) => {
    // Simple heuristics — if AI proposes a title, theme, etc. and user hasn't set them
    const patch: Partial<Project> = {};
    if (!p.theme && aiText.toLowerCase().includes("tema:")) {
      const match = aiText.match(/[Tt]ema:\s*\*{0,2}([^\n*]+)\*{0,2}/);
      if (match) patch.theme = match[1].trim();
    }
    if (Object.keys(patch).length > 0) {
      try { await updateProject(p.id, patch); } catch (_) {}
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const onClear = async () => {
    if (!project) return;
    await clearDbMessages(project.id, agent.id);
    setMessages([]);
    setShowQuickPrompts(true);
    toast.success("Histórico limpo");
  };

  const progress = calcProgress(checked);
  const projectIncomplete = !project?.theme && !project?.objectives;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT: Chat ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card/60 px-5 py-3.5 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-tight">{agent.name}</h1>
              <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                Orientação contínua do PFC
                {memory.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Brain className="h-3 w-3 text-primary" /> {memory.length} memórias
                  </span>
                )}
                {project && <span className="text-primary font-medium">· {project.title}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground h-8 text-xs">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {projectIncomplete && (
          <div className="border-b bg-amber-50 px-5 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 flex items-center gap-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Configure o projeto PFC para orientação personalizada.{" "}
            <Link to="/project" className="font-semibold underline">Configurar agora</Link>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1" ref={scrollRef as never}>
          <div className="mx-auto max-w-2xl px-4 py-5 sm:px-5">
            {messages.length === 0 ? (
              <div className="space-y-6">
                {/* Welcome */}
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <GraduationCap className="h-8 w-8" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold">Orientador IA</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                    O seu orientador académico inteligente e contínuo. Aqui construímos juntos o seu PFC — do tema à defesa.
                  </p>
                </div>

                {/* Quick prompts */}
                {showQuickPrompts && (
                  <div>
                    <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Por onde quer começar?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {QUICK_PROMPTS.map((qp) => (
                        <button
                          key={qp.label}
                          onClick={() => send(qp.prompt)}
                          className="group flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-left text-sm font-medium transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                        >
                          <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                          {qp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((m, i) => (
                  <MessageBubble key={i} message={m} />
                ))}
                {loading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-1 pt-2">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t bg-card/50 backdrop-blur shrink-0">
          <div className="mx-auto max-w-2xl px-4 py-3 sm:px-5">
            {/* Quick prompts mini bar when chat has messages */}
            {messages.length > 0 && (
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {QUICK_PROMPTS.slice(0, 5).map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => send(qp.prompt)}
                    disabled={loading}
                    className="shrink-0 rounded-full border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Fale com o seu orientador..."
                rows={1}
                className="min-h-[40px] max-h-36 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
              />
              <Button onClick={() => send()} disabled={!input.trim() || loading} size="icon" className="h-9 w-9 shrink-0 rounded-xl">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Sidebar panel ───────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-72 xl:w-80 flex-col border-l bg-card/30 overflow-hidden">
        {/* Sidebar tabs */}
        <div className="flex border-b shrink-0">
          {(["progress", "checklist", "timeline"] as const).map((tab) => {
            const icons = { progress: BarChart2, checklist: ListChecks, timeline: Calendar };
            const labels = { progress: "Progresso", checklist: "Checklist", timeline: "Timeline" };
            const Icon = icons[tab];
            return (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${sidebarTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {labels[tab]}
              </button>
            );
          })}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">

            {/* ── PROGRESS TAB ─────────────────────────────────────────── */}
            {sidebarTab === "progress" && (
              <div className="space-y-4">
                {/* Progress ring */}
                <div className="flex flex-col items-center py-4">
                  <div className="relative h-28 w-28">
                    <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                      <circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke="currentColor" strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                        className="text-primary transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-bold">{progress}%</span>
                      <span className="text-[10px] text-muted-foreground">completo</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium">{progress < 20 ? "Início" : progress < 50 ? "Em desenvolvimento" : progress < 80 ? "A progredir bem" : "Quase pronto!"}</p>
                </div>

                {/* Phase indicator */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fase atual</p>
                  <div className="rounded-xl border bg-primary/5 p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                        {currentPhase + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{TIMELINE_PHASES[currentPhase]?.label}</p>
                        <p className="text-[11px] text-muted-foreground">{TIMELINE_PHASES[currentPhase]?.desc}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumo</p>
                  <div className="space-y-2">
                    {CHECKLIST_SECTIONS.map((sec) => {
                      const done = sec.items.filter((i) => checked.has(i.id)).length;
                      const pct = Math.round((done / sec.items.length) * 100);
                      return (
                        <div key={sec.id}>
                          <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">{sec.label}</span>
                            <span className="font-medium">{done}/{sec.items.length}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Next steps suggestions */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Próximos passos
                  </p>
                  <div className="space-y-1.5">
                    {CHECKLIST_SECTIONS.flatMap((sec) => sec.items.filter((i) => !checked.has(i.id)))
                      .slice(0, 3)
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => send(`Ajuda-me com: ${item.label}`)}
                          className="group w-full flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-xs transition-all hover:border-primary/40 hover:bg-primary/5"
                        >
                          <ChevronRight className="h-3 w-3 text-primary shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Memory snippets */}
                {memory.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Brain className="h-3 w-3" /> Memória recente
                    </p>
                    <div className="space-y-1.5">
                      {memory.slice(0, 3).map((m) => (
                        <div key={m.id} className="rounded-lg border bg-background px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                          {m.content.length > 80 ? m.content.slice(0, 80) + "…" : m.content}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CHECKLIST TAB ─────────────────────────────────────────── */}
            {sidebarTab === "checklist" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{checked.size} de {CHECKLIST_SECTIONS.reduce((a, s) => a + s.items.length, 0)} itens concluídos</p>
                  <span className="text-xs font-bold text-primary">{progress}%</span>
                </div>

                {CHECKLIST_SECTIONS.map((sec) => {
                  const Icon = sec.icon;
                  const expanded = expandedSections.has(sec.id);
                  const done = sec.items.filter((i) => checked.has(i.id)).length;
                  return (
                    <div key={sec.id} className="rounded-xl border overflow-hidden">
                      <button
                        onClick={() => toggleSection(sec.id)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium">{sec.label}</span>
                          <span className="text-[10px] text-muted-foreground">{done}/{sec.items.length}</span>
                        </div>
                        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      {expanded && (
                        <div className="divide-y">
                          {sec.items.map((item) => {
                            const isChecked = checked.has(item.id);
                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-2.5 px-3 py-2 bg-background"
                              >
                                <button onClick={() => toggleCheck(item.id)} className="shrink-0">
                                  {isChecked
                                    ? <CheckCircle2 className="h-4 w-4 text-primary" />
                                    : <Circle className="h-4 w-4 text-muted-foreground/40" />}
                                </button>
                                <span className={`text-xs flex-1 ${isChecked ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
                                {!isChecked && (
                                  <button
                                    onClick={() => send(`Ajuda-me com: ${item.label}`)}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 text-primary"
                                    title="Pedir ajuda"
                                  >
                                    <Zap className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TIMELINE TAB ─────────────────────────────────────────── */}
            {sidebarTab === "timeline" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-4">Fases do desenvolvimento do PFC. Clique numa fase para pedir orientação específica.</p>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[18px] top-4 bottom-4 w-px bg-border" />
                  <div className="space-y-1">
                    {TIMELINE_PHASES.map((phase, idx) => {
                      const isPast = idx < currentPhase;
                      const isCurrent = idx === currentPhase;
                      const isFuture = idx > currentPhase;
                      return (
                        <button
                          key={phase.id}
                          onClick={() => send(`Estamos na fase de ${phase.label}. Que orientação podes dar-me para esta fase?`)}
                          className={`relative w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all ${isCurrent ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"}`}
                        >
                          <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                            isPast ? "bg-primary border-primary text-primary-foreground" :
                            isCurrent ? "bg-primary/10 border-primary text-primary" :
                            "bg-background border-muted-foreground/30 text-muted-foreground"
                          }`}>
                            {isPast ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${isFuture ? "text-muted-foreground" : ""}`}>{phase.label}</p>
                            <p className="text-[11px] text-muted-foreground">{phase.desc}</p>
                            {isCurrent && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                <Clock className="h-2.5 w-2.5" /> Fase atual
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Documents context */}
                {documents.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Documentos de referência
                    </p>
                    <div className="space-y-1.5">
                      {documents.filter(d => d.include_in_context).map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                          <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-[11px] truncate">{doc.filename}</span>
                        </div>
                      ))}
                      {documents.filter(d => d.include_in_context).length === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Nenhum documento ativo. <Link to="/documents" className="text-primary underline">Gerir documentos</Link>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}

// ─── Message bubble with markdown rendering ───────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  // Simple markdown renderer
  const renderContent = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("## ")) {
        elements.push(<h2 key={i} className="text-base font-semibold mt-3 mb-1 first:mt-0">{line.slice(3)}</h2>);
      } else if (line.startsWith("### ")) {
        elements.push(<h3 key={i} className="text-sm font-semibold mt-2 mb-1">{line.slice(4)}</h3>);
      } else if (line.startsWith("**📍")) {
        elements.push(
          <div key={i} className="mt-3 flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary font-medium">
            <span>{line.replace(/\*\*/g, "")}</span>
          </div>
        );
      } else if (line.match(/^[-*] /)) {
        const items: string[] = [];
        while (i < lines.length && lines[i].match(/^[-*] /)) {
          items.push(lines[i].slice(2));
          i++;
        }
        elements.push(
          <ul key={`ul-${i}`} className="my-1.5 space-y-1 pl-4">
            {items.map((item, j) => (
              <li key={j} className="relative text-sm before:absolute before:-left-3 before:content-['·'] before:text-primary">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      } else if (line.match(/^\d+\. /)) {
        const items: string[] = [];
        while (i < lines.length && lines[i].match(/^\d+\. /)) {
          items.push(lines[i].replace(/^\d+\. /, ""));
          i++;
        }
        elements.push(
          <ol key={`ol-${i}`} className="my-1.5 space-y-1 pl-5 list-decimal">
            {items.map((item, j) => <li key={j} className="text-sm">{renderInline(item)}</li>)}
          </ol>
        );
        continue;
      } else if (line === "") {
        if (i > 0 && elements.length > 0) elements.push(<div key={`sp-${i}`} className="h-1" />);
      } else {
        elements.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>);
      }
      i++;
    }
    return elements;
  };

  const renderInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>;
      return part;
    });
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isUser ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"}`}>
        {isUser ? <User className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
      </div>
      <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${isUser ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
        {isUser
          ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          : <div className="space-y-0.5">{renderContent(message.content)}</div>
        }
      </div>
    </div>
  );
}
