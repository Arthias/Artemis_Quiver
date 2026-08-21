---
tags: [feature, cv-builder, cl-builder, document-builder]
status: maintained
last_updated: 2026-08-20
---

# Document Builders (CV & Cover Letter)

Artemis Quiver provides two interactive builders: **CV Studio** and **Cover Letter Studio**. These tools allow users to generate tailored copies from their master profile, refine them iteratively via chat, and export them.

---

## Builder Data Handoff

When a user clicks "Open CV Builder" or "Edit in Builder" from the Analysis Hub, job metadata is stored in `BuilderHandoffContext` and transferred across the route boundaries:

```text
Analysis Hub (Route: /)
  click event triggers context store (setHandoff)
    redirect (navigate)
      Page Component mounts (CVBuilder / CLBuilder)
        consumeHandoff() called to populate input fields & suggestions
```

---

## 1. CV Studio (`/cv-builder`)

- **File:** `src/app/pages/CVBuilder.tsx`
- **Service Integration:** `src/app/services/cvBuilderService.ts`

### Technology & Architecture

**Stack:**
- React 18 with TypeScript (strict mode, `noUncheckedIndexedAccess`)
- Tailwind v4 via `@tailwindcss/vite` plugin
- `shadcn/ui` primitives (Button, Card, Textarea, Badge, ScrollArea)
- `lucide-react` icons
- `Zod` for runtime schema validation of LLM output
- `react-i18next` for all user-facing strings
- `react-router` (hash routing) for navigation
- `Dexie.js` for IndexedDB persistence (profile storage)

**Component tree (CVBuilder page):**

```
CVBuilder (page)
  Header (border-b, print:hidden)
    Title / subtitle
    ThemeConfigPanel (template picker, color pickers, font selects, section-style controls)
    Export buttons (PDF / MD legacy)
  Main content (flex row)
    Left panel (preview area, flex-1)
      Pre-generation form (job description + recommendations + generate button)
      OR Post-generation:
        InteractiveCVPreview (thin dispatcher — owns content-mutation callbacks only)
          TEMPLATE_COMPONENTS[templateId] (Classic | Modern | Executive | Minimal)
            CVHeader (name, title, contact — contact variant from sectionVariants registry)
            Body sections, each wrapped in SectionFrame (shared chrome: drag, move
            up/down, collapse, page-break, label) — Executive additionally groups
            skills/education/certifications into a fixed bottom 2-col grid
              renderSectionContent() dispatches each section's body to the variant
              registry (sectionVariants/registry.ts) based on ThemeConfig.sectionVariants
    Right panel (print:hidden)
      BuilderAssistantPanel (quick suggestions + chat refinement)
  Hidden <style> tag (print CSS: @page, page-keep, cv-preview-card overrides)
```

**Data flow:**
```
Profile (IndexedDB) + Job Description + Recommendations
  -> cvBuilderService.generateCv() 
    -> LLM chatCompletion() -> raw JSON string
      -> extractJsonObject() (strip markdown fences)
        -> normalizeCvJson() (normalize section shapes)
          -> zod parse via CVContentSchema
            -> cvContent state (CVContent)
              -> InteractiveCVPreview renders React components
                -> window.print() captures same React DOM
```

**State management:**
- All CV content lives in `cvContent: CVContent | null` state in `CVBuilder`
- `InteractiveCVPreview` receives `content + onContentChange` props — it never owns the data
- Sub-components (`ExperienceItemCard`, `SkillsView`, `EducationItemCard`) manage their own editing UI state locally (e.g., `editing` boolean, `draft` form state)
- Drag-to-reorder mutates `content.sections` array directly via `onContentChange`
- Section collapse state (`collapsed: Set<string>`) is local to `InteractiveCVPreview` (not persisted)
- `themeConfig: ThemeConfig` state in `CVBuilder`/`CLBuilder` is seeded from
  `localStorage` (`artemis:cvThemeConfig` / `artemis:clThemeConfig` via
  `src/app/utils/themeConfigStorage.ts`) and written back on every change — a template/color/
  font/section-variant choice survives reload and navigation, per document type independently

### Data Model (Zod Schema)

`src/types/cv.ts` defines the complete CV structure using Zod discriminated unions:

```
CVContent {
  name: string            // Candidate's full name
  title: string           // Professional headline
  location?: string       // Primary location
  sections: CVSection[]   // Array of 6 possible section types (discriminated by "type")
}

CVSection (discriminated union):
  | { type: "summary", content: string }
  | { type: "contact", email?, phone?, linkedin?, website?, location? }
  | { type: "skills", skills?: string[], categories?: { name, items[] }[] }
  | { type: "experience", experience?: { role, company, period, location?, description?, bullets?[] }[] }
  | { type: "education", education?: { degree, institution, period, location? }[] }
  | { type: "certifications", certifications?: string[] }
```

Key design decisions:
- `sections` is an array, not a fixed object — this enables reordering
- `experience` items support both `bullets[]` (modern) and `description` (legacy) fields
- `skills` supports flat `skills[]` and grouped `categories[]` — mutually exclusive fields
- All fields are mutable by the user through inline editing
- `ThemeConfig` (`src/types/cv.ts`) = `{ templateId, primaryColor, accentColor, textColor,
  headingFont, bodyFont, sectionVariants }`. `templateId` is one of the 4 `TEMPLATE_IDS`
  (`"classic" | "modern" | "executive" | "minimal"`). `sectionVariants` is a loose
  `Record<SectionType, string>` overriding the active template's default rendering style for
  any of the 6 section types — see **Theme System** below.

### LLM Generation Pipeline

`src/app/services/cvBuilderService.ts` orchestrates LLM-based CV generation:

1. **Prompt construction**: `buildMessages()` assembles system prompt (from `prompts.ts`) + user message with profile markdown, job description, and recommendations
2. **API call**: `chatCompletion()` sends to the configured endpoint (OpenAI-compatible, Anthropic, Google Gemini, or WebLLM)
3. **JSON extraction**: `extractJsonObject()` strips markdown fences from LLM output
4. **Normalization**: `normalizeCvJson()` handles malformed section shapes (e.g., if LLM outputs `{ "summary": "..." }` instead of `{ "type": "summary", "content": "..." }`)
5. **Retry logic**: `withJsonRetry()` retries up to 3 times with corrective feedback when JSON is invalid
6. **Error classification**: `AppError` with `ErrorCode` enum — distinguishes JSON parse errors, schema validation errors, and LLM API failures
7. **Edit mode**: `editCv()` sends the current CV JSON + user request back to the LLM for iterative refinement

### Rendering Architecture

The preview and print output use the **same React component tree** — this is the critical design choice:

**Preview rendering:**
- `InteractiveCVPreview.tsx` receives `CVContent` and renders themed React components
- Theme applied via `cvThemes.ts` `getCVTheme(templateId, accentColor)` → `CVTheme` object with `React.CSSProperties`
- Theme controls: font family, name/title sizes, section title color, body/muted colors, tag colors, divider styles, card shadow/border
- Three templates: **Modern** (Inter, bold, blue accent, card shadow), **Classic** (Playfair Display/Georgia, serif, italic title), **Minimal** (Inter, no shadow, flat)

**Print rendering (Phase 1):**
- `window.print()` captures the React DOM directly
- `@media print` CSS hides sidebar, header, assistant panel, add buttons, drag handles, move buttons, collapse toggles
- `@page { size: A4; margin: 0.15in; }` sets page geometry
- `page-keep` class on individual experience/education items prevents mid-item breaks
- `print-color-adjust: exact` preserves accent colors and tag backgrounds
- `cv-preview-card` gets `box-shadow: none; border: none` during print
- `print:hidden` on buttons and interactive elements
- No iframe, no separate HTML generation — the React DOM is the source of truth

**Previous approach (replaced):**
- The old `renderCVToHTML()` / `renderingEngine.ts` iframe approach (standalone HTML generation
  + hidden iframe + `win.print()`) has been fully removed — no `renderingEngine.ts` file exists
  in the codebase anymore. `window.print()` against the live React DOM is the only path, for
  both CV and Cover Letter.

### Interactive Features

**Inline editing (every field):**
- Name, title: `InlineInput` (click to edit, blur to save)
- Contact (email, phone, LinkedIn, location): `InlineInput` per field
- Summary: `InlineTextarea` (click, edit, save/cancel) — or a `callout`-styled variant, see Theme System
- Experience role/company/period/location: `ExperienceItemCard` has a modal editing mode with form inputs + bullet point editor
- Skills: `SkillsView` has an editing mode with drag-to-reorder, category toggle, add/remove
- Education: `EducationItemCard` modal editing mode
- Certifications: inline `InlineInput` per item

**Drag-to-reorder, collapse/expand, and page-break, all via shared `SectionFrame`:**
- Body sections (summary, experience, skills, education, certifications) are rendered from `bodySections` array (filtered from `content.sections`, excluding "contact")
- `src/components/cv/SectionFrame.tsx` is the one chrome component all 4 templates wrap every
  body section in — `GripVertical` drag handle, up/down arrow buttons, collapse toggle
  (chevron), and a page-break toggle, plus the `SECTION_LABELS` title. Previously this chrome
  only existed inline in the Classic render path, so the Executive template silently lacked
  reorder/collapse/page-break; extracting it into one component means every current and future
  template gets all three by construction.
- Drag events use native HTML5 drag API (`onDragStart`, `onDragOver`, `onDragEnd`)
- `moveSection()` (in `InteractiveCVPreview.tsx`) maps visual index → actual `sections[]` array index, handling index shift after splice
- Contact section stays fixed in the header area (not in the body section list)
- Collapse state (`collapsed: Set<string>`) and drag state live in `InteractiveCVPreview` (not persisted — resets on re-render)
- Page-break is a `pageBreakBefore` flag stored directly on the section object (persisted with the rest of `CVContent`)
- On the **Executive** template specifically, skills/education/certifications are always grouped
  into a fixed bottom 2-column grid (its distinguishing structural feature) — each is still
  individually wrapped in `SectionFrame`, so reorder/collapse/page-break work on them, but
  reordering them relative to summary/experience has no visible effect since their grid
  position is fixed by design, not by array order.

### Theme System

Theme is three independent, freely-combinable layers, all driven by one `ThemeConfig`
(`src/types/cv.ts`) and rendered through `ThemeConfigPanel`:

1. **Template** (`templateId`) — one of 4 curated presets in `src/components/cv/templates.ts`
   (`TEMPLATE_PRESETS`), each grounded in a real resume-design category: **Classic** (single
   column, serif heading, neutral — safest all-purpose), **Modern** (single column, sans-serif,
   accent-forward), **Executive** (bottom 2-column grid, compact, for dense senior profiles),
   **Minimal** (single column, no color, spacious — ATS-safe). A preset seeds default colors,
   fonts, spacing, and default section variants; picking a template in the UI applies its full
   preset (`applyTemplatePreset()`).
2. **Colors/fonts** (`primaryColor`, `accentColor`, `textColor`, `headingFont`, `bodyFont`) —
   3 hex color pickers + 2 font selects in `ThemeConfigPanel`, converted to a `CVTheme` object
   of `React.CSSProperties` by `getCVTheme()` in `cvThemes.ts`. Every section variant component
   consumes `theme` for all of its text (name/title/body/muted colors) — this was previously
   inconsistent: `ExperienceItemCard`/`EducationItemCard`/`InlineTextarea` hardcoded gray
   Tailwind classes regardless of the chosen colors, so customization only ever reached the
   header. That gap is closed: every variant in `sectionVariants/` is theme-aware.
3. **Section variants** (`sectionVariants: Record<SectionType, string>`) — each of the 6 section
   types has 2-3 independent rendering styles, resolved per-section via `resolveVariant()` and
   looked up in `src/components/cv/sectionVariants/registry.ts`: summary (`paragraph`/
   `callout`), contact (`stacked`/`badges`), skills (`tags`/`columns`/`inline`), experience
   (`classic`/`cards`/`timeline`), education (`classic`/`cards`), certifications (`list`/
   `tags`). A section's variant defaults to whatever the active template preset specifies, but
   is independently overridable in `ThemeConfigPanel`'s "Section styles" control — e.g. skills
   can render in the `columns` style while experience stays `classic`, regardless of template.
   Only the read-only render differs per variant; the edit-mode form (`ExperienceItemCard`/
   `EducationItemCard`) is shared across all variants of a section type, since it's editing tool
   chrome rather than document style.

Theme choice (including section variants) persists to `localStorage` per document type
(`artemis:cvThemeConfig`, `artemis:clThemeConfig`) via `src/app/utils/themeConfigStorage.ts`.

**Cover Letter builder:** `ThemeConfigPanel` accepts `showTemplateSelector={false}` there —
`InteractiveCLPreview` has no template/section concept (a letter has no discrete sections to
vary), so the template picker and section-style controls are hidden entirely. Color and font
pickers are unchanged and still apply via `getCVTheme(themeConfig)`.

### Export Pipeline

**PDF Export (primary, current approach):**
1. User clicks "Export PDF" button
2. `printPDF` callback calls `window.print()`
3. Browser applies `@media print` CSS:
   - Hides: sidebar, header, assistant panel, all buttons, drag handles, collapse toggles, empty/error states, page-break indicators
   - Formats: A4 page size, 0.15in margins, white background, exact color reproduction
   - Preserves: all CV content, theme colors, fonts, page-break-avoid on individual items
4. Browser print dialog opens — user selects "Save as PDF" or printer
5. Output: multi-page PDF matching the on-screen preview

Known limitation: Browser header/footer (URL, date, page numbers) appears in the PDF and cannot be removed programmatically — the user must disable "Headers and footers" in the print dialog.

**MD Export (legacy):**
- `downloadMarkdownExport()` manually serializes `CVContent` to Markdown
- Simple text format: headers, bullet lists, inline text
- No formatting control, no theming
- Useful as a fallback or for ATS systems that prefer plain text
- File name: `cv.md`

### Pre-Generation Layout

Before the LLM generates a CV, the page shows:
- **Job description textarea** (pre-populated by Analysis Hub handoff, optional)
- **Recommendations checkboxes** (pre-populated from analysis, each with optional additional context textarea)
- **Generate CV button** triggers the LLM pipeline
- **How-to-use guide** card with numbered steps

### Post-Generation Layout

After generation, the page splits:
- **Left panel**: Interactive preview (full width, scrollable, themed)
- **Right panel**: AI Assistant sidebar for refinement:
  - Quick suggestion buttons (add metrics, shorten, reorder, formatting)
  - Chat input for custom requests → triggers `editCv()` which sends current CV JSON + request to LLM
  - Responses overwrite the entire `cvContent` state

---

## 2. Cover Letter Studio (`/cl-builder`)

- **File:** `src/app/pages/CLBuilder.tsx`
- **Service Integration:** `src/app/services/clBuilderService.ts`

### Pre-Generation Layout
- Captures company-specific variables:
  - **Company Name** (default: "the company")
  - **Position/Role Title** (default: "the role")
  - **Job Description**
- Uses the seed draft generated during the initial match analysis to skip prompt latency.

### Post-Generation Split Screen
- **Left Panel (Document View)**: Renders the cover letter.
- **Right Panel (AI Refinement Assistant)**:
  - Provides text inputs to customize and request style/content changes dynamically via `editCoverLetter` chats.
- **Styling**: `ThemeConfigPanel` with `showTemplateSelector={false}` — color and font pickers
  only, no template or section-style controls (letters have no template/section concept). See
  **Theme System** above.

### Exports

- **CL Builder**: `.md` file download via `src/app/utils/download.ts`.

---

## Key Files

| Path | Purpose |
|------|---------|
| `src/app/pages/CVBuilder.tsx` | Main CV builder page — state, generation, layout, print CSS, error handling |
| `src/app/pages/CLBuilder.tsx` | Cover letter builder page |
| `src/app/services/cvBuilderService.ts` | LLM integration: prompt building, JSON normalization, retry with corrective feedback |
| `src/app/services/clBuilderService.ts` | Cover letter LLM integration |
| `src/components/cv/InteractiveCVPreview.tsx` | Thin dispatcher — owns content-mutation callbacks + drag/collapse state, renders the selected template shell |
| `src/components/cv/InteractiveCLPreview.tsx` | Cover letter interactive preview (single fixed layout, no template concept) |
| `src/components/cv/templates.ts` | `TEMPLATE_PRESETS` (4 templates as data), `applyTemplatePreset()`, `resolveVariant()`, `spacingScale()` |
| `src/components/cv/templates/` | The 4 template shell components (`ClassicTemplate`, `ModernTemplate`, `ExecutiveTemplate`, `MinimalTemplate`), `SingleColumnBase.tsx` (shared shell for the 3 single-column ones), `CVHeader.tsx` (shared name/title/contact) |
| `src/components/cv/SectionFrame.tsx` | Shared chrome (drag, move up/down, collapse, page-break, label) every template wraps each body section in |
| `src/components/cv/sectionVariants/` | Per-section-type style variants (`summary.tsx`, `contact.tsx`, `skills.tsx`, `experience.tsx`, `education.tsx`, `certifications.tsx`) + `registry.ts` lookup |
| `src/components/cv/renderSectionContent.tsx` | Dispatches a `CVSection` to its resolved variant + wires up edit callbacks (Add/Update/Remove) |
| `src/components/cv/cvThemes.ts` | Theme definitions: `CVTheme` interface + `getCVTheme()` — colors/fonts only; template structure and section variants live elsewhere |
| `src/components/cv/EditComponents.tsx` | `ExperienceItemCard`/`EducationItemCard` (shared edit form + variant-aware view dispatch), `SkillsView`, `SECTION_LABELS` |
| `src/components/cv/InlineEdit.tsx` | InlineInput + InlineTextarea shared edit components |
| `src/types/cv.ts` | Zod schema + TypeScript types: CVContent, CVSection (discriminated union), ThemeConfig, TEMPLATE_IDS, SECTION_VARIANTS_BY_TYPE |
| `src/app/types/cv.ts` | Barrel re-export for app-level imports |
| `src/app/services/prompts.ts` | Prompt templates with v3 schema — system prompts for generation + edit modes |
| `src/app/components/builder/BuilderAssistantPanel.tsx` | Shared AI Assistant sidebar (both builders) |
| `src/app/components/builder/BuilderErrorDisplay.tsx` | Shared error display with retry button |
| `src/app/components/builder/ThemeConfigPanel.tsx` | Template picker, color/font pickers, per-section style controls — `showTemplateSelector` prop hides the template/section controls for CL |
| `src/app/utils/themeConfigStorage.ts` | localStorage get/set for `ThemeConfig`, used by both builders to persist theme choice |
| `src/app/utils/jsonParse.ts` | Markdown fence stripping for LLM JSON responses |
| `src/app/utils/errors.ts` | `AppError` class + `ErrorCode` enum for categorized error handling |
| `src/app/context/BuilderHandoffContext.tsx` | Cross-route data transfer from Analysis Hub to builders |
