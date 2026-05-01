-- Projeto PFC ativo (um por sessão de browser, sem auth)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Meu PFC',
  theme TEXT,
  research_question TEXT,
  objectives TEXT,
  methodology TEXT,
  structure TEXT,
  current_status TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_session ON public.projects(session_id, is_active);

-- Memória partilhada entre agentes (decisões, factos, descobertas)
CREATE TABLE public.project_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note', -- note | decision | finding | reference
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_project ON public.project_memory(project_id, created_at DESC);

-- Mensagens de chat por agente, ligadas ao projeto
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_project_agent ON public.chat_messages(project_id, agent_id, created_at);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_projects_updated
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS aberto (sem auth ainda) — acesso anónimo permitido, isolamento por session_id no cliente
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all memory"   ON public.project_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);