import Link from "next/link";

interface AdjacentPage {
  href: string;
  label: string;
}

interface TextbookPageProps {
  eyebrow: string;
  title: string;
  pageNumber: string;
  children: React.ReactNode;
  prevPage?: AdjacentPage;
  nextPage?: AdjacentPage;
}

/**
 * Renders content styled like an open page of a printed textbook: warm
 * paper tone, serif type, a chapter eyebrow, a folded top corner and a
 * running footer with a page number. `prevPage`/`nextPage` are each
 * optional independently: the Introduction has no previous page, the
 * Glossary has no next page, and both render normally either way.
 */
export function TextbookPage({
  eyebrow,
  title,
  pageNumber,
  children,
  prevPage,
  nextPage,
}: TextbookPageProps) {
  return (
    <div className="relative mx-auto max-w-3xl rounded-sm bg-paper px-5 py-7 font-serif text-paper-ink shadow-[0_20px_45px_-25px_rgba(43,38,32,0.35)] sm:px-14 sm:py-14">
      <div
        className="pointer-events-none absolute right-0 top-0 h-7 w-7 bg-paper-dark sm:h-9 sm:w-9"
        style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-12 hidden w-px bg-paper-ink/10 sm:block"
        aria-hidden
      />

      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-brand-600 sm:tracking-[0.25em]">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-paper-ink sm:text-4xl">
        {title}
      </h1>

      <div className="mt-7 space-y-5 text-[16px] leading-[1.85] text-paper-ink/85">{children}</div>

      <div className="mt-10 flex items-center justify-between border-t border-paper-ink/15 pt-3 font-display text-xs uppercase tracking-widest text-paper-ink/40">
        <span>AI Nexus: An Interactive Tutorial</span>
        <span>{pageNumber}</span>
      </div>

      {(prevPage || nextPage) && (
        <div className="mt-4 flex items-start justify-between gap-4 font-display text-xs uppercase tracking-wide">
          {prevPage ? (
            <Link
              href={prevPage.href}
              className="group flex max-w-[45%] items-baseline gap-1.5 text-paper-ink/60 transition hover:text-brand-700"
            >
              <span aria-hidden>&larr;</span>
              <span className="truncate normal-case tracking-normal text-paper-ink/80 underline decoration-paper-ink/25 decoration-dotted underline-offset-4 transition group-hover:text-brand-700 group-hover:decoration-brand-500">
                {prevPage.label}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {nextPage ? (
            <Link
              href={nextPage.href}
              className="group flex max-w-[45%] items-baseline gap-1.5 text-right text-paper-ink/60 transition hover:text-brand-700"
            >
              <span className="truncate normal-case tracking-normal text-paper-ink/80 underline decoration-paper-ink/25 decoration-dotted underline-offset-4 transition group-hover:text-brand-700 group-hover:decoration-brand-500">
                {nextPage.label}
              </span>
              <span aria-hidden>&rarr;</span>
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
