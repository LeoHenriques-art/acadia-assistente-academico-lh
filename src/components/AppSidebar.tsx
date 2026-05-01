import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, CheckCircle2, Circle, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { NAV_ITEMS } from "@/lib/agents";
import { getOrCreateActiveProject, listMemory, type Project } from "@/lib/project";
import { listDocuments } from "@/lib/documents";
import { supabase } from "@/integrations/supabase/client";

// Compute per-agent status based on project + activity
function useAgentStatuses() {
  const [project, setProject] = useState<Project | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [msgCounts, setMsgCounts] = useState<Record<string, number>>({});
  const [memCount, setMemCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const p = await getOrCreateActiveProject();
        setProject(p);
        const [docs, mem, msgs] = await Promise.all([
          listDocuments(p.id),
          listMemory(p.id),
          supabase.from("chat_messages").select("agent_id").eq("project_id", p.id),
        ]);
        setDocCount(docs.length);
        setMemCount(mem.length);
        const c: Record<string, number> = {};
        (msgs.data || []).forEach((m: { agent_id: string }) => { c[m.agent_id] = (c[m.agent_id] || 0) + 1; });
        setMsgCounts(c);
      } catch {}
    })();
  }, []);

  function statusFor(id: string): "done" | "active" | "idle" {
    if (id === "dashboard" || id === "project" || id === "documents") return "idle";
    if (id === "leitor-pfc") return docCount > 0 ? "done" : "idle";
    if (id === "orientador") return (project?.theme && project?.objectives) ? "done" : msgCounts["orientador"] > 0 ? "active" : "idle";
    if (id === "revisor") return msgCounts["revisor"] > 0 ? (memCount > 2 ? "done" : "active") : "idle";
    if (id === "metodologia") return (project?.methodology) ? "done" : msgCounts["metodologia"] > 0 ? "active" : "idle";
    if (id === "analise-dados") return msgCounts["analise-dados"] > 0 ? "active" : "idle";
    if (id === "simulador-juri") return msgCounts["simulador-juri"] > 0 ? "active" : "idle";
    return "idle";
  }

  return { statusFor };
}

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { statusFor } = useAgentStatuses();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-semibold leading-none">Acadia</span>
            <span className="text-xs text-muted-foreground">Created by Leonel Henriques</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = item.path === "/" ? path === "/" : path.startsWith(item.path);
                const status = statusFor(item.id);
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.name}>
                      <Link to={item.path} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1">{item.name}</span>
                        {status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                        {status === "active" && <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        {status === "idle" && item.path.startsWith("/agent") && <Circle className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-3 py-2 space-y-1">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Completo</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" /> Em progresso</span>
            <span className="flex items-center gap-1"><Circle className="h-3 w-3 text-muted-foreground/30" /> Por iniciar</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Histórico salvo neste dispositivo.</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
