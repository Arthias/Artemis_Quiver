# Artemis Quiver — Development Plan

> **Failsafe:** This file is the canonical implementation plan. Update it as each sprint/task completes so work can resume after a restart. Last synced: May 2026 (roadmap sprint 0–3 shipped).

## Documentation maintenance

| When | Action |
|------|--------|
| **Before coding** | Ensure this `PLAN.md` reflects the current plan. |
| **After each sprint / major task** | Update task checkboxes, “Current status”, and “Suggested order” here. |
| **After full implementation pass** | Sync `README.md` MVP section to match what shipped. |

`Overview.md` was merged into `README.md` and removed.

---

## Project overview

Artemis Quiver is an AI-driven job hunting engine: compare job postings to a master profile, get scoring and tips, then refine CVs and cover letters via interactive builders. Data stays in the browser (`localStorage`) unless exported as Markdown.

**Design:** [Figma — Job Hunting Automation Engine](https://www.figma.com/design/NAKF9BYIvmXKegz6JDnaJl/Job-Hunting-Automation-Engine)

**Stack (actual):** React 18, Vite, Tailwind CSS, shadcn/ui, React Router v7. Local LLM via LMStudio or Ollama (dev proxy).

**Out of scope:** PDF export, cloud API keys, user login/auth.

---

## Current status

| Area | Status |
|------|--------|
| Analysis Hub + `jobAnalysisService` | **Done** |
| Multi-profile workspace (max 3) | **Done** — `WorkspaceProfileContext`, migration, eviction |
| Settings + theme per profile | **Done** — Light/Dark on General tab |
| Sidebar history + profile modal | **Done** |
| Analysis → builder handoff | **Done** — `BuilderHandoffContext` |
| Profile upload + AI chat | **Done** |
| CV / CL builders (LLM + chat) | **Done** — Markdown export |
| Follow-up analysis chat | **Deferred** (Sprint 4) |
| Markdown preview on Profile | **Deferred** (Sprint 4) |

---

## Implementation sprints

### Sprint 0 — Workspace profiles + theme

- [x] `src/app/types/workspace.ts`
- [x] `src/app/context/WorkspaceProfileContext.tsx`
- [x] Refactor `ConfigContext`, `ProfileContext`, `AnalysisContext`
- [x] Theme switch on General tab
- [x] `ProfileSwitcherModal` + sidebar footer
- [x] Legacy storage migration

### Sprint 1 — Integration glue

- [x] Sidebar “Recent Analyses” per profile
- [x] `activeSessionId`; New Analysis
- [x] `BuilderHandoffContext` + Analysis Hub handoff

### Sprint 2 — Profile features

- [x] File upload merge with confirmation
- [x] Profile AI Assistant tab + per-profile chat history

### Sprint 3 — CV / Cover Letter AI

- [x] `cvBuilderService` / `clBuilderService`
- [x] Real generation + chat; Markdown export

### Sprint 4 — Optional polish (not started)

- [ ] Follow-up chat on analysis sessions
- [ ] Markdown preview on Profile

---

## Key files

| Path | Role |
|------|------|
| `src/app/context/WorkspaceProfileContext.tsx` | Multi-profile manifest + active data |
| `src/app/utils/workspaceStorage.ts` | Load/save/migrate/evict |
| `src/app/components/workspace/ProfileSwitcherModal.tsx` | Profile picker + add flow |
| `src/app/context/BuilderHandoffContext.tsx` | Analysis → builder payload |
| `src/app/services/profileMergeService.ts` | Upload merge |
| `src/app/services/profileChatService.ts` | Profile AI chat |
| `src/app/services/cvBuilderService.ts` | CV generate/edit |
| `src/app/services/clBuilderService.ts` | Cover letter generate/edit |

---

## Risks

- **Context overflow** — large uploads; merge may truncate in preview.
- **Hallucination** — review LLM merges and generated documents.
- **Errors** — user-facing messages in UI; details in browser console.
