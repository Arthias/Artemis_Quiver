import type { EducationVariantProps } from "./types";

export function EducationClassic({ item, theme }: EducationVariantProps) {
  return (
    <div className="flex justify-between items-start">
      <div>
        <p className="font-semibold text-sm" style={{ color: theme.name.color }}>{item.degree}</p>
        <p className="text-sm" style={theme.muted}>{item.institution}{item.location ? `, ${item.location}` : ""}</p>
      </div>
      {item.period && <span className="text-xs whitespace-nowrap ml-2" style={theme.muted}>{item.period}</span>}
    </div>
  );
}

export function EducationCards({ item, theme }: EducationVariantProps) {
  return (
    <div>
      <p className="font-semibold" style={{ color: theme.name.color }}>{item.degree}</p>
      <p style={theme.muted}>
        {item.institution}
        {item.location ? `, ${item.location}` : ""}
        {item.period && <span> <span className="mx-1">•</span> {item.period}</span>}
      </p>
    </div>
  );
}
