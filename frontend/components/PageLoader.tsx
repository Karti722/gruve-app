/**
 * Shown automatically by Next.js while a route segment is loading or being
 * navigated to (see the sibling loading.tsx files). A circular spinner with
 * a printer's-ornament glyph at its center, styled to match the rest of the
 * book, not a generic app spinner.
 */
export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-paper-ink/15 border-t-brand-500" />
        <span aria-hidden className="font-display text-xl text-brand-600">
          ❦
        </span>
      </div>
      <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-paper-ink/40">
        Turning the page…
      </p>
    </div>
  );
}
