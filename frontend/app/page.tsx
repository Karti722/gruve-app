import Link from "next/link";

const CHAPTERS = [
  {
    number: "Chapter 1",
    href: "/tokenizer",
    title: "Tokenization and the Cost of a Request",
    description: "The exact token count Claude actually bills for, and what that costs to call.",
    part: "Part I — Foundations",
  },
  {
    number: "Chapter 2",
    href: "/chat",
    title: "Large Language Models",
    description: "How a model turns a prompt into a reply, one token at a time.",
    part: "Part I — Foundations",
  },
  {
    number: "Chapter 3",
    href: "/rag",
    title: "Retrieval-Augmented Generation",
    description: "Teaching an AI to look things up before it answers.",
    part: "Part I — Foundations",
  },
  {
    number: "Chapter 4",
    href: "/agent",
    title: "AI Agents and Tool Use",
    description: "Watching an AI decide, act and use outside tools on its own.",
    part: "Part II — Applied Techniques",
  },
  {
    number: "Chapter 5",
    href: "/summarize",
    title: "Automatic Text Summarization",
    description: "Ranking a document's own sentences to condense it, without inventing a word.",
    part: "Part II — Applied Techniques",
  },
  {
    number: "Chapter 6",
    href: "/cache",
    title: "Semantic Caching",
    description: "Skipping a model call entirely when a new question means the same thing as an old one.",
    part: "Part II — Applied Techniques",
  },
  {
    number: "Chapter 7",
    href: "/eval",
    title: "Evaluating AI Outputs",
    description: "Scoring an answer against a reference instead of just eyeballing it.",
    part: "Part II — Applied Techniques",
  },
  {
    number: "Chapter 8",
    href: "/enterprise",
    title: "These Concepts in the Real World",
    description: "Real companies, real numbers: how this stuff is actually used at scale.",
    part: "Part III — Beyond the Model",
  },
  {
    number: "Chapter 9",
    href: "/architecture",
    title: "The System Behind This Tutorial",
    description: "A behind-the-scenes tour of the system running these chapters.",
    part: "Part III — Beyond the Model",
  },
  {
    number: "Chapter 10",
    href: "/building",
    title: "How This Tutorial Was Built",
    description: "The story of how an AI coding assistant and a person built this, together.",
    part: "Part III — Beyond the Model",
  },
];

export default function HomePage() {
  return (
    <div className="relative mx-auto max-w-3xl overflow-hidden rounded-sm bg-paper px-5 py-10 text-center font-serif text-paper-ink shadow-[0_20px_45px_-25px_rgba(43,38,32,0.35)] sm:px-16 sm:py-20">
      <div
        className="pointer-events-none absolute right-0 top-0 h-11 w-11 bg-paper-dark"
        style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
        aria-hidden
      />

      <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-brand-600 sm:tracking-[0.35em]">
        An Interactive Tutorial
      </p>

      <h1 className="mt-4 font-display text-4xl font-black leading-none tracking-tight text-paper-ink sm:text-6xl md:text-8xl">
        AI Nexus
      </h1>

      <p className="mt-3 font-display text-sm italic text-paper-ink/50 sm:text-base">
        by{" "}
        <a
          href="https://kartikeyakumaria.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-paper-ink/70 underline decoration-paper-ink/25 underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500"
        >
          Kartikeya Kumaria
        </a>
      </p>

      <p className="mx-auto mt-6 max-w-xl text-base italic leading-relaxed text-paper-ink/70 sm:text-lg">
        A hands-on introduction to large language models, retrieval and AI agents: learn how
        modern AI actually works by using it yourself, no experience required.
      </p>

      <div className="mx-auto mt-10 h-px w-24 bg-paper-ink/20" />

      <div className="mt-10 text-left">
        <div className="flex items-center justify-center gap-4">
          <span className="h-px flex-1 max-w-16 bg-paper-ink/20" aria-hidden />
          <h2 className="shrink-0 font-display text-sm font-bold uppercase tracking-[0.3em] text-paper-ink/50">
            Table of Contents
          </h2>
          <span className="h-px flex-1 max-w-16 bg-paper-ink/20" aria-hidden />
        </div>

        <Link
          href="/introduction"
          className="group mt-6 flex items-baseline gap-3 border-b border-paper-ink/10 py-3 transition hover:border-brand-500/40"
        >
          <span className="shrink-0 font-display text-sm font-semibold italic text-paper-ink transition group-hover:text-brand-700">
            Introduction: Why This Guide Exists
          </span>
        </Link>

        <ol className="mt-1 space-y-1">
          {CHAPTERS.map((chapter, index) => (
            <li key={chapter.href}>
              {chapter.part !== CHAPTERS[index - 1]?.part && (
                <div className="mb-1 mt-8 flex items-baseline gap-3 first:mt-6">
                  <span className="shrink-0 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-brand-600/70">
                    {chapter.part}
                  </span>
                  <span className="h-px flex-1 bg-paper-ink/10" aria-hidden />
                </div>
              )}
              <div className="group flex items-start gap-4 sm:gap-6">
                <span
                  className="hidden shrink-0 pt-2 font-display text-4xl font-black leading-none text-paper-ink/10 transition group-hover:text-brand-500/25 sm:block sm:text-5xl"
                  aria-hidden
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={chapter.href}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-paper-ink/10 py-4 transition group-hover:border-brand-500/40"
                  >
                    <span className="shrink-0 font-display text-xs font-bold uppercase tracking-widest text-brand-600 transition group-hover:text-brand-800">
                      {chapter.number}
                    </span>
                    <span className="font-display text-lg font-semibold text-paper-ink transition group-hover:text-brand-700 sm:text-xl">
                      {chapter.title}
                    </span>
                  </Link>
                  <p className="pt-1 text-sm text-paper-ink/50 transition group-hover:text-paper-ink/70">
                    {chapter.description}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <Link
          href="/glossary"
          className="group mt-3 flex items-baseline gap-3 py-2 transition"
        >
          <span className="shrink-0 font-display text-sm italic text-paper-ink/60 transition group-hover:text-brand-700">
            Glossary of Key Terms
          </span>
        </Link>
      </div>

      <div className="mt-14 flex items-center justify-between border-t border-paper-ink/15 pt-3 font-display text-xs uppercase tracking-widest text-paper-ink/40">
        <span>AI Nexus: An Interactive Tutorial</span>
        <span>Page i</span>
      </div>

      <div className="mt-4 flex items-start justify-end gap-4 font-display text-xs uppercase tracking-wide">
        <Link
          href="/introduction"
          className="group flex max-w-[45%] items-baseline gap-1.5 text-right text-paper-ink/60 transition hover:text-brand-700"
        >
          <span className="truncate normal-case tracking-normal text-paper-ink/80 underline decoration-paper-ink/25 decoration-dotted underline-offset-4 transition group-hover:text-brand-700 group-hover:decoration-brand-500">
            Introduction: Why This Guide Exists
          </span>
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
