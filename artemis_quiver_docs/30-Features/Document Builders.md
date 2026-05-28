---
tags: [feature, cv-builder, cl-builder, document-builder]
status: completed
last_updated: 2026-05-28
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

### Architecture (v2 — Structured JSON + Themed HTML)
- LLM generates **structured JSON** (Zod-validated schema) instead of raw Markdown
- JSON is normalized via `normalizeCvJson()` — handles both `{"type":"summary","content":"..."}` and `{"summary":"..."}` formats
- `renderCVToHTML()` converts JSON to themed HTML (Modern / Classic / Minimal)
- PDF export via iframe printing (clean isolation from app UI)

**Schema:** `src/types/cv.ts` — 6 section types: summary, contact, skills, experience, education, certifications

### Pre-Generation Layout
- Renders an input field for the **Job Description** (pre-populated by handoff, optional).
- If `autoGenerate: true` is set in the handoff (e.g., from Analysis Hub's "Generate CV with Recommendations" button), CV generation starts automatically on mount.
- The **Generate CV** trigger prompts the local model to build a structured CV JSON.
- Theme configuration panel (color picker + template selector) appears only after generation.

### Post-Generation Split Screen
- **Left Panel (Document View)**: Renders the generated CV in a themed iframe.
- **Right Panel (AI Refinement Assistant)**:
  - **Quick Suggestions**: Quick-click suggestion buttons for rapid alterations:
    - *Add more metrics* (Measurable achievements)
    - *Shorten experience* (Consolidate sentences)
    - *Reorder sections* (Prioritize core roles)
    - *Change formatting* (Formatting adjustments)
  - Export button for `.md` (legacy) and PDF via browser print dialog.

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

- **CV Builder**: PDF export via browser print dialog (themed HTML rendered in isolated iframe). Legacy `.md` export also available.
- **Cover Letter Builder**: `.md` file download via [download.ts](file:///F:/Dev/Artemis_Quiver/src/app/utils/download.ts).

## 📁 Key Files

| Path | Purpose |
|------|---------|
| `src/types/cv.ts` | Zod schema + TypeScript types for CV structure |
| `src/types/cv.ts` | Zod schema + TypeScript types for CV structure (canonical) |
| `src/app/types/cv.ts` | Barrel re-export for app-level imports |
| `src/components/cv/renderingEngine.ts` | JSON → themed HTML converter (3 themes) |
| `src/app/services/cvBuilderService.ts` | LLM integration + JSON normalization |
| `src/app/utils/jsonParse.ts` | Markdown fence stripping for LLM JSON responses |
