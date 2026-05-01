import { useEffect, useRef, useState, useCallback, type DragEvent } from "react";
import {
  FileUp, Loader2, Trash2, FileText, Eye, EyeOff, Sparkles,
  Brain, MessageSquare, X, ArrowRight, CheckCircle2, ChevronRight,
  GraduationCap, FlaskConical, BarChart3, Users, BookOpen, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { type Agent } from "@/lib/agents";
import { getOrCreateActiveProject, addMemory, updateProject, type Project } from "@/lib/project";
import {
  listDocuments, insertDocument, deleteDocument, toggleDocumentContext,
  extractPdfText, analyzeDocumentRemote, saveAnalysis, parseAnalysis,
  type ProjectDocument, type DocumentAnalysis,
} from "@/lib/documents";
import { ChatInterface } from "./ChatInterface";

type ProcessingState =
  | { phase: "extracting"; filename: string }
  | { phase: "analyzing"; filename: string }
  | null;

// Journey steps after upload
const JOURNEY_STEPS = [
  { id: "orientador", label: "Orientador IA", desc: "Define tema, objetivos e estrutura do PFC", icon: GraduationCap, color: "text-violet-600 bg-violet-50 border-violet-200" },
  { id: "revisor", label: "Revisor Académico", desc: "Revisa gramática, clareza e escrita científica", icon: BookOpen, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { id: "metodologia", label: "Especialista em Metodologia", desc: "Constrói e valida a metodologia de investigação", icon: FlaskConical, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { id: "analise-dados", label: "Analista de Dados", desc: "Analisa datasets e gera gráficos e estatísticas", icon: BarChart3, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { id: "simulador-juri", label: "Simulador de Júri", desc: "Treina a defesa com perguntas críticas da banca", icon: Users, color: "text-red-600 bg-red-50 border-red-200" },
];

export function LeitorPfcWorkspace({ agent }: { agent: Agent }) {
  const [project, setProject] = useState<Project | null>(null);
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<ProcessingState>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<ProjectDocument | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showJourney, setShowJourney] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await getOrCreateActiveProject();
        setProject(p);
        const list = await listDocuments(p.id);
        setDocs(list);
        if (list.length > 0) { setSelected(list[0]); setShowJourney(true); }
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar documentos");
      } finally { setLoading(false); }
    })();
  }, []);

  const reanalyze = useCallback(async (d: ProjectDocument) => {
    if (!project) return;
    setProcessing({ phase: "analyzing", filename: d.filename });
    try {
      const analysis = await analyzeDocumentRemote(d.extracted_text, d.filename);
      await saveAnalysis(d.id, analysis);
      const updated = { ...d, summary: JSON.stringify(analysis) };
      setDocs((prev) => prev.map((x) => (x.id === d.id ? updated : x)));
      if (selected?.id === d.id) setSelected(updated);
      await addMemory(project.id, agent.id, `Doc "${d.filename}" — Tema: ${analysis.theme || "n/d"}. Metodologia: ${analysis.methodology || "n/d"}.`, "document");
      toast.success(`Análise concluída: ${d.filename}`);
    } catch (e) { console.error(e); toast.error("Falha na análise"); }
    finally { setProcessing(null); }
  }, [project, agent.id, selected]);

  const handleFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files || !project) return;
    const arr = Array.from(files);
    for (const file of arr) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`${file.name}: apenas PDFs.`); continue;
      }
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name}: máx. 20 MB.`); continue; }
      try {
        setProcessing({ phase: "extracting", filename: file.name });
        const { text, pages } = await extractPdfText(file);
        if (!text) { toast.error(`${file.name}: sem texto extraível.`); continue; }

        const created = await insertDocument({
          project_id: project.id, filename: file.name,
          mime_type: file.type || "application/pdf", page_count: pages,
          char_count: text.length, extracted_text: text, include_in_context: true,
        });
        setDocs((prev) => [created, ...prev]);
        setSelected(created);

        setProcessing({ phase: "analyzing", filename: file.name });
        const analysis = await analyzeDocumentRemote(text, file.name);
        await saveAnalysis(created.id, analysis);
        const updated = { ...created, summary: JSON.stringify(analysis) };
        setDocs((prev) => prev.map((x) => (x.id === created.id ? updated : x)));
        setSelected(updated);

        // Auto-fill project fields from analysis
        const patch: Partial<Project> = {};
        if (analysis.theme && !project.theme) patch.theme = analysis.theme;
        if (analysis.objectives && !project.objectives) patch.objectives = analysis.objectives;
        if (analysis.methodology && !project.methodology) patch.methodology = analysis.methodology;
        if (Object.keys(patch).length > 0) {
          try { await updateProject(project.id, patch); } catch (_) {}
        }

        await addMemory(project.id, agent.id,
          `Pré-projeto "${file.name}" carregado. Tema: ${analysis.theme || "n/d"}. Objetivos: ${analysis.objectives?.slice(0, 100) || "n/d"}. Metodologia: ${analysis.methodology || "n/d"}.`,
          "document");
        toast.success(`${file.name} analisado com sucesso!`);
        setShowJourney(true);
      } catch (e) { console.error(e); toast.error(`Erro ao processar ${file.name}`); }
      finally { setProcessing(null); }
    }
    if (inputRef.current) inputRef.current.value = "";
  }, [project, agent.id]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); };
  const onDelete = async (d: ProjectDocument) => {
    if (!confirm(`Remover "${d.filename}"?`)) return;
    await deleteDocument(d.id);
    setDocs((prev) => prev.filter((x) => x.id !== d.id));
    if (selected?.id === d.id) { setSelected(null); setShowJourney(false); }
  };
  const onToggle = async (d: ProjectDocument) => {
    const next = !d.include_in_context;
    await toggleDocumentContext(d.id, next);
    const upd = { ...d, include_in_context: next };
    setDocs((prev) => prev.map((x) => (x.id === d.id ? upd : x)));
    if (selected?.id === d.id) setSelected(upd);
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const Icon = agent.icon;
  const analysis = selected ? parseAnalysis(selected.summary) : null;
  const activeCount = docs.filter(d => d.include_in_context).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card/50 px-6 py-4 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight">Leitor de PFCs</h1>
            <p className="text-xs text-muted-foreground">
              {docs.length === 0
                ? "Começa aqui — faz upload do teu pré-projeto"
                : `${docs.length} ficheiro(s) · ${activeCount} no contexto partilhado`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {docs.length > 0 && (
            <Button size="sm" variant={showChat ? "default" : "outline"} onClick={() => setShowChat(v => !v)}>
              <MessageSquare className="mr-2 h-4 w-4" /> {showChat ? "Fechar chat" : "Conversar"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside className="flex w-72 shrink-0 flex-col border-r bg-card/30">
          {/* Upload zone */}
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} className="m-3">
            <label htmlFor="leitor-pdf-input" className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-xs transition ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-card"}`}>
              {processing ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="font-semibold text-primary">
                    {processing.phase === "extracting" ? "A extrair texto…" : "A analisar com IA…"}
                  </span>
                  <span className="truncate text-muted-foreground max-w-full">{processing.filename}</span>
                </>
              ) : (
                <>
                  <FileUp className="h-6 w-6 text-primary" />
                  <span className="font-semibold">Upload do pré-projeto</span>
                  <span className="text-muted-foreground">Arraste PDFs ou clique aqui</span>
                  <span className="text-[10px] text-muted-foreground/60">Máx. 20 MB · PDF</span>
                </>
              )}
              <input id="leitor-pdf-input" ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} disabled={!!processing} />
            </label>
          </div>

          {/* Docs list */}
          <ScrollArea className="flex-1 px-3 pb-3">
            {docs.length === 0 ? (
              <div className="py-6 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Nenhum documento ainda.</p>
                <p className="mt-1 text-[11px] text-muted-foreground/60">Faz upload do teu pré-projeto para começar a jornada.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {docs.map((d) => {
                  const isSel = selected?.id === d.id;
                  const a = parseAnalysis(d.summary);
                  return (
                    <li key={d.id}>
                      <button onClick={() => setSelected(d)} className={`group flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${isSel ? "border-primary bg-primary/5" : "border-transparent hover:bg-card"} ${!d.include_in_context && "opacity-60"}`}>
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{d.filename}</div>
                          <div className="text-[10px] text-muted-foreground">{d.page_count ?? "?"} págs · {a ? "✓ analisado" : "aguardando"}</div>
                        </div>
                        {a && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {!selected ? (
            <EmptyState onUpload={() => inputRef.current?.click()} />
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
              {/* Doc header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-2xl font-semibold">{analysis?.title || selected.filename}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.filename} · {selected.page_count ?? "?"} págs · {selected.char_count.toLocaleString()} chars</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggle(selected)} title={selected.include_in_context ? "Remover do contexto" : "Adicionar ao contexto"}>
                    {selected.include_in_context ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reanalyze(selected)} disabled={!!processing} title="Re-analisar">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(selected)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selected.include_in_context && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  <Brain className="h-3 w-3" /> Disponível para todos os agentes
                </div>
              )}

              {/* Analysis sections */}
              {!analysis ? (
                <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Análise em curso…
                </div>
              ) : (
                <div className="space-y-3">
                  <Section title="Resumo académico" content={analysis.summary} highlight />
                  <Section title="Tema" content={analysis.theme} />
                  <Section title="Objetivos" content={analysis.objectives} />
                  <Section title="Metodologia" content={analysis.methodology} />
                  <Section title="Conclusões" content={analysis.conclusions} />
                  <Section title="Contribuições" content={analysis.contributions} />
                  <Section title="Lacunas / Limitações" content={analysis.gaps} />
                </div>
              )}

              {/* Journey guide */}
              {showJourney && analysis && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-base font-semibold">Continua a tua jornada</h3>
                    <span className="ml-auto text-[11px] text-muted-foreground">Passo 1 de 6 completo ✓</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">O teu pré-projeto foi analisado e os dados estão disponíveis para todos os agentes. Segue estes passos para construir o teu PFC completo:</p>
                  <div className="space-y-2">
                    {JOURNEY_STEPS.map((step, idx) => {
                      const StepIcon = step.icon;
                      return (
                        <Link key={step.id} to="/agent/$agentId" params={{ agentId: step.id }}
                          className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:shadow-sm ${step.color}`}>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80">
                            <StepIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold opacity-60">PASSO {idx + 2}</span>
                            </div>
                            <p className="text-sm font-semibold leading-tight">{step.label}</p>
                            <p className="text-[11px] opacity-70">{step.desc}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Side chat */}
        {showChat && (
          <aside className="flex w-[440px] shrink-0 flex-col border-l bg-background">
            <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
              <span className="text-xs font-medium text-muted-foreground">Chat com Leitor de PFCs</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowChat(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 min-h-0"><ChatInterface agent={agent} /></div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Section({ title, content, highlight }: { title: string; content?: string; highlight?: boolean }) {
  if (!content) return null;
  return (
    <div className={`rounded-xl border p-5 ${highlight ? "bg-primary/5 border-primary/20" : "bg-card"}`}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">{content}</div>
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <FileUp className="h-10 w-10" />
      </div>
      <h2 className="font-display text-3xl font-semibold">Começa aqui</h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        Faz upload do teu pré-projeto em PDF. A IA extrai automaticamente o tema, objetivos, metodologia e conclusões — e prepara todos os agentes para te ajudar a construir o PFC completo.
      </p>
      <Button onClick={onUpload} className="mt-6 gap-2 px-6" size="lg">
        <FileUp className="h-5 w-5" /> Fazer upload do pré-projeto
      </Button>
      <div className="mt-8 grid grid-cols-3 gap-3 max-w-sm w-full">
        {[
          { icon: CheckCircle2, text: "Extração automática de dados" },
          { icon: Brain, text: "Memória partilhada entre agentes" },
          { icon: ArrowRight, text: "Guia passo a passo" },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-center">
            <item.icon className="h-5 w-5 text-primary" />
            <span className="text-[11px] text-muted-foreground">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
