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

### 2026-06-10: Task 1 — Remove legacy localStorage code
- [x] Confirmed: all localStorage calls are already removed from source
- [x] Updated `Local Storage.md` — replaced "One-Shot Migration" section with simpler init description
- [x] Updated `Profile Workspace.md` — "Autosave to localStorage" → "IndexedDB"
- [x] Updated `Plan.md` — marked task done, updated table entry (workspaceStorage.ts → profileDefaults.ts)
- [x] Updated `Test Cases.md` — 1.1 and 1.3 now reference IndexedDB instead of localStorage
- [x] Updated `Coding Standards.md` — utils description no longer mentions "localStorage"
- Cleanup: no source changes needed, only documentation

---

## Final Sweep

| Check | Status |
|-------|--------|
| `npm run test` | |
| `npm run typecheck` | |
| `npx fallow` | |
| `npx fallow dead-code` | |
| `npx fallow dupes` | |
| `npx fallow health` | |

---

*Mark for deletion when branch merges to `main`.*
