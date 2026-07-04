export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** JSON-schema tool definition shared by both the real and mock LLM clients. */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * A provider-agnostic transcript for an agent's tool-calling loop.
 * Both the real Anthropic client and the mock client translate this into
 * whatever wire format they need internally.
 */
export type TranscriptItem =
  | { kind: "user"; content: string }
  | { kind: "assistant_text"; content: string }
  | { kind: "tool_call"; id: string; toolName: string; input: Record<string, unknown> }
  | { kind: "tool_result"; id: string; toolName: string; output: string };

export type AgentStep =
  | { type: "tool_call"; toolName: string; input: Record<string, unknown>; id: string }
  | { type: "final"; text: string };

export interface LLMClient {
  /** Single-turn (or multi-turn) chat completion, no tools. */
  chat(messages: ChatMessage[], systemPrompt: string): Promise<string>;

  /**
   * One step of a tool-calling agent loop. Given the running transcript and
   * the tools currently available, returns either a request to call a tool
   * or a final answer.
   */
  step(transcript: TranscriptItem[], systemPrompt: string, tools: ToolDefinition[]): Promise<AgentStep>;
}
