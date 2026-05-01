import { supabase } from "@/integrations/supabase/client";

export interface ProjectDocument {
  id: string;
  project_id: string;
  filename: string;
  mime_type: string | null;
  page_count: number | null;
  char_count: number;
  extracted_text: string;
  summary: string | null;
  include_in_context: boolean;
  created_at: string;
}

export async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from("project_documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ProjectDocument[];
}

export async function insertDocument(doc: Omit<ProjectDocument, "id" | "created_at" | "summary">): Promise<ProjectDocument> {
  const { data, error } = await supabase
    .from("project_documents")
    .insert(doc)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectDocument;
}

export async function deleteDocument(id: string) {
  const { error } = await supabase.from("project_documents").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleDocumentContext(id: string, include: boolean) {
  const { error } = await supabase.from("project_documents")
    .update({ include_in_context: include }).eq("id", id);
  if (error) throw error;
}

export interface DocumentAnalysis {
  title?: string;
  theme?: string;
  objectives?: string;
  methodology?: string;
  conclusions?: string;
  contributions?: string;
  gaps?: string;
  summary?: string;
}

export function parseAnalysis(summary: string | null): DocumentAnalysis | null {
  if (!summary) return null;
  try { return JSON.parse(summary) as DocumentAnalysis; } catch { return { summary }; }
}

export async function saveAnalysis(id: string, analysis: DocumentAnalysis) {
  const { error } = await supabase.from("project_documents")
    .update({ summary: JSON.stringify(analysis) }).eq("id", id);
  if (error) throw error;
}

export async function analyzeDocumentRemote(text: string, filename: string): Promise<DocumentAnalysis> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text, filename }),
  });
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({ error: "Falha na análise" }));
    throw new Error(e.error || "Falha na análise");
  }
  const { analysis } = await resp.json();
  return analysis as DocumentAnalysis;
}

/** Extract plain text from a PDF using pdfjs-dist. Browser-only. */
export async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  console.log("Iniciando extração de PDF:", file.name, "Tamanho:", file.size);
  
  try {
    // Import pdfjs-dist 3.11.174 (versão estável)
    const pdfjs = await import("pdfjs-dist");
    console.log("PDF.js 3.11.174 importado com sucesso");
    
    // Configurar worker para versão 3.11.174
    try {
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.js?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      console.log("Worker URL local:", workerUrl);
    } catch (e) {
      console.log("Usando worker CDN como fallback");
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    console.log("Convertendo arquivo para ArrayBuffer...");
    const buf = await file.arrayBuffer();
    console.log("ArrayBuffer criado, tamanho:", buf.byteLength);
    
    console.log("Carregando documento PDF...");
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    console.log("PDF carregado, páginas:", pdf.numPages);
    
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Processando página ${i} de ${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((it: any) => ("str" in it ? it.str : "")).filter(Boolean);
      text += `\n\n[Página ${i}]\n` + strings.join(" ");
    }
    
    console.log("Extração concluída, texto length:", text.length);
    return { text: text.trim(), pages: pdf.numPages };
  } catch (error) {
    console.error("Erro detalhado na extração de PDF:", error);
    throw new Error(`Falha ao extrair texto do PDF: ${error.message}`);
  }
}

/** Build a context block from documents for the AI, capped to a char budget. */
export function buildDocumentsContext(docs: ProjectDocument[], maxChars = 60000): string {
  const active = docs.filter((d) => d.include_in_context && d.extracted_text);
  if (active.length === 0) return "";
  const lines: string[] = ["=== DOCUMENTOS DO PROJETO (referência) ==="];
  let used = 0;
  // Distribute budget evenly
  const perDoc = Math.floor(maxChars / active.length);
  for (const d of active) {
    const slice = d.extracted_text.slice(0, perDoc);
    used += slice.length;
    lines.push(`\n--- ${d.filename} (${d.page_count ?? "?"} págs, ${d.char_count} chars) ---`);
    lines.push(slice);
    if (slice.length < d.extracted_text.length) {
      lines.push(`[…texto truncado, total ${d.extracted_text.length} caracteres]`);
    }
    if (used >= maxChars) break;
  }
  return lines.join("\n");
}