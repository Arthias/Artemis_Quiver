import type { ExperienceVariantProps } from "./types";

export function ExperienceClassic({ item, theme }: ExperienceVariantProps) {
  const bullets = item.bullets ?? [];
  return (
    <div className="flex justify-between items-start mb-1">
      <div>
        <h3 className="font-semibold text-sm" style={{ color: theme.name.color }}>{item.role || "Untitled Role"}</h3>
        <p className="text-sm" style={theme.muted}>
          {item.company && <span className="font-medium" style={{ color: theme.body.color }}>{item.company}</span>}
          {item.location && <span> &mdash; {item.location}</span>}
        </p>
        {bullets.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {bullets.map((b, i) => (
              <li key={i} className="text-sm leading-relaxed pl-4 relative before:content-['•'] before:absolute before:left-1" style={theme.body}>{b}</li>
            ))}
          </ul>
        )}
        {item.description && !bullets.length && (
          <p className="text-sm mt-1 leading-relaxed" style={theme.body}>{item.description}</p>
        )}
      </div>
      {item.period && (
        <span className="text-xs whitespace-nowrap ml-2" style={theme.muted}>{item.period}</span>
      )}
    </div>
  );
}

export function ExperienceCards({ item, theme }: ExperienceVariantProps) {
  const bullets = item.bullets ?? [];
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between">
        <h3 className="text-sm font-bold" style={{ color: theme.name.color }}>
          {item.role || "Untitled Role"}
          {item.company && <span style={theme.muted}> <span className="font-normal">|</span> {item.company}</span>}
        </h3>
        <span className="text-xs font-semibold sm:text-right shrink-0 ml-2" style={{ color: theme.title.color }}>
          {item.period || ""}
          {item.location && <span style={theme.muted} className="font-normal"> | {item.location}</span>}
        </span>
      </div>
      {bullets.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs leading-relaxed list-disc list-outside ml-4" style={theme.body}>
          {bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
      {item.description && !bullets.length && (
        <p className="mt-2 text-xs leading-relaxed" style={theme.body}>{item.description}</p>
      )}
    </div>
  );
}

export function ExperienceTimeline({ item, theme }: ExperienceVariantProps) {
  const bullets = item.bullets ?? [];
  return (
    <div className="relative pl-4" style={{ borderLeft: `2px solid ${theme.title.color ?? "#2563eb"}` }}>
      <span
        className="absolute -left-[5px] top-1 w-2 h-2 rounded-full"
        style={{ background: theme.title.color ?? "#2563eb" }}
      />
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between">
        <h3 className="text-sm font-semibold" style={{ color: theme.name.color }}>{item.role || "Untitled Role"}</h3>
        <span className="text-xs shrink-0 ml-2" style={{ color: theme.title.color }}>{item.period || ""}</span>
      </div>
      <p className="text-sm" style={theme.muted}>
        {item.company}
        {item.location && <span> &mdash; {item.location}</span>}
      </p>
      {bullets.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-sm list-disc list-outside ml-4" style={theme.body}>
          {bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
      {item.description && !bullets.length && (
        <p className="text-sm mt-1 leading-relaxed" style={theme.body}>{item.description}</p>
      )}
    </div>
  );
}
