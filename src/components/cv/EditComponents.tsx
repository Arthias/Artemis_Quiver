import { useEffect, useState } from "react";
import { Pencil, X, Check, Plus } from "lucide-react";
import type { CVSection } from "../../types/cv";
import type { CVTheme } from "./cvThemes";

export const SECTION_LABELS: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Professional Experience",
  skills: "Skills",
  education: "Education",
  certifications: "Certifications",
};

export function ExperienceItemCard({ item, onUpdate, onRemove }: {
  item: { role: string; company: string; period: string; location?: string; bullets?: string[]; description?: string };
  onUpdate: (item: any) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...item });

  useEffect(() => {
    if (!editing) setDraft({ ...item });
  }, [item, editing]);

  if (editing) {
    return (
      <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Role</label>
            <input value={draft.role} onChange={e => setDraft(p => ({ ...p, role: e.target.value }))} className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Job title" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Company</label>
            <input value={draft.company} onChange={e => setDraft(p => ({ ...p, company: e.target.value }))} className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Company name" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Period</label>
            <input value={draft.period} onChange={e => setDraft(p => ({ ...p, period: e.target.value }))} className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. Jan 2020 - Present" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Location</label>
            <input value={draft.location ?? ""} onChange={e => setDraft(p => ({ ...p, location: e.target.value }))} className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. Remote / NY" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Bullet points (one per line)</label>
          <textarea
            value={(draft.bullets ?? []).join("\n")}
            onChange={e => setDraft(p => ({ ...p, bullets: e.target.value.split("\n").filter(Boolean) }))}
            className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm"
            rows={4}
            placeholder="Led a team of 5 engineers...&#10;Reduced deployment time by 40%..."
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { onUpdate(draft); setEditing(false); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={() => { setDraft({ ...item }); setEditing(false); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">
            <X className="w-3 h-3" /> Cancel
          </button>
          <button onClick={onRemove} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-red-500 text-xs rounded hover:bg-red-50">
            <X className="w-3 h-3" /> Remove
          </button>
        </div>
      </div>
    );
  }

  const bullets = item.bullets ?? [];
  return (
    <div
      className="page-keep group relative cursor-pointer rounded-lg p-3 -mx-3 hover:bg-gray-50 transition-colors"
      onClick={() => setEditing(true)}
    >
      <div className="flex justify-between items-start mb-1">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{item.role || "Untitled Role"}</h3>
          <p className="text-sm text-gray-600">
            {item.company && <span className="font-medium text-gray-700">{item.company}</span>}
            {item.location && <span className="text-gray-400"> &mdash; {item.location}</span>}
          </p>
        </div>
        {item.period && (
          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{item.period}</span>
        )}
      </div>
      {bullets.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {bullets.map((b: string, i: number) => (
            <li key={i} className="text-sm text-gray-700 leading-relaxed pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-gray-400">{b}</li>
          ))}
        </ul>
      )}
      {item.description && !bullets.length && (
        <p className="text-sm text-gray-700 mt-1 leading-relaxed">{item.description}</p>
      )}
      <button
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-white border border-gray-200 rounded shadow-sm text-gray-400 hover:text-blue-600"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title="Edit this entry"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

export function EducationItemCard({ item, onUpdate, onRemove }: {
  item: { degree: string; institution: string; period: string; location?: string };
  onUpdate: (item: any) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...item });

  useEffect(() => {
    if (!editing) setDraft({ ...item });
  }, [item, editing]);

  if (editing) {
    return (
      <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-0.5">Degree</label>
            <input value={draft.degree} onChange={e => setDraft(p => ({ ...p, degree: e.target.value }))} className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Degree name" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Institution</label>
            <input value={draft.institution} onChange={e => setDraft(p => ({ ...p, institution: e.target.value }))} className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="University" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Period</label>
            <input value={draft.period} onChange={e => setDraft(p => ({ ...p, period: e.target.value }))} className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. 2014-2018" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { onUpdate(draft); setEditing(false); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={() => { setDraft({ ...item }); setEditing(false); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">
            <X className="w-3 h-3" /> Cancel
          </button>
          <button onClick={onRemove} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-red-500 text-xs rounded hover:bg-red-50">
            <X className="w-3 h-3" /> Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-keep group relative cursor-pointer flex justify-between items-start rounded-lg p-2 -mx-2 hover:bg-gray-50 transition-colors"
      onClick={() => setEditing(true)}
    >
      <div>
        <p className="font-semibold text-gray-900 text-sm">{item.degree}</p>
        <p className="text-sm text-gray-600">{item.institution}{item.location ? `, ${item.location}` : ""}</p>
      </div>
      {item.period && <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{item.period}</span>}
    </div>
  );
}

export function SkillsView({ skills, onUpdateSkillsSection, theme }: {
  skills: Extract<CVSection, { type: "skills" }>;
  onUpdateSkillsSection: (section: Extract<CVSection, { type: "skills" }>) => void;
  theme?: CVTheme;
}) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<Array<{ name: string; isCategory: boolean }>>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const startEditing = () => {
    const flat: Array<{ name: string; isCategory: boolean }> = [];
    if (skills.categories) {
      for (const cat of skills.categories) {
        flat.push({ name: cat.name, isCategory: true });
        for (const item of cat.items) {
          flat.push({ name: item, isCategory: false });
        }
      }
    } else if (skills.skills) {
      for (const s of skills.skills) {
        flat.push({ name: s, isCategory: false });
      }
    }
    setItems(flat.length > 0 ? flat : [{ name: "", isCategory: false }]);
    setEditing(true);
  };

  const saveEditing = () => {
    const cats: Array<{ name: string; items: string[] }> = [];
    let currentCat: { name: string; items: string[] } | null = null;
    for (const item of items) {
      if (item.isCategory) {
        currentCat = { name: item.name, items: [] };
        cats.push(currentCat);
      } else if (currentCat) {
        if (item.name) currentCat.items.push(item.name);
      }
    }
    if (cats.length === 0) {
      onUpdateSkillsSection({
        ...skills,
        skills: items.map(i => i.name).filter(Boolean),
        categories: undefined,
      });
    } else {
      onUpdateSkillsSection({
        ...skills,
        categories: cats,
        skills: undefined,
      });
    }
    setEditing(false);
  };

  const updateItem = (idx: number, name: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, name } : item));
  };

  const toggleCategory = (idx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, isCategory: !item.isCategory } : item));
  };

  const addItem = () => {
    setItems(prev => [...prev, { name: "", isCategory: false }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    setItems(prev => {
      const next = [...prev];
      const a = next[idx]!;
      const b = next[target]!;
      next[idx] = b;
      next[target] = a;
      return next;
    });
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const from = dragIdx;
    setDragIdx(idx);
    setItems(prev => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      if (!removed) return prev;
      next.splice(idx, 0, removed);
      return next;
    });
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={e => handleDragOver(e, i)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 p-1.5 rounded ${dragIdx === i ? "opacity-50" : ""} ${item.isCategory ? "bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-800" : "hover:bg-gray-50 dark:hover:bg-gray-800/30"}`}
          >
            <span className="cursor-grab text-gray-400 hover:text-gray-600 shrink-0" title="Drag to reorder">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-20 p-0.5"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg></button>
              <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-20 p-0.5"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg></button>
            </div>
            <input
              value={item.name}
              onChange={e => updateItem(i, e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
              placeholder={item.isCategory ? "Category name" : "Skill name"}
            />
            <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={item.isCategory}
                onChange={() => toggleCategory(i)}
                className="rounded"
              />
              Category
            </label>
            <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 shrink-0 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button onClick={addItem} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: theme?.title.color ?? "#2563eb" }}>
            <Plus className="w-3 h-3" /> Add skill
          </button>
          <button onClick={saveEditing} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 ml-auto">
            <Check className="w-3 h-3" /> Done
          </button>
        </div>
      </div>
    );
  }

  const cats = skills.categories;
  if (cats && cats.length > 0) {
    return (
      <div className="group relative">
        <div className="grid grid-cols-1 md:grid-cols-2 print-grid-2 gap-4 text-sm">
          {cats.map((cat, i) => (
            <div key={i}>
              <h3 className="font-semibold text-xs uppercase tracking-wide mb-1.5" style={{ color: theme?.sectionTitle.color }}>{cat.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                {cat.items.map((item, j) => (
                  <span key={j} className="inline-block px-2 py-0.5 rounded text-xs" style={{ background: theme?.tag.background, color: theme?.tag.color }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={startEditing} className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 bg-white border border-gray-200 rounded shadow-sm text-gray-400 hover:text-blue-600">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (skills.skills && skills.skills.length > 0) {
    return (
      <div className="group relative">
        <div className="flex flex-wrap gap-2">
          {skills.skills.map((s, i) => (
            <span key={i} className="inline-block text-sm px-2.5 py-1 rounded" style={{ background: theme?.tag.background, color: theme?.tag.color }}>{s}</span>
          ))}
        </div>
        <button onClick={startEditing} className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 bg-white border border-gray-200 rounded shadow-sm text-gray-400 hover:text-blue-600">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative">
      <p className="text-sm italic" style={{ color: theme?.muted.color ?? "#9ca3af" }}>No skills listed</p>
      <button onClick={startEditing} className="inline-flex items-center gap-1 text-xs font-medium print:hidden" style={{ color: theme?.title.color ?? "#2563eb" }}>Add skills</button>
    </div>
  );
}
