"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Contents" },
  { href: "/chat", label: "LLM Chat", chapter: "Ch. 1" },
  { href: "/rag", label: "RAG", chapter: "Ch. 2" },
  { href: "/agent", label: "AI Agent + MCP", chapter: "Ch. 3" },
  { href: "/enterprise", label: "Enterprise Use", chapter: "Ch. 4" },
  { href: "/architecture", label: "Architecture", chapter: "Ch. 5" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-paper-ink/10 bg-[#efe8d8]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-paper-ink"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />
          AI Nexus
        </Link>
        <nav className="flex flex-wrap justify-end gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-sm px-3 py-2 text-sm transition ${
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
      </div>
    </header>
  );
}
