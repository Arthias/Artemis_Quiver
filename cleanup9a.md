# cleanup9a.md — Sprint 9a Code Revision & Cleanup

> Temporary log. Delete when `cleanup/sprint-9a` merges back to `main`.

## Branch
`cleanup/sprint-9a` (based on `main` @ `ef7cd67`)

## Baseline (before changes)

| Metric | Value |
|--------|-------|
| Tests | 102 passing, 11 files |
| Typecheck errors | 35 (known pre-existing) |
| Fallow unused files | 4 (all extension files — false positives, separate build entry) |
| Fallow unused exports | 0 |
| Fallow clone groups | 30 groups, 889 lines (7.8%) |
| Fallow maintainability | 90.7 (good) |
| Fallow high complexity | 79 functions above threshold |
| Fallow refactoring targets | 6 (nano-inject.ts, ExtensionBridgeContext, overlay.ts, clParser.ts, shared.ts, InteractiveCVPreview.tsx) |

---

## Log

### 2026-06-10: Baseline Fallow sweep
- Full sweep complete. Results above.
- 4 "unused files" are extension-specific (background.ts, overlay.ts, nano-inject.ts, useExtensionImport.ts) — not reachable from app entry points but referenced by extension build. Will suppress with fallow-ignore.
- 30 clone groups to tackle across: CVBuilder/CLBuilder pages, provider adapters, InteractiveCVPreview, background/overlay, job-sites/overlay.
- 79 high-complexity functions. Main offenders: nano-inject (CRITICAL), InteractiveCVPreview, overlay.ts render, clParser, CVBuilder/CLBuilder/Profile/AnalysisHub page components.

### 2026-06-10: Task 2 — Clone group reduction
- [x] Extracted `InlineInput` + `InlineTextarea` to `src/components/cv/InlineEdit.tsx`
  - Removed 79 lines × 2 = 158 lines duplication between InteractiveCVPreview and InteractiveCLPreview
- [x] overlay.ts now imports `matchJobSite`, `parseSiteEntry`, `domainMatches` from `./job-sites` instead of redefining
  - Exported `domainMatches` from job-sites.ts
  - Removed ~30 lines duplication
- Remaining clones are in provider adapters (shared error handling) and CVBuilder/CLBuilder page handlers — lower ROI to extract further

### 2026-06-10: Task 3 — Audit `any` types
- [x] `renderingEngine.ts` — replaced 6 `as any` casts with type-safe `findSection<T>()` helper using discriminated union
- [x] `ExtensionBridgeContext.tsx` — replaced `msg: any` with `ArtemisMessage` union type, `resp: any` with proper response type, `(stored as any)` removed
- [x] `ErrorLogContext.tsx` — replaced `msg: any` with typed message payload
- Remaining `any` types are in extension files (chrome.* API surface, inherently untyped) and test files — acceptable

### 2026-06-10: Final Fallow sweep

| Metric | Before | After |
|--------|--------|-------|
| Unused files | 4 | 1 (useExtensionImport.ts — legitimately extension-only) |
| Unused exports | 0 | 9 (new visibility from .fallowrc; mostly public API surface) |
| Clone groups | 30 groups, 889 lines (7.8%) | 24 groups, 622 lines (6.3%) |
| Maintainability | 90.7 | 90.8 |
| LOC | 11,830 | 10,410 |
| Tests | 102 passing | 102 passing ✅ |

Remaining items not sprint-scoped: large page components (AnalysisHub 426L, CVBuilder 340L, Profile 316L), provider adapter clones, extension error handling standardization — better suited for a focused refactoring sprint.

---

## Final Sweep

| Check | Status |
|-------|--------|
| `npm run test` | ✅ 102 passing, 11 files |
| `npm run typecheck` | ⚠️ 35 pre-existing errors (unchanged) |
| `npx fallow` | ✅ Config loaded, 91 files analyzed |
| `npx fallow dead-code` | ⚠️ 1 file + 9 exports (all either extension-only or public API surface) |
| `npx fallow dupes` | ⚠️ 24 groups, 622 lines (6.3%) — down from 30 groups, 889 lines (7.8%) |
| `npx fallow health` | ⚠️ 97 above threshold — MI 90.8 (good), large page components remain |

---

*Mark for deletion when branch merges to `main`.*
