/**
 * A richer visual for the agent's get_weather tool result, specifically so
 * it's immediately obvious (not just stated in a sentence) that this number
 * came from a live external API call, the same "LIVE" pill vocabulary
 * already used elsewhere in this app for a real Anthropic call. Parses the
 * exact sentence shape mcp-server/src/index.ts's getWeather() returns;
 * both sides of that contract live in this same codebase, so the coupling
 * is deliberate, not fragile. Renders nothing if the text doesn't match
 * (an error message, for instance), letting the caller fall back to plain
 * text instead of showing a broken card.
 */

const WEATHER_PATTERN = /^(.+?): (-?[\d.]+)°F \(feels like (-?[\d.]+)°F\), (.+?), (\d+)% humidity\./;

interface ParsedWeather {
  location: string;
  tempF: number;
  feelsLikeF: number;
  condition: string;
  humidity: number;
}

export function parseWeatherOutput(output: string): ParsedWeather | null {
  const match = output.match(WEATHER_PATTERN);
  if (!match) return null;
  return {
    location: match[1],
    tempF: Number(match[2]),
    feelsLikeF: Number(match[3]),
    condition: match[4],
    humidity: Number(match[5]),
  };
}

function weatherEmoji(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("thunder") || c.includes("storm")) return "⛈️";
  if (c.includes("snow") || c.includes("sleet") || c.includes("ice")) return "❄️";
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return "🌧️";
  if (c.includes("fog") || c.includes("mist") || c.includes("haze")) return "🌫️";
  if (c.includes("overcast") || c.includes("cloud")) return "☁️";
  if (c.includes("clear") || c.includes("sunny")) return "☀️";
  return "🌡️";
}

export function WeatherCard({ output }: { output: string }) {
  const parsed = parseWeatherOutput(output);
  if (!parsed) return null;

  return (
    <div className="flex items-center gap-4 rounded-sm border border-brand-500/25 bg-brand-500/[0.05] px-4 py-3">
      <span className="text-4xl leading-none" aria-hidden="true">
        {weatherEmoji(parsed.condition)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-display text-sm font-semibold text-paper-ink">{parsed.location}</span>
          <span className="pill shrink-0 text-emerald-700">LIVE · WeatherAPI.com</span>
        </div>
        <p className="mt-1 text-2xl font-semibold text-paper-ink">
          {parsed.tempF}°F{" "}
          <span className="text-sm font-normal text-paper-ink/60">
            feels like {parsed.feelsLikeF}°F
          </span>
        </p>
        <p className="text-sm text-paper-ink/70">
          {parsed.condition} · {parsed.humidity}% humidity
        </p>
      </div>
    </div>
  );
}
