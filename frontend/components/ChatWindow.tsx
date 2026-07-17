"use client";

import { useState } from "react";
import { sendChatMessage, type ChatMessage } from "@/lib/api";

const SAMPLE_PROMPTS = [
  "Explain what a system prompt does, in two sentences.",
  "What's the difference between an AI agent and a regular chatbot?",
  "Write a short poem about neural networks.",
];

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const history = messages;
    setMessages([...history, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(text, history);
      setMockMode(response.mock);
      setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="card flex h-[32rem] flex-col">
      <div className="mb-4 flex items-center justify-between border-b border-paper-ink/10 pb-3">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
          Transcript
        </h2>
        {mockMode !== null && (
          <span className={`pill ${mockMode ? "text-amber-700" : "text-emerald-700"}`}>
            {mockMode ? "MOCK MODE" : "LIVE · Anthropic"}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wide text-paper-ink/40">
              Try asking
            </p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {SAMPLE_PROMPTS.map((prompt, i) => (
                <li key={prompt}>
                  <button
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="text-left leading-relaxed text-paper-ink/70 underline decoration-paper-ink/25 decoration-dotted underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500"
                  >
                    {i + 1}. {prompt}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "" : "border-l-2 border-brand-500/30 pl-4"}>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
              <span className="mr-2 font-display text-xs font-bold uppercase tracking-wide text-brand-600">
                {m.role === "user" ? "Q." : "A."}
              </span>
              <span className={m.role === "user" ? "font-semibold text-paper-ink" : "text-paper-ink/80"}>
                {m.content}
              </span>
            </p>
          </div>
        ))}
        {loading && <p className="text-sm italic text-paper-ink/40">Thinking…</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2 border-t border-paper-ink/10 pt-4">
        <input
          className="input"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
