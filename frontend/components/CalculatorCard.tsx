/**
 * A richer visual for the agent's calculator tool result, parallel to
 * WeatherCard: makes it visually obvious this is a real, exact evaluation
 * (backend/src/agent/tools.ts's hand-written recursive-descent evaluator,
 * no eval()/Function()) rather than the model estimating an answer.
 * Deliberately labeled "EXACT", not "LIVE": unlike the weather tool, this
 * never calls an external API, so claiming "live" data here would be
 * inaccurate rather than just unnecessary.
 */

const CALCULATOR_PATTERN = /^(.+?) = (-?[\d.]+)$/;

interface ParsedCalculation {
  expression: string;
  result: string;
}

export function parseCalculatorOutput(output: string): ParsedCalculation | null {
  const match = output.match(CALCULATOR_PATTERN);
  if (!match) return null;
  return { expression: match[1], result: match[2] };
}

export function CalculatorCard({ output }: { output: string }) {
  const parsed = parseCalculatorOutput(output);
  if (!parsed) return null;

  return (
    <div className="flex items-center gap-4 rounded-sm border border-brand-500/25 bg-brand-500/[0.05] px-4 py-3">
      <span className="text-4xl leading-none" aria-hidden="true">
        🧮
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-display text-xs uppercase tracking-wide text-paper-ink/50">
            Exact arithmetic
          </span>
          <span className="pill shrink-0 text-brand-700">EXACT · Local calculator</span>
        </div>
        <p className="mt-1 font-mono text-xl font-semibold text-paper-ink">
          {parsed.expression} = <span className="text-brand-700">{parsed.result}</span>
        </p>
      </div>
    </div>
  );
}
