---
tags: [meta, changelog, history]
status: completed
last_updated: 2026-05-28
---

# Changelog

## [v2.3.0] - May 28, 2026

### Features
- **Follow-up Chat on Analysis Hub** — New chat section after analysis results for asking follow-up questions and generating side content (e.g. "Why do you want to work at this company?", salary negotiation advice, interview prep)
- **`followUpChat()` service** — New function in `jobAnalysisService.ts` with a dedicated system prompt preserving the job application coach persona for coherent multi-turn conversations
- **Persistent chat history** — `AnalysisSession.followUpMessages` stored per session, loaded on session switch, shared via context
- **Quick-action suggestion pills** — 5 common follow-up scenarios: company motivation, interview skills, thank-you email, interviewer questions, culture summary
- **3 new jobAnalysisService tests** — follow-up chat with history, empty history, and context passthrough

### Files Modified
- `src/app/types/analysis.ts` — Added `followUpMessages?: ChatMessage[]` to `AnalysisSession`
- `src/app/services/jobAnalysisService.ts` — Added `followUpChat()` function + `FOLLOWUP_SYSTEM_PROMPT`
- `src/app/context/AnalysisContext.tsx` — Added `followUpMessages`, `followUpLoading`, `sendFollowUpMessage()` state/actions
- `src/app/pages/AnalysisHub.tsx` — Added follow-up chat UI section with message list, input, suggestion pills
- `src/app/services/__tests__/jobAnalysisService.test.ts` — 3 new follow-up chat tests (8 total, up from 5)
- `docs/90-Meta/CHANGELOG.md` — This entry

## [v2.2.0] - May 28, 2026

### Features
- **Prompt system overhaul** — Extracted all CV prompts into centralized `prompts.ts` with 10 specialized optimization modes: standard, summary-rewrite, bullet-optimize, ats-optimize, career-transition, audit, work-history-align, skills-section, headline, hiring-manager
- **Intent classification** — `classifyEditIntent()` auto-detects optimization mode from user's free-text request via regex keyword matching
- **`optimizeCv()` function** — New public API for targeted text-only optimizations (audit, summary, bullets, headline, etc.) alongside JSON-producing modes
- **Enhanced CV generation prompt** — Added industry/role context, action-verb guidance, metrics emphasis, and anti-cliché rules to the base generation prompt
- **5 new cvBuilderService tests** — Industry context passthrough, mode routing, non-JSON mode passthrough, `optimizeCv()` audit mode, all 9 non-standard modes iteration

### Files Created
- `src/app/services/prompts.ts` — Centralized prompt library with 10 optimization modes + intent classifier

### Files Modified
- `src/app/services/cvBuilderService.ts` — Refactored to use prompts module, added `GenerateCvOptions`, `optimizeCv()`, mode-based JSON/text routing
- `src/app/services/__tests__/cvBuilderService.test.ts` — 5 new tests (11 total, up from 6)
- `docs/20-APIs/AI Prompt Templates.md` — Full rewrite documenting all 10 optimization modes
- `docs/90-Meta/CHANGELOG.md` — This entry
- `docs/50-Testing/Test Cases.md` — Added prompt optimization test cases

## [v2.1.0] - May 28, 2026

### ✨ Features
- **Collapsible prompt view** — Analysis Hub now shows the analyzed job posting as a collapsible read-only card (click to expand/collapse)
- **Two CV Optimization buttons** — "Edit Profile" (navigates to `/profile`) and "Generate CV with Recommendations" (auto-generates CV on mount)
- **Auto-generate handoff** — `BuilderHandoff` now supports `autoGenerate: true` flag, enabling one-click CV generation from Analysis Hub
- **Testing infrastructure** — vitest config, tsconfig with strict mode, 46 tests across 8 files (rendering engine + 6 services + JSON parse util)
- **Type safety** — Restored 3 missing type files (`workspace.ts`, `analysis.ts`, `llm.ts`), typecheck script with `tsc --noEmit`

### 🐛 Bug Fixes
- **Analysis Hub session sync** — Fixed `useEffect` in `AnalysisContext.tsx` resetting results on session load (dependency array narrowed to `[activeProfileId]`)
- **CV Builder dark theme** — Added `background: #ffffff` to all 3 theme CSS blocks in `renderingEngine.ts` so CV renders on white paper regardless of app theme
- **`renderingEngine.ts` missing break** — Added missing `break` after `case "minimal"` — minimal theme CSS was being overwritten by the `default` case
- **CSS injection breaking fonts** — Replaced `escapeHtml()` on entire CSS with regex-validated `primaryColor` injection (font declarations no longer HTML-escaped)
- **Print PDF** — Simplified to reuse the existing preview iframe via `useRef` instead of creating a new hidden iframe
- **Theme preview shown before CV generation** — Removed redundant theme preview card from pre-generation state
- **Unused imports** — Fixed unused `CVSectionSchema` import in `cvBuilderService.ts` and unused `editCv` import in `CVBuilder.tsx`
- **Import paths** — Fixed broken imports in `CVBuilder.tsx`, `renderingEngine.ts`, and `CVRenderer.tsx` after duplicate file cleanup

### 🧹 Cleanup
- **Deleted 7 duplicate files** — Removed scattered copies of `renderingEngine.ts`, `renderingEngine.test.ts`, and `CVRenderer.tsx` from `src/app/types/cv/` and `src/app/components/cv/` directories. Also removed `src/app/cv.ts` (full duplicate of `src/types/cv.ts`). Canonical files remain in `src/components/cv/` and `src/types/`.
- **Removed past analyses dropdown** — The redundant `<Select>` dropdown on Analysis Hub was removed. Session navigation is now handled exclusively by the sidebar's "Recent Analyses" section.

### 📁 Files Created
- `src/app/types/workspace.ts` — Restored from git history
- `src/app/types/analysis.ts` — Restored from git history
- `src/app/types/llm.ts` — Restored from git history
- `tsconfig.json` — Strict mode TypeScript config
- `tsconfig.node.json` — Node build config
- `vitest.config.ts` — Test runner config
- `src/app/services/__tests__/jobAnalysisService.test.ts` — 5 tests
- `src/app/services/__tests__/cvBuilderService.test.ts` — 6 tests
- `src/app/services/__tests__/clBuilderService.test.ts` — 4 tests
- `src/app/services/__tests__/profileMergeService.test.ts` — 2 tests
- `src/app/services/__tests__/profileChatService.test.ts` — 5 tests
- `src/app/services/__tests__/llmService.test.ts` — 5 tests
- `src/app/utils/__tests__/jsonParse.test.ts` — 6 tests

### 📝 Files Modified
- `src/app/context/AnalysisContext.tsx` — Fixed useEffect dependency array
- `src/app/pages/AnalysisHub.tsx` — Removed dropdown, added collapsible prompt view, two CV buttons
- `src/app/pages/CVBuilder.tsx` — Auto-generate handoff, iframe ref print, removed theme preview, fixed import
- `src/components/cv/renderingEngine.ts` — White background, missing break, CSS escaping fix, import fix
- `src/components/cv/CVRenderer.tsx` — Fixed import path
- `src/app/services/cvBuilderService.ts` — Removed unused import
- `src/components/cv/renderingEngine.test.ts` — Fixed import path
- `package.json` — Added test, test:watch, typecheck scripts
- `README.md` — Updated feature table

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
- `README.md` — Updated feature table

### 🔧 Breaking Changes
**Before:** CV exports as Markdown text (`.md`)  
**After:** CV renders as HTML via iframe, exported as PDF from browser print dialog

---

## [v1.0.0] - Original Implementation

Plain Markdown generation via chat completion API call. Exported with `blob:` URLs for download.
