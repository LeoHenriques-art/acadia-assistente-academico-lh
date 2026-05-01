import type { AgentId } from "./agents";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const KEY = (agent: AgentId) => `acadia_chat_${agent}`;

export function loadMessages(agent: AgentId): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(agent));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMessages(agent: AgentId, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(agent), JSON.stringify(messages));
}

export function clearMessages(agent: AgentId) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY(agent));
}

export function countMessages(agent: AgentId): number {
  return loadMessages(agent).length;
}
