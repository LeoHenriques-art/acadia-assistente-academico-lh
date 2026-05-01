import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Sparkles, User, Brain, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { type Agent } from "@/lib/agents";
import { getOrCreateActiveProject, listMemory, addMemory, buildProjectContext, type Project, type MemoryItem } from "@/lib/project";
import { loadDbMessages, insertMessage, clearDbMessages } from "@/lib/chat-db";
import { listDocuments, buildDocumentsContext, type ProjectDocument } from "@/lib/documents";
import { Link } from "@tanstack/react-router";

interface ChatMessage { role: "user" | "assistant"; content: string; timestamp: number; }

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-agent`;

export function ChatInterface({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const Icon = agent.icon;

  // Load project + memory + history when agent changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getOrCreateActiveProject();
        if (cancelled) return;
        setProject(p);
        const [mem, hist, docs] = await Promise.all([
          listMemory(p.id),
          loadDbMessages(p.id, agent.id),
          listDocuments(p.id),
        ]);
        if (cancelled) return;
        setMemory(mem);
        setDocuments(docs);
        setMessages(hist.map((m) => ({ role: m.role, content: m.content, timestamp: new Date(m.created_at).getTime() })));
      } catch (e) {
        console.error("Erro ao carregar contexto:", e);
        toast.error("Erro ao carregar projeto");
      }
    })();
    return () => { cancelled = true; };
  }, [agent.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const extractMemoryLines = (text: string): { clean: string; memos: string[] } => {
    const memos: string[] = [];
    const lines = text.split("\n");
    const kept: string[] = [];
    for (const l of lines) {
      const m = l.match(/^\s*MEMORY:\s*(.+)$/i);
      if (m) memos.push(m[1].trim());
      else kept.push(l);
    }
    return { clean: kept.join("\n").trim(), memos };
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!project) { toast.error("Projeto não carregado"); return; }

    const userMsg: ChatMessage = { role: "user", content: text, timestamp: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    insertMessage(project.id, agent.id, "user", text).catch(console.error);

    let acc = "";
    const updateAssistant = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        return [...prev, { role: "assistant", content: acc, timestamp: Date.now() }];
      });
    };

    try {
      const projectContext = buildProjectContext(project, memory);
      const documentsContext = buildDocumentsContext(documents);
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          agent: agent.id,
          projectContext,
          documentsContext,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Falha ao iniciar a conversa" }));
        toast.error(err.error || "Erro ao enviar mensagem");
        setMessages(next);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) updateAssistant(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      // Post-process: strip MEMORY lines, persist assistant message and memory
      if (acc) {
        const { clean, memos } = extractMemoryLines(acc);
        if (memos.length > 0) {
          // Replace last assistant message content with cleaned version
          setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 && m.role === "assistant" ? { ...m, content: clean } : m)));
          for (const memo of memos) {
            try {
              await addMemory(project.id, agent.id, memo, "decision");
            } catch (e) { console.error(e); }
          }
          // refresh memory list locally
          const fresh = await listMemory(project.id);
          setMemory(fresh);
        }
        await insertMessage(project.id, agent.id, "assistant", clean || acc);
      }
    } catch (e) {
      toast.error("Erro de conexão");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onClear = async () => {
    if (!project) return;
    await clearDbMessages(project.id, agent.id);
    setMessages([]);
    toast.success("Histórico limpo");
  };

  const projectIncomplete = !project?.theme && !project?.objectives;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card/50 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight">{agent.name}</h1>
            <p className="text-xs text-muted-foreground">
              {agent.description}
              {project && <> · <span className="text-primary">{project.title}</span></>}
              {memory.length > 0 && <> · <Brain className="inline h-3 w-3" /> {memory.length} memórias</>}
              {documents.filter(d => d.include_in_context).length > 0 && (
                <> · <FileText className="inline h-3 w-3" /> {documents.filter(d => d.include_in_context).length} doc(s)</>
              )}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
            <Trash2 className="mr-2 h-4 w-4" /> Limpar
          </Button>
        )}
      </div>

      {projectIncomplete && (
        <div className="border-b bg-amber-50 px-6 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠ O projeto PFC ainda não está configurado. <Link to="/project" className="font-semibold underline">Configurar agora</Link> para que todos os agentes trabalhem com o mesmo contexto.
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef as never}>
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-7 w-7" />
              </div>
              <h2 className="font-display text-2xl font-semibold">{agent.name}</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{agent.intro}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} agentIcon={Icon} />
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1 pt-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50 [animation-delay:0.2s]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50 [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Pergunte ao ${agent.short}...`}
              rows={1}
              className="min-h-[40px] max-h-40 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
            />
            <Button onClick={send} disabled={!input.trim() || loading} size="icon" className="h-9 w-9 shrink-0 rounded-xl">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, agentIcon: Icon }: { message: ChatMessage; agentIcon: typeof Sparkles }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser ? "bg-primary text-primary-foreground" : "bg-card border"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}
