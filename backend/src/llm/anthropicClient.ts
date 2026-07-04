import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import type {
  AgentStep,
  ChatMessage,
  LLMClient,
  ToolDefinition,
  TranscriptItem,
} from "./types";

/** Real LLM client backed by the Anthropic Messages API (used whenever
 * ANTHROPIC_API_KEY is set). */
export class AnthropicLLMClient implements LLMClient {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
  }

  async chat(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: config.anthropicModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  async step(
    transcript: TranscriptItem[],
    systemPrompt: string,
    tools: ToolDefinition[]
  ): Promise<AgentStep> {
    const messages = transcriptToAnthropicMessages(transcript);

    const response = await this.client.messages.create({
      model: config.anthropicModel,
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })),
      messages,
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUse) {
      return {
        type: "tool_call",
        toolName: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
        id: toolUse.id,
      };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return { type: "final", text };
  }
}

/** Rebuilds the Anthropic-native message array (with proper tool_use /
 * tool_result content blocks) from our provider-agnostic transcript. */
function transcriptToAnthropicMessages(transcript: TranscriptItem[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  for (const item of transcript) {
    switch (item.kind) {
      case "user":
        messages.push({ role: "user", content: item.content });
        break;
      case "assistant_text":
        messages.push({ role: "assistant", content: item.content });
        break;
      case "tool_call":
        messages.push({
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: item.id,
              name: item.toolName,
              input: item.input,
            },
          ],
        });
        break;
      case "tool_result":
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: item.id,
              content: item.output,
            },
          ],
        });
        break;
    }
  }

  return messages;
}
