import type { CVContent, CVSection } from "../../types/cv";
import type { CLContent } from "../../types/cl";
import type { ThemeConfig } from "../../types/cv";

const SECTION_LABELS: Record<string, Record<string, string>> = {
  summary: { en: "Professional Summary", es: "Resumen Profesional" },
  experience: { en: "Professional Experience", es: "Experiencia Profesional" },
  skillsCat: { en: "Technical Proficiencies", es: "Competencias Técnicas" },
  skills: { en: "Skills", es: "Habilidades" },
  education: { en: "Education", es: "Educación" },
  certifications: { en: "Certifications", es: "Certificaciones" },
};

function label(key: string, lang: string): string {
  return SECTION_LABELS[key]?.[lang] ?? SECTION_LABELS[key]?.en ?? key;
}

function findSection<T extends CVSection["type"]>(
  sections: CVSection[],
  type: T
): Extract<CVSection, { type: T }> | undefined {
  return sections.find((s): s is Extract<CVSection, { type: T }> => s.type === type);
}

const escapeHtml = (str: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  };
  return str.replace(/[&<>"']/g, (c) => map[c] ?? c);
};

const safeColor = (color: string | undefined, fallback = "#2563eb"): string =>
  typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : fallback;

type CvTheme = { primaryColor: string; templateId?: "modern" | "classic" | "minimal" | undefined };

const CL_COMMON_STYLES = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
  body { margin: 0; padding: 0; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  .cl-sheet { max-width: 700px; margin: 2rem auto; padding: 2.5rem 3rem; background: #fff; }
  .cl-paragraph { margin-bottom: 1rem; text-align: justify; }
  @media print { .cl-sheet { box-shadow: none; margin: 0; max-width: 100%; padding: 0.5in; } }
`;

const PRINT_STYLES = `
  @media print {
    body { background: #fff !important; color: #000 !important; font-size: 10.5pt !important; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    .page-keep { page-break-inside: avoid; break-inside: avoid; }
    a.contact-link { text-decoration: underline !important; color: #2563eb !important; }
  }
`;

const CV_COMMON_STYLES = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
  body { margin: 0; padding: 0; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  .cv-sheet { max-width: 800px; margin: 2rem auto; padding: 2.5rem 3rem; background: #fff; }
  .cv-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; margin-bottom: 0.75rem; }
  .cv-header-left { flex: 1; min-width: 0; }
  .cv-header-right { flex-shrink: 0; text-align: right; }
  .cv-contact-row { display: flex; align-items: center; justify-content: flex-end; gap: 0.35rem; margin-bottom: 0.2rem; white-space: nowrap; font-size: 0.78rem; }
  .cv-contact-row svg { flex-shrink: 0; opacity: 0.6; }
  h2.section-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 0.75rem 0; }
  ul.bullets { margin: 0.25rem 0 0 0; padding-left: 1.1rem; list-style: disc; }
  ul.bullets li { margin-bottom: 0.2rem; }
  .exp-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .skill-tag { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.75rem; margin: 0.15rem; }
  .skill-cat-title { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
  @media print { .cv-sheet { box-shadow: none; margin: 0; max-width: 100%; padding: 0.5in; } }
`;

function getCvThemeStyles(themeId: string, pc: string): string {
  switch (themeId) {
    case "modern":
      return `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; background: #f8fafc; }
        .cv-sheet { box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; }
        .cv-name { font-size: 2rem; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; margin: 0; }
        .cv-title { font-size: 1.05rem; color: ${pc}; font-weight: 600; margin: 0.15rem 0 0 0; }
        .cv-contact-row { color: #64748b; }
        .cv-divider { border: none; border-top: 2px solid #e2e8f0; margin: 1rem 0; }
        h2.section-title { color: ${pc}; }
        .exp-role { font-size: 1rem; font-weight: 600; color: #0f172a; margin: 0; }
        .exp-meta { font-size: 0.8rem; color: #64748b; margin: 0.1rem 0 0 0; }
        .exp-period { font-size: 0.75rem; color: #94a3b8; white-space: nowrap; }
        .exp-item { margin-bottom: 1rem; }
        ul.bullets { font-size: 0.85rem; color: #334155; }
        ul.bullets li { margin-bottom: 0.15rem; }
        .skill-tag { background: ${pc}15; color: #334155; }
      `.trim();
    case "classic":
      return `
        @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap");
        body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a202c; background: #faf9f7; }
        .cv-sheet { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .cv-name { font-size: 2rem; font-weight: 700; font-family: 'Playfair Display', serif; color: #1a202c; margin: 0; }
        .cv-title { font-size: 1rem; color: ${pc}; font-style: italic; margin: 0.2rem 0 0 0; }
        .cv-contact-row { font-size: 0.78rem; color: #4a5568; }
        .cv-divider { border: none; border-top: 1px solid #cbd5e0; margin: 1rem 0; }
        h2.section-title { color: ${pc}; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.35rem; }
        .exp-role { font-size: 1rem; font-weight: 600; color: #1a202c; margin: 0; }
        .exp-meta { font-size: 0.8rem; color: #4a5568; margin: 0.1rem 0 0 0; font-style: italic; }
        .exp-period { font-size: 0.75rem; color: #718096; white-space: nowrap; }
        .exp-item { margin-bottom: 1rem; }
        ul.bullets { font-size: 0.85rem; color: #2d3748; }
        .skill-tag { background: #edf2f7; color: #2d3748; }
      `.trim();
    case "minimal":
      return `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; background: #fff; }
        .cv-sheet { box-shadow: none; border: none; padding: 2rem 2.5rem; }
        .cv-name { font-size: 1.6rem; font-weight: 700; color: #0f172a; margin: 0; }
        .cv-title { font-size: 0.95rem; color: #64748b; font-weight: 400; margin: 0.15rem 0 0 0; }
        .cv-contact-row { font-size: 0.75rem; color: #94a3b8; }
        .cv-divider { border: none; border-top: 1px solid #f1f5f9; margin: 0.75rem 0; }
        h2.section-title { color: #1e293b; }
        .exp-role { font-size: 0.95rem; font-weight: 600; color: #0f172a; margin: 0; }
        .exp-meta { font-size: 0.8rem; color: #64748b; margin: 0.1rem 0 0 0; }
        .exp-period { font-size: 0.75rem; color: #94a3b8; white-space: nowrap; }
        .exp-item { margin-bottom: 0.8rem; }
        ul.bullets { font-size: 0.8rem; color: #475569; }
        .skill-tag { background: #f1f5f9; color: #475569; }
      `.trim();
    default:
      return "";
  }
}

function cvHeaderHtml(name: string, title: string, contact: Extract<CVSection, { type: "contact" }> | undefined): string {
  const iconEmail = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
  const iconPhone = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  const iconLinkedin = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>';
  const iconLocation = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const contactRows: string[] = [];
  if (contact) {
    if (contact.email) contactRows.push(`<div class="cv-contact-row">${iconEmail}<a class="contact-link" href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></div>`);
    if (contact.phone) contactRows.push(`<div class="cv-contact-row">${iconPhone}<span>${escapeHtml(contact.phone)}</span></div>`);
    if (contact.linkedin) {
      const linkedinLabel = contact.linkedin.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      contactRows.push(`<div class="cv-contact-row">${iconLinkedin}<a class="contact-link" href="${escapeHtml(contact.linkedin)}">${escapeHtml(linkedinLabel)}</a></div>`);
    }
    if (contact.location) contactRows.push(`<div class="cv-contact-row">${iconLocation}<span>${escapeHtml(contact.location)}</span></div>`);
  }
  const lines: string[] = ['<header class="page-keep">', '<div class="cv-header">'];
  lines.push('<div class="cv-header-left">', `<h1 class="cv-name">${escapeHtml(name)}</h1>`);
  if (title) lines.push(`<p class="cv-title">${escapeHtml(title)}</p>`);
  lines.push('</div>');
  if (contactRows.length > 0) {
    lines.push('<div class="cv-header-right">', ...contactRows, '</div>');
  }
  lines.push('</div>', '</header>', '<hr class="cv-divider" />');
  return lines.join("\n");
}

function cvSectionHtml(tag: string, content: string): string {
  return `<section class="page-keep"><h2 class="section-title">${tag}</h2>${content}</section><hr class="cv-divider" />`;
}

function cvExperienceHtml(experience: any, lang = "en"): string {
  const items = experience?.experience ?? [];
  if (items.length === 0) return "";
  const lines: string[] = ['<section>', `<h2 class="section-title">${label("experience", lang)}</h2>`];
  for (const exp of items) {
    lines.push(
      '<div class="exp-item page-keep">',
      '<div class="exp-header">',
      '<div>',
      `<p class="exp-role">${escapeHtml(exp.role || "")}</p>`,
    );
    const metaParts: string[] = [];
    if (exp.company) metaParts.push(escapeHtml(exp.company));
    if (exp.location) metaParts.push(escapeHtml(exp.location));
    lines.push(`<p class="exp-meta">${metaParts.join(" &mdash; ")}</p>`);
    lines.push('</div>');
    if (exp.period) lines.push(`<span class="exp-period">${escapeHtml(exp.period)}</span>`);
    lines.push('</div>');
    const bullets = exp.bullets ?? [];
    if (bullets.length > 0) {
      lines.push('<ul class="bullets">');
      for (const b of bullets) lines.push(`<li>${escapeHtml(b)}</li>`);
      lines.push('</ul>');
    } else if (exp.description) {
      lines.push(`<p style="font-size:0.85rem;color:#475569;margin:0.25rem 0;">${escapeHtml(exp.description)}</p>`);
    }
    lines.push('</div>');
  }
  lines.push('</section>', '<hr class="cv-divider" />');
  return lines.join("\n");
}

function cvSkillsHtml(skills: any, lang = "en"): string {
  if (!skills) return "";
  const cats = skills.categories;
  if (cats?.length > 0) {
    const lines: string[] = [`<h2 class="section-title">${label("skillsCat", lang)}</h2>`,
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;">'];
    for (const cat of cats) {
      lines.push('<div>', `<p class="skill-cat-title">${escapeHtml(cat.name)}</p>`, '<div>');
      for (const item of cat.items) lines.push(`<span class="skill-tag">${escapeHtml(item)}</span>`);
      lines.push('</div></div>');
    }
    lines.push('</div>');
    return cvSectionHtml(label("skillsCat", lang), lines.join("\n"));
  }
  if (skills.skills?.length > 0) {
    const tags = skills.skills.map((s: string) => `<span class="skill-tag">${escapeHtml(s)}</span>`).join("");
    return cvSectionHtml(label("skills", lang), `<div>${tags}</div>`);
  }
  return "";
}

function cvEducationHtml(education: any, lang = "en"): string {
  const items = education?.education ?? [];
  if (items.length === 0) return "";
  const lines: string[] = [];
  for (const edu of items) {
    lines.push(
      '<div style="margin-bottom:0.75rem;">',
      `<p style="font-size:0.9rem;font-weight:600;margin:0;color:#0f172a;">${escapeHtml(edu.degree)}</p>`,
    );
    const instParts: string[] = [escapeHtml(edu.institution)];
    if (edu.location) instParts.push(escapeHtml(edu.location));
    lines.push(`<p style="font-size:0.8rem;color:#64748b;margin:0.1rem 0;">${instParts.join(", ")}</p>`);
    if (edu.period) lines.push(`<p style="font-size:0.75rem;color:#94a3b8;margin:0;">${escapeHtml(edu.period)}</p>`);
    lines.push('</div>');
  }
  return cvSectionHtml(label("education", lang), lines.join("\n"));
}

function cvCertificationsHtml(certifications: any, lang = "en"): string {
  const items = certifications?.certifications ?? [];
  if (items.length === 0) return "";
  const lis = items.map((c: string) => `<li style="font-size:0.85rem;color:#475569;margin-bottom:0.2rem;">${escapeHtml(c)}</li>`).join("");
  return `<section class="page-keep"><h2 class="section-title">${label("certifications", lang)}</h2><ul style="margin:0;padding-left:1rem;list-style:disc;">${lis}</ul></section>`;
}

export const renderCVToHTML = (
  content: CVContent,
  theme: CvTheme,
  lang = "en"
): string => {
  const themeId = theme.templateId || "modern";
  const pc = safeColor(theme.primaryColor);

  const contact = findSection(content.sections, "contact");
  const summary = findSection(content.sections, "summary");
  const skills = findSection(content.sections, "skills");
  const experience = findSection(content.sections, "experience");
  const education = findSection(content.sections, "education");
  const certifications = findSection(content.sections, "certifications");

  const name = escapeHtml(content.name || "Your Name");
  const title = escapeHtml(content.title || "");

  const themeStyles = getCvThemeStyles(themeId, pc);
  const summaryHtml = summary ? cvSectionHtml(label("summary", lang), `<p style="font-size:0.85rem;color:#475569;line-height:1.6;margin:0;">${escapeHtml(summary.content)}</p>`) : "";

  const parts: string[] = [
    '<!DOCTYPE html>',
    `<html lang="${lang}">`,
    `<head><meta charset="utf-8"><title>CV - ${escapeHtml(content.name || "Resume")}</title>`,
    `<style>${PRINT_STYLES}${CV_COMMON_STYLES}${themeStyles}</style>`,
    '</head><body>',
    '<div class="cv-sheet">',
    cvHeaderHtml(name, title, contact),
    summaryHtml,
    cvExperienceHtml(experience, lang),
    cvSkillsHtml(skills, lang),
    cvEducationHtml(education, lang),
    cvCertificationsHtml(certifications, lang),
    '</div></body></html>',
  ];

  return parts.join('\n');
};

function getClThemeStyles(themeId: string, pc: string): string {
  switch (themeId) {
    case "modern":
      return `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; background: #f8fafc; font-size: 10.5pt; }
        .cl-sheet { box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; }
        .cl-sender-name { font-size: 1.4rem; font-weight: 700; color: #0f172a; margin: 0; }
        .cl-sender-title { font-size: 0.85rem; color: ${pc}; margin: 0.1rem 0 0 0; }
        .cl-header-block { margin-bottom: 1.5rem; }
        .cl-recipient-block { margin-bottom: 1rem; font-size: 0.9rem; color: #475569; }
        .cl-subject { font-weight: 600; color: #0f172a; margin-bottom: 0.75rem; font-size: 0.9rem; }
        .cl-salutation { margin-bottom: 1rem; font-size: 0.95rem; }
        .cl-body { font-size: 0.9rem; color: #334155; }
        .cl-closing { margin-top: 1.5rem; font-size: 0.9rem; }
      `.trim();
    case "classic":
      return `
        @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap");
        body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a202c; background: #faf9f7; font-size: 11pt; }
        .cl-sheet { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .cl-sender-name { font-size: 1.5rem; font-weight: 700; font-family: 'Playfair Display', serif; color: #1a202c; margin: 0; }
        .cl-sender-title { font-size: 0.9rem; color: ${pc}; font-style: italic; margin: 0.1rem 0 0 0; }
        .cl-header-block { margin-bottom: 1.5rem; }
        .cl-recipient-block { margin-bottom: 1rem; font-size: 0.95rem; color: #4a5568; }
        .cl-subject { font-weight: 600; color: #1a202c; margin-bottom: 0.75rem; font-size: 0.95rem; }
        .cl-salutation { margin-bottom: 1rem; font-size: 1rem; }
        .cl-body { font-size: 0.95rem; color: #2d3748; }
        .cl-closing { margin-top: 1.5rem; font-size: 0.95rem; }
      `.trim();
    case "minimal":
      return `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; background: #fff; font-size: 10pt; }
        .cl-sheet { box-shadow: none; border: none; padding: 2rem 2.5rem; }
        .cl-sender-name { font-size: 1.2rem; font-weight: 700; color: #0f172a; margin: 0; }
        .cl-sender-title { font-size: 0.8rem; color: #64748b; margin: 0.1rem 0 0 0; }
        .cl-header-block { margin-bottom: 1.5rem; }
        .cl-recipient-block { margin-bottom: 1rem; font-size: 0.85rem; color: #64748b; }
        .cl-subject { font-weight: 600; color: #0f172a; margin-bottom: 0.75rem; font-size: 0.85rem; }
        .cl-salutation { margin-bottom: 1rem; font-size: 0.9rem; }
        .cl-body { font-size: 0.85rem; color: #475569; }
        .cl-closing { margin-top: 1.5rem; font-size: 0.85rem; }
      `.trim();
    default:
      return "";
  }
}

export const renderCLToHTML = (
  content: CLContent,
  theme: ThemeConfig,
  lang = "en"
): string => {
  const themeId = theme.templateId || "modern";
  const pc = safeColor(theme.primaryColor);
  const themeStyles = getClThemeStyles(themeId, pc);

  const parts: string[] = [
    '<!DOCTYPE html>',
    `<html lang="${lang}">`,
    `<head><meta charset="utf-8"><title>Cover Letter - ${escapeHtml(content.senderName)}</title>`,
    `<style>${PRINT_STYLES}${CL_COMMON_STYLES}${themeStyles}</style>`,
    '</head><body>',
    '<div class="cl-sheet">',
    '<div class="cl-header-block">',
    `<p class="cl-sender-name">${escapeHtml(content.senderName)}</p>`,
  ];
  if (content.senderTitle) parts.push(`<p class="cl-sender-title">${escapeHtml(content.senderTitle)}</p>`);
  if (content.date) parts.push(`<p style="font-size:0.85rem;color:#94a3b8;margin:0.25rem 0 0 0;">${escapeHtml(content.date)}</p>`);
  parts.push('</div>');

  if (content.recipientName || content.companyName) {
    parts.push('<div class="cl-recipient-block">');
    if (content.recipientName) parts.push(`<p style="margin:0;">${escapeHtml(content.recipientName)}</p>`);
    if (content.companyName) parts.push(`<p style="margin:0;">${escapeHtml(content.companyName)}</p>`);
    if (content.companyLocation) parts.push(`<p style="margin:0;">${escapeHtml(content.companyLocation)}</p>`);
    parts.push('</div>');
  }

  if (content.subject) parts.push(`<p class="cl-subject">Re: ${escapeHtml(content.subject)}</p>`);
  if (content.salutation) parts.push(`<p class="cl-salutation">${escapeHtml(content.salutation)}</p>`);

  parts.push('<div class="cl-body">');
  for (const p of content.bodyParagraphs) parts.push(`<p class="cl-paragraph">${escapeHtml(p)}</p>`);
  parts.push('</div>');

  if (content.closing) parts.push(`<p class="cl-closing">${escapeHtml(content.closing)}</p>`);
  parts.push(`<p>${escapeHtml(content.senderName)}</p>`);

  parts.push('</div></body></html>');
  return parts.join('\n');
};
