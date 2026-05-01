import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ChatInterface } from "@/components/agent/ChatInterface";
import { LeitorPfcWorkspace } from "@/components/agent/LeitorPfcWorkspace";
import { OrientadorWorkspace } from "@/components/agent/OrientadorWorkspace";
import { RevisorWorkspace } from "@/components/agent/RevisorWorkspace";
import { AGENTS, type AgentId } from "@/lib/agents";

export const Route = createFileRoute("/agent/$agentId")({
  head: ({ params }) => {
    const a = AGENTS.find((x) => x.id === params.agentId);
    return {
      meta: [
        { title: a ? `${a.name} — Acadia` : "Agente — Acadia" },
        { name: "description", content: a?.description ?? "Agente acadêmico de IA" },
      ],
    };
  },
 loader: async ({ params }) => {
   const a = AGENTS.find((x) => x.id === (params.agentId as AgentId));
   if (!a) throw notFound();
   return { agent: a };
 },
  notFoundComponent: () => (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <h1 className="font-display text-2xl font-semibold">Agente não encontrado</h1>
        <Link to="/" className="mt-3 inline-block text-sm text-primary hover:underline">Voltar ao Dashboard</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  component: AgentPage,
});

 function AgentPage() {
   const { agent } = Route.useLoaderData() as { agent: (typeof AGENTS)[0] };
   if (agent.id === "leitor-pfc") return <LeitorPfcWorkspace agent={agent} />;
   if (agent.id === "orientador") return <OrientadorWorkspace agent={agent} />;
   if (agent.id === "revisor") return <RevisorWorkspace agent={agent} />;
   return <ChatInterface agent={agent} />;
 }
