import { InlineTextarea } from "../InlineEdit";
import type { SummaryVariantProps } from "./types";

export function SummaryParagraph({ content, theme, onSave }: SummaryVariantProps) {
  return <InlineTextarea value={content} onSave={onSave} style={theme.body} />;
}

export function SummaryCallout({ content, theme, onSave }: SummaryVariantProps) {
  return (
    <div
      className="rounded-md pl-4 py-1"
      style={{ borderLeft: `3px solid ${theme.title.color ?? "#2563eb"}`, background: theme.tag.background }}
    >
      <InlineTextarea value={content} onSave={onSave} style={{ ...theme.body, fontStyle: "italic" }} />
    </div>
  );
}
