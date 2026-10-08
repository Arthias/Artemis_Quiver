/**
 * Paginates a rendered document card with Paged.js and prints it.
 *
 * Why: relying on the browser's native print engine to fragment the live
 * editor DOM across pages is what produced the three reported bugs — no
 * fine-grained break control, card backgrounds that stop mid-page on the
 * last sheet (the div is only as tall as its content, not the page), and
 * outright content loss when a forced break lands a CSS Grid or an
 * unbreakable block near a page boundary (a long-standing Chromium/Firefox
 * print-fragmentation bug, still open as of 2025 — crbug.com/719908,
 * crbug.com/445481941, bugzilla 1417615). Paged.js computes pagination in
 * JS into fixed-size, full-page boxes *before* the browser ever prints, so
 * native print only has to place already-finished pages — it never has to
 * fragment a grid or a flex row across a page boundary itself.
 */

const EXPORT_ROOT_ID = "paged-export-root";
const EXPORTING_BODY_CLASS = "paged-exporting";

/**
 * Paged.js's CSS parser (css-tree) predates the CSS Media Queries Level 4
 * range syntax and silently mis-parses `@media (width >= 40rem)` — the form
 * Tailwind v4 emits — which crashes its print-media handler entirely. Rewrite
 * range comparisons to the equivalent legacy min-width/max-width syntax that
 * every CSS parser understands; browsers treat them identically.
 */
function normalizeMediaRangeSyntax(cssText: string): string {
  return cssText
    .replace(/\(\s*width\s*>=\s*([^)]+?)\s*\)/g, "(min-width: $1)")
    .replace(/\(\s*width\s*<=\s*([^)]+?)\s*\)/g, "(max-width: $1)")
    .replace(/\(\s*width\s*>\s*([^)]+?)\s*\)/g, "(min-width: $1)")
    .replace(/\(\s*width\s*<\s*([^)]+?)\s*\)/g, "(max-width: $1)");
}

/**
 * Reads every same-document stylesheet as text (fetching linked ones, since
 * the production/extension build serves CSS as a single linked file rather
 * than the inline `<style>` tags Vite's dev server injects) so every sheet
 * — not just inline ones — gets the range-syntax rewrite above. Handing
 * Paged.js a bare URL would let it fetch the raw, un-rewritten file itself
 * and hit the same crash in production.
 *
 * Skips anything marked `data-pagedjs-ignore` (Paged.js's own convention for
 * "don't reprocess this sheet"). Paged.js's Polisher rewrites `#id`
 * selectors to `[data-id="..."]` attribute selectors when it reprocesses a
 * stylesheet, since that's how it tracks elements *inside* the paginated
 * content — but the page's own meta CSS (e.g. the export root's own
 * visibility toggle, keyed off its real `#paged-export-root` id) isn't part
 * of that content, so the rewrite breaks its `:not(#paged-export-root)`
 * exclusion and the export root ends up hiding itself.
 */
async function collectDocumentStylesheets(): Promise<Array<Record<string, string>>> {
  const sheets: Array<Record<string, string>> = [];
  let inlineIndex = 0;

  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.ownerNode instanceof Element && sheet.ownerNode.hasAttribute("data-pagedjs-ignore")) {
      continue;
    }
    try {
      if (sheet.href) {
        const response = await fetch(sheet.href);
        const cssText = await response.text();
        if (cssText.trim()) {
          sheets.push({ [sheet.href]: normalizeMediaRangeSyntax(cssText) });
        }
        continue;
      }
      const rules = Array.from(sheet.cssRules ?? []);
      const cssText = rules.map((rule) => rule.cssText).join("\n");
      if (cssText.trim()) {
        sheets.push({ [`inline-style-${inlineIndex++}.css`]: normalizeMediaRangeSyntax(cssText) });
      }
    } catch {
      // Cross-origin stylesheet we can't read or fetch; nothing we can do.
    }
  }

  return sheets;
}

function buildOverrideCss(pageBackground: string, pageMargin: string): string {
  return `
    @page {
      size: A4;
      margin: ${pageMargin};
    }
    /* Paged.js's own print stylesheet sizes each page via "height: 100%
       !important", which requires the full ancestor chain (root, body,
       #paged-export-root, .pagedjs_pages) to carry an explicit height for
       the percentage to resolve — it doesn't reliably in this app's layout,
       collapsing every page to zero height. Pin pages to A4's physical
       dimensions directly so sizing never depends on that chain. */
    html, body {
      height: auto !important;
    }
    .pagedjs_pages {
      height: auto !important;
    }
    .pagedjs_page {
      width: 210mm !important;
      height: 297mm !important;
      background: ${pageBackground} !important;
    }
    .pagedjs_pagebox {
      background: transparent !important;
    }
    .cv-preview-card, .cl-preview-card {
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      background: transparent !important;
      width: 100% !important;
      max-width: none !important;
    }
    .print-grid-2 {
      break-inside: avoid;
    }
    .page-keep {
      break-inside: avoid;
    }
    .page-break-before {
      break-before: page;
    }
  `;
}

function ensureExportRoot(): HTMLDivElement {
  let root = document.getElementById(EXPORT_ROOT_ID) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement("div");
    root.id = EXPORT_ROOT_ID;
    document.body.appendChild(root);
  }
  root.innerHTML = "";
  return root;
}

/**
 * Sets `document.title` (the print-to-PDF suggested filename) and restores
 * it once printing is done, then calls `onRestore` (if given) for any extra
 * cleanup. `afterprint` alone isn't reliable enough to bring the app UI back
 * — it can fail to fire (or fire very late) on some platforms when the
 * "Save as PDF" destination is used, since the native save dialog it opens
 * is outside the browser's own print lifecycle. `matchMedia("print")` tracks
 * the actual print-media state directly and fires as soon as it stops
 * matching, so we listen on both and restore on whichever signals first.
 */
function withTitleRestore(documentTitle: string, onRestore?: () => void): void {
  const originalTitle = document.title;
  const printMediaQuery = window.matchMedia("print");
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    document.title = originalTitle;
    onRestore?.();
    window.removeEventListener("afterprint", restore);
    printMediaQuery.removeEventListener("change", onPrintMediaChange);
  };
  const onPrintMediaChange = (event: MediaQueryListEvent) => {
    if (!event.matches) restore();
  };
  window.addEventListener("afterprint", restore);
  printMediaQuery.addEventListener("change", onPrintMediaChange);
  document.title = documentTitle;
}

/**
 * Plain `window.print()` with title restore, for callers that don't have a
 * `.cv-preview-card`/`.cl-preview-card` element to paginate with Paged.js.
 */
export function printWithTitleRestore(documentTitle: string): void {
  withTitleRestore(documentTitle);
  window.print();
}

export interface PagedPrintOptions {
  /** The rendered card element (e.g. `.cv-preview-card`) to paginate. */
  sourceEl: HTMLElement;
  /** Document title to use while the print dialog is open (becomes the suggested filename). */
  documentTitle: string;
  /** Extra top/right/bottom/left page margin, e.g. "0.2in". */
  pageMargin?: string;
}

/**
 * Paginates `sourceEl` with Paged.js into a hidden, full-page-sized clone
 * and opens the browser's print dialog scoped to just that paginated
 * content. Resolves once `window.print()` has been invoked (not once the
 * dialog closes — printing itself is synchronous/blocking in the browser).
 */
export async function printWithPagedJs({ sourceEl, documentTitle, pageMargin = "0.2in" }: PagedPrintOptions): Promise<void> {
  const { Previewer } = await import("pagedjs");

  const computedBg = getComputedStyle(sourceEl).backgroundColor;
  const clone = sourceEl.cloneNode(true) as HTMLElement;

  const root = ensureExportRoot();
  const stylesheets = [
    ...(await collectDocumentStylesheets()),
    { "paged-export-overrides.css": buildOverrideCss(computedBg, pageMargin) },
  ];

  const previewer = new Previewer();
  await previewer.preview(clone, stylesheets, root);

  withTitleRestore(documentTitle, () => {
    document.body.classList.remove(EXPORTING_BODY_CLASS);
    root.innerHTML = "";
  });
  document.body.classList.add(EXPORTING_BODY_CLASS);

  // Let the "exporting" layout settle (root becomes the only visible subtree)
  // before invoking print, so the browser measures final page geometry.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  window.print();
}
