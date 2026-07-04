import { ChatWindow } from "@/components/ChatWindow";

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">LLM Chat</h1>
        <p className="mt-1 text-white/60">
          Plain multi-turn chat completion: your message plus history is sent to{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5">POST /api/chat</code>, wrapped with a
          versioned system prompt, and answered by Claude (or the mock LLM if no API key is set).
        </p>
      </div>
      <ChatWindow />
    </div>
  );
}
