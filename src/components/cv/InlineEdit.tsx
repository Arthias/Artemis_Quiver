import { useState } from "react";
import { Pencil, X, Check } from "lucide-react";

export function InlineInput({ value, onSave, className, placeholder, style }: {
  value: string; onSave: (v: string) => void;
  className?: string; placeholder?: string; style?: React.CSSProperties;
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
        className={`bg-white text-gray-900 border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 ${className ?? ""}`}
        placeholder={placeholder}
        style={style}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer rounded px-1 -mx-1 hover:bg-gray-100 transition-colors ${className ?? ""}`}
      title="Click to edit"
      style={style}
    >
      {value}
    </span>
  );
}

export function InlineTextarea({ value, onSave, className }: {
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
          className={`w-full bg-white text-gray-900 border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${className ?? ""}`}
          rows={4}
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={() => { onSave(draft); setEditing(false); }}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            <Check className="w-3 h-3" /> Save
          </button>
          <button
            onClick={() => { setDraft(value); setEditing(false); }}
            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
          >
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
