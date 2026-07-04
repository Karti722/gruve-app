"use client";

import { useState } from "react";
import { runAgent, type AgentTraceStep } from "@/lib/api";
import { AgentTrace } from "@/components/AgentTrace";

const SAMPLE_PROMPTS = [
  { label: "Math → calculator tool", prompt: "What's 18% of 240?" },
  { label: "Knowledge base → RAG tool", prompt: "What is the Model Context Protocol?" },
  { label: "MCP tool server → weather", prompt: "What's the weather in Austin?" },
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Agent + MCP</h1>
        <p className="mt-1 text-white/60">
          A ReAct-style think → act → observe loop. The agent can call a local calculator, search
          the RAG knowledge base, or (with MCP enabled) reach tools hosted in a completely separate
          process — <code className="rounded bg-white/10 px-1.5 py-0.5">mcp-server/</code> — over
          the real Model Context Protocol.
        </p>
      </div>

      <div className="card space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(message);
          }}
          className="flex gap-2"
        >
          <input
            className="input"
            placeholder="Ask the agent to do something…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !message.trim()}>
            Run
          </button>
        </form>

        <label className="flex items-center gap-2 text-sm text-white/60">
          <input
            type="checkbox"
            checked={useMcp}
            onChange={(e) => setUseMcp(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/5"
          />
          Include tools from the MCP server (requires{" "}
          <code className="rounded bg-white/10 px-1 py-0.5">npm run build --prefix mcp-server</code>{" "}
          to have been run at least once)
        </label>

        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((s) => (
            <button
              key={s.prompt}
              type="button"
              onClick={() => {
                setMessage(s.prompt);
                run(s.prompt);
              }}
              className="pill transition hover:bg-white/10"
              title={s.prompt}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-white/40">Agent is reasoning…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {trace.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
              Reasoning trace
            </h2>
            {mockMode !== null && (
              <span className={`pill ${mockMode ? "text-amber-300" : "text-emerald-300"}`}>
                {mockMode ? "MOCK MODE" : "LIVE · Anthropic"}
              </span>
            )}
          </div>
          <AgentTrace trace={trace} />
        </div>
      )}
    </div>
  );
}
