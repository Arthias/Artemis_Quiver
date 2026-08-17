import { useEffect, useState } from "react";
import { Pencil, X, Plus } from "lucide-react";
import type { CVContent, CVSection } from "../../types/cv";
import type { CVTheme } from "./cvThemes";
import { InlineInput, InlineTextarea } from "./InlineEdit";
import { ExperienceItemCard, EducationItemCard } from "./EditComponents";

interface ExecutiveTemplateProps {
  content: CVContent;
  theme: CVTheme;
  updateName: (name: string) => void;
  updateTitle: (title: string) => void;
  updateContactField: (field: string, value: string) => void;
  updateSummaryContent: (value: string) => void;
  updateExperienceItem: (idx: number, item: any) => void;
  addExperienceItem: () => void;
  removeExperienceItem: (idx: number) => void;
  updateEducationItem: (idx: number, item: any) => void;
  addEducationItem: () => void;
  removeEducationItem: (idx: number) => void;
  updateCertification: (idx: number, val: string) => void;
  addCertification: () => void;
  removeCertification: (idx: number) => void;
}

function SectionTitle({ label, theme, dark }: { label: string; theme: CVTheme; dark?: boolean }) {
  const borderColor = dark ? "#ffffff" : theme.sectionTitle.color ?? "#1e293b";
  return (
    <h2
      className="text-xs font-bold tracking-wider uppercase pb-1 mb-2.5"
      style={{
        color: dark ? "#ffffff" : (theme.sectionTitle.color ?? "#1e293b"),
        borderBottom: `2px solid ${borderColor}`,
      }}
    >
      {label}
    </h2>
  );
}

export function ExecutiveTemplate({
  content, theme,
  updateName, updateTitle, updateContactField,
  updateSummaryContent,
  updateExperienceItem, addExperienceItem, removeExperienceItem,
  updateEducationItem, addEducationItem, removeEducationItem,
  updateCertification, addCertification, removeCertification,
}: ExecutiveTemplateProps) {
  const contact = content.sections.find(s => s.type === "contact") as Extract<CVSection, { type: "contact" }> | undefined;
  const summary = content.sections.find(s => s.type === "summary") as Extract<CVSection, { type: "summary" }> | undefined;
  const expSection = content.sections.find(s => s.type === "experience") as Extract<CVSection, { type: "experience" }> | undefined;
  const skills = content.sections.find(s => s.type === "skills") as Extract<CVSection, { type: "skills" }> | undefined;
  const eduSection = content.sections.find(s => s.type === "education") as Extract<CVSection, { type: "education" }> | undefined;
  const certSection = content.sections.find(s => s.type === "certifications") as Extract<CVSection, { type: "certifications" }> | undefined;

  const expItems = expSection?.experience ?? [];
  const eduItems = eduSection?.education ?? [];
  const certs = certSection?.certifications ?? [];
  const cats = skills?.categories;
  const flatSkills = skills?.skills;

  return (
    <div className="cv-preview-card rounded-lg border border-gray-200 shadow-sm" style={{ fontFamily: theme.fontFamily, background: "#ffffff" }}>
      <div className="p-8 md:p-10">

        {/* Header */}
        <header className="border-b border-gray-200 pb-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: theme.name.color ?? "#0f172a" }}>
                <InlineInput
                  value={content.name}
                  onSave={updateName}
                  placeholder="Your Name"
                  style={{ fontSize: "2rem", fontWeight: 800, color: theme.name.color ?? "#0f172a", letterSpacing: "-0.025em", fontFamily: theme.headingFont }}
                />
              </h1>
              <p className="text-lg font-semibold mt-1 tracking-wide" style={{ color: theme.title.color ?? "#4338ca" }}>
                <InlineInput
                  value={content.title}
                  onSave={updateTitle}
                  placeholder="Professional Title"
                  style={{ fontSize: "1.125rem", fontWeight: 600, color: theme.title.color ?? "#4338ca", fontFamily: theme.headingFont }}
                />
              </p>
            </div>
          </div>

          {/* Contact Badges */}
          <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-medium" style={{ color: theme.muted.color ?? "#64748b" }}>
            {contact?.location && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" style={{ color: theme.contactIcon.color ?? "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <InlineInput value={contact.location} onSave={v => updateContactField("location", v)} placeholder="Location" />
              </div>
            )}
            {contact?.phone && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" style={{ color: theme.contactIcon.color ?? "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                <InlineInput value={contact.phone} onSave={v => updateContactField("phone", v)} placeholder="+1 234 567 890" />
              </div>
            )}
            {contact?.email && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" style={{ color: theme.contactIcon.color ?? "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <InlineInput value={contact.email} onSave={v => updateContactField("email", v)} placeholder="email@example.com" />
              </div>
            )}
            {contact?.linkedin && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" style={{ color: theme.contactIcon.color ?? "#94a3b8" }} fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                <InlineInput value={contact.linkedin} onSave={v => updateContactField("linkedin", v)} placeholder="linkedin.com/in/..." />
              </div>
            )}
          </div>
        </header>

        {/* Professional Summary */}
        {summary && (
          <section className="mb-6">
            <SectionTitle label="Professional Summary" theme={theme} />
            <InlineTextarea
              value={summary.content}
              onSave={updateSummaryContent}
            />
          </section>
        )}

        {/* Core Competencies (from skills with categories) */}
        {cats && cats.length > 0 && (
          <section className="mb-6">
            <SectionTitle label="Core Competencies" theme={theme} />
            <div className="grid grid-cols-1 md:grid-cols-2 print-grid-2 gap-3 text-xs">
              {cats.map((cat, i) => (
                <div key={i} className="p-3 rounded-lg border" style={{ background: theme.tag.background ?? "#f8fafc", borderColor: theme.divider.borderTop?.toString() ?? "#e2e8f0" }}>
                  <h3 className="font-bold mb-1" style={{ color: theme.sectionTitle.color ?? "#0f172a" }}>{cat.name}</h3>
                  <p style={{ color: theme.body.color ?? "#475569" }} className="leading-snug">{cat.items.join(", ")}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Professional Experience */}
        {expItems.length > 0 && (
          <section className="mb-6">
            <SectionTitle label="Professional Experience" theme={theme} />
            <div className="space-y-5">
              {expItems.map((exp, idx) => (
                <ExecutiveExperienceItem
                  key={idx}
                  item={exp}
                  theme={theme}
                  onUpdate={(item) => updateExperienceItem(idx, item)}
                  onRemove={() => removeExperienceItem(idx)}
                />
              ))}
            </div>
            <button onClick={addExperienceItem}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium print:hidden"
              style={{ color: theme.title.color ?? "#2563eb" }}>
              <Plus className="w-3.5 h-3.5" /> Add experience
            </button>
          </section>
        )}

        {/* Bottom: 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 print-grid-2 gap-6 pt-2 border-t" style={{ borderColor: theme.divider.borderTop?.toString() ?? "#e2e8f0" }}>
          {/* Technical Proficiencies */}
          <div>
            <SectionTitle label="Technical Proficiencies" theme={theme} />
            <div className="space-y-1.5 text-xs" style={{ color: theme.body.color ?? "#475569" }}>
              {flatSkills && flatSkills.length > 0 && (
                <p>{flatSkills.join(", ")}</p>
              )}
              {cats && cats.length > 0 && cats.map((cat, i) => (
                <p key={i}><strong>{cat.name}:</strong> {cat.items.join(", ")}</p>
              ))}
              {!flatSkills && !cats && (
                <p className="italic" style={{ color: theme.muted.color ?? "#9ca3af" }}>No skills listed</p>
              )}
            </div>
          </div>

          {/* Education & Certifications */}
          <div>
            <SectionTitle label="Education & Certifications" theme={theme} />
            <div className="space-y-2 text-xs" style={{ color: theme.body.color ?? "#475569" }}>
              {eduItems.length > 0 ? (
                eduItems.map((edu, idx) => (
                  <ExecutiveEducationItem
                    key={idx}
                    item={edu}
                    theme={theme}
                    onUpdate={(item) => updateEducationItem(idx, item)}
                    onRemove={() => removeEducationItem(idx)}
                  />
                ))
              ) : (
                <p className="italic" style={{ color: theme.muted.color ?? "#9ca3af" }}>No education listed</p>
              )}
              <button onClick={addEducationItem}
                className="inline-flex items-center gap-1 text-xs font-medium print:hidden"
                style={{ color: theme.title.color ?? "#2563eb" }}>
                <Plus className="w-3 h-3" /> Add education
              </button>

              {certs.length > 0 && (
                <div className="pt-1 border-t" style={{ borderColor: theme.divider.borderTop?.toString() ?? "#e2e8f0" }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: theme.sectionTitle.color }}>Certifications</h3>
                  <ul className="space-y-1">
                    {certs.map((cert, idx) => (
                      <ExecutiveCertificationItem
                        key={idx}
                        value={cert}
                        theme={theme}
                        onUpdate={(val) => updateCertification(idx, val)}
                        onRemove={() => removeCertification(idx)}
                      />
                    ))}
                  </ul>
                  <button onClick={addCertification}
                    className="inline-flex items-center gap-1 text-xs font-medium print:hidden"
                    style={{ color: theme.title.color ?? "#2563eb" }}>
                    <Plus className="w-3 h-3" /> Add certification
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function ExecutiveExperienceItem({ item, theme, onUpdate, onRemove }: {
  item: { role: string; company: string; period: string; location?: string; bullets?: string[]; description?: string };
  theme: CVTheme;
  onUpdate: (item: any) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <ExperienceItemCard item={item} onUpdate={(i) => { onUpdate(i); setEditing(false); }} onRemove={onRemove} />;
  }

  const bullets = item.bullets ?? [];
  return (
    <div
      className="page-break-inside-avoid group relative cursor-pointer rounded-lg p-3 -mx-3 hover:bg-gray-50 transition-colors"
      onClick={() => setEditing(true)}
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between">
        <h3 className="text-sm font-bold" style={{ color: theme.name.color ?? "#0f172a" }}>
          {item.role || "Untitled Role"}
          {item.company && <span style={{ color: theme.muted.color ?? "#64748b" }}> <span className="font-normal">|</span> {item.company}</span>}
        </h3>
        <span className="text-xs font-semibold sm:text-right shrink-0 ml-2" style={{ color: theme.title.color ?? "#4338ca" }}>
          {item.period || ""}
          {item.location && <span style={{ color: theme.muted.color ?? "#94a3b8" }} className="font-normal"> | {item.location}</span>}
        </span>
      </div>
      {bullets.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs leading-relaxed list-disc list-outside ml-4" style={{ color: theme.body.color ?? "#475569" }}>
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {item.description && !bullets.length && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: theme.body.color ?? "#475569" }}>{item.description}</p>
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

function ExecutiveEducationItem({ item, theme, onUpdate, onRemove }: {
  item: { degree: string; institution: string; period: string; location?: string };
  theme: CVTheme;
  onUpdate: (item: any) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <EducationItemCard item={item} onUpdate={(i) => { onUpdate(i); setEditing(false); }} onRemove={onRemove} />;
  }

  return (
    <div className="page-break-inside-avoid group relative cursor-pointer rounded p-1 -mx-1 hover:bg-gray-50 transition-colors" onClick={() => setEditing(true)}>
      <p className="font-semibold" style={{ color: theme.name.color ?? "#0f172a" }}>{item.degree}</p>
      <p style={{ color: theme.muted.color ?? "#64748b" }}>
        {item.institution}
        {item.location ? `, ${item.location}` : ""}
        {item.period && <span> <span className="mx-1">•</span> {item.period}</span>}
      </p>
    </div>
  );
}

function ExecutiveCertificationItem({ value, theme, onUpdate, onRemove }: {
  value: string;
  theme: CVTheme;
  onUpdate: (val: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { onUpdate(draft ?? value); setEditing(false); }}
          onKeyDown={e => { if (e.key === "Enter") { onUpdate(draft ?? value); setEditing(false); } if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          autoFocus
          className="flex-1 bg-white text-gray-900 border border-gray-300 rounded px-1.5 py-0.5 text-xs"
        />
        <button onClick={() => onRemove()} className="text-red-400 hover:text-red-600 p-0.5"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  return (
    <div className="group/cert flex items-center gap-1">
      <span className="text-gray-400">&#8226;</span>
      <span
        className="cursor-pointer rounded px-1 -mx-1 hover:bg-gray-100 transition-colors"
        onClick={() => setEditing(true)}
        style={{ color: theme.body.color ?? "#475569" }}
      >
        {value}
      </span>
      <button onClick={onRemove} className="opacity-0 group-hover/cert:opacity-100 text-red-400 hover:text-red-600 p-0.5">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
