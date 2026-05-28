---
tags: [roadmap, planning, backlog]
status: completed  
last_updated: 2026-05-28
---

# Development Plan & Sprint Backlog

This document maps out the roadmap, completed milestones, and pending backlog items for Artemis Quiver.

> [!NOTE] CV Builder Upgrade Complete
> The CV Builder now generates JSON output and supports themed PDF export via HTML rendering with 3 theme options (Modern, Classic, Minimal). See [[../30-Features/CV Builder Themed PDF Export|CV Builder Feature Doc]] for details.

---

## 🏗️ Sprint Progress Overview

| Sprint | Goal / Focus | Status |
|---|---|---|
| **Sprint 0** | Workspace Profiles & Custom Themes | **Done** |
| **Sprint 1** | Session History & Builder Handoffs | **Done** |
| **Sprint 2** | Smart Profile Merging & Assistant Chats | **Done** |
| **Sprint 3** | CV & Cover Letter Generation Services | **Done** |
| **Sprint 4** | UI Polish & Testing Infrastructure | **Done** |
| **Sprint 4b** | Prompt Engineering & Optimization Modes | **Done** |
| **Sprint 5** | Feature Polish (Analysis chats & MD Previews) | **Not Started** |
| **—** | Prompt Engineering & Optimization Modes | **Done** |

---

## 🏃 Active & Backlog Tasks

### Sprint 4 — UI Polish & Testing Infrastructure (Done)
- [x] **Remove redundant past analyses dropdown** — Session loading unified under sidebar "Recent Analyses"
- [x] **Fix sidebar session sync bug** — `useEffect` dependency narrowed to `[activeProfileId]`
- [x] **Add collapsible prompt view** — Analyze job posting shown as expandable read-only card
- [x] **Two CV Optimization buttons** — "Edit Profile" + "Generate CV with Recommendations"
- [x] **Auto-generate CV on handoff** — `autoGenerate: true` flag in `BuilderHandoff`
- [x] **Fix CV dark background** — Explicit white background in rendering engine
- [x] **Fix minimal theme CSS** — Added missing `break` in theme switch
- [x] **Fix CSS injection** — Replaced `escapeHtml` with color validation
- [x] **Print PDF via iframe ref** — Reuse existing preview iframe instead of creating new
- [x] **Clean up 7 duplicate files** — Removed scattered copies from wrong directories
- [x] **Restore 3 missing type files** — `workspace.ts`, `analysis.ts`, `llm.ts` restored
- [x] **Scaffold testing infrastructure** — vitest, tsconfig strict mode, typecheck script
- [x] **Write 46 tests** — 8 test files covering rendering engine, all 6 services, JSON parsing

### Sprint 5 — Feature Polish (Backlog)
- [ ] **Follow-up Chat on Job Analysis**: Add a chat interface to the Analysis Hub page to allow secondary questions on the parsed job posting.
- [ ] **Markdown Render Preview on Profile page**: Integrate a fully-styled Markdown-to-HTML parser component (like `react-markdown`) on the Profile view instead of pure text wraps.

---

## 🗃️ Sprint History & Code Changes

### Sprint 0 — Multi-profile Setup
- [x] Create [workspace.ts](file:///F:/Dev/Artemis_Quiver/src/app/types/workspace.ts) schemas.
- [x] Set up [WorkspaceProfileContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/WorkspaceProfileContext.tsx).
- [x] Refactor config, profile, and analysis providers to use workspace context.
- [x] Create active profile selector modal and footer switcher.
- [x] Code legacy data migration logic in local storage.

### Sprint 1 — Context Glue
- [x] Configure sidebar "Recent Analyses" array.
- [x] Connect `activeSessionId` and "New Analysis" options.
- [x] Set up [BuilderHandoffContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/BuilderHandoffContext.tsx) to pass data between page routes.

### Sprint 2 — Profile Upgrades
- [x] Implement AI-assisted profile merges with preview and diff confirm flags.
- [x] Design the AI Profile Assistant chat interface with per-profile storage.

### Sprint 3 — Document Generation
- [x] Implement [cvBuilderService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/cvBuilderService.ts) and [clBuilderService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/clBuilderService.ts).
- [x] Build split-screen editors with interactive modification chats and Markdown download streams.

### Sprint 4 — UI Polish & Testing Infrastructure (Done)
- [x] Fix session sync: narrowed `useEffect` deps to `[activeProfileId]`
- [x] Remove redundant past analyses dropdown, add collapsible prompt view
- [x] Add two CV Optimization buttons with auto-generate handoff
- [x] Fix CV dark background, missing break, CSS escaping in rendering engine
- [x] Clean up 7 duplicate files, restore 3 missing type files
- [x] Scaffold testing infra: vitest, tsconfig strict mode, 46 tests

### Sprint 4b — Prompt Engineering & Optimization Modes (Done)
- [x] Gap analysis: Audited current prompts against 10 expert CV optimization scenarios
- [x] Created `src/app/services/prompts.ts` — Centralized prompt library with 10 specialized optimization modes
- [x] Enhanced CV generation prompt with industry/role context, action-verb guidance, metrics emphasis, anti-cliché rules
- [x] Added 9 new specialized prompt templates: summary-rewrite, bullet-optimize, ats-optimize, career-transition, audit, work-history-align, skills-section, headline, hiring-manager
- [x] Added `classifyEditIntent()` — Auto-detects optimization mode from free-text user requests via regex
- [x] Added `optimizeCv()` public API — Targeted text-only optimizations alongside JSON-producing modes
- [x] Updated `cvBuilderService.ts` — Refactored to use prompts module, mode-based JSON/text routing, accepts `GenerateCvOptions`
- [x] 5 new cvBuilderService tests (11 total, up from 6) covering context passthrough, mode routing, mode enumeration
- [x] Updated docs: AI Prompt Templates (full rewrite), CHANGELOG, Test Cases, Plan

---

## 📂 Key Code Files & Roles

| Path | Role |
|---|---|
| [WorkspaceProfileContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/WorkspaceProfileContext.tsx) | Handles multi-profile storage orchestration. |
| [workspaceStorage.ts](file:///F:/Dev/Artemis_Quiver/src/app/utils/workspaceStorage.ts) | Performs low-level localStorage actions (read, write, migrate, evict). |
| [ProfileSwitcherModal.tsx](file:///F:/Dev/Artemis_Quiver/src/app/components/workspace/ProfileSwitcherModal.tsx) | The UI modal for adding and choosing profiles. |
| [BuilderHandoffContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/BuilderHandoffContext.tsx) | Manages job parameters passing between route views. |
| [profileMergeService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/profileMergeService.ts) | Performs smart merging of text payloads via LLM. |
| [profileChatService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/profileChatService.ts) | Prompts local models to suggest segment edits. |
| [cvBuilderService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/cvBuilderService.ts) | Orchestrates CV generation and inline edit prompts. |
| [clBuilderService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/clBuilderService.ts) | Orchestrates Cover Letter generation and inline edit prompts. |
