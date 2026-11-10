---
tags: [development, cv-builder, pdf, architecture, bugfix]
status: done
last_updated: 2026-11-10
---

# CV PDF Export — Paged.js Migration

Root-cause record for three CV Builder export bugs reported 2026-09-10, and
the switch from native browser print pagination to [Paged.js](https://pagedjs.org/)
for the "Export PDF" path.

> [!NOTE] Scope
> Only `CVBuilder.tsx` was migrated. `CLBuilder.tsx` still uses the old plain
> `window.print()` path and shares the same underlying risk — see
> [[../60-Roadmap/Plan.md|Plan]] backlog for follow-up scope.

## The three reported bugs, and their actual root causes

All three turned out to be symptoms of the same category of problem:
Chromium's native print-fragmentation engine has real, long-standing,
still-open bugs when pagination has to fragment a CSS Grid/Flexbox across a
page boundary, or when a forced `break-before` lands an unbreakable block
near a page edge. `window.print()` on the live editor DOM was always going
to hit these eventually — this isn't unique to this codebase.

### 1. "Little control over line breaks"
Only a whole-section `break-before: page` toggle existed (`SectionFrame`'s
"Insert page break before this section"), plus `break-inside: avoid` on
individual experience/education items (`.page-keep` in `EditComponents.tsx`).
No per-bullet/per-paragraph control.

### 2. Background color stops mid-page, leaving a visible white seam
`cvThemes.ts`'s `container.background` (and `card.background`) is painted on
`.cv-preview-card` — a `<div>` sized to its own content, not to a physical
page. When native print fragments that div across a page boundary and the
content ends partway down the last page, the background stops with it,
leaving stark white below. Reproduced on the Minimal template (the only
preset where `container.background` isn't overridden back to white by
`theme.card`).

### 3. Text cut off / duplicated at the end of the document
Two distinct causes, both confirmed with Playwright:
- **Grid duplication**: `ExecutiveTemplate.tsx`'s Skills/Education/
  Certifications block renders as `.print-grid-2` (a real CSS Grid, forced on
  for print). When that grid straddles a page boundary, Chromium's grid
  print-fragmentation bug ([crbug 719908](https://bugs.chromium.org/p/chromium/issues/detail?id=719908),
  still tracked as of Oct 2025 in crbug 445481941) duplicates content across
  the two pages instead of splitting it cleanly.
- **Silent content loss**: combining the manual "insert page break" toggle
  with an unbreakable block (`.page-keep`) near the resulting page boundary
  could make the browser's print engine drop the rest of the document
  entirely — no error, no extra page, the content just never renders.
  Reproduced with Classic template + forced break before Education + a
  12-item Certifications list: the heading rendered sliced in half at the
  page-2 boundary and the entire list vanished.

## Why Paged.js

[Paged.js](https://pagedjs.org/) (actively maintained, NLnet-funded 2025
modernization) computes pagination in JS into fixed-size, full-page boxes
*before* the browser ever prints. By the time `window.print()` actually
runs, there's nothing left for Chromium's native engine to fragment — each
`.pagedjs_page` is already a complete, correctly-sized page. This fixes all
three bug classes at the root instead of patching around them.

Alternatives considered and why not: patching the native print CSS further
doesn't touch Chromium's underlying grid-fragmentation bug, so it would keep
resurfacing for different content lengths. A DOCX export was also discussed
as a companion format for ATS-sensitive use cases, but deferred — see the
Backlog item below.

## Implementation: `src/app/utils/pagedExport.ts`

`printWithPagedJs({ sourceEl, documentTitle, pageMargin })`:
1. Clones the live `.cv-preview-card` DOM node (reuses 100% of the existing
   template/theme rendering — no separate "export renderer" to keep in sync).
2. Collects every same-document stylesheet as text (`collectDocumentStylesheets()`),
   fetching linked ones too so the extension/production build (single bundled
   `.css` file) gets the same treatment as dev (many inline `<style>` tags).
3. Feeds the clone + collected CSS + a small override stylesheet into
   `new Previewer().preview(...)`, rendering into a hidden `#paged-export-root`
   container.
4. Sets `document.title` (the print-to-PDF filename), adds `body.paged-exporting`
   (a CSS-only toggle that hides the live editor and shows `#paged-export-root`
   under `@media print`), and calls `window.print()`.
5. On `afterprint`, restores the title and clears the export root.

`CVBuilder.tsx`'s `printPDF()` calls this and falls back to the old plain
`window.print()` on any error (missing `.cv-preview-card`, or an unexpected
Paged.js failure) — the export is never fully broken by an edge case.

## Three subtle bugs found integrating Paged.js itself

Worth recording — none of these are documented anywhere obvious, and each
one silently produced a broken export (blank page, 1-page PDF instead of N,
or content that visually looked right but measured zero height).

### A. Tailwind v4's `@media (width >= 40rem)` crashes Paged.js's CSS parser
Paged.js's `css-tree` dependency predates the [CSS Media Queries Level 4
range syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Range_syntax)
and mis-parses it — silently, producing a malformed AST node that later
throws `Cannot read properties of undefined (reading 'includes')` deep in
`PrintMedia.onAtMedia`. Tailwind v4 emits this syntax for its `.container`
utility. Fix: `normalizeMediaRangeSyntax()` rewrites `(width >= X)` /
`(width <= X)` to legacy `(min-width: X)` / `(max-width: X)` before handing
CSS to Paged.js — browsers treat them identically, but only the legacy form
parses correctly in `css-tree`.

### B. `.pagedjs_page { height: 100% !important }` resolves to zero
Paged.js's own built-in `@media print` stylesheet sizes each page via
`height: 100%`, which requires the *entire* ancestor chain (`html`, `body`,
`#paged-export-root`, `.pagedjs_pages`) to carry an explicit height for the
percentage to resolve against anything. It didn't in this app's layout, so
every `.pagedjs_page` collapsed to `height: 0` — pages existed in the DOM,
correct content and all, but `page.pdf()` / real print produced only 1 blank
(or wrong) physical page regardless of how many `.pagedjs_page` elements
were actually there. Fix: pin `.pagedjs_page` to the physical A4 size
directly (`width: 210mm !important; height: 297mm !important`) instead of
relying on the percentage chain.

### C. Paged.js's own ID-selector rewrite hides the export root from itself
Paged.js's Polisher rewrites `#id` selectors to `[data-id="..."]` attribute
selectors when it reprocesses a stylesheet — needed for its own internal
element-tracking system, but disastrous for any stylesheet passed to it that
isn't actually part of the paginated *content*. This app's `#paged-export-root`
visibility toggle (`body.paged-exporting > *:not(#paged-export-root) {
display: none }`) got swept into `collectDocumentStylesheets()` along with
everything else, reprocessed by Paged.js into
`:not([data-id="paged-export-root"])` — which the real `#paged-export-root`
element doesn't carry, so the `:not()` exclusion silently stopped excluding
it, and the export root hid itself. Fix: mark that `<style>` tag with
`data-pagedjs-ignore="true"` (Paged.js's own convention for "don't touch
this sheet" — it already respects that attribute in its own `removeStyles()`
helper) and skip any stylesheet carrying it in `collectDocumentStylesheets()`.

## Four more export bugs, fixed 2026-11-10

Reported against real exports: the editor never came back after printing, a
section title stranded at the foot of a page, and a manual page break giving a
blank page followed by the same page twice. Reproduced by mounting the real
`InteractiveCVPreview` with a real CV in Chromium and paginating with the export
code, across all four templates and a range of summary lengths.

### D. Paged.js styles outlived the export, and hid the editor

`polisher.add()` inserts a processed copy of every stylesheet into `<head>`
with `@media print` wrappers stripped, so `print:hidden` applied on screen.
Cleanup only emptied the export root. Now cleanup calls
`previewer.polisher.destroy()` and `previewer.chunker.removePages()`, on
`afterprint` and on a failed pagination.

### E. A far-off-screen export root breaks forced page breaks

With `#paged-export-root { left: -99999px }`, any section with `break-before:
page` produced a blank page and then that section twice — every template, every
content length. Placing the root at 0,0 behind the app with `opacity: 0` fixes
it (the print rule restores `opacity: 1`). Paged.js decides breaks from element
positions; do not move the root off-screen again.

### F. The builder's fallback `@page` margin outranked Paged.js's

`CVBuilder`'s `<style>` renders inside `<body>`, so its print-only
`@page { margin: 0.15in }` beats Paged.js's `@page` in `<head>`. Paged.js pages
are already full A4 with their own margins; the extra margin made Chrome shrink
each sheet (the white frame seen on exported PDFs). The export now appends
`@page { size: A4; margin: 0 }` at the end of `<body>` while it runs. It also
disconnects each page's `ResizeObserver` before printing, so print layout
cannot trigger a re-flow mid-print.

### G. Section titles left alone at the foot of a page

Nothing tied a section's title row to its first item. `SectionFrame`'s title
row carries `.section-heading`, and the export override sets
`break-after: avoid` on it. Paged.js only honours break rules from
stylesheets, not inline styles, so it has to live in the override CSS.

## Backlog

See [[../60-Roadmap/Plan.md#backlog--unscheduled|Plan → Backlog]] for the
deferred multi-column ATS-risk review (Executive template's grid layout) and
the DOCX-companion-export idea, both raised during this investigation but
out of scope for the pagination fix itself.
