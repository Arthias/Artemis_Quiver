const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

function sanitizePart(value: string): string {
  return value
    .replace(ILLEGAL_FILENAME_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "")
    .slice(0, 60);
}

/**
 * Builds a filesystem-safe document title from the given parts, joined with
 * " - ". Browsers use `document.title` as the default filename when printing
 * to PDF, so this is meant to be assigned there right before `window.print()`.
 */
export function buildPdfFilename(parts: Array<string | null | undefined>, fallback: string): string {
  const clean = parts.map((p) => (p ? sanitizePart(p) : "")).filter(Boolean);
  return clean.length > 0 ? clean.join(" - ") : fallback;
}
