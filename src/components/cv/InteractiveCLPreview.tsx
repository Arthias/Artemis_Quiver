import { useCallback } from "react";
import type { CLContent } from "../../types/cl";
import { Plus, X } from "lucide-react";
import type { CVTheme } from "./cvThemes";
import { InlineInput, InlineTextarea } from "./InlineEdit";

interface InteractiveCLPreviewProps {
  content: CLContent;
  onContentChange: (content: CLContent) => void;
  theme: CVTheme;
}

export function InteractiveCLPreview({ content, onContentChange, theme }: InteractiveCLPreviewProps) {

  const updateField = useCallback(<K extends keyof CLContent>(field: K, value: CLContent[K]) => {
    onContentChange({ ...content, [field]: value });
  }, [content, onContentChange]);

  const updateParagraph = useCallback((idx: number, value: string) => {
    const next = [...content.bodyParagraphs];
    next[idx] = value;
    onContentChange({ ...content, bodyParagraphs: next });
  }, [content, onContentChange]);

  const addParagraph = useCallback(() => {
    onContentChange({ ...content, bodyParagraphs: [...content.bodyParagraphs, ""] });
  }, [content, onContentChange]);

  const removeParagraph = useCallback((idx: number) => {
    onContentChange({
      ...content,
      bodyParagraphs: content.bodyParagraphs.filter((_, i) => i !== idx),
    });
  }, [content, onContentChange]);

  const removeSenderHeader = useCallback(() => {
    onContentChange({
      ...content,
      senderName: "",
      senderTitle: undefined,
      date: undefined,
    });
  }, [content, onContentChange]);

  return (
    <div className="cl-preview-card rounded-lg border border-gray-200 shadow-sm max-w-3xl mx-auto" style={{ fontFamily: theme.fontFamily, background: theme.container.background, ...theme.card }}>
      <div className="p-8 md:p-10">
        {/* Sender header: a letterhead, not a CV headline */}
        {content.senderName && (
          <div className="mb-8 group relative">
            <InlineInput
              value={content.senderName}
              onSave={v => updateField("senderName", v)}
              className="block w-fit" placeholder="Your Name"
              style={{ ...theme.name, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "normal" }}
            />
            {content.senderTitle && (
              <InlineInput
                value={content.senderTitle}
                onSave={v => updateField("senderTitle", v)}
                className="block w-fit text-sm" placeholder="Job Title"
                style={theme.muted}
              />
            )}
            {content.date && (
              <p className="mt-4 text-sm" style={theme.muted}>{content.date}</p>
            )}
            <button
              onClick={removeSenderHeader}
              className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 p-1 bg-white border border-gray-200 rounded shadow-sm text-red-400 hover:text-red-600 transition-all"
              title="Remove sender header"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Salutation */}
        <InlineInput
          value={content.salutation}
          onSave={v => updateField("salutation", v)}
          className="text-sm"
          placeholder="Dear Hiring Manager,"
          style={{ color: theme.body.color }}
        />

        {/* Body paragraphs */}
        <div className="mt-4 space-y-4" style={theme.body}>
          {content.bodyParagraphs.map((p, idx) => (
            <div key={idx} className="group relative">
              <InlineTextarea
                value={p}
                onSave={v => updateParagraph(idx, v)}
              />
              <button
                onClick={() => removeParagraph(idx)}
                className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 p-1 bg-white border border-gray-200 rounded shadow-sm text-red-400 hover:text-red-600 transition-all"
                title="Remove paragraph"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={addParagraph}
            className="cl-add-paragraph inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: theme.title.color }}
          >
            <Plus className="w-3.5 h-3.5" /> Add paragraph
          </button>
        </div>

        {/* Closing */}
        <div className="mt-6 space-y-1">
          <InlineInput
            value={content.closing}
            onSave={v => updateField("closing", v)}
            className="text-sm"
            placeholder="Sincerely,"
            style={{ color: theme.body.color }}
          />
          {content.senderName && <p className="text-sm font-semibold" style={{ color: theme.name.color }}>{content.senderName}</p>}
        </div>
      </div>
    </div>
  );
}
