/**
 * CV Rendering Engine - Converts structured JSON CV data to themed HTML strings
 * 
 * Features:
 * - Three themes: Modern, Classic, Minimal (with CSS styling)
 * - HTML entity escaping for XSS prevention
 * - Frame-ready output with styles injected via <style> tags
 * 
 * @module renderingEngine
 */

/* ============================================================================
   Configuration & Types
   ============================================================================ */

import type { CVContent } from "../../types/cv";

/* Escape HTML entities to prevent XSS attacks */
const escapeHtml = (str: string): string => {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  })[c]);
};

/* Get header text for each section type */
const getSectionHeader = (type: string): string => {
  const headers: Record<string, string> = {
    "summary": "Professional Summary",
    "contact": "Contact Information",
    "skills": "Technical Skills", 
    "experience": "Work Experience",
    "education": "Education",
    "certifications": "Certifications"
  };
  return headers[type] || "Section";
};

/* ============================================================================
   Core Rendering Function
   ============================================================================ */

/**
 * Renders structured JSON CV content into themed HTML string ready for print/PDF
 * 
 * @param content - The structured CV content from LLM (CVContent type)
 * @param theme - Theme configuration (primary color, template ID, font family)
 * @returns Complete HTML document as string (including DOCTYPE, head, body, styles)
 */
export const renderCVToHTML = (content: CVContent, theme: { primaryColor: string; templateId?: "modern" | "classic" | "minimal" | undefined }): string => {
  
  // Determine active theme (defaults to 'modern')
  const themeId = theme.templateId || "modern";
  
  /* ========================================================================
     Theme-Specific CSS Stylesheets
     ======================================================================== */
  let styleRules = '';
  
  switch (themeId) {
    case "modern":
      styleRules = `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap");
        * { font-family: 'Inter', sans-serif; }
        body { max-width: 800px; margin: 0 auto; padding: 2rem; color: #1e293b; }
        section { border-top: 1px solid #e2e8f0; padding-top: 1.5rem; }
        h2 { color: var(--primary-color) !important; margin-top: 1.5rem; font-weight: 600;}
        .skill-tag { display: inline-block; background-color: rgba(37, 99, 235, 0.1); 
                padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.875rem; margin-right: 0.5rem; }
      `.trim();
      break;
      
    case "classic":
      styleRules = `
        @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&display=swap");
        * { font-family: 'Georgia', serif; }
        body { margin: 2rem; color: #1a202c; font-size: 1rem; }
        h1, h2 { font-family: 'Playfair Display', serif;}
        h2 { text-align: center; border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; margin-top: 1.5rem;}
        section { margin-bottom: 1.5rem; }
      `.trim();
      break;
      
    case "minimal":
      styleRules = `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap");
        * { font-family: 'Inter', sans-serif; }
        body { max-width: 800px; margin: auto; padding: 1.5rem; font-size: 0.9em; border: none;}
        h2 { font-weight: 600; color: #1e293b; margin-top: 1rem; }
      `.trim();
      
    default:
      styleRules = `body { max-width: 800px; margin: auto; padding: 1rem; } h2 { margin-top: 1rem; } .skill-tag { display: inline-block; background:#e5e7eb;padding:.2rem .75rem;border-radius:4px;}`.trim();
  }

  /* ========================================================================
     Build HTML Document Structure
     ======================================================================== */
  
  const htmlParts: string[] = [];
  
  // Add document metadata and CSS
  htmlParts.push('<!DOCTYPE html>');
  htmlParts.push('<html lang="en">');
  htmlParts.push(`<head><meta charset="utf-8"><title>CV - ${theme.templateId || 'preview'}</title>`);
  htmlParts.push(`<meta name="description" content="${escapeHtml("Resume and Skills")}" />`);
  
  /* Inject CSS as HTML style element */
  // Replace color variable in template with user-provided primary color
  if (theme.primaryColor) {
    const injectedStyles = escapeHtml(styleRules.replace('var(--primary-color)', theme.primaryColor));
    htmlParts.push(`<style>${injectedStyles}</style>`);
  }
  
  htmlParts.push('</head><body>');
  htmlParts.push('<div class="cv-content-wrapper">');

  /* ========================================================================
     Render Each Section
     ======================================================================== */

  for (const section of content.sections) {
    
    switch (section.type) {
      case "summary":
        // Summary Section
        const summaryContent = escapeHtml(section.content);
        htmlParts.push(`
          <section>
            <h2>${getSectionHeader("summary")}</h2>
            <p style="line-height: 1.6;">${summaryContent}</p>
          </section>
        `);
        break;

      case "contact": {
        // Contact Section - dynamic items based on available data
        let contactItems = '';
        
        if ((section as any).email) {
          const email = escapeHtml((section as any).email);
          contactItems += `<a href="mailto:${email}" style="color:inherit;">${email}</a> `;
        }
        if ((section as any).phone) {
          contactItems += `<span role="status">📞 ${(section as any).phone}</span>`;
        }
        if ((section as any).linkedin || (section as any).website) {
          const webItems = [];
          if ((section as any).linkedin) {
            webItems.push(`<a href="${escapeHtml((section as any).linkedin)}" style="color:inherit;">LinkedIn</a>`);
          }
          if ((section as any).website) {
            webItems.push(`<a href="${escapeHtml((section as any).website)}" style="color:inherit;">Website</a>`);
          }
          if (webItems.length > 0) contactItems += `<span role="status">${webItems.join(' - ')}</span>`;
        }
        
        htmlParts.push(`
          <section>
            <h2>${getSectionHeader("contact")}</h2>
            <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">${contactItems || 'No contact information'}</div>
          </section>
        `);
        break;
      }

      case "skills": {
        // Skills Section - render as tags
        const skills = section.skills || [];
        const skillTags = skills.map((skill: string) => 
          `<span class="skill-tag">${escapeHtml(skill)}</span>`
        ).join('');
        
        htmlParts.push(`
          <section>
            <h2>${getSectionHeader("skills")}</h2>
            <div style="display: flex; flex-wrap: wrap;">${skillTags}</div>
          </section>
        `);
        break;
      }

      case "experience": {
        // Experience Section - list of jobs with descriptions
        const experienceItems = section.experience || [];
        const expParts = experienceItems.map((exp: any) => {
          let itemHtml = '';
          itemHtml += `<div style="margin-bottom: 1.25rem; padding-left: 0.75rem; border-left: 3px solid #2563eb;">`;
          
          itemHtml += `<h3>${escapeHtml(exp.role)}</h3>`;
          itemHtml += `<p style="color:#64748b; font-style: italic; margin: 0.25rem 0;">${escapeHtml(exp.company)} • ${escapeHtml(exp.period)}</p>`;
          
          if (exp.description) {
            itemHtml += `<p style="color: #374151; line-height: 1.5;">${escapeHtml(exp.description)}</p>`;
          }
          
          itemHtml += `</div>`.concat(''); // Close div
          return itemHtml;
        }).join('');

        htmlParts.push(`
          <section>
            <h2>${getSectionHeader("experience")}</h2>
            <div style="display: block;">${expParts}</div>
          </section>
        `);
        break;
      }

      case "education": {
        // Education Section - list of degrees
        const eduItems = section.education || [];
        const educationParts = eduItems.map((edu: any) => 
          `<div style="margin-bottom: 1rem;">
            <p style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(edu.degree)}</p>
            <p style="color: #64748b;">${escapeHtml(edu.institution)} • ${escapeHtml(edu.period)}</p>
          </div>`
        ).join('');

        htmlParts.push(`
          <section>
            <h2>${getSectionHeader("education")}</h2>
            <div style="display: block;">${educationParts || 'No education listed.'}</div>
          </section>
        `);
        break;
      }

      case "certifications": {
        // Certifications Section - list of cert names
        const certs = section.certifications || [];
        const certList = certs.map((c: string) => 
          `<li style="margin-bottom: 0.5rem;">${escapeHtml(c)}</li>`
        ).join('');

        htmlParts.push(`
          <section>
            <h2>${getSectionHeader("certifications")}</h2>
            <ul style="list-style-type: none; padding-left: 0;">${certList || 'No certifications listed.'}</ul>
          </section>
        `);
        break;
      }

      // Default case (for any unknown section types) - skip rendering
    }
  }

  /* ========================================================================
     Close Document Structure
     ======================================================================== */
  
  htmlParts.push('</div>');
  htmlParts.push('</body>');
  htmlParts.push('</html>');

  // Join all parts into final HTML string
  return htmlParts.join('\n');
};
