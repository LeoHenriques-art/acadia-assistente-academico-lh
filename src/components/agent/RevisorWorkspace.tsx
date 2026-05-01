import { useEffect, useRef, useState, useCallback, type DragEvent } from "react";
import {
  FileSearch, Sparkles, Brain, AlertTriangle, CheckCircle2,
  ArrowLeftRight, BarChart2, Lightbulb, Loader2,
  ChevronDown, ChevronUp, Copy, RefreshCw, BookOpen, Zap,
  AlertCircle, Info, X, FileText, FileUp, Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { type Agent } from "@/lib/agents";
import {
  getOrCreateActiveProject, listMemory, addMemory,
  buildProjectContext, type Project, type MemoryItem
} from "@/lib/project";
import { listDocuments, buildDocumentsContext, extractPdfText, type ProjectDocument } from "@/lib/documents";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-agent`;

type RevisionIssue = {
  type: "erro" | "aviso" | "sugestao" | "positivo";
  category: string;
  original: string;
  suggestion: string;
  explanation: string;
};
type RevisionResult = {
  score: number;
  scoreLabel: string;
  summary: string;
  revisedText: string;
  issues: RevisionIssue[];
  metrics: { grammar: number; clarity: number; formality: number; coherence: number; structure: number; };
  nextSteps: string[];
};
type Tab = "editor" | "comparar" | "analise";
type Section = "introducao" | "metodologia" | "resultados" | "conclusao" | "outro";
type InputMode = "texto" | "pdf";

const SECTION_LABELS: Record<Section, string> = {
  introducao: "Introdução", metodologia: "Metodologia",
  resultados: "Resultados", conclusao: "Conclusão", outro: "Outro",
};

function buildSystemPrompt(project: Project | null, memory: MemoryItem[], docs: ProjectDocument[], section: Section) {
  return `Você é o Revisor Científico Profissional da plataforma ACADIA — revisor académico especializado em PFCs/TCCs.
Você NÃO é um chatbot. Analisa textos académicos com rigor e devolve APENAS JSON estruturado, sem markdown.

SECÇÃO: ${SECTION_LABELS[section]}

CONTEXTO DO PROJETO:
${buildProjectContext(project, memory)}

${docs.filter(d => d.include_in_context).length > 0 ? `DOCUMENTOS DE REFERÊNCIA:\n${buildDocumentsContext(docs, 15000)}` : ""}

Responda APENAS com JSON válido, sem texto extra, sem \`\`\`json:
{
  "score": <0-100>,
  "scoreLabel": <"Fraco"|"Razoável"|"Bom"|"Muito Bom"|"Excelente">,
  "summary": <resumo geral em 2-3 frases>,
  "revisedText": <texto completamente revisto e melhorado>,
  "issues": [{"type":"erro"|"aviso"|"sugestao"|"positivo","category":"Gramática"|"Clareza"|"Coerência"|"Formalidade"|"Estrutura"|"Repetição"|"Argumentação"|"Pontos fortes","original":"<80 chars","suggestion":"<melhoria>","explanation":"<explicação académica>"}],
  "metrics": {"grammar":<0-100>,"clarity":<0-100>,"formality":<0-100>,"coherence":<0-100>,"structure":<0-100>},
  "nextSteps": [<3 próximos passos concretos>]
}
Mínimo 4 issues, máximo 12. Sempre inclua pelo menos 1 "positivo" se o texto tiver qualidade.`;
}

const scoreToColor = (s: number) => s >= 80 ? "text-emerald-600" : s >= 60 ? "text-blue-600" : s >= 40 ? "text-amber-600" : "text-red-600";
const scoreToBg = (s: number) => s >= 80 ? "bg-emerald-50 border-emerald-200" : s >= 60 ? "bg-blue-50 border-blue-200" : s >= 40 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
const scoreToBar = (s: number) => s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-blue-500" : s >= 40 ? "bg-amber-500" : "bg-red-500";

function issueIcon(t: RevisionIssue["type"]) {
  if (t === "erro") return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  if (t === "aviso") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  if (t === "sugestao") return <Lightbulb className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
}
function issueBg(t: RevisionIssue["type"]) {
  if (t === "erro") return "border-red-100 bg-red-50/50";
  if (t === "aviso") return "border-amber-100 bg-amber-50/50";
  if (t === "sugestao") return "border-blue-100 bg-blue-50/50";
  return "border-emerald-100 bg-emerald-50/50";
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${scoreToColor(value)}`}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${scoreToBar(value)}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function RevisorWorkspace({ agent }: { agent: Agent }) {
  const [project, setProject] = useState<Project | null>(null);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);

  const [inputMode, setInputMode] = useState<InputMode>("texto");
  const [inputText, setInputText] = useState("");
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [section, setSection] = useState<Section>("outro");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RevisionResult | null>(null);
  const [tab, setTab] = useState<Tab>("editor");
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set([0]));
  const [filterType, setFilterType] = useState<RevisionIssue["type"] | "todos">("todos");
  const [history, setHistory] = useState<{ filename?: string; section: Section; result: RevisionResult }[]>([]);
  const [copied, setCopied] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await getOrCreateActiveProject();
        setProject(p);
        const [mem, docs] = await Promise.all([listMemory(p.id), listDocuments(p.id)]);
        setMemory(mem);
        setDocuments(docs);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const handlePdf = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Apenas ficheiros PDF"); return;
    }
    if (file.size > 20 * 1024 * 1024) { toast.error("Máx. 20 MB"); return; }
    setPdfLoading(true); setPdfFilename(file.name); setInputText("");
    try {
      const { text } = await extractPdfText(file);
      if (!text) { toast.error("Sem texto extraível no PDF"); return; }
      setInputText(text);
      toast.success(`PDF carregado: ${file.name}`);
    } catch (e) { console.error(e); toast.error("Erro ao ler o PDF"); }
    finally { setPdfLoading(false); }
  }, []);

  const onPdfDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePdf(file);
  };

  const toggleIssue = (i: number) => {
    setExpandedIssues(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const revise = useCallback(async () => {
    const text = inputText.trim();
    if (!text) { toast.error("Cole um texto ou carregue um PDF"); return; }
    if (text.length < 50) { toast.error("Texto muito curto — mínimo 50 caracteres"); return; }
    if (!project) { toast.error("Projeto não carregado"); return; }
    setLoading(true); setResult(null);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          agent: agent.id,
          systemPrompt: buildSystemPrompt(project, memory, documents, section),
          projectContext: buildProjectContext(project, memory),
          documentsContext: buildDocumentsContext(documents, 15000),
          messages: [{ role: "user", content: `Revisa este trecho de ${SECTION_LABELS[section]}${pdfFilename ? ` (do ficheiro "${pdfFilename}")` : ""}:\n\n${text.slice(0, 12000)}` }],
        }),
      });
      if (!resp.ok || !resp.body) { toast.error("Erro na revisão"); return; }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", acc = "", done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) acc += c; } catch {}
        }
      }
      const clean = acc.replace(/```json|```/g, "").trim();
      let parsed: RevisionResult;
      try { parsed = JSON.parse(clean); } catch { toast.error("Erro ao interpretar resposta"); return; }
      setResult(parsed); setExpandedIssues(new Set([0])); setTab("editor"); setFilterType("todos");
      setHistory(prev => [{ filename: pdfFilename ?? undefined, section, result: parsed }, ...prev.slice(0, 4)]);
      await addMemory(project.id, agent.id,
        `Revisão de ${SECTION_LABELS[section]}${pdfFilename ? ` ("${pdfFilename}")` : ""}: score ${parsed.score}/100 (${parsed.scoreLabel}). ${parsed.issues.filter(i => i.type === "erro").length} erros críticos.`,
        "revision");
      const fresh = await listMemory(project.id); setMemory(fresh);
      toast.success(`Revisão concluída — Score: ${parsed.score}/100`);
    } catch (e) { console.error(e); toast.error("Erro de conexão"); }
    finally { setLoading(false); }
  }, [inputText, section, project, memory, documents, agent.id, pdfFilename]);

  const applyAllSuggestions = () => {
    if (!result) return;
    setInputText(result.revisedText);
    setPdfFilename(null);
    toast.success("Texto revisto aplicado! Podes rever novamente.");
  };

  const copyRevised = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.revisedText);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("Texto revisto copiado!");
  };

  const filteredIssues = result?.issues.filter(i => filterType === "todos" || i.type === filterType) ?? [];
  const errCount = result?.issues.filter(i => i.type === "erro").length ?? 0;
  const warnCount = result?.issues.filter(i => i.type === "aviso").length ?? 0;
  const sugCount = result?.issues.filter(i => i.type === "sugestao").length ?? 0;
  const posCount = result?.issues.filter(i => i.type === "positivo").length ?? 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card/60 px-5 py-3.5 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold leading-tight">Revisor Académico</h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-2">
              Revisão científica profissional
              {memory.length > 0 && <span className="inline-flex items-center gap-1"><Brain className="h-3 w-3 text-primary" />{memory.length} memórias</span>}
              {result && <span className={`font-semibold ${scoreToColor(result.score)}`}>· Score: {result.score}/100</span>}
            </p>
          </div>
        </div>
        {history.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground mr-1">Histórico:</span>
            {history.slice(0, 3).map((h, i) => (
              <button key={i} onClick={() => setResult(h.result)}
                className={`rounded-lg border px-2 py-1 text-[10px] font-medium hover:border-primary/40 ${scoreToColor(h.result.score)}`}>
                {h.filename ? h.filename.slice(0, 10) + "…" : SECTION_LABELS[h.section]} {h.result.score}%
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT: Input panel */}
        <div className="flex w-[420px] shrink-0 flex-col border-r bg-card/20 overflow-hidden">
          {/* Input mode toggle */}
          <div className="border-b px-4 py-3 shrink-0">
            <div className="flex rounded-xl border bg-muted/40 p-1 gap-1">
              <button onClick={() => { setInputMode("texto"); setPdfFilename(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${inputMode === "texto" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <FileText className="h-3.5 w-3.5" /> Colar texto
              </button>
              <button onClick={() => setInputMode("pdf")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${inputMode === "pdf" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <FileUp className="h-3.5 w-3.5" /> Upload PDF
              </button>
            </div>
          </div>

          {/* Section selector */}
          <div className="border-b px-4 py-3 shrink-0">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Secção do texto</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SECTION_LABELS) as Section[]).map(s => (
                <button key={s} onClick={() => setSection(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${section === s ? "bg-primary text-primary-foreground" : "border bg-background hover:border-primary/40"}`}>
                  {SECTION_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Input area */}
          <div className="flex flex-col flex-1 min-h-0 px-4 py-3 gap-3 overflow-hidden">
            {inputMode === "pdf" ? (
              /* PDF upload zone */
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onPdfDrop}
                className="flex-1 flex flex-col"
              >
                <label htmlFor="revisor-pdf-input"
                  className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 text-center transition-all ${dragOver ? "border-primary bg-primary/5" : pdfFilename ? "border-emerald-400 bg-emerald-50/30" : "border-border hover:border-primary/40 hover:bg-card"}`}>
                  {pdfLoading ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-sm font-medium text-primary">A extrair texto do PDF…</span>
                    </>
                  ) : pdfFilename ? (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                        <FileText className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">{pdfFilename}</p>
                        <p className="text-[11px] text-emerald-600">{inputText.length.toLocaleString()} caracteres extraídos</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.preventDefault(); setPdfFilename(null); setInputText(""); }}
                          className="text-[11px] text-muted-foreground hover:text-foreground underline">
                          Remover
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button onClick={(e) => { e.preventDefault(); pdfInputRef.current?.click(); }}
                          className="text-[11px] text-primary hover:underline">
                          Trocar PDF
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <FileUp className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Arrasta o PDF ou clica aqui</p>
                        <p className="text-xs text-muted-foreground">Capítulos, secções ou o documento completo</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1">Máx. 20 MB · PDF</p>
                      </div>
                    </>
                  )}
                  <input id="revisor-pdf-input" ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdf(f); }} />
                </label>
              </div>
            ) : (
              /* Text input */
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Cole o texto</p>
                  {inputText && (
                    <button onClick={() => { setInputText(""); setPdfFilename(null); }}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <X className="h-3 w-3" /> Limpar
                    </button>
                  )}
                </div>
                <Textarea value={inputText} onChange={e => setInputText(e.target.value)}
                  placeholder={`Cole aqui o texto da ${SECTION_LABELS[section]} para revisão científica...`}
                  className="flex-1 resize-none text-sm leading-relaxed font-mono border-muted/60 bg-background/60 min-h-0" />
              </>
            )}

            {/* Stats + button */}
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[11px] text-muted-foreground">
                {inputText.length > 0 ? `${inputText.length.toLocaleString()} chars · ${inputText.split(/\s+/).filter(Boolean).length.toLocaleString()} palavras` : ""}
              </span>
              <Button onClick={revise} disabled={loading || !inputText.trim()} className="gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />A rever…</> : <><Sparkles className="h-4 w-4" />Rever</>}
              </Button>
            </div>

            {/* Apply all button */}
            {result && (
              <Button onClick={applyAllSuggestions} variant="outline" size="sm" className="gap-2 w-full shrink-0">
                <Wand2 className="h-3.5 w-3.5" /> Aplicar texto revisto e rever novamente
              </Button>
            )}

            {/* Doc context indicator */}
            {documents.filter(d => d.include_in_context).length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border bg-primary/5 border-primary/20 px-3 py-2 shrink-0">
                <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[11px] text-primary">{documents.filter(d => d.include_in_context).length} documento(s) de referência ativos</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Results */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {!result && !loading ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileSearch className="h-8 w-8" />
              </div>
              <h2 className="font-display text-2xl font-semibold">Revisor Científico</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                Cole um texto ou faz upload de um PDF com o teu capítulo. O revisor analisa gramática, clareza, formalidade, coerência e estrutura com base no contexto do teu projeto.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-sm">
                {[
                  { icon: AlertCircle, label: "Erros críticos", color: "text-red-500" },
                  { icon: AlertTriangle, label: "Avisos", color: "text-amber-500" },
                  { icon: Lightbulb, label: "Sugestões", color: "text-blue-500" },
                  { icon: BarChart2, label: "Score académico", color: "text-primary" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 rounded-xl border bg-card p-3">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FileSearch className="h-8 w-8 text-primary" />
                </div>
                <div className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-primary animate-ping opacity-30" />
                <div className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">A analisar o texto…</p>
                <p className="text-sm text-muted-foreground">Gramática · Clareza · Coerência · Formalidade</p>
              </div>
            </div>
          ) : result ? (
            <div className="flex flex-col h-full">
              {/* Score bar + tabs */}
              <div className="border-b bg-card/40 px-5 py-3 shrink-0">
                <div className="flex items-center gap-4 mb-3 flex-wrap">
                  <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${scoreToBg(result.score)}`}>
                    <div className="text-center">
                      <div className={`font-display text-3xl font-bold leading-none ${scoreToColor(result.score)}`}>{result.score}</div>
                      <div className="text-[10px] text-muted-foreground">/ 100</div>
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${scoreToColor(result.score)}`}>{result.scoreLabel}</div>
                      <div className="text-[11px] text-muted-foreground">{SECTION_LABELS[section]}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { type: "erro" as const, count: errCount, icon: AlertCircle, cls: "text-red-500 bg-red-50 border-red-100", activeCls: "bg-red-100 border-red-300" },
                      { type: "aviso" as const, count: warnCount, icon: AlertTriangle, cls: "text-amber-500 bg-amber-50 border-amber-100", activeCls: "bg-amber-100 border-amber-300" },
                      { type: "sugestao" as const, count: sugCount, icon: Lightbulb, cls: "text-blue-500 bg-blue-50 border-blue-100", activeCls: "bg-blue-100 border-blue-300" },
                      { type: "positivo" as const, count: posCount, icon: CheckCircle2, cls: "text-emerald-500 bg-emerald-50 border-emerald-100", activeCls: "bg-emerald-100 border-emerald-300" },
                    ].filter(b => b.count > 0).map(b => (
                      <button key={b.type} onClick={() => setFilterType(filterType === b.type ? "todos" : b.type)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${filterType === b.type ? b.activeCls : b.cls}`}>
                        <b.icon className="h-3.5 w-3.5" />{b.count}
                      </button>
                    ))}
                    {filterType !== "todos" && (
                      <button onClick={() => setFilterType("todos")} className="text-[11px] text-muted-foreground hover:text-foreground underline">Ver todos</button>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {(["editor", "comparar", "analise"] as Tab[]).map(t => {
                    const cfg = { editor: { icon: FileText, label: "Revisões" }, comparar: { icon: ArrowLeftRight, label: "Comparar" }, analise: { icon: BarChart2, label: "Análise" } }[t];
                    return (
                      <button key={t} onClick={() => setTab(t)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60"}`}>
                        <cfg.icon className="h-3.5 w-3.5" />{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-5 space-y-4">
                  {tab === "editor" && (
                    <div className="space-y-4">
                      <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
                        </div>
                      </div>

                      {/* Revised text */}
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40">
                        <div className="flex items-center justify-between border-b border-emerald-200 px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-xs font-semibold text-emerald-700">Texto revisto</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={applyAllSuggestions} className="h-7 text-xs text-emerald-700 gap-1">
                              <Wand2 className="h-3 w-3" /> Aplicar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={copyRevised} className="h-7 text-xs text-emerald-700 gap-1">
                              {copied ? <><CheckCircle2 className="h-3 w-3" />Copiado!</> : <><Copy className="h-3 w-3" />Copiar</>}
                            </Button>
                          </div>
                        </div>
                        <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-mono max-h-64 overflow-y-auto">{result.revisedText}</div>
                      </div>

                      {/* Issues */}
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Anotações ({filteredIssues.length})</p>
                        <div className="space-y-2">
                          {filteredIssues.map((issue, i) => {
                            const expanded = expandedIssues.has(i);
                            return (
                              <div key={i} className={`rounded-xl border overflow-hidden ${issueBg(issue.type)}`}>
                                <button onClick={() => toggleIssue(i)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                                  {issueIcon(issue.type)}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold">{issue.category}</span>
                                      <span className="text-[10px] text-muted-foreground rounded-full border px-1.5 py-0.5 bg-background/60">
                                        {issue.type === "erro" ? "Erro" : issue.type === "aviso" ? "Aviso" : issue.type === "sugestao" ? "Sugestão" : "Ponto forte"}
                                      </span>
                                    </div>
                                    {!expanded && issue.original && <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono">"{issue.original}"</p>}
                                  </div>
                                  {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                </button>
                                {expanded && (
                                  <div className="border-t bg-background/40 px-4 py-3 space-y-2">
                                    {issue.original && <div><p className="text-[10px] font-medium text-muted-foreground mb-1">ORIGINAL</p><p className="text-xs font-mono bg-red-50 border border-red-100 rounded-lg px-3 py-2">"{issue.original}"</p></div>}
                                    {issue.suggestion && <div><p className="text-[10px] font-medium text-muted-foreground mb-1">SUGESTÃO</p><p className="text-xs font-mono bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">"{issue.suggestion}"</p></div>}
                                    <div><p className="text-[10px] font-medium text-muted-foreground mb-1">EXPLICAÇÃO</p><p className="text-xs leading-relaxed text-muted-foreground">{issue.explanation}</p></div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Next steps */}
                      {result.nextSteps.length > 0 && (
                        <div className="rounded-xl border bg-primary/5 border-primary/20 p-4">
                          <div className="flex items-center gap-2 mb-3"><Zap className="h-4 w-4 text-primary" /><span className="text-xs font-semibold text-primary uppercase tracking-wide">Próximos passos</span></div>
                          <ul className="space-y-2">
                            {result.nextSteps.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{i + 1}</span>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "comparar" && (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">Comparação lado a lado entre o texto original e o texto revisto.</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-red-600"><div className="h-2 w-2 rounded-full bg-red-400" />Original</div>
                          <div className="rounded-xl border border-red-100 bg-red-50/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap min-h-40 max-h-96 overflow-y-auto">{inputText}</div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-600"><div className="h-2 w-2 rounded-full bg-emerald-400" />Revisto</div>
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap min-h-40 max-h-96 overflow-y-auto">{result.revisedText}</div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button onClick={applyAllSuggestions} variant="outline" size="sm" className="gap-2"><Wand2 className="h-3.5 w-3.5" />Aplicar e rever novamente</Button>
                        <Button onClick={copyRevised} variant="outline" size="sm" className="gap-2">
                          {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copiado!" : "Copiar revisto"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {tab === "analise" && (
                    <div className="space-y-5">
                      <div className="rounded-xl border bg-card p-5">
                        <h3 className="mb-4 text-sm font-semibold">Métricas de qualidade</h3>
                        <div className="space-y-3">
                          <MetricBar label="Gramática e ortografia" value={result.metrics.grammar} />
                          <MetricBar label="Clareza científica" value={result.metrics.clarity} />
                          <MetricBar label="Formalidade académica" value={result.metrics.formality} />
                          <MetricBar label="Coerência textual" value={result.metrics.coherence} />
                          <MetricBar label="Estrutura" value={result.metrics.structure} />
                        </div>
                      </div>
                      <div className={`rounded-xl border p-5 ${scoreToBg(result.score)}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold">Score académico global</h3>
                          <span className={`font-display text-4xl font-bold ${scoreToColor(result.score)}`}>{result.score}</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${scoreToBar(result.score)}`} style={{ width: `${result.score}%` }} />
                        </div>
                        <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
                          <span>Fraco</span><span>Razoável</span><span>Bom</span><span>Muito Bom</span><span>Excelente</span>
                        </div>
                      </div>
                      <div className="rounded-xl border bg-card p-5">
                        <h3 className="mb-3 text-sm font-semibold">Distribuição de problemas</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Erros críticos", count: errCount, color: "text-red-600 bg-red-50 border-red-100" },
                            { label: "Avisos", count: warnCount, color: "text-amber-600 bg-amber-50 border-amber-100" },
                            { label: "Sugestões", count: sugCount, color: "text-blue-600 bg-blue-50 border-blue-100" },
                            { label: "Pontos fortes", count: posCount, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                          ].map(item => (
                            <div key={item.label} className={`flex flex-col items-center rounded-xl border p-4 ${item.color}`}>
                              <span className="font-display text-3xl font-bold">{item.count}</span>
                              <span className="text-xs font-medium mt-1">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button onClick={revise} disabled={loading} variant="outline" className="w-full gap-2">
                        <RefreshCw className="h-4 w-4" /> Rever novamente
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
