import { useState, useCallback } from "react";
import type { CLContent } from "../../types/cl";
import { Pencil, Plus, X, Check } from "lucide-react";

interface InteractiveCLPreviewProps {
  content: CLContent;
  onContentChange: (content: CLContent) => void;
  accentColor?: string;
}

function InlineInput({ value, onSave, className, placeholder }: {
  value: string; onSave: (v: string) => void;
  className?: string; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onSave(draft || value); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") { onSave(draft || value); setEditing(false); } if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        autoFocus
        className={`bg-white border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 ${className ?? ""}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer rounded px-1 -mx-1 hover:bg-gray-100 transition-colors ${className ?? ""}`}
      title="Click to edit"
    >
      {value}
    </span>
  );
}

function InlineTextarea({ value, onSave, className }: {
  value: string; onSave: (v: string) => void; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className={`w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${className ?? ""}`}
          rows={4}
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={() => { onSave(draft); setEditing(false); }} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer group relative rounded-md p-2 -m-2 hover:bg-gray-50 transition-colors"
    >
      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{value}</p>
      <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-400">
        <Pencil className="w-3.5 h-3.5" />
      </span>
    </div>
  );
}

export function InteractiveCLPreview({ content, onContentChange, accentColor = "#2563eb" }: InteractiveCLPreviewProps) {
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

  const switchThemeColor = accentColor;

  const renderDivider = () => <hr className="border-gray-200 my-6" />;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-3xl mx-auto" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-8 md:p-10">
        {/* Sender header */}
        <div className="mb-6">
          <InlineInput
            value={content.senderName}
            onSave={v => updateField("senderName", v)}
            className="text-xl md:text-2xl font-bold text-gray-900"
            placeholder="Your Name"
          />
          {content.senderTitle && (
            <InlineInput
              value={content.senderTitle}
              onSave={v => updateField("senderTitle", v)}
              className="text-sm text-gray-500"
              placeholder="Job Title"
            />
          )}
          {content.date && (
            <p className="text-xs text-gray-400 mt-1">{content.date}</p>
          )}
        </div>

        {renderDivider()}

        {/* Recipient info */}
        {(content.recipientName || content.companyName) && (
          <div className="mb-4 text-sm text-gray-600 space-y-0.5">
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
          <p className="text-sm font-semibold text-gray-800 mb-4">
            Re: <InlineInput value={content.subject} onSave={v => updateField("subject", v)} placeholder="Position you're applying for" />
          </p>
        )}

        {/* Salutation */}
        <InlineInput
          value={content.salutation}
          onSave={v => updateField("salutation", v)}
          className="text-sm text-gray-800"
          placeholder="Dear Hiring Manager,"
        />

        {renderDivider()}

        {/* Body paragraphs */}
        <div className="space-y-4">
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
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add paragraph
          </button>
        </div>

        {renderDivider()}

        {/* Closing */}
        <div className="mt-6 space-y-1">
          <InlineInput
            value={content.closing}
            onSave={v => updateField("closing", v)}
            className="text-sm text-gray-800"
            placeholder="Sincerely,"
          />
          <p className="text-sm font-semibold text-gray-900">{content.senderName}</p>
        </div>
      </div>
    </div>
  );
}
