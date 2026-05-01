const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um analista académico. Recebe o texto extraído de um PFC/TCC/artigo e devolve UMA análise estruturada em JSON puro (sem markdown, sem texto extra).

Schema obrigatório:
{
  "title": string,            // título inferido do documento
  "theme": string,            // 1-2 frases
  "objectives": string,       // objetivo geral + específicos (bullet com - )
  "methodology": string,      // tipo de estudo, abordagem, técnicas
  "conclusions": string,      // principais conclusões
  "contributions": string,    // contribuições / novidades
  "gaps": string,             // lacunas / limitações
  "summary": string           // resumo académico (200-350 palavras)
}

Responda APENAS com o JSON. Se algum campo não estiver presente no texto, devolva "Não identificado".`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, filename } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!text) throw new Error("Texto vazio");

    // Cap input to keep tokens reasonable
    const capped = text.slice(0, 80000);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Ficheiro: ${filename || "documento"}\n\nTEXTO:\n${capped}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: resp.status === 429 ? "Limite de requisições. Tente em instantes." : resp.status === 402 ? "Créditos esgotados." : "Erro no gateway de IA" }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let analysis: Record<string, string>;
    try { analysis = JSON.parse(raw); }
    catch {
      // try to recover JSON from the text
      const m = raw.match(/\{[\s\S]*\}/);
      analysis = m ? JSON.parse(m[0]) : { summary: raw };
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});