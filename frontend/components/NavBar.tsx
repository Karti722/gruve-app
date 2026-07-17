"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Contents" },
  { href: "/chat", label: "LLM Chat", chapter: "Ch. 1" },
  { href: "/rag", label: "RAG", chapter: "Ch. 2" },
  { href: "/agent", label: "AI Agent + MCP", chapter: "Ch. 3" },
  { href: "/enterprise", label: "Enterprise Use", chapter: "Ch. 4" },
  { href: "/architecture", label: "Architecture", chapter: "Ch. 5" },
  { href: "/building", label: "How This Was Built", chapter: "Ch. 6" },
  { href: "/glossary", label: "Glossary" },
];

export function NavBar() {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function updateScrollState() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, []);

  // Close the mobile menu automatically whenever navigation completes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function scrollBy(amount: number) {
    scrollerRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-paper-ink/10 bg-[#efe8d8]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-base font-bold tracking-tight text-paper-ink sm:text-lg"
        >
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
          AI Nexus
        </Link>

        {/* Tablet and up: a horizontal, scrollable chapter strip */}
        <div className="relative hidden min-w-0 flex-1 items-center md:flex">
          {canScrollLeft && (
            <>
              <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-[#efe8d8] to-transparent" />
              <button
                type="button"
                aria-label="Scroll chapters left"
                onClick={() => scrollBy(-200)}
                className="relative z-20 shrink-0 px-1 text-paper-ink/50 hover:text-paper-ink"
              >
                ‹
              </button>
            </>
          )}

          <nav
            ref={scrollerRef}
            onScroll={updateScrollState}
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 whitespace-nowrap rounded-sm px-3 py-2 text-sm transition ${
                    active
                      ? "bg-paper-ink/10 text-paper-ink"
                      : "text-paper-ink/60 hover:bg-paper-ink/5 hover:text-paper-ink"
                  }`}
                >
                  {link.chapter && (
                    <span className="mr-1.5 font-display text-[11px] uppercase tracking-wide text-brand-600">
                      {link.chapter}
                    </span>
                  )}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {canScrollRight && (
            <>
              <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-[#efe8d8] to-transparent" />
              <button
                type="button"
                aria-label="Scroll chapters right"
                onClick={() => scrollBy(200)}
                className="relative z-20 shrink-0 px-1 text-paper-ink/50 hover:text-paper-ink"
              >
                ›
              </button>
            </>
          )}
        </div>

        {/* Below tablet width: a hamburger toggle instead of the strip */}
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="ml-auto flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-1.5 rounded-sm border border-paper-ink/15 md:hidden"
        >
          <span
            className={`block h-px w-5 bg-paper-ink transition ${menuOpen ? "translate-y-[6px] rotate-45" : ""}`}
          />
          <span className={`block h-px w-5 bg-paper-ink transition ${menuOpen ? "opacity-0" : ""}`} />
          <span
            className={`block h-px w-5 bg-paper-ink transition ${menuOpen ? "-translate-y-[6px] -rotate-45" : ""}`}
          />
        </button>
      </div>

      {menuOpen && (
        <nav className="border-t border-paper-ink/10 bg-[#efe8d8] px-4 pb-2 md:hidden">
          <ul className="divide-y divide-paper-ink/10">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center gap-2 py-3 text-base transition ${
                      active ? "font-semibold text-brand-700" : "text-paper-ink/80 hover:text-paper-ink"
                    }`}
                  >
                    {link.chapter && (
                      <span className="shrink-0 font-display text-xs font-bold uppercase tracking-wide text-brand-600">
                        {link.chapter}
                      </span>
                    )}
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
