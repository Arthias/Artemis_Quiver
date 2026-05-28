---
tags: [meta, changelog, history]
status: completed
last_updated: 2026-05-28
---

# Changelog

## [v2.0.0] - May 28, 2026

### ✨ Major Features Added
- **Structured JSON Output** — LLM now generates valid JSON (not Markdown) using Zod schema validation
- **Themed HTML Rendering** — Three professional themes: Modern (default), Classic, Minimal  
- **PDF Export** — Via hidden iframe printing for clean output without UI bleed-through
- **XSS Protection** — All content escaped to prevent injection attacks

### 🐛 Bug Fixes
- Fixed Vite import resolution: `src/app/types/cv` was a directory, not a file — created barrel re-export
- Fixed syntax error in `src/types/cv.ts` (extra `>` in type export)
- Fixed missing `error` state variable in CVBuilder causing `ReferenceError`
- Fixed textarea missing `onChange` handler (read-only controlled input warning)
- Fixed LLM 400 error: changed invalid `role: "format"` to `role: "system"`
- Fixed JSON parsing: replaced raw `JSON.parse` with `extractJsonObject` (handles markdown fences)
- Fixed blank CV rendering: added `normalizeCvJson()` to handle LLM format mismatches

### 📁 Files Created
- `src/types/cv.ts` — Zod schema with full TypeScript types
- `src/components/cv/renderingEngine.ts` — Core JSON→HTML converter with 3 themes
- `src/components/cv/CVRenderer.tsx` — React iframe rendering component
- `src/app/types/cv.ts` — Barrel re-export for app-level imports

### 📝 Files Modified
- `src/app/services/cvBuilderService.ts` — Updated prompts, added `normalizeCvJson()`, fixed `role` values
- `src/app/pages/CVBuilder.tsx` — Added error state, textarea onChange, fence-stripping JSON parse
- `src/app/components/cv/renderingEngine.ts` — Fixed broken import path
- `README.md` — Updated feature table

### 🔧 Breaking Changes
**Before:** CV exports as Markdown text (`.md`)  
**After:** CV renders as HTML via iframe, exported as PDF from browser print dialog

---

## [v1.0.0] - Original Implementation

Plain Markdown generation via chat completion API call. Exported with `blob:` URLs for download.
