export function CaseStudy({ company, children }: { company: string; children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-emerald-700/50 bg-paper-ink/[0.035] py-3 pl-5 pr-4">
      <span className="mb-1.5 block font-display text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">
        Real-World Example — {company}
      </span>
      <div className="space-y-2 text-[15.5px] leading-[1.85] text-paper-ink/80">{children}</div>
    </div>
  );
}
