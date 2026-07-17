export function ArchitectureDiagram() {
  return (
    <figure className="my-2">
      <div className="rounded-sm border border-paper-ink/15 bg-paper-ink/[0.02] p-4 sm:p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-sm border border-paper-ink/30 bg-white px-4 py-2 font-display text-xs font-semibold text-paper-ink">
            Browser (the interface)
          </div>
          <span className="font-display text-[11px] uppercase tracking-wide text-paper-ink/40">
            ↓ sends requests over the web ↓
          </span>
          <div className="rounded-sm border border-paper-ink/30 bg-white px-4 py-2 font-display text-xs font-semibold text-paper-ink">
            API server (the orchestrator)
          </div>
          <span className="font-display text-[11px] uppercase tracking-wide text-paper-ink/40">
            ↓ reaches out to, as needed ↓
          </span>
          <div className="flex flex-wrap justify-center gap-3">
            <div className="rounded-sm border border-paper-ink/25 bg-white px-3 py-2 font-display text-[11px] text-paper-ink/80">
              AI model
            </div>
            <div className="rounded-sm border border-paper-ink/25 bg-white px-3 py-2 font-display text-[11px] text-paper-ink/80">
              Vector database
            </div>
            <div className="rounded-sm border border-paper-ink/25 bg-white px-3 py-2 font-display text-[11px] text-paper-ink/80">
              Embedding service
            </div>
            <div className="rounded-sm border border-paper-ink/25 bg-white px-3 py-2 font-display text-[11px] text-paper-ink/80">
              Tool server
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs italic text-paper-ink/50">
        Figure 5.1: A request's path through the system. The browser only ever talks to the API
        server; the API server is the single point that reaches out to everything else.
      </figcaption>
    </figure>
  );
}
