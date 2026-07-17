"use client";

import { useState } from "react";
import { runAgent, type AgentTraceStep } from "@/lib/api";
import { AgentTrace } from "@/components/AgentTrace";
import { Analogy } from "@/components/Analogy";
import { TextbookPage } from "@/components/TextbookPage";
import { Sources } from "@/components/Sources";

const SAMPLE_PROMPTS = [
  { label: "Do some math", prompt: "What's 18% of 240?" },
  { label: "Ask about an AI concept", prompt: "What is the Model Context Protocol?" },
  { label: "Check the weather", prompt: "What's the weather in Austin?" },
];

export default function AgentPage() {
  const [message, setMessage] = useState("");
  const [useMcp, setUseMcp] = useState(true);
  const [trace, setTrace] = useState<AgentTraceStep[]>([]);
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(prompt: string) {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setTrace([]);
    try {
      const response = await runAgent(prompt, useMcp);
      setTrace(response.trace);
      setMockMode(response.mock);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
          Try it yourself
        </h2>

        <div className="card space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(message);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              className="input"
              placeholder="Ask the agent to do something…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn-primary shrink-0"
              disabled={loading || !message.trim()}
            >
              Run
            </button>
          </form>

          <label className="flex items-center gap-2 text-sm text-paper-ink/60">
            <input
              type="checkbox"
              checked={useMcp}
              onChange={(e) => setUseMcp(e.target.checked)}
              className="h-4 w-4 rounded-sm border-paper-ink/20 bg-white"
            />
            Let the agent use extra tools (time, weather, and topic lookups) from a connected tool
            server
          </label>

          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wide text-paper-ink/40">
              Try asking
            </p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {SAMPLE_PROMPTS.map((s, i) => (
                <li key={s.prompt}>
                  <button
                    type="button"
                    onClick={() => {
                      setMessage(s.prompt);
                      run(s.prompt);
                    }}
                    title={s.prompt}
                    className="text-left leading-relaxed text-paper-ink/70 underline decoration-paper-ink/25 decoration-dotted underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500"
                  >
                    {i + 1}. {s.label}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {loading && <p className="text-sm italic text-paper-ink/40">Agent is reasoning…</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {trace.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                Reasoning trace
              </h3>
              {mockMode !== null && (
                <span className={`pill ${mockMode ? "text-amber-700" : "text-emerald-700"}`}>
                  {mockMode ? "MOCK MODE" : "LIVE · Anthropic"}
                </span>
              )}
            </div>
            <AgentTrace trace={trace} />
          </div>
        )}
      </div>

      <TextbookPage eyebrow="Chapter 4" title="AI Agents and Tool Use" pageNumber="Page 4">
        <p>
          Even with retrieval, a language model still only produces text — it cannot perform a
          precise calculation, take an action, or reach out to another system to check something in
          real time. It also can't decide partway through answering that it needs to do one of those
          things; at best, it can only respond with whatever it's already been given.
        </p>

        <p>
          An <strong>AI agent</strong> extends a language model with the ability to take actions, by
          giving it a defined set of tools it's allowed to call — a calculator, a search function, a
          request to another system — along with a description of what each tool does. Instead of
          only producing a final answer, the model can produce a request to use one of these tools.
          That request is carried out outside the model, and the result is fed back into the
          conversation as something the model just observed. The model then decides, based on that
          new information, whether it can answer now or needs to call another tool. Think, act,
          observe, and repeat until ready to answer — this cycle is often called the{" "}
          <strong>ReAct</strong> pattern, short for "reason and act," and it's the mechanism behind
          every AI system capable of doing more than talking.
        </p>

        <Analogy>
          A plain chatbot is like asking someone a question and only getting an answer from whatever
          they already remember. An agent is like sending someone to actually go find the answer:
          they might do a calculation, check a source, or make a call, and only report back once
          they've gathered what's actually needed — adjusting their next step based on what they
          learn along the way, rather than committing to one fixed plan up front.
        </Analogy>

        <p>
          Tool use raises a practical problem, though: every application that wants to give a model
          access to a tool would otherwise need its own custom, one-off integration for that specific
          tool. The <strong>Model Context Protocol (MCP)</strong> is an open standard that solves
          this by defining one common format for describing tools and exchanging tool calls and
          results, independent of which AI model or application is using them. A program exposing
          tools over MCP can be reached by any MCP-compatible agent, and an agent that speaks MCP can
          use tools from any MCP-compatible source — neither side needs to know anything specific
          about the other beyond the shared protocol.
        </p>

        <Analogy>
          MCP plays a similar role for AI tools that a standard electrical outlet plays for
          appliances. Without a shared standard, every appliance would need its own uniquely shaped
          plug matched to a uniquely shaped outlet. Because manufacturers build to one shared
          standard instead, any compliant appliance works in any compliant outlet. MCP defines one
          shared "plug shape" for AI tools, so an agent and a tool server that have never seen each
          other before can still connect.
        </Analogy>

        <div className="border-l-[3px] border-amber-700/40 bg-paper-ink/[0.035] py-3 pl-5 pr-4">
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-amber-800">
            In this demo
          </p>
          <p className="mt-2 text-[16px]">This agent can currently:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Do exact arithmetic with a real calculator, instead of guessing at numbers</li>
            <li>
              Answer questions about AI concepts (LLMs, RAG, agents, MCP, vector databases, and
              more) by searching the same knowledge base used in the previous chapter
            </li>
            <li>
              With "extra tools" switched on above: check the current time, look up a (simulated)
              weather report, or list the topics this tutorial covers — reaching those tools over
              MCP, described above
            </li>
          </ul>
        </div>

        <p>
          Above, you could try a sample prompt or write your own — anything that needs a calculation
          or a factual lookup works well. The reasoning trace it produced lists every tool the agent
          called, exactly what it sent, what came back, and finally its answer, so you can see its
          thinking instead of just the result.
        </p>

        <Sources
          items={[
            {
              label: "Yao et al., \"ReAct: Synergizing Reasoning and Acting in Language Models\" (2022)",
              href: "https://arxiv.org/abs/2210.03629",
            },
            {
              label: "Anthropic, \"Introducing the Model Context Protocol\" (November 2024)",
              href: "https://www.anthropic.com/news/model-context-protocol",
            },
            {
              label: "Model Context Protocol — official specification and documentation",
              href: "https://modelcontextprotocol.io",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
