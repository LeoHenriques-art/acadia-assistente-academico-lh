import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Trash2, FileText, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getOrCreateActiveProject, type Project } from "@/lib/project";
import {
  listDocuments, insertDocument, deleteDocument, toggleDocumentContext,
  extractPdfText, type ProjectDocument,
} from "@/lib/documents";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documentos — Acadia" },
      { name: "description", content: "Carregue PDFs de referência. Todos os agentes do ACADIA usam este conteúdo." },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await getOrCreateActiveProject();
        setProject(p);
        setDocs(await listDocuments(p.id));
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar documentos");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files || !project) return;
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`${file.name}: apenas PDFs são suportados nesta fase.`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: máximo 20 MB.`);
        continue;
      }
      setUploading(file.name);
      try {
        const { text, pages } = await extractPdfText(file);
        if (!text) {
          toast.error(`${file.name}: não foi possível extrair texto (PDF digitalizado?).`);
          continue;
        }
        const created = await insertDocument({
          project_id: project.id,
          filename: file.name,
          mime_type: file.type || "application/pdf",
          page_count: pages,
          char_count: text.length,
          extracted_text: text,
          include_in_context: true,
        });
        setDocs((prev) => [created, ...prev]);
        toast.success(`${file.name} processado (${pages} págs)`);
      } catch (e) {
        console.error(e);
        toast.error(`Erro ao processar ${file.name}`);
      } finally {
        setUploading(null);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDelete = async (d: ProjectDocument) => {
    if (!confirm(`Remover "${d.filename}"?`)) return;
    await deleteDocument(d.id);
    setDocs((prev) => prev.filter((x) => x.id !== d.id));
  };

  const onToggle = async (d: ProjectDocument) => {
    const next = !d.include_in_context;
    await toggleDocumentContext(d.id, next);
    setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, include_in_context: next } : x)));
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const totalChars = docs.filter(d => d.include_in_context).reduce((s, d) => s + d.char_count, 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <div className="mb-8 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">Documentos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              PDFs carregados aqui ficam disponíveis para todos os agentes raciocinarem.
            </p>
          </div>
        </div>

        {/* Upload zone */}
        <label
          htmlFor="pdf-input"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-card/50 px-6 py-12 text-center transition hover:border-primary/40 hover:bg-card"
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">A processar <span className="font-medium">{uploading}</span>…</p>
            </>
          ) : (
            <>
              <FileUp className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Clique para carregar PDFs</p>
              <p className="text-xs text-muted-foreground">Máx. 20 MB por ficheiro · texto será extraído automaticamente</p>
            </>
          )}
          <input
            id="pdf-input"
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
            disabled={!!uploading}
          />
        </label>

        {/* Stats */}
        <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>{docs.length} documento(s) · {docs.filter(d => d.include_in_context).length} ativo(s)</span>
          <span>{totalChars.toLocaleString()} caracteres no contexto</span>
        </div>

        {/* Document list */}
        <div className="mt-4 space-y-2">
          {docs.length === 0 ? (
            <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Ainda não há documentos. Carregue um PDF para começar.
            </p>
          ) : (
            docs.map((d) => (
              <div key={d.id} className={`flex items-center gap-3 rounded-xl border bg-card p-4 ${!d.include_in_context && "opacity-60"}`}>
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.page_count ?? "?"} págs · {d.char_count.toLocaleString()} chars · {new Date(d.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onToggle(d)} title={d.include_in_context ? "Remover do contexto" : "Adicionar ao contexto"}>
                  {d.include_in_context ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(d)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}