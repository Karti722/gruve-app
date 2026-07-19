const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error ?? `Request to ${path} failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error ?? `Request to ${path} failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  mock: boolean;
}

export function sendChatMessage(message: string, history: ChatMessage[]): Promise<ChatResponse> {
  return postJson<ChatResponse>("/api/chat", { message, history });
}

export interface RagSource {
  citation: number;
  source: string;
  title: string;
  text: string;
  similarity: number;
}

export interface RagResponse {
  answer: string;
  sources: RagSource[];
  mock: boolean;
}

export function queryRag(question: string): Promise<RagResponse> {
  return postJson<RagResponse>("/api/rag/query", { question });
}

export interface KnowledgeBaseSource {
  source: string;
  title: string;
}

export function listKnowledgeBaseSources(): Promise<{ sources: KnowledgeBaseSource[] }> {
  return getJson<{ sources: KnowledgeBaseSource[] }>("/api/rag/sources");
}

export interface KnowledgeBaseArticle extends KnowledgeBaseSource {
  content: string;
}

export function getKnowledgeBaseSource(source: string): Promise<KnowledgeBaseArticle> {
  return getJson<KnowledgeBaseArticle>(`/api/rag/sources/${encodeURIComponent(source)}`);
}

export interface AgentTraceStep {
  type: "tool_call" | "tool_result" | "final";
  toolName?: string;
  input?: Record<string, unknown>;
  output?: string;
  text?: string;
}

export interface AgentResponse {
  trace: AgentTraceStep[];
  answer: string;
  mock: boolean;
}

export function runAgent(message: string, useMcp: boolean): Promise<AgentResponse> {
  return postJson<AgentResponse>("/api/agent/run", { message, useMcp });
}

export type SummarizeMode = "abstractive" | "extractive";

export interface AbstractiveSummarizeResponse {
  mode: "abstractive";
  summary: string;
  mock: boolean;
}

export interface RankedSentence {
  text: string;
  index: number;
  score: number;
}

export interface ReadabilityScore {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  wordCount: number;
  sentenceCount: number;
}

export interface ExtractiveSummarizeResponse {
  mode: "extractive";
  sentences: RankedSentence[];
  totalSentences: number;
  keywords: string[];
  originalReadability: ReadabilityScore;
  summaryReadability: ReadabilityScore;
}

export type SummarizeResponse = AbstractiveSummarizeResponse | ExtractiveSummarizeResponse;

export function summarizeText(
  text: string,
  sentenceCount: number,
  mode: SummarizeMode
): Promise<SummarizeResponse> {
  return postJson<SummarizeResponse>("/api/summarize", { text, sentenceCount, mode });
}

export interface CostEstimate {
  model: string;
  inputCostUsd: number;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
}

export interface TokenizeResponse {
  tokenCount: number;
  costEstimates: CostEstimate[];
}

export function tokenizeText(text: string): Promise<TokenizeResponse> {
  return postJson<TokenizeResponse>("/api/tokenize", { text });
}

export interface CacheSimResult {
  query: string;
  hit: boolean;
  matchedQuery: string | null;
  similarity: number;
}

export interface CacheSimResponse {
  results: CacheSimResult[];
  hitCount: number;
  missCount: number;
}

export function simulateCache(queries: string[], threshold: number): Promise<CacheSimResponse> {
  return postJson<CacheSimResponse>("/api/cache-sim", { queries, threshold });
}

export interface EvaluateResponse {
  exactMatch: boolean;
  rougeL: number;
  semanticSimilarity: number;
  compositeScore: number;
}

export function evaluateOutput(candidate: string, reference: string): Promise<EvaluateResponse> {
  return postJson<EvaluateResponse>("/api/evaluate", { candidate, reference });
}
