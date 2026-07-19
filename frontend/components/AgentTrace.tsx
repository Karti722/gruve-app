import type { AgentTraceStep } from "@/lib/api";
import { WeatherCard, parseWeatherOutput } from "./WeatherCard";
import { CalculatorCard, parseCalculatorOutput } from "./CalculatorCard";
import { KnowledgeBaseResults, parseKnowledgeBaseOutput } from "./KnowledgeBaseResults";

function StepBadge({ step }: { step: AgentTraceStep }) {
  if (step.type === "tool_call") return <span className="pill text-brand-700">tool call</span>;
  if (step.type === "tool_result") return <span className="pill text-sky-700">tool result</span>;
  return <span className="pill text-emerald-700">final answer</span>;
}

/** Each tool gets its own richer visual, parsed from its plain-text output,
 * so it's immediately obvious what's real and where it came from, rather
 * than that being buried in a sentence. Falls back to the original plain
 * text whenever a tool's output doesn't match its expected shape (an error
 * message, for instance), so a parse miss never hides real information. */
function ToolResult({ toolName, output }: { toolName?: string; output?: string }) {
  if (!output) return null;

  if (toolName === "get_weather" && parseWeatherOutput(output)) {
    return <WeatherCard output={output} />;
  }
  if (toolName === "calculator" && parseCalculatorOutput(output)) {
    return <CalculatorCard output={output} />;
  }
  if (toolName === "search_knowledge_base" && parseKnowledgeBaseOutput(output) !== null) {
    return <KnowledgeBaseResults output={output} />;
  }

  return (
    <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-paper-ink/70">{output}</p>
  );
}

export function AgentTrace({ trace }: { trace: AgentTraceStep[] }) {
  return (
    <ol className="space-y-4">
      {trace.map((step, i) => (
        <li key={i} className="border-l-2 border-paper-ink/15 pl-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-xs font-bold text-paper-ink/40">{i + 1}.</span>
            <StepBadge step={step} />
            {step.toolName && (
              <span className="font-mono text-xs text-paper-ink/50">{step.toolName}</span>
            )}
          </div>

          {step.type === "tool_call" && (
            <pre className="overflow-x-auto rounded-sm border border-paper-ink/10 bg-paper-ink/[0.04] p-3 font-mono text-xs text-paper-ink/70">
              {JSON.stringify(step.input, null, 2)}
            </pre>
          )}

          {step.type === "tool_result" && <ToolResult toolName={step.toolName} output={step.output} />}

          {step.type === "final" && (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-paper-ink/90">
              {step.text}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
