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
