import type { CVContent } from "../../types/cv";
import type { CLContent } from "../../types/cl";
import type { ThemeConfig } from "../../types/cv";

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

export const renderCVToHTML = (
  content: CVContent,
  theme: { primaryColor: string; templateId?: "modern" | "classic" | "minimal" | undefined }
): string => {
  const themeId = theme.templateId || "modern";
  const pc = safeColor(theme.primaryColor);

  const contact = content.sections.find(s => s.type === "contact") as any;
  const summary = content.sections.find(s => s.type === "summary") as any;
  const skills = content.sections.find(s => s.type === "skills") as any;
  const experience = content.sections.find(s => s.type === "experience") as any;
  const education = content.sections.find(s => s.type === "education") as any;
  const certifications = content.sections.find(s => s.type === "certifications") as any;

  const name = escapeHtml(content.name || "Your Name");
  const title = escapeHtml(content.title || "");

  const contactLines: string[] = [];
  if (contact) {
    if (contact.email) contactLines.push(`<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>`);
    if (contact.phone) contactLines.push(`<span>${escapeHtml(contact.phone)}</span>`);
    if (contact.linkedin) contactLines.push(`<a href="${escapeHtml(contact.linkedin)}">LinkedIn</a>`);
    if (contact.location) contactLines.push(`<span>${escapeHtml(contact.location)}</span>`);
  }

  const printStyles = `
    @media print {
      body { background: #fff !important; color: #000 !important; font-size: 10.5pt !important; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .page-keep { page-break-inside: avoid; break-inside: avoid; }
      a { text-decoration: none !important; color: inherit !important; }
    }
  `;

  const commonStyles = `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
    body { margin: 0; padding: 0; line-height: 1.5; -webkit-font-smoothing: antialiased; }
    .cv-sheet { max-width: 800px; margin: 2rem auto; padding: 2.5rem 3rem; background: #fff; }
    h2.section-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 0.75rem 0; }
    .contact-bar a, .contact-bar span { color: inherit; }
    ul.bullets { margin: 0.25rem 0 0 0; padding-left: 1.1rem; list-style: disc; }
    ul.bullets li { margin-bottom: 0.2rem; }
    .exp-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .skill-tag { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.75rem; margin: 0.15rem; }
    .skill-cat-title { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
    @media print { .cv-sheet { box-shadow: none; margin: 0; max-width: 100%; padding: 0.5in; } }
  `;

  let themeStyles = "";

  switch (themeId) {
    case "modern":
      themeStyles = `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; background: #f8fafc; }
        .cv-sheet { box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; }
        .cv-name { font-size: 2rem; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; margin: 0; }
        .cv-title { font-size: 1.05rem; color: ${pc}; font-weight: 600; margin: 0.15rem 0 0 0; }
        .contact-bar { font-size: 0.8rem; color: #64748b; display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem; }
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
      break;

    case "classic":
      themeStyles = `
        @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap");
        body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a202c; background: #faf9f7; }
        .cv-sheet { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .cv-name { font-size: 2rem; font-weight: 700; font-family: 'Playfair Display', serif; color: #1a202c; margin: 0; }
        .cv-title { font-size: 1rem; color: ${pc}; font-style: italic; margin: 0.2rem 0 0 0; }
        .contact-bar { font-size: 0.8rem; color: #4a5568; display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem; justify-content: center; }
        .cv-divider { border: none; border-top: 1px solid #cbd5e0; margin: 1rem 0; }
        h2.section-title { color: ${pc}; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.35rem; }
        .exp-role { font-size: 1rem; font-weight: 600; color: #1a202c; margin: 0; }
        .exp-meta { font-size: 0.8rem; color: #4a5568; margin: 0.1rem 0 0 0; font-style: italic; }
        .exp-period { font-size: 0.75rem; color: #718096; white-space: nowrap; }
        .exp-item { margin-bottom: 1rem; }
        ul.bullets { font-size: 0.85rem; color: #2d3748; }
        .skill-tag { background: #edf2f7; color: #2d3748; }
      `.trim();
      break;

    case "minimal":
      themeStyles = `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; background: #fff; }
        .cv-sheet { box-shadow: none; border: none; padding: 2rem 2.5rem; }
        .cv-name { font-size: 1.6rem; font-weight: 700; color: #0f172a; margin: 0; }
        .cv-title { font-size: 0.95rem; color: #64748b; font-weight: 400; margin: 0.15rem 0 0 0; }
        .contact-bar { font-size: 0.78rem; color: #94a3b8; display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.35rem; }
        .cv-divider { border: none; border-top: 1px solid #f1f5f9; margin: 0.75rem 0; }
        h2.section-title { color: #1e293b; }
        .exp-role { font-size: 0.95rem; font-weight: 600; color: #0f172a; margin: 0; }
        .exp-meta { font-size: 0.8rem; color: #64748b; margin: 0.1rem 0 0 0; }
        .exp-period { font-size: 0.75rem; color: #94a3b8; white-space: nowrap; }
        .exp-item { margin-bottom: 0.8rem; }
        ul.bullets { font-size: 0.8rem; color: #475569; }
        .skill-tag { background: #f1f5f9; color: #475569; }
      `.trim();
      break;
  }

  const htmlParts: string[] = [];

  htmlParts.push('<!DOCTYPE html>');
  htmlParts.push('<html lang="en">');
  htmlParts.push(`<head><meta charset="utf-8"><title>CV - ${escapeHtml(content.name || "Resume")}</title>`);
  htmlParts.push(`<style>${printStyles}${commonStyles}${themeStyles}</style>`);
  htmlParts.push('</head><body>');
  htmlParts.push('<div class="cv-sheet">');

  // Header: name, title, contact
  htmlParts.push('<header class="page-keep">');
  htmlParts.push(`<h1 class="cv-name">${name}</h1>`);
  if (title) htmlParts.push(`<p class="cv-title">${title}</p>`);
  if (contactLines.length > 0) {
    htmlParts.push(`<div class="contact-bar">${contactLines.join('<span class="contact-sep">&middot;</span>')}</div>`);
  }
  htmlParts.push('</header>');
  htmlParts.push('<hr class="cv-divider" />');

  // Summary
  if (summary) {
    htmlParts.push('<section class="page-keep">');
    htmlParts.push('<h2 class="section-title">Professional Summary</h2>');
    htmlParts.push(`<p style="font-size:0.85rem;color:#475569;line-height:1.6;margin:0;">${escapeHtml(summary.content)}</p>`);
    htmlParts.push('</section>');
    htmlParts.push('<hr class="cv-divider" />');
  }

  // Experience
  if (experience?.experience?.length > 0) {
    htmlParts.push('<section>');
    htmlParts.push('<h2 class="section-title">Professional Experience</h2>');
    for (const exp of experience.experience) {
      htmlParts.push('<div class="exp-item page-keep">');
      htmlParts.push('<div class="exp-header">');
      htmlParts.push('<div>');
      htmlParts.push(`<p class="exp-role">${escapeHtml(exp.role || "")}</p>`);
      const metaParts: string[] = [];
      if (exp.company) metaParts.push(escapeHtml(exp.company));
      if (exp.location) metaParts.push(escapeHtml(exp.location));
      htmlParts.push(`<p class="exp-meta">${metaParts.join(" &mdash; ")}</p>`);
      htmlParts.push('</div>');
      if (exp.period) htmlParts.push(`<span class="exp-period">${escapeHtml(exp.period)}</span>`);
      htmlParts.push('</div>');
      const bullets = exp.bullets ?? [];
      if (bullets.length > 0) {
        htmlParts.push('<ul class="bullets">');
        for (const b of bullets) {
          htmlParts.push(`<li>${escapeHtml(b)}</li>`);
        }
        htmlParts.push('</ul>');
      } else if (exp.description) {
        htmlParts.push(`<p style="font-size:0.85rem;color:#475569;margin:0.25rem 0;">${escapeHtml(exp.description)}</p>`);
      }
      htmlParts.push('</div>');
    }
    htmlParts.push('</section>');
    htmlParts.push('<hr class="cv-divider" />');
  }

  // Skills
  if (skills) {
    htmlParts.push('<section class="page-keep">');
    const cats = skills.categories;
    if (cats?.length > 0) {
      htmlParts.push('<h2 class="section-title">Technical Proficiencies</h2>');
      htmlParts.push('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;">');
      for (const cat of cats) {
        htmlParts.push('<div>');
        htmlParts.push(`<p class="skill-cat-title">${escapeHtml(cat.name)}</p>`);
        htmlParts.push('<div>');
        for (const item of cat.items) {
          htmlParts.push(`<span class="skill-tag">${escapeHtml(item)}</span>`);
        }
        htmlParts.push('</div></div>');
      }
      htmlParts.push('</div>');
    } else if (skills.skills?.length > 0) {
      htmlParts.push('<h2 class="section-title">Skills</h2>');
      htmlParts.push('<div>');
      for (const s of skills.skills) {
        htmlParts.push(`<span class="skill-tag">${escapeHtml(s)}</span>`);
      }
      htmlParts.push('</div>');
    }
    htmlParts.push('</section>');
    htmlParts.push('<hr class="cv-divider" />');
  }

  // Education
  if (education?.education?.length > 0) {
    htmlParts.push('<section class="page-keep">');
    htmlParts.push('<h2 class="section-title">Education</h2>');
    for (const edu of education.education) {
      htmlParts.push('<div style="margin-bottom:0.75rem;">');
      htmlParts.push(`<p style="font-size:0.9rem;font-weight:600;margin:0;color:#0f172a;">${escapeHtml(edu.degree)}</p>`);
      const instParts: string[] = [escapeHtml(edu.institution)];
      if (edu.location) instParts.push(escapeHtml(edu.location));
      htmlParts.push(`<p style="font-size:0.8rem;color:#64748b;margin:0.1rem 0;">${instParts.join(", ")}</p>`);
      if (edu.period) htmlParts.push(`<p style="font-size:0.75rem;color:#94a3b8;margin:0;">${escapeHtml(edu.period)}</p>`);
      htmlParts.push('</div>');
    }
    htmlParts.push('</section>');
    htmlParts.push('<hr class="cv-divider" />');
  }

  // Certifications
  if (certifications?.certifications?.length > 0) {
    htmlParts.push('<section class="page-keep">');
    htmlParts.push('<h2 class="section-title">Certifications</h2>');
    htmlParts.push('<ul style="margin:0;padding-left:1rem;list-style:disc;">');
    for (const c of certifications.certifications) {
      htmlParts.push(`<li style="font-size:0.85rem;color:#475569;margin-bottom:0.2rem;">${escapeHtml(c)}</li>`);
    }
    htmlParts.push('</ul>');
    htmlParts.push('</section>');
  }

  htmlParts.push('</div></body></html>');

  return htmlParts.join('\n');
};

export const renderCLToHTML = (
  content: CLContent,
  theme: ThemeConfig
): string => {
  const themeId = theme.templateId || "modern";
  const pc = safeColor(theme.primaryColor);

  const printStyles = `
    @media print {
      body { background: #fff !important; color: #000 !important; font-size: 10.5pt !important; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      a { text-decoration: none !important; color: inherit !important; }
    }
  `;

  const commonStyles = `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
    body { margin: 0; padding: 0; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    .cl-sheet { max-width: 700px; margin: 2rem auto; padding: 2.5rem 3rem; background: #fff; }
    .cl-paragraph { margin-bottom: 1rem; text-align: justify; }
    @media print { .cl-sheet { box-shadow: none; margin: 0; max-width: 100%; padding: 0.5in; } }
  `;

  let themeStyles = "";
  switch (themeId) {
    case "modern":
      themeStyles = `
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
      break;
    case "classic":
      themeStyles = `
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
      break;
    case "minimal":
      themeStyles = `
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
      break;
  }

  const parts: string[] = [];
  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="en">');
  parts.push(`<head><meta charset="utf-8"><title>Cover Letter - ${escapeHtml(content.senderName)}</title>`);
  parts.push(`<style>${printStyles}${commonStyles}${themeStyles}</style>`);
  parts.push('</head><body>');
  parts.push('<div class="cl-sheet">');

  // Sender header
  parts.push('<div class="cl-header-block">');
  parts.push(`<p class="cl-sender-name">${escapeHtml(content.senderName)}</p>`);
  if (content.senderTitle) parts.push(`<p class="cl-sender-title">${escapeHtml(content.senderTitle)}</p>`);
  if (content.date) parts.push(`<p style="font-size:0.85rem;color:#94a3b8;margin:0.25rem 0 0 0;">${escapeHtml(content.date)}</p>`);
  parts.push('</div>');

  // Recipient block
  if (content.recipientName || content.companyName) {
    parts.push('<div class="cl-recipient-block">');
    if (content.recipientName) parts.push(`<p style="margin:0;">${escapeHtml(content.recipientName)}</p>`);
    if (content.companyName) parts.push(`<p style="margin:0;">${escapeHtml(content.companyName)}</p>`);
    if (content.companyLocation) parts.push(`<p style="margin:0;">${escapeHtml(content.companyLocation)}</p>`);
    parts.push('</div>');
  }

  // Subject line
  if (content.subject) {
    parts.push(`<p class="cl-subject">Re: ${escapeHtml(content.subject)}</p>`);
  }

  // Salutation
  if (content.salutation) {
    parts.push(`<p class="cl-salutation">${escapeHtml(content.salutation)}</p>`);
  }

  // Body paragraphs
  parts.push('<div class="cl-body">');
  for (const p of content.bodyParagraphs) {
    parts.push(`<p class="cl-paragraph">${escapeHtml(p)}</p>`);
  }
  parts.push('</div>');

  // Closing
  if (content.closing) {
    parts.push(`<p class="cl-closing">${escapeHtml(content.closing)}</p>`);
  }
  parts.push(`<p>${escapeHtml(content.senderName)}</p>`);

  parts.push('</div></body></html>');
  return parts.join('\n');
};
