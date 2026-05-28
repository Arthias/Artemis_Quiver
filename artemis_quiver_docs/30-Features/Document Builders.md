---
tags: [feature, cv-builder, cl-builder, document-builder]
status: completed
last_updated: 2026-05-28
---

# 📝 Document Builders (CV & Cover Letter)

Artemis Quiver provides two interactive builders: **CV Studio** and **Cover Letter Studio**. These tools allow users to generate tailored copies from their master profile, refine them iteratively via chat, and export them as plain text/Markdown files.

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

### Pre-Generation Layout
- Renders an input field for the **Job Description** (pre-populated by handoff).
- The **Generate CV** trigger prompts the local model to build a structured CV (Contact, Summary, Skills, Experience, Education, Certifications).

### Post-Generation Split Screen
- **Left Panel (Document View)**: Renders the generated CV markdown.
- **Right Panel (AI Refinement Assistant)**:
  - **Quick Suggestions**: Quick-click suggestion buttons for rapid alterations:
    - *Add more metrics* (Measurable achievements)
    - *Shorten experience* (Consolidate sentences)
    - *Reorder sections* (Prioritize core roles)
    - *Change formatting* (Formatting adjustments)
  - **Custom Request Chat**: A text input box for arbitrary user instructions (e.g., "rewrite the StartupXYZ bullet points to emphasize Go development").

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

## 📤 Markdown Exports

Both builders feature a download button that calls [download.ts](file:///F:/Dev/Artemis_Quiver/src/app/utils/download.ts). This triggers browser downloads of raw `.md` documents locally (e.g. `cv.md`, `cover-letter.md`).
