import { supabase } from "@/integrations/supabase/client";

export interface DbMessage {
  id: string;
  project_id: string;
  agent_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export async function loadDbMessages(projectId: string, agentId: string): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("project_id", projectId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as DbMessage[];
}

export async function insertMessage(projectId: string, agentId: string, role: "user" | "assistant", content: string) {
  await supabase.from("chat_messages").insert({
    project_id: projectId, agent_id: agentId, role, content,
  });
}

export async function clearDbMessages(projectId: string, agentId: string) {
  await supabase.from("chat_messages").delete()
    .eq("project_id", projectId).eq("agent_id", agentId);
}