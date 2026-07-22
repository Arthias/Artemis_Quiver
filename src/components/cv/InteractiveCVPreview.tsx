import { useState, useCallback, useMemo } from "react";
import type { CVContent, CVSection } from "../../types/cv";
import { Pencil, Plus, X, Check, GripVertical, ChevronDown, ChevronUp, FileDown } from "lucide-react";
import type { CVTheme } from "./cvThemes";
import { InlineInput, InlineTextarea } from "./InlineEdit";

interface InteractiveCVPreviewProps {
  content: CVContent;
  onContentChange: (content: CVContent) => void;
  theme: CVTheme;
}

const SECTION_LABELS: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Professional Experience",
  skills: "Skills",
  education: "Education",
  certifications: "Certifications",
};

export function InteractiveCVPreview({ content, onContentChange, theme }: InteractiveCVPreviewProps) {
  const contact = content.sections.find(s => s.type === "contact") as Extract<CVSection, { type: "contact" }> | undefined;

  const [dragVisualIdx, setDragVisualIdx] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const bodySections = useMemo(() =>
    content.sections.filter(s => s.type !== "contact"),
    [content.sections]
  );

  const bodyIndices = useMemo(() =>
    content.sections
      .map((s, i) => s.type !== "contact" ? i : -1)
      .filter((i): i is number => i !== -1),
    [content.sections]
  );

  const moveSection = useCallback((fromVisualIdx: number, toVisualIdx: number) => {
    if (fromVisualIdx === toVisualIdx) return;
    const sections = [...content.sections];
    const fromActual = bodyIndices[fromVisualIdx];
    const toActual = bodyIndices[toVisualIdx];
    if (fromActual === undefined || toActual === undefined) return;
    const [moved] = sections.splice(fromActual, 1);
    if (!moved) return;
    const insertAt = toActual > fromActual ? toActual - 1 : toActual;
    sections.splice(insertAt, 0, moved);
    onContentChange({ ...content, sections });
  }, [content, onContentChange, bodyIndices]);

  const handleDragStart = useCallback((visualIdx: number) => {
    setDragVisualIdx(visualIdx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, visualIdx: number) => {
    e.preventDefault();
    if (dragVisualIdx === null || dragVisualIdx === visualIdx) return;
    moveSection(dragVisualIdx, visualIdx);
    setDragVisualIdx(visualIdx);
  }, [dragVisualIdx, moveSection]);

  const handleDragEnd = useCallback(() => {
    setDragVisualIdx(null);
  }, []);

  const toggleCollapse = (type: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const togglePageBreak = (sectionType: string) => {
    updateSection(sections => sections.map(s =>
      s.type === sectionType
        ? { ...s, pageBreakBefore: s.pageBreakBefore ? undefined : true } as CVSection
        : s
    ));
  };

  const updateSection = useCallback((updater: (prev: CVSection[]) => CVSection[]) => {
    onContentChange({ ...content, sections: updater(content.sections) });
  }, [content, onContentChange]);

  const updateName = useCallback((name: string) => {
    onContentChange({ ...content, name });
  }, [content, onContentChange]);

  const updateTitle = useCallback((title: string) => {
    onContentChange({ ...content, title });
  }, [content, onContentChange]);

  const updateContactField = useCallback((field: string, value: string) => {
    updateSection(sections => sections.map(s =>
      s.type === "contact" ? { ...s, [field]: value } as CVSection : s
    ));
  }, [updateSection]);

  const updateSummaryContent = useCallback((value: string) => {
    updateSection(sections => sections.map(s =>
      s.type === "summary" ? { ...s, content: value } as CVSection : s
    ));
  }, [updateSection]);

  const updateSkillsSection = useCallback((section: Extract<CVSection, { type: "skills" }>) => {
    updateSection(sections => sections.map(s =>
      s.type === "skills" ? section : s
    ));
  }, [updateSection]);

  const updateExperienceItem = useCallback((idx: number, item: Record<string, any>) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "experience") return s;
      const items = [...(s.experience ?? [])];
      items[idx] = item as any;
      return { ...s, experience: items } as CVSection;
    }));
  }, [updateSection]);

  const addExperienceItem = useCallback(() => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "experience") return s;
      const items = s.experience ?? [];
      return { ...s, experience: [...items, { role: "", company: "", period: "", location: "", bullets: [] }] } as CVSection;
    }));
  }, [updateSection]);

  const removeExperienceItem = useCallback((idx: number) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "experience") return s;
      return { ...s, experience: (s.experience ?? []).filter((_, i) => i !== idx) } as CVSection;
    }));
  }, [updateSection]);

  const updateEducationItem = useCallback((idx: number, item: Record<string, any>) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "education") return s;
      const items = [...(s.education ?? [])];
      items[idx] = item as any;
      return { ...s, education: items } as CVSection;
    }));
  }, [updateSection]);

  const addEducationItem = useCallback(() => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "education") return s;
      const items = s.education ?? [];
      return { ...s, education: [...items, { degree: "", institution: "", period: "" }] } as CVSection;
    }));
  }, [updateSection]);

  const removeEducationItem = useCallback((idx: number) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "education") return s;
      return { ...s, education: (s.education ?? []).filter((_, i) => i !== idx) } as CVSection;
    }));
  }, [updateSection]);

  const updateCertification = useCallback((idx: number, val: string) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "certifications") return s;
      const certs = [...(s.certifications ?? [])];
      certs[idx] = val;
      return { ...s, certifications: certs } as CVSection;
    }));
  }, [updateSection]);

  const addCertification = useCallback(() => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "certifications") return s;
      return { ...s, certifications: [...(s.certifications ?? []), ""] } as CVSection;
    }));
  }, [updateSection]);

  const removeCertification = useCallback((idx: number) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "certifications") return s;
      return { ...s, certifications: (s.certifications ?? []).filter((_, i) => i !== idx) } as CVSection;
    }));
  }, [updateSection]);

  const renderDivider = () => <hr style={theme.divider} />;

  return (
    <div className="cv-preview-card rounded-lg border border-gray-200 shadow-sm" style={{ fontFamily: theme.fontFamily, background: theme.container.background, ...theme.card }}>
      <div className="p-8 md:p-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1">
              <InlineInput
                value={content.name}
                onSave={updateName}
                className="" placeholder="Your Name"
                style={theme.name}
              />
              <div className="mt-1">
                <InlineInput
                  value={content.title}
                  onSave={updateTitle}
                  className="" placeholder="Professional Title"
                  style={theme.title}
                />
              </div>
            </div>

            <div className="space-y-1.5 md:text-right flex-shrink-0" style={theme.muted}>
              {contact?.location && (
                <div className="flex items-center md:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: theme.contactIcon.color }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <InlineInput value={contact.location} onSave={v => updateContactField("location", v)} placeholder="Location" />
                </div>
              )}
              {contact?.email && (
                <div className="flex items-center md:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: theme.contactIcon.color }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <InlineInput value={contact.email} onSave={v => updateContactField("email", v)} placeholder="email@example.com" />
                </div>
              )}
              {contact?.phone && (
                <div className="flex items-center md:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: theme.contactIcon.color }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <InlineInput value={contact.phone} onSave={v => updateContactField("phone", v)} placeholder="+1 234 567 890" />
                </div>
              )}
              {contact?.linkedin && (
                <div className="flex items-center md:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: theme.contactIcon.color }}><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                  <InlineInput value={contact.linkedin} onSave={v => updateContactField("linkedin", v)} placeholder="linkedin.com/in/..." />
                </div>
              )}
            </div>
          </div>
        </div>

        {renderDivider()}

        {/* Body sections */}
        <div>
          {bodySections.map((section, visualIdx) => (
            <SectionBlock
              key={section.type}
              section={section}
              visualIdx={visualIdx}
              total={bodySections.length}
              theme={theme}
              dragVisualIdx={dragVisualIdx}
              isCollapsed={collapsed.has(section.type)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onMove={moveSection}
              onToggleCollapse={toggleCollapse}
              onTogglePageBreak={togglePageBreak}
              updateSummaryContent={updateSummaryContent}
              updateSkillsSection={updateSkillsSection}
              updateExperienceItem={updateExperienceItem}
              addExperienceItem={addExperienceItem}
              removeExperienceItem={removeExperienceItem}
              updateEducationItem={updateEducationItem}
              addEducationItem={addEducationItem}
              removeEducationItem={removeEducationItem}
              updateCertification={updateCertification}
              addCertification={addCertification}
              removeCertification={removeCertification}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionBlock({
  section, visualIdx, total, theme,
  dragVisualIdx, isCollapsed,
  onDragStart, onDragOver, onDragEnd, onMove, onToggleCollapse,
  onTogglePageBreak,
  updateSummaryContent, updateSkillsSection,
  updateExperienceItem, addExperienceItem, removeExperienceItem,
  updateEducationItem, addEducationItem, removeEducationItem,
  updateCertification, addCertification, removeCertification,
}: {
  section: CVSection; visualIdx: number; total: number;
  theme: CVTheme;
  dragVisualIdx: number | null; isCollapsed: boolean;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
  onMove: (from: number, to: number) => void;
  onToggleCollapse: (type: string) => void;
  onTogglePageBreak: (type: string) => void;
  updateSummaryContent: (v: string) => void;
  updateSkillsSection: (s: Extract<CVSection, { type: "skills" }>) => void;
  updateExperienceItem: (i: number, item: any) => void;
  addExperienceItem: () => void;
  removeExperienceItem: (i: number) => void;
  updateEducationItem: (i: number, item: any) => void;
  addEducationItem: () => void;
  removeEducationItem: (i: number) => void;
  updateCertification: (i: number, v: string) => void;
  addCertification: () => void;
  removeCertification: (i: number) => void;
}) {
  const label = SECTION_LABELS[section.type] ?? section.type;
  const titleStyle = { ...theme.sectionTitle, marginBottom: 0 };
  const withBreak = section.pageBreakBefore;

  const moveUp = () => onMove(visualIdx, visualIdx - 1);
  const moveDown = () => onMove(visualIdx, visualIdx + 1);

  const content = isCollapsed ? null : renderSectionContent(section, {
    theme,
    updateSummaryContent, updateSkillsSection,
    updateExperienceItem, addExperienceItem, removeExperienceItem,
    updateEducationItem, addEducationItem, removeEducationItem,
    updateCertification, addCertification, removeCertification,
  });

  return (
    <div
      className={`group relative mb-6 ${withBreak ? 'page-break-before' : ''} ${dragVisualIdx === visualIdx ? 'opacity-50' : ''}`}
      draggable
      onDragStart={() => onDragStart(visualIdx)}
      onDragOver={(e) => onDragOver(e, visualIdx)}
      onDragEnd={onDragEnd}
      style={withBreak ? { pageBreakBefore: 'always', breakBefore: 'page' } as React.CSSProperties : undefined}
    >
      {withBreak && (
        <div className="mb-3 flex items-center gap-2 print:hidden">
          <div className="flex-1 border-t-2 border-dashed border-rose-300" />
          <span className="text-xs text-rose-500 font-medium whitespace-nowrap flex items-center gap-1">
            <FileDown className="w-3 h-3" /> Page break
          </span>
          <div className="flex-1 border-t-2 border-dashed border-rose-300" />
        </div>
      )}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="cursor-grab text-gray-300 hover:text-gray-500 shrink-0 print:hidden" title="Drag to reorder">
          <GripVertical className="w-4 h-4" />
        </span>

        <div className="flex items-center gap-0.5 shrink-0 print:hidden">
          <button onClick={moveUp} disabled={visualIdx === 0}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 p-0.5">
            <ChevronUp className="w-3 h-3" />
          </button>
          <button onClick={moveDown} disabled={visualIdx === total - 1}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 p-0.5">
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <h2 className="text-xs font-bold uppercase tracking-widest" style={titleStyle}>
          {label}
        </h2>

        <button onClick={() => onTogglePageBreak(section.type)}
          className={`print:hidden p-0.5 ${withBreak ? 'text-rose-500' : 'text-gray-300 hover:text-gray-500'}`}
          title={withBreak ? "Remove page break" : "Insert page break before this section"}>
          <FileDown className="w-3.5 h-3.5" />
        </button>

        <button onClick={() => onToggleCollapse(section.type)}
          className="text-gray-300 hover:text-gray-500 print:hidden ml-auto"
          title={isCollapsed ? "Expand" : "Collapse"}>
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isCollapsed ? (
        <div className="border border-dashed border-gray-200 rounded p-3">
          <p className="text-xs text-gray-400 italic">Collapsed</p>
        </div>
      ) : (
        content
      )}
    </div>
  );
}

function renderSectionContent(section: CVSection, deps: {
  theme: CVTheme;
  updateSummaryContent: (v: string) => void;
  updateSkillsSection: (s: Extract<CVSection, { type: "skills" }>) => void;
  updateExperienceItem: (i: number, item: any) => void;
  addExperienceItem: () => void;
  removeExperienceItem: (i: number) => void;
  updateEducationItem: (i: number, item: any) => void;
  addEducationItem: () => void;
  removeEducationItem: (i: number) => void;
  updateCertification: (i: number, v: string) => void;
  addCertification: () => void;
  removeCertification: (i: number) => void;
}): React.ReactNode | null {
  switch (section.type) {
    case "summary": {
      const s = section as Extract<CVSection, { type: "summary" }>;
      return <InlineTextarea value={s.content} onSave={deps.updateSummaryContent} />;
    }
    case "experience": {
      const s = section as Extract<CVSection, { type: "experience" }>;
      const items = s.experience ?? [];
      return (
        <div>
          <div className="space-y-5">
            {items.map((exp, idx) => (
              <ExperienceItemCard
                key={idx} item={exp as any}
                onUpdate={(item) => deps.updateExperienceItem(idx, item)}
                onRemove={() => deps.removeExperienceItem(idx)}
              />
            ))}
          </div>
          <button onClick={deps.addExperienceItem}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium print:hidden"
            style={{ color: deps.theme.title.color }}>
            <Plus className="w-3.5 h-3.5" /> Add experience
          </button>
        </div>
      );
    }
    case "skills": {
      const s = section as Extract<CVSection, { type: "skills" }>;
      return (
        <SkillsView
          skills={s}
          onUpdateSkillsSection={deps.updateSkillsSection}
          theme={deps.theme}
        />
      );
    }
    case "education": {
      const s = section as Extract<CVSection, { type: "education" }>;
      const items = s.education ?? [];
      return (
        <div>
          <div className="space-y-4">
            {items.map((edu, idx) => (
              <EducationItemCard
                key={idx} item={edu as any}
                onUpdate={(item) => deps.updateEducationItem(idx, item)}
                onRemove={() => deps.removeEducationItem(idx)}
              />
            ))}
          </div>
          <button onClick={deps.addEducationItem}
            className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium print:hidden">
            <Plus className="w-3.5 h-3.5" /> Add education
          </button>
        </div>
      );
    }
    case "certifications": {
      const s = section as Extract<CVSection, { type: "certifications" }>;
      const certs = s.certifications ?? [];
      return (
        <div>
          <ul className="space-y-2">
            {certs.map((cert, idx) => (
              <li key={idx} className="flex items-center gap-2 group">
                <span className="text-gray-400">&#8226;</span>
                <InlineInput
                  value={cert}
                  onSave={v => deps.updateCertification(idx, v)}
                  className="text-sm text-gray-700" placeholder="Certification name"
                />
                <button onClick={() => deps.removeCertification(idx)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
          <button onClick={deps.addCertification}
            className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium print:hidden">
            <Plus className="w-3.5 h-3.5" /> Add certification
          </button>
        </div>
      );
    }
    default:
      return null;
  }
}

function ExperienceItemCard({ item, onUpdate, onRemove }: {
  item: { role: string; company: string; period: string; location?: string; bullets?: string[]; description?: string };
  onUpdate: (item: any) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...item });

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

function EducationItemCard({ item, onUpdate, onRemove }: {
  item: { degree: string; institution: string; period: string; location?: string };
  onUpdate: (item: any) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...item });

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

function SkillsView({ skills, onUpdateSkillsSection, theme }: {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
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
