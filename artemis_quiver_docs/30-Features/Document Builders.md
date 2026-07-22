---
tags: [feature, cv-builder, cl-builder, document-builder]
status: maintained
last_updated: 2026-07-21
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
    ThemeConfigPanel (color picker + template dropdown)
    Export buttons (PDF / MD legacy)
  Main content (flex row)
    Left panel (preview area, flex-1)
      Pre-generation form (job description + recommendations + generate button)
      OR Post-generation:
        Page breaks toggle
        InteractiveCVPreview
          cv-preview-card (themed container)
            Header row (name, title, contact inline edits)
            Body sections (SectionBlock[])
              Summary (InlineTextarea)
              Experience (ExperienceItemCard[])
              Skills (SkillsView)
              Education (EducationItemCard[])
              Certifications (InlineInput[])
            Page break indicators (optional, absolute-positioned divs)
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
- `ThemeConfig` uses `primaryColor` (hex) + `templateId` ("modern" | "classic" | "minimal")

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
- `renderCVToHTML()` in `renderingEngine.ts` generated standalone HTML
- Hidden iframe loaded this HTML, then called `win.print()`
- Two separate render paths always diverged (preview never matched PDF)
- `renderingEngine.ts` still exists for the Cover Letter builder and as a fallback

### Interactive Features

**Inline editing (every field):**
- Name, title: `InlineInput` (click to edit, blur to save)
- Contact (email, phone, LinkedIn, location): `InlineInput` per field
- Summary: `InlineTextarea` (click, edit, save/cancel)
- Experience role/company/period/location: `ExperienceItemCard` has a modal editing mode with form inputs + bullet point editor
- Skills: `SkillsView` has an editing mode with drag-to-reorder, category toggle, add/remove
- Education: `EducationItemCard` modal editing mode
- Certifications: inline `InlineInput` per item

**Drag-to-reorder sections (Phase 2):**
- Body sections (summary, experience, skills, education, certifications) are rendered from `bodySections` array (filtered from `content.sections`, excluding "contact")
- Each `SectionBlock` has a `GripVertical` drag handle + up/down arrow buttons
- Drag events use native HTML5 drag API (`onDragStart`, `onDragOver`, `onDragEnd`)
- `moveSection()` maps visual index → actual `sections[]` array index, handling index shift after splice
- Contact section stays fixed in the header area (not in the body section list)

**Collapse/expand (Phase 2):**
- Each `SectionBlock` has a collapse toggle (chevron icon, right-aligned)
- State tracked in `collapsed: Set<string>` by section type
- Collapsed sections show a dashed border with "Collapsed" placeholder
- Useful for focusing on specific sections during editing
- Not persisted (collapsed state resets on re-render)

**Pagebreak preview (Phase 2):**
- Toggle button: "Show page breaks" / "Hide page breaks"
- When enabled, `useLayoutEffect` measures `previewRef.current.scrollHeight`
- Calculates page boundaries at `PAGE_HEIGHT_PX` (1050px ≈ A4 at preview scale)
- Renders absolutely-positioned dashed rose lines with "Page N" labels
- Hidden during print via `print:hidden`
- Approximate indicator (equal intervals, not exact text-flow pagination)

### Theme System

The `ThemeConfigPanel` (shared with the Builder sidebar) exposes:
- **Color picker**: Hex input for `primaryColor` — controls section title color, tag backgrounds, title text, link colors
- **Template selector**: Radio/tab toggle for `templateId` — modern, classic, minimal

Theme application is split across two systems:
1. **Screen preview** (`cvThemes.ts`): Returns `CVTheme` object with `React.CSSProperties` — applied as inline `style` props on React elements
2. **Print** (CSS in CVBuilder's `<style>` tag): `getCvThemeStyles()` in `renderingEngine.ts` generates CSS strings — currently unused for CV print but available

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
| `src/components/cv/InteractiveCVPreview.tsx` | React interactive preview — all section rendering, inline editing, drag-to-reorder, collapse/expand, pagebreak indicators |
| `src/components/cv/InteractiveCLPreview.tsx` | Cover letter interactive preview |
| `src/components/cv/renderingEngine.ts` | JSON → themed HTML converter (3 themes, print CSS) — legacy for CL, fallback for CV |
| `src/components/cv/cvThemes.ts` | Theme definitions: CVTheme interface + getCVTheme() for 3 templates |
| `src/components/cv/InlineEdit.tsx` | InlineInput + InlineTextarea shared edit components |
| `src/types/cv.ts` | Zod schema + TypeScript types: CVContent, CVSection (discriminated union), ThemeConfig |
| `src/app/types/cv.ts` | Barrel re-export for app-level imports |
| `src/app/services/prompts.ts` | Prompt templates with v3 schema — system prompts for generation + edit modes |
| `src/app/components/builder/BuilderAssistantPanel.tsx` | Shared AI Assistant sidebar (both builders) |
| `src/app/components/builder/BuilderErrorDisplay.tsx` | Shared error display with retry button |
| `src/app/components/builder/ThemeConfigPanel.tsx` | Shared theme selector + color picker |
| `src/app/utils/jsonParse.ts` | Markdown fence stripping for LLM JSON responses |
| `src/app/utils/errors.ts` | `AppError` class + `ErrorCode` enum for categorized error handling |
| `src/app/context/BuilderHandoffContext.tsx` | Cross-route data transfer from Analysis Hub to builders |
