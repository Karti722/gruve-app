interface ConceptCardProps {
  title: string;
  description: string;
  tags: string[];
}

export function ConceptCard({ title, description, tags }: ConceptCardProps) {
  return (
    <div className="card">
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mb-4 text-sm leading-relaxed text-white/70">{description}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="pill">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
