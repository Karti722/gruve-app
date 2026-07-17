export function Analogy({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-brand-500/50 bg-paper-ink/[0.035] py-3 pl-5 pr-4 text-[15.5px] italic leading-[1.85] text-paper-ink/80">
      <span className="mb-1 block font-display text-xs font-bold not-italic uppercase tracking-[0.2em] text-brand-600">
        Analogy
      </span>
      {children}
    </div>
  );
}
