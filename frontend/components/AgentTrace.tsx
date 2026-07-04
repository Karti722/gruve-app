import type { AgentTraceStep } from "@/lib/api";

function StepBadge({ step }: { step: AgentTraceStep }) {
  if (step.type === "tool_call") return <span className="pill text-brand-400">tool call</span>;
  if (step.type === "tool_result") return <span className="pill text-sky-300">tool result</span>;
  return <span className="pill text-emerald-300">final answer</span>;
}

export function AgentTrace({ trace }: { trace: AgentTraceStep[] }) {
  return (
    <ol className="space-y-3">
      {trace.map((step, i) => (
        <li key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-xs text-white/40">step {i + 1}</span>
            <StepBadge step={step} />
            {step.toolName && <span className="font-mono text-xs text-white/60">{step.toolName}</span>}
          </div>

          {step.type === "tool_call" && (
            <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-xs text-white/70">
              {JSON.stringify(step.input, null, 2)}
            </pre>
          )}

          {step.type === "tool_result" && (
            <p className="whitespace-pre-wrap text-sm text-white/70">{step.output}</p>
          )}

          {step.type === "final" && (
            <p className="whitespace-pre-wrap text-sm text-white/90">{step.text}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
