const MAX_PART = 60;

/** "Principal Solutions Architect | AI & Data" -> "Principal-Solutions-Architect-AI-Data" */
function sanitizePart(value: string): string {
  const slug = value
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ") // drops filesystem-illegal chars and symbols like & | ,
    .trim()
    .replace(/[\s-]+/g, "-");
  if (slug.length <= MAX_PART) return slug;
  const cut = slug.slice(0, MAX_PART + 1);
  const lastHyphen = cut.lastIndexOf("-");
  return lastHyphen > 0 ? cut.slice(0, lastHyphen) : slug.slice(0, MAX_PART);
}

/**
 * Builds a filesystem-safe document title like "CV_Jane-Doe_Senior-Engineer":
 * parts joined with "_", words within a part with "-". Browsers use
 * `document.title` as the default filename when printing to PDF, so this is
 * meant to be assigned there right before `window.print()`.
 */
export function buildPdfFilename(parts: Array<string | null | undefined>, fallback: string): string {
  const clean = parts.map((p) => (p ? sanitizePart(p) : "")).filter(Boolean);
  return clean.length > 0 ? clean.join("_") : fallback;
}
