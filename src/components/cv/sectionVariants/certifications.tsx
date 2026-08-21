import { X } from "lucide-react";
import { InlineInput } from "../InlineEdit";
import type { CertificationsVariantProps } from "./types";

export function CertificationsList({ certifications, theme, onUpdate, onRemove }: CertificationsVariantProps) {
  return (
    <ul className="space-y-2">
      {certifications.map((cert, idx) => (
        <li key={idx} className="flex items-center gap-2 group">
          <span style={theme.muted}>&#8226;</span>
          <InlineInput
            value={cert}
            onSave={v => onUpdate(idx, v)}
            className="text-sm" style={theme.body} placeholder="Certification name"
          />
          <button onClick={() => onRemove(idx)}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
            <X className="w-3 h-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CertificationsTags({ certifications, theme, onUpdate, onRemove }: CertificationsVariantProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {certifications.map((cert, idx) => (
        <span key={idx} className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs" style={theme.tag}>
          <InlineInput value={cert} onSave={v => onUpdate(idx, v)} placeholder="Certification name" />
          <button onClick={() => onRemove(idx)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
