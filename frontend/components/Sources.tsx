interface SourceItem {
  label: string;
  href: string;
}

export function Sources({ items }: { items: SourceItem[] }) {
  return (
    <div className="mt-2 border-t border-paper-ink/10 pt-5">
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/40">
        Sources &amp; Further Reading
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper-ink/70 underline decoration-paper-ink/25 underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
