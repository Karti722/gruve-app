import Link from "next/link";

const CHAPTERS = [
  {
    number: "Chapter 1",
    href: "/chat",
    title: "Large Language Models",
    description: "How a model turns a prompt into a reply, one token at a time.",
  },
  {
    number: "Chapter 2",
    href: "/rag",
    title: "Retrieval-Augmented Generation",
    description: "Teaching an AI to look things up before it answers.",
  },
  {
    number: "Chapter 3",
    href: "/agent",
    title: "AI Agents and Tool Use",
    description: "Watching an AI decide, act, and use outside tools on its own.",
  },
];

export default function HomePage() {
  return (
    <div className="relative mx-auto max-w-3xl overflow-hidden rounded-sm bg-paper px-8 py-14 text-center font-serif text-paper-ink shadow-[0_20px_45px_-25px_rgba(43,38,32,0.35)] sm:px-16 sm:py-20">
      <div
        className="pointer-events-none absolute right-0 top-0 h-11 w-11 bg-paper-dark"
        style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
        aria-hidden
      />

      <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-brand-600">
        An Interactive Tutorial
      </p>

      <h1 className="mt-4 font-display text-6xl font-black leading-none tracking-tight text-paper-ink sm:text-8xl">
        AI Nexus
      </h1>

      <p className="mx-auto mt-6 max-w-xl text-lg italic leading-relaxed text-paper-ink/70">
        A hands-on introduction to large language models, retrieval, and AI agents — learn how
        modern AI actually works by using it yourself, no experience required.
      </p>

      <div className="mx-auto mt-10 h-px w-24 bg-paper-ink/20" />

      <div className="mt-10 text-left">
        <h2 className="text-center font-display text-sm font-bold uppercase tracking-[0.3em] text-paper-ink/50">
          Table of Contents
        </h2>

        <ol className="mt-8 space-y-1">
          {CHAPTERS.map((chapter) => (
            <li key={chapter.href}>
              <Link
                href={chapter.href}
                className="group flex items-baseline gap-3 border-b border-paper-ink/10 py-4 transition hover:border-brand-500/40"
              >
                <span className="shrink-0 font-display text-xs font-bold uppercase tracking-widest text-brand-600">
                  {chapter.number}
                </span>
                <span className="shrink-0 font-display text-xl font-semibold text-paper-ink transition group-hover:text-brand-700">
                  {chapter.title}
                </span>
                <span
                  className="mx-1 flex-1 translate-y-[-2px] border-b border-dotted border-paper-ink/30"
                  aria-hidden
                />
                <span className="shrink-0 font-display text-sm text-paper-ink/40 transition group-hover:text-brand-600">
                  {chapter.href}
                </span>
              </Link>
              <p className="pl-0 pt-1 text-sm text-paper-ink/50 sm:pl-[6.5rem]">
                {chapter.description}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-14 flex items-center justify-between border-t border-paper-ink/15 pt-3 font-display text-xs uppercase tracking-widest text-paper-ink/40">
        <span>AI Nexus — An Interactive Tutorial</span>
        <span>Page i</span>
      </div>
    </div>
  );
}
