---
tags: [feature, cv-builder, cl-builder, document-builder]
status: completed
last_updated: 2026-05-29
---

# 📝 Document Builders (CV & Cover Letter)

Artemis Quiver provides two interactive builders: **CV Studio** and **Cover Letter Studio**. These tools allow users to generate tailored copies from their master profile, refine them iteratively via chat, and export them.

---

## 🛠️ Builder Data Handoff

When a user clicks "Open CV Builder" or "Edit in Builder" from the [[30-Features/Analysis Hub|Analysis Hub]], job metadata is stored in `BuilderHandoffContext` and transferred across the route boundaries:

```text
Analysis Hub (Route: /)
 └── click event triggers context store (setHandoff)
      └── redirect (navigate)
           └── Page Component mounts (CVBuilder / CLBuilder)
                └── consumeHandoff() called to populate input fields & suggestions
```

---

## 📄 1. CV Studio (`/cv-builder`)

- **File:** [CVBuilder.tsx](file:///F:/Dev/Artemis_Quiver/src/app/pages/CVBuilder.tsx)
- **Service Integration:** [cvBuilderService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/cvBuilderService.ts)

### Architecture (v3 — Interactive Preview + Inline Editing)
- LLM generates **structured JSON** (Zod-validated schema) with top-level name/title/location fields
- JSON rendered as an **interactive React preview** ([InteractiveCVPreview.tsx](file:///F:/Dev/Artemis_Quiver/src/components/cv/InteractiveCVPreview.tsx)) with click-to-edit inline editing on every section
- `renderCVToHTML()` converts JSON to themed HTML (Modern / Classic / Minimal) for PDF export
- PDF export via hidden iframe printing (clean isolation from app UI)

**Schema:** `src/types/cv.ts` — Top-level: `name`, `title`, `location` + 6 section types: summary, contact, skills, experience, education, certifications. Experience items support `bullets[]` and `location`. Skills support `categories[]`.

### Pre-Generation Layout
- Renders an input field for the **Job Description** (pre-populated by handoff, optional).
- If `autoGenerate: true` is set in the handoff (e.g., from Analysis Hub's "Generate CV with Recommendations" button), CV generation starts automatically on mount.
- The **Generate CV** trigger prompts the local model to build a structured CV JSON.
- Theme configuration panel (color picker + template selector) appears only after generation.

### Post-Generation Interactive Preview
- **Left Panel (Document View)**: Renders an interactive CV preview built with React components. Every field is editable inline:
  - **Name / Title / Contact**: Click any field (name, title, email, phone, location, LinkedIn) to edit inline
  - **Professional Summary**: Click to edit in a textarea with Save/Cancel
  - **Work Experience**: Each item is clickable to edit role, company, period, location, and bullet points (one per line). Add/remove items.
  - **Skills**: Click to edit tag list or grid. Add/remove individual skills.
  - **Education**: Each item is clickable to edit degree, institution, period. Add/remove items.
  - **Certifications**: Click to edit individual items. Add/remove entries.
  - Changes update the `cvContent` state live and persist to PDF export.
- **Right Panel (AI Refinement Assistant)**:
  - **Quick Suggestions**: Quick-click suggestion buttons for rapid alterations:
    - *Add more metrics* (Measurable achievements)
    - *Shorten experience* (Consolidate sentences)
    - *Reorder sections* (Prioritize core roles)
    - *Change formatting* (Formatting adjustments)
  - Export button for `.md` (legacy) and PDF via hidden iframe print dialog.

---

## ✉️ 2. Cover Letter Studio (`/cl-builder`)

- **File:** [CLBuilder.tsx](file:///F:/Dev/Artemis_Quiver/src/app/pages/CLBuilder.tsx)
- **Service Integration:** [clBuilderService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/clBuilderService.ts)

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

---

## 📤 Exports

- **CV Builder**: PDF export via hidden iframe printing (themed HTML rendered from `renderCVToHTML`). Legacy `.md` export also available.
- **Cover Letter Builder**: `.md` file download via [download.ts](file:///F:/Dev/Artemis_Quiver/src/app/utils/download.ts).

## 📁 Key Files

| Path | Purpose |
|------|---------|
| `src/types/cv.ts` | Zod schema + TypeScript types for CV structure (name, title, sections, bullets, categories) |
| `src/app/types/cv.ts` | Barrel re-export for app-level imports |
| `src/components/cv/renderingEngine.ts` | JSON → themed HTML converter (3 themes, print CSS) |
| `src/components/cv/InteractiveCVPreview.tsx` | React interactive preview with inline editing for all sections |
| `src/app/services/cvBuilderService.ts` | LLM integration + JSON normalization + retry with corrective feedback |
| `src/app/services/prompts.ts` | Prompt templates with v3 schema (name, title, bullets, categories) |
| `src/app/utils/jsonParse.ts` | Markdown fence stripping for LLM JSON responses |
| `src/app/utils/errors.ts` | `AppError` class + `ErrorCode` enum for categorized error handling |
