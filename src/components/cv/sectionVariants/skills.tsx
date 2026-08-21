import type { SkillsVariantProps } from "./types";

export function SkillsTags({ skills, theme }: SkillsVariantProps) {
  const cats = skills.categories;
  if (cats && cats.length > 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 print-grid-2 gap-4 text-sm">
        {cats.map((cat, i) => (
          <div key={i}>
            <h3 className="font-semibold text-xs uppercase tracking-wide mb-1.5" style={{ color: theme.sectionTitle.color }}>{cat.name}</h3>
            <div className="flex flex-wrap gap-1.5">
              {cat.items.map((item, j) => (
                <span key={j} className="inline-block px-2 py-0.5 rounded text-xs" style={theme.tag}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (skills.skills && skills.skills.length > 0) {
    return (
      <div className="flex flex-wrap gap-2">
        {skills.skills.map((s, i) => (
          <span key={i} className="inline-block text-sm px-2.5 py-1 rounded" style={theme.tag}>{s}</span>
        ))}
      </div>
    );
  }
  return <p className="text-sm italic" style={theme.muted}>No skills listed</p>;
}

export function SkillsColumns({ skills, theme }: SkillsVariantProps) {
  const cats = skills.categories;
  if (cats && cats.length > 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 print-grid-2 gap-3 text-xs">
        {cats.map((cat, i) => (
          <div key={i} className="p-3 rounded-lg border" style={{ background: theme.tag.background, borderColor: String(theme.divider.borderTop ?? "#e2e8f0").split(" ").pop() }}>
            <h3 className="font-bold mb-1" style={{ color: theme.sectionTitle.color }}>{cat.name}</h3>
            <p style={theme.body} className="leading-snug">{cat.items.join(", ")}</p>
          </div>
        ))}
      </div>
    );
  }
  if (skills.skills && skills.skills.length > 0) {
    return (
      <div className="p-3 rounded-lg border text-xs" style={{ background: theme.tag.background, borderColor: String(theme.divider.borderTop ?? "#e2e8f0").split(" ").pop() }}>
        <p style={theme.body} className="leading-snug">{skills.skills.join(", ")}</p>
      </div>
    );
  }
  return <p className="text-sm italic" style={theme.muted}>No skills listed</p>;
}

export function SkillsInline({ skills, theme }: SkillsVariantProps) {
  const cats = skills.categories;
  if (cats && cats.length > 0) {
    return (
      <div className="space-y-1 text-sm" style={theme.body}>
        {cats.map((cat, i) => (
          <p key={i}><strong style={{ color: theme.sectionTitle.color }}>{cat.name}:</strong> {cat.items.join(", ")}</p>
        ))}
      </div>
    );
  }
  if (skills.skills && skills.skills.length > 0) {
    return <p className="text-sm" style={theme.body}>{skills.skills.join(" · ")}</p>;
  }
  return <p className="text-sm italic" style={theme.muted}>No skills listed</p>;
}
