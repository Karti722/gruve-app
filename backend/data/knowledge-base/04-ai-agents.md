# AI Agents and Tool Use

An AI agent is an LLM wrapped in a loop that lets it take actions — calling
functions, querying databases, hitting APIs — rather than only producing
text. The most common pattern is the **ReAct loop** (Reason + Act):

1. The model reads the user's request and decides whether it needs more
   information or capability than it already has.
2. If so, it emits a structured "tool call" — a function name plus
   JSON arguments — instead of a plain-text answer.
3. The application executes that function in real code and feeds the
   result back to the model as a new message.
4. The model repeats steps 1-3 until it has enough information, then
   produces a final natural-language answer.

This lets an LLM reliably do arithmetic (via a calculator tool instead of
mental math), search a knowledge base (via a retrieval tool), or call
external services, while keeping the LLM itself stateless and
deterministic-per-turn. Frameworks like LangChain, LangGraph, CrewAI, and
AutoGen provide higher-level abstractions — memory, multi-agent
orchestration, graph-based control flow — on top of this same fundamental
tool-calling loop.

Multi-agent systems extend this further by having several specialized
agents (e.g., a "planner" and a "coder") communicate with each other to
solve a task no single agent could do well alone.
