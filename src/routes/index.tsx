import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, MessageSquare, Sparkles, Brain, FolderKanban } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getOrCreateActiveProject, listMemory, type Project } from "@/lib/project";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Acadia" },
      { name: "description", content: "Selecione um agente acadêmico de IA para começar." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [project, setProject] = useState<Project | null>(null);
  const [memCount, setMemCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const p = await getOrCreateActiveProject();
        setProject(p);
        const [mem, msgs] = await Promise.all([
          listMemory(p.id),
          supabase.from("chat_messages").select("agent_id").eq("project_id", p.id),
        ]);
        setMemCount(mem.length);
        const c: Record<string, number> = {};
        (msgs.data || []).forEach((m: { agent_id: string }) => { c[m.agent_id] = (c[m.agent_id] || 0) + 1; });
        setCounts(c);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const configured = !!(project?.theme || project?.objectives);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
               Plataforma acadêmica created by Leonel Henriques
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Bem-vindo ao <span className="text-primary">Acadia</span>
            </h1>
            <p className="mt-3 max-w-xl text-base text-muted-foreground">
              Seis agentes especializados que partilham o <strong>mesmo cérebro</strong>: tema, objetivos, metodologia e memória do seu PFC.
            </p>
          </div>
          <div className="hidden md:block"><SidebarTrigger /></div>
        </div>

        {/* Project banner */}
        <Link to="/project" className="mb-8 flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold">{project?.title || "Meu PFC"}</div>
              <div className="text-xs text-muted-foreground">
                {configured ? (project?.theme || "Tema definido") : "⚠ Configure tema, objetivos e metodologia para ativar o cérebro central"}
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        {/* Stats */}
        <div className="mb-10 grid gap-3 sm:grid-cols-3">
          <StatCard label="Agentes disponíveis" value={AGENTS.length.toString()} />
          <StatCard label="Mensagens trocadas" value={total.toString()} />
          <StatCard label="Memória partilhada" value={memCount.toString()} icon={<Brain className="h-4 w-4 text-primary" />} />
        </div>

        {/* Agent grid */}
        <h2 className="mb-4 font-display text-xl font-semibold">Agentes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a) => {
            const Icon = a.icon;
            const c = counts[a.id] || 0;
            return (
              <Link
                key={a.id}
                to="/agent/$agentId"
                params={{ agentId: a.id }}
                className="group relative flex flex-col rounded-2xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  {c > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      <MessageSquare className="h-3 w-3" />
                      {c}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-lg font-semibold">{a.name}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{a.description}</p>
                <div className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                  Abrir conversa
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold">{value}</div>
    </div>
  );
}
