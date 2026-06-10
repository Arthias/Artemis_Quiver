import { useState, useCallback } from "react";
import type { CLContent } from "../../types/cl";
import { Plus, X, Check } from "lucide-react";
import { getCVTheme, type CVTheme } from "./cvThemes";
import { InlineInput, InlineTextarea } from "./InlineEdit";

interface InteractiveCLPreviewProps {
  content: CLContent;
  onContentChange: (content: CLContent) => void;
  accentColor?: string;
  templateId?: string;
}

function CLThemeDivider({ theme }: { theme: CVTheme }) {
  return <hr style={theme.divider} />;
}

export function InteractiveCLPreview({ content, onContentChange, accentColor = "#2563eb", templateId = "modern" }: InteractiveCLPreviewProps) {
  const theme: CVTheme = getCVTheme(templateId, accentColor);

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

  return (
    <div className="rounded-lg border border-gray-200 shadow-sm max-w-3xl mx-auto" style={{ fontFamily: theme.fontFamily, background: theme.container.background, ...theme.card }}>
      <div className="p-8 md:p-10">
        {/* Sender header */}
        <div className="mb-6">
          <InlineInput
            value={content.senderName}
            onSave={v => updateField("senderName", v)}
            className="" placeholder="Your Name"
            style={theme.name}
          />
          {content.senderTitle && (
            <InlineInput
              value={content.senderTitle}
              onSave={v => updateField("senderTitle", v)}
              className="" placeholder="Job Title"
              style={theme.title}
            />
          )}
          {content.date && (
            <p className="mt-1" style={theme.muted}>{content.date}</p>
          )}
        </div>

        <CLThemeDivider theme={theme} />

        {/* Recipient info */}
        {(content.recipientName || content.companyName) && (
          <div className="mb-4 space-y-0.5" style={theme.muted}>
            {content.recipientName && (
              <InlineInput value={content.recipientName} onSave={v => updateField("recipientName", v)} placeholder="Hiring Manager" />
            )}
            {content.companyName && (
              <InlineInput value={content.companyName} onSave={v => updateField("companyName", v)} placeholder="Company Name" />
            )}
            {content.companyLocation && (
              <InlineInput value={content.companyLocation} onSave={v => updateField("companyLocation", v)} placeholder="City, State" />
            )}
          </div>
        )}

        {/* Subject */}
        {content.subject && (
          <p className="text-sm font-semibold mb-4" style={{ color: theme.sectionTitle.color }}>
            Re: <InlineInput value={content.subject} onSave={v => updateField("subject", v)} placeholder="Position you're applying for" />
          </p>
        )}

        {/* Salutation */}
        <InlineInput
          value={content.salutation}
          onSave={v => updateField("salutation", v)}
          className="text-sm"
          placeholder="Dear Hiring Manager,"
          style={{ color: theme.body.color }}
        />

        <CLThemeDivider theme={theme} />

        {/* Body paragraphs */}
        <div className="space-y-4" style={theme.body}>
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
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: theme.title.color || accentColor }}
          >
            <Plus className="w-3.5 h-3.5" /> Add paragraph
          </button>
        </div>

        <CLThemeDivider theme={theme} />

        {/* Closing */}
        <div className="mt-6 space-y-1">
          <InlineInput
            value={content.closing}
            onSave={v => updateField("closing", v)}
            className="text-sm"
            placeholder="Sincerely,"
            style={{ color: theme.body.color }}
          />
          <p className="text-sm font-semibold" style={{ color: theme.name.color }}>{content.senderName}</p>
        </div>
      </div>
    </div>
  );
}
