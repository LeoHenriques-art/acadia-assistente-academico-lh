const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRAIN_PREAMBLE = `Você faz parte do ACADIA — um sistema multi-agente acadêmico que funciona como um CÉREBRO ÚNICO.
Você NÃO é um chat isolado. Todos os agentes partilham o mesmo PFC, a mesma memória e o mesmo contexto.

Regras invioláveis:
1. Sempre considere o PROJETO PFC ATIVO e a MEMÓRIA PARTILHADA fornecidos abaixo. Eles são a verdade do projeto.
2. Mantenha COERÊNCIA com decisões já tomadas por outros agentes (visíveis na memória).
3. Se faltar informação importante (tema, objetivos, metodologia), peça-a ao utilizador antes de assumir.
4. Sempre relacione a sua resposta ao PFC concreto — nunca dê respostas genéricas descoladas do projeto.
5. Quando tomar uma decisão relevante (ex.: definição de método, escolha de capítulo, validação de dado), termine com uma linha:
   MEMORY: <frase curta e útil para os outros agentes lembrarem>
`;

const SYSTEM_PROMPTS: Record<string, string> = {
  "orientador": "Você é um Orientador Acadêmico experiente, especialista em guiar alunos de graduação e pós-graduação no desenvolvimento de seus trabalhos científicos (TCC, dissertações, teses). Ofereça orientação clara, estruturada e crítica sobre tema, escopo, problema de pesquisa, objetivos, hipóteses e cronograma. Responda em português, com tom acadêmico, acolhedor e propositivo.",
  "revisor": "Você é um Revisor Acadêmico rigoroso especializado em normas ABNT, APA e Vancouver. Analise textos científicos verificando: clareza, coesão, coerência, ortografia, gramática, formatação de citações e referências, e estrutura argumentativa. Aponte erros específicos e sugira reescritas. Responda em português.",
  "leitor-pfc": "Você é um especialista em Projetos Finais de Curso (PFCs), TCCs e monografias. Ajude o usuário a interpretar, resumir, comparar e extrair insights de PFCs e trabalhos acadêmicos. Identifique metodologias, contribuições, lacunas e oportunidades de pesquisa. Responda em português.",
  "metodologia": "Você é um especialista em Metodologia Científica. Auxilie na escolha e fundamentação de métodos de pesquisa (qualitativo, quantitativo, misto), tipos de estudo (exploratório, descritivo, explicativo), técnicas de coleta (entrevista, questionário, observação) e procedimentos de análise. Cite autores clássicos (Gil, Lakatos, Marconi, Creswell). Responda em português.",
  "analise-dados": "Você é um especialista em Análise de Dados aplicada à pesquisa acadêmica. Oriente sobre estatística descritiva e inferencial, testes de hipótese, análise qualitativa (análise de conteúdo, análise temática), uso de softwares (SPSS, R, Python, NVivo) e interpretação de resultados. Responda em português, com exemplos práticos.",
  "simulador-banca": "Você é um Simulador de Banca Examinadora. Atue como uma banca acadêmica crítica e construtiva: faça perguntas desafiadoras sobre o trabalho do aluno (problema, objetivos, metodologia, resultados, contribuições, limitações), questione escolhas teóricas e metodológicas, e ofereça feedback. Mantenha tom formal e exigente. Responda em português.",
  "simulador-juri": "Você é um Simulador de Júri/Banca Examinadora. Atue como uma banca acadêmica crítica e construtiva: faça perguntas desafiadoras sobre o trabalho do aluno (problema, objetivos, metodologia, resultados, contribuições, limitações), questione escolhas teóricas e metodológicas, e ofereça feedback. Mantenha tom formal e exigente. Responda em português.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, agent, projectContext, documentsContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const agentPrompt = SYSTEM_PROMPTS[agent] || "Você é um assistente acadêmico útil. Responda em português.";
    const systemPrompt = [
      BRAIN_PREAMBLE,
      "--- PAPEL DESTE AGENTE ---",
      agentPrompt,
      projectContext ? "\n--- CONTEXTO DO PROJETO ---\n" + projectContext : "\n(Nenhum projeto configurado ainda — oriente o utilizador a abrir 'Projeto PFC' e preencher tema/objetivos.)",
      documentsContext ? "\n--- DOCUMENTOS CARREGADOS ---\n" + documentsContext + "\n(Use estes documentos como fonte primária quando relevante. Cite o nome do ficheiro e a página entre colchetes.)" : "",
    ].join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos ao seu workspace Lovable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
