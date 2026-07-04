import { config } from "../config";
import { AnthropicLLMClient } from "./anthropicClient";
import { MockLLMClient } from "./mockLLM";
import type { LLMClient } from "./types";

/** Single place that decides real-vs-mock so routes never branch on config. */
export const llmClient: LLMClient = config.isMockMode ? new MockLLMClient() : new AnthropicLLMClient();

export * from "./types";
