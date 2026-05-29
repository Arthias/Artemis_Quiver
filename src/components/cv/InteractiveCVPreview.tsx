import { useState, useCallback } from "react";
import type { CVContent, CVSection } from "../../types/cv";
import { Pencil, Plus, X, Check } from "lucide-react";

interface InteractiveCVPreviewProps {
  content: CVContent;
  onContentChange: (content: CVContent) => void;
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

export function InteractiveCVPreview({ content, onContentChange, accentColor = "#2563eb" }: InteractiveCVPreviewProps) {
  const contact = content.sections.find(s => s.type === "contact") as Extract<CVSection, { type: "contact" }> | undefined;
  const summary = content.sections.find(s => s.type === "summary") as Extract<CVSection, { type: "summary" }> | undefined;
  const skills = content.sections.find(s => s.type === "skills") as Extract<CVSection, { type: "skills" }> | undefined;
  const experience = content.sections.find(s => s.type === "experience") as Extract<CVSection, { type: "experience" }> | undefined;
  const education = content.sections.find(s => s.type === "education") as Extract<CVSection, { type: "education" }> | undefined;
  const certifications = content.sections.find(s => s.type === "certifications") as Extract<CVSection, { type: "certifications" }> | undefined;

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

  const updateSummary = useCallback((content: string) => {
    updateSection(sections => sections.map(s =>
      s.type === "summary" ? { ...s, content } as CVSection : s
    ));
  }, [updateSection]);

  const addSkill = useCallback(() => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "skills") return s;
      const flat = s.skills ?? [];
      return { ...s, skills: [...flat, ""] } as CVSection;
    }));
  }, [updateSection]);

  const removeSkill = useCallback((idx: number) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "skills") return s;
      const flat = s.skills ?? [];
      return { ...s, skills: flat.filter((_, i) => i !== idx) } as CVSection;
    }));
  }, [updateSection]);

  const updateSkill = useCallback((idx: number, val: string) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "skills") return s;
      const flat = s.skills ?? [];
      const next = [...flat];
      next[idx] = val;
      return { ...s, skills: next } as CVSection;
    }));
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

  const renderDivider = () => <hr className="border-gray-200 my-6" />;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-8 md:p-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1">
              <InlineInput
                value={content.name}
                onSave={updateName}
                className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight"
                placeholder="Your Name"
              />
              <div className="mt-1">
                <InlineInput
                  value={content.title}
                  onSave={updateTitle}
                  className="text-lg text-blue-700 font-semibold"
                  placeholder="Professional Title"
                />
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-1.5 md:text-right flex-shrink-0">
              {contact?.location && (
                <div className="flex items-center md:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <InlineInput value={contact.location} onSave={v => updateContactField("location", v)} placeholder="Location" />
                </div>
              )}
              {contact?.email && (
                <div className="flex items-center md:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <InlineInput value={contact.email} onSave={v => updateContactField("email", v)} placeholder="email@example.com" />
                </div>
              )}
              {contact?.phone && (
                <div className="flex items-center md:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <InlineInput value={contact.phone} onSave={v => updateContactField("phone", v)} placeholder="+1 234 567 890" />
                </div>
              )}
              {contact?.linkedin && (
                <div className="flex items-center md:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                  <InlineInput value={contact.linkedin} onSave={v => updateContactField("linkedin", v)} placeholder="linkedin.com/in/..." />
                </div>
              )}
            </div>
          </div>
        </div>

        {renderDivider()}

        {/* Professional Summary */}
        {summary && (
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: accentColor }}>Professional Summary</h2>
            <InlineTextarea value={summary.content} onSave={updateSummary} />
          </section>
        )}

        {/* Experience */}
        {experience && experience.experience && experience.experience.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: accentColor }}>Professional Experience</h2>
            <div className="space-y-5">
              {experience.experience.map((exp, idx) => (
                <ExperienceItemCard
                  key={idx}
                  item={exp as any}
                  onUpdate={(item) => updateExperienceItem(idx, item)}
                  onRemove={() => removeExperienceItem(idx)}
                />
              ))}
            </div>
            <button onClick={addExperienceItem} className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="w-3.5 h-3.5" /> Add experience
            </button>
          </section>
        )}

        {/* Skills */}
        {skills && (
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: accentColor }}>
              {skills.categories ? "Technical Proficiencies" : "Skills"}
            </h2>
            <SkillsView
              skills={skills}
              onAddSkill={addSkill}
              onRemoveSkill={removeSkill}
              onUpdateSkill={updateSkill}
            />
          </section>
        )}

        {/* Education */}
        {education && education.education && education.education.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: accentColor }}>Education</h2>
            <div className="space-y-4">
              {education.education.map((edu, idx) => (
                <EducationItemCard
                  key={idx}
                  item={edu as any}
                  onUpdate={(item) => updateEducationItem(idx, item)}
                  onRemove={() => removeEducationItem(idx)}
                />
              ))}
            </div>
            <button onClick={addEducationItem} className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="w-3.5 h-3.5" /> Add education
            </button>
          </section>
        )}

        {/* Certifications */}
        {certifications && certifications.certifications && certifications.certifications.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: accentColor }}>Certifications</h2>
            <ul className="space-y-2">
              {certifications.certifications.map((cert, idx) => (
                <li key={idx} className="flex items-center gap-2 group">
                  <span className="text-gray-400">&#8226;</span>
                  <InlineInput
                    value={cert}
                    onSave={v => updateCertification(idx, v)}
                    className="text-sm text-gray-700"
                    placeholder="Certification name"
                  />
                  <button
                    onClick={() => removeCertification(idx)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={addCertification} className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="w-3.5 h-3.5" /> Add certification
            </button>
          </section>
        )}
      </div>
    </div>
  );
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
            <input value={draft.role} onChange={e => setDraft(p => ({ ...p, role: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Job title" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Company</label>
            <input value={draft.company} onChange={e => setDraft(p => ({ ...p, company: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Company name" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Period</label>
            <input value={draft.period} onChange={e => setDraft(p => ({ ...p, period: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. Jan 2020 - Present" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Location</label>
            <input value={draft.location ?? ""} onChange={e => setDraft(p => ({ ...p, location: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. Remote / NY" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Bullet points (one per line)</label>
          <textarea
            value={(draft.bullets ?? []).join("\n")}
            onChange={e => setDraft(p => ({ ...p, bullets: e.target.value.split("\n").filter(Boolean) }))}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
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
      className="group relative cursor-pointer rounded-lg p-3 -mx-3 hover:bg-gray-50 transition-colors"
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
            <input value={draft.degree} onChange={e => setDraft(p => ({ ...p, degree: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Degree name" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Institution</label>
            <input value={draft.institution} onChange={e => setDraft(p => ({ ...p, institution: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="University" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Period</label>
            <input value={draft.period} onChange={e => setDraft(p => ({ ...p, period: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. 2014-2018" />
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
      className="group relative cursor-pointer flex justify-between items-start rounded-lg p-2 -mx-2 hover:bg-gray-50 transition-colors"
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

function SkillsView({ skills, onAddSkill, onRemoveSkill, onUpdateSkill }: {
  skills: Extract<CVSection, { type: "skills" }>;
  onAddSkill: () => void;
  onRemoveSkill: (idx: number) => void;
  onUpdateSkill: (idx: number, val: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    const flat = skills.skills ?? [];
    return (
      <div className="space-y-3">
        {flat.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={s} onChange={e => onUpdateSkill(i, e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Skill name" />
            <button onClick={() => onRemoveSkill(i)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={onAddSkill} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
            <Plus className="w-3 h-3" /> Add skill
          </button>
          <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 ml-auto">
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
              <h3 className="font-semibold text-gray-900 text-xs uppercase tracking-wide mb-1.5">{cat.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                {cat.items.map((item, j) => (
                  <span key={j} className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setEditing(true)} className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 bg-white border border-gray-200 rounded shadow-sm text-gray-400 hover:text-blue-600">
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
            <span key={i} className="inline-block text-sm text-gray-700 bg-gray-100 px-2.5 py-1 rounded">{s}</span>
          ))}
        </div>
        <button onClick={() => setEditing(true)} className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 bg-white border border-gray-200 rounded shadow-sm text-gray-400 hover:text-blue-600">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative">
      <p className="text-sm text-gray-400 italic">No skills listed</p>
      <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800">Add skills</button>
    </div>
  );
}
