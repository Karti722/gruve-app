# Large Language Models (LLMs)

Large Language Models are neural networks trained on massive text corpora to
predict the next token in a sequence. Modern LLMs such as Anthropic's Claude
family are built on the transformer architecture and fine-tuned with
techniques like reinforcement learning from human feedback (RLHF) to be
helpful, harmless, and honest.

In production applications, LLMs are typically accessed through a hosted API
(REST over HTTPS) rather than run locally, because the largest, most capable
models require substantial GPU infrastructure. A typical request sends a
system prompt, a list of prior conversation turns, and generation parameters
(max tokens, temperature) and receives back generated text or a tool-call
request.

Key production concerns when integrating an LLM into an application include
latency (mitigated with streaming responses), cost (mitigated with smaller
models or prompt caching), and reliability (mitigated with retries, timeouts,
and graceful fallbacks when the provider is unavailable).
