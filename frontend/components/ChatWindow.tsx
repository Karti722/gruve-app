"use client";

import { useState } from "react";
import { sendChatMessage, type ChatMessage } from "@/lib/api";

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

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

  return (
    <div className="card flex h-[32rem] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-white">LLM Chat</h2>
        {mockMode !== null && (
          <span className={`pill ${mockMode ? "text-amber-300" : "text-emerald-300"}`}>
            {mockMode ? "MOCK MODE" : "LIVE · Anthropic"}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-white/40">
            Ask anything — e.g. "Explain what a system prompt does in two sentences."
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "user" ? "bg-brand-500 text-white" : "bg-white/10 text-white/90"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-white/40">Thinking…</p>}
        {error && <p className="text-sm text-red-400">Error: {error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
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
