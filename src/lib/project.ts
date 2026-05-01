import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "./session";

export interface Project {
  id: string;
  session_id: string;
  title: string;
  theme: string | null;
  research_question: string | null;
  objectives: string | null;
  methodology: string | null;
  structure: string | null;
  current_status: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemoryItem {
  id: string;
  project_id: string;
  agent_id: string;
  kind: string;
  content: string;
  created_at: string;
}

export async function getOrCreateActiveProject(): Promise<Project> {
  const session_id = getSessionId();
  const { data: existing } = await supabase
    .from("projects")
    .select("*")
    .eq("session_id", session_id)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) return existing as Project;

  const { data, error } = await supabase
    .from("projects")
    .insert({ session_id, title: "Meu PFC" })
    .select("*")
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

export async function listMemory(projectId: string): Promise<MemoryItem[]> {
  const { data, error } = await supabase
    .from("project_memory")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as MemoryItem[];
}

export async function addMemory(projectId: string, agentId: string, content: string, kind = "note"): Promise<void> {
  await supabase.from("project_memory").insert({
    project_id: projectId, agent_id: agentId, content, kind,
  });
}

export function buildProjectContext(p: Project | null, memory: MemoryItem[]): string {
  if (!p) return "";
  const lines: string[] = [];
  lines.push("=== PROJETO PFC ATIVO ===");
  lines.push(`Título: ${p.title || "(sem título)"}`);
  if (p.theme) lines.push(`Tema: ${p.theme}`);
  if (p.research_question) lines.push(`Pergunta de pesquisa: ${p.research_question}`);
  if (p.objectives) lines.push(`Objetivos: ${p.objectives}`);
  if (p.methodology) lines.push(`Metodologia: ${p.methodology}`);
  if (p.structure) lines.push(`Estrutura: ${p.structure}`);
  if (p.current_status) lines.push(`Estado atual: ${p.current_status}`);

  if (memory.length > 0) {
    lines.push("");
    lines.push("=== MEMÓRIA PARTILHADA (decisões e descobertas de outros agentes) ===");
    memory.slice(0, 20).forEach((m) => {
      lines.push(`- [${m.agent_id}/${m.kind}] ${m.content}`);
    });
  }
  return lines.join("\n");
}