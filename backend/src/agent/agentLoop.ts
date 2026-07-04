import { llmClient } from "../llm";
import type { ToolDefinition, TranscriptItem } from "../llm/types";
import { AGENT_SYSTEM_PROMPT } from "../prompts/systemPrompts";
import { callMcpTool, getMcpTools } from "./mcpClient";
import { LOCAL_TOOLS } from "./tools";

export interface AgentTraceStep {
  type: "tool_call" | "tool_result" | "final";
  toolName?: string;
  input?: Record<string, unknown>;
  output?: string;
  text?: string;
}

export interface AgentRunResult {
  trace: AgentTraceStep[];
  answer: string;
}

const MAX_STEPS = 4;

/**
 * Drives the ReAct-style think → act → observe loop described in
 * prompts/systemPrompts.ts: ask the model for a step, execute a tool if it
 * asked for one, feed the result back, repeat until it gives a final
 * answer (or MAX_STEPS is hit as a safety valve against infinite loops).
 */
export async function runAgent(userMessage: string, opts?: { useMcp?: boolean }): Promise<AgentRunResult> {
  const localToolDefs = LOCAL_TOOLS.map((t) => t.definition);
  const mcpToolDefs = opts?.useMcp ? await getMcpTools() : [];
  const allTools: ToolDefinition[] = [...localToolDefs, ...mcpToolDefs];

  const transcript: TranscriptItem[] = [{ kind: "user", content: userMessage }];
  const trace: AgentTraceStep[] = [];

  for (let i = 0; i < MAX_STEPS; i++) {
    const step = await llmClient.step(transcript, AGENT_SYSTEM_PROMPT, allTools);

    if (step.type === "final") {
      trace.push({ type: "final", text: step.text });
      return { trace, answer: step.text };
    }

    trace.push({ type: "tool_call", toolName: step.toolName, input: step.input });
    transcript.push({ kind: "tool_call", id: step.id, toolName: step.toolName, input: step.input });

    const output = await executeTool(step.toolName, step.input);
    trace.push({ type: "tool_result", toolName: step.toolName, output });
    transcript.push({ kind: "tool_result", id: step.id, toolName: step.toolName, output });
  }

  const answer = "I reached the maximum number of tool-calling steps without producing a final answer.";
  trace.push({ type: "final", text: answer });
  return { trace, answer };
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const localTool = LOCAL_TOOLS.find((t) => t.definition.name === name);
  if (localTool) return localTool.execute(input);
  return callMcpTool(name, input);
}
