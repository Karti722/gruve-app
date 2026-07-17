import { randomUUID } from "crypto";
import type {
  AgentStep,
  ChatMessage,
  LLMClient,
  ToolDefinition,
  TranscriptItem,
} from "./types";

const MATH_EXPRESSION = /-?\d+(\.\d+)?\s*[+\-*/%]\s*-?\d+(\.\d+)?/;
const PERCENT_OF = /(-?\d+(?:\.\d+)?)\s*%\s*of\s*(-?\d+(?:\.\d+)?)/i;

/**
 * Deterministic, dependency-free stand-in for a real LLM. Used automatically
 * when ANTHROPIC_API_KEY is empty so the whole demo (chat, RAG, agents) is
 * runnable offline / without billing. Every response is clearly labeled
 * "[MOCK MODE]" so it's never mistaken for a real model output.
 */
export class MockLLMClient implements LLMClient {
  async chat(messages: ChatMessage[], _systemPrompt: string): Promise<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const question = lastUser?.content ?? "";

    return (
      `[MOCK MODE: set ANTHROPIC_API_KEY in .env for real Claude responses]\n\n` +
      `You asked: "${question}"\n\n` +
      `Here's a canned-but-structured reply demonstrating the chat pipeline: the request hit ` +
      `the Express REST API, was wrapped with a system prompt and would normally stream back ` +
      `token-by-token from Claude. Everything downstream (routing, prompt templates, message ` +
      `history) is real: only the model call itself is mocked.`
    );
  }

  async step(
    transcript: TranscriptItem[],
    _systemPrompt: string,
    tools: ToolDefinition[]
  ): Promise<AgentStep> {
    const lastUser = [...transcript].reverse().find((t) => t.kind === "user");
    const question = lastUser && lastUser.kind === "user" ? lastUser.content : "";
    const toolResults = transcript.filter((t) => t.kind === "tool_result");

    // Once we already have a tool result, wrap up with a final answer.
    if (toolResults.length > 0) {
      const summary = toolResults
        .map((t) => (t.kind === "tool_result" ? `${t.toolName} → ${t.output}` : ""))
        .join("; ");

      return {
        type: "final",
        text:
          `[MOCK MODE] Using the tool result(s) (${summary}), here's my answer to "${question}": ` +
          `the tool call above supplied the grounding data, and a real Claude call would now ` +
          `phrase this fluently. This demonstrates the full think → act → observe → answer agent loop.`,
      };
    }

    const calculatorTool = tools.find((t) => t.name === "calculator");
    const kbTool = tools.find((t) => t.name === "search_knowledge_base");
    // Any tool that isn't one of the two built-ins is assumed to be
    // MCP-server-hosted (see backend/src/agent/mcpClient.ts).
    const mcpTools = tools.filter((t) => t.name !== "calculator" && t.name !== "search_knowledge_base");

    const percentOfMatch = question.match(PERCENT_OF);
    if (calculatorTool && percentOfMatch) {
      const [, percent, of] = percentOfMatch;
      return {
        type: "tool_call",
        toolName: "calculator",
        input: { expression: `(${percent} / 100) * ${of}` },
        id: randomUUID(),
      };
    }

    if (calculatorTool && MATH_EXPRESSION.test(question)) {
      const match = question.match(MATH_EXPRESSION)![0];
      return {
        type: "tool_call",
        toolName: "calculator",
        input: { expression: match },
        id: randomUUID(),
      };
    }

    // Prefer an MCP tool whose name is echoed in the question (e.g. "weather"
    // -> get_weather) over the generic knowledge-base search, so MCP demo
    // prompts actually exercise the MCP-hosted tool rather than always
    // falling through to RAG.
    const matchedMcpTool = mcpTools.find((tool) =>
      tool.name
        .split("_")
        .filter((word) => word.length > 3)
        .some((word) => question.toLowerCase().includes(word))
    );

    if (matchedMcpTool) {
      return {
        type: "tool_call",
        toolName: matchedMcpTool.name,
        input: buildMcpToolInput(matchedMcpTool, question),
        id: randomUUID(),
      };
    }

    if (kbTool) {
      return {
        type: "tool_call",
        toolName: "search_knowledge_base",
        input: { query: question },
        id: randomUUID(),
      };
    }

    if (mcpTools[0]) {
      return {
        type: "tool_call",
        toolName: mcpTools[0].name,
        input: buildMcpToolInput(mcpTools[0], question),
        id: randomUUID(),
      };
    }

    return {
      type: "final",
      text: `[MOCK MODE] No suitable tool was available, so here's a direct answer to "${question}".`,
    };
  }
}

/** Best-effort mapping from a free-text question to an MCP tool's declared
 * input schema, so the mock can call real MCP tools (e.g. get_weather's
 * `city` argument) with plausible arguments instead of a raw query blob. */
function buildMcpToolInput(tool: ToolDefinition, question: string): Record<string, unknown> {
  const schema = tool.input_schema as { properties?: Record<string, unknown> };
  const propertyNames = Object.keys(schema.properties ?? {});
  if (propertyNames.length === 0) return {};

  if (propertyNames.includes("city")) {
    const match = question.match(/in ([a-z\s]+?)[?.!]?$/i);
    return { city: (match ? match[1] : question).trim() };
  }

  return { [propertyNames[0]]: question };
}
