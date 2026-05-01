import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderKanban, Save, Loader2, Brain, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getOrCreateActiveProject, updateProject, listMemory, type Project, type MemoryItem } from "@/lib/project";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/project")({
  head: () => ({
    meta: [
      { title: "Projeto PFC — Acadia" },
      { name: "description", content: "Configure o tema, objetivos e metodologia do seu PFC. Todos os agentes usam este contexto." },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await getOrCreateActiveProject();
        setProject(p);
        setMemory(await listMemory(p.id));
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar projeto");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onChange = (k: keyof Project, v: string) => {
    setProject((p) => (p ? { ...p, [k]: v } : p));
  };

  const save = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await updateProject(project.id, {
        title: project.title,
        theme: project.theme,
        research_question: project.research_question,
        objectives: project.objectives,
        methodology: project.methodology,
        structure: project.structure,
        current_status: project.current_status,
      });
      setProject(updated);
      toast.success("Projeto salvo");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const clearMemory = async () => {
    if (!project) return;
    if (!confirm("Apagar toda a memória partilhada do projeto?")) return;
    await supabase.from("project_memory").delete().eq("project_id", project.id);
    setMemory([]);
    toast.success("Memória limpa");
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!project) return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <div className="mb-8 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">Projeto PFC</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Este é o cérebro do ACADIA. Tudo o que escrever aqui é partilhado com todos os agentes.
            </p>
          </div>
        </div>

        <div className="space-y-5 rounded-2xl border bg-card p-6">
          <Field label="Título do PFC">
            <Input value={project.title} onChange={(e) => onChange("title", e.target.value)} />
          </Field>
          <Field label="Tema" hint="Área e foco do trabalho.">
            <Textarea rows={2} value={project.theme || ""} onChange={(e) => onChange("theme", e.target.value)} />
          </Field>
          <Field label="Pergunta de pesquisa" hint="O que pretende responder?">
            <Textarea rows={2} value={project.research_question || ""} onChange={(e) => onChange("research_question", e.target.value)} />
          </Field>
          <Field label="Objetivos" hint="Geral e específicos.">
            <Textarea rows={3} value={project.objectives || ""} onChange={(e) => onChange("objectives", e.target.value)} />
          </Field>
          <Field label="Metodologia" hint="Tipo de estudo, abordagem, técnicas.">
            <Textarea rows={3} value={project.methodology || ""} onChange={(e) => onChange("methodology", e.target.value)} />
          </Field>
          <Field label="Estrutura" hint="Capítulos planeados.">
            <Textarea rows={3} value={project.structure || ""} onChange={(e) => onChange("structure", e.target.value)} />
          </Field>
          <Field label="Estado atual" hint="Em que fase está o trabalho?">
            <Textarea rows={2} value={project.current_status || ""} onChange={(e) => onChange("current_status", e.target.value)} />
          </Field>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar projeto
            </Button>
          </div>
        </div>

        {/* Memory */}
        <div className="mt-8 rounded-2xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Memória partilhada</h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{memory.length}</span>
            </div>
            {memory.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearMemory}>
                <Trash2 className="mr-2 h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
          {memory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Quando os agentes tomarem decisões importantes, irão registá-las aqui automaticamente.
            </p>
          ) : (
            <ul className="space-y-2">
              {memory.map((m) => (
                <li key={m.id} className="rounded-lg border bg-background p-3 text-sm">
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {m.agent_id} · {m.kind} · {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}