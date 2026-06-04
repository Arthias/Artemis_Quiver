---
tags: [roadmap, planning, backlog]
status: planning  
last_updated: 2026-06-04
---

# Development Plan & Sprint Backlog

This document maps out the roadmap, completed milestones, and pending backlog items for Artemis Quiver.

> [!NOTE] Strategy shift — Local-first suite, not SaaS
> Artemis Quiver is evolving from a pure MVP into a **local-first job hunting suite**: downloadable, private, buy-once. No cloud dependency, no subscription. See debates in `90-Meta/`. The roadmap below reflects this direction.

> [!NOTE] CV Builder v3 — Interactive Preview + Error Resilience
> The CV Builder features an interactive React preview with inline editing on all sections, plus a categorized error handling system (`AppError` / `ErrorCode`) with automatic retry (up to 3 attempts) and corrective feedback to the LLM on parse failures. See [[../30-Features/Document Builders|Document Builders]] for details.

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
| **Sprint 5** | Feature Polish (Follow-up Chat + MD Preview) | **Done** |
| **Sprint 6** | Local Database — IndexedDB Migration | **Done** |
| **Sprint 6b** | Code Quality & Technical Debt Cleanup | **Done** |
| **Sprint 7** | Chrome Extension — One-Click Job Import | **Done** |
| **Sprint 8** | Application Kanban — Pipeline Tracker | **Planned** |
| **Sprint 9** | Outreach Generator — Cold Messages | **Planned** |
| **Sprint 10** | Cloud LLM Fallback — API Key Support | **Planned** |
| **Sprint 11** | Interview Simulator — STAR + Technical | **Future** |
| **Sprint 12** | Desktop App — Tauri Wrap & Monetize | **Future** |

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

### Sprint 5 — Feature Polish (Done)
- [x] **Follow-up Chat on Job Analysis**: Add a chat interface to the Analysis Hub page to allow secondary questions on the parsed job posting.
- [x] **Markdown Render Preview on Profile page**: Integrate `react-markdown` with `remark-gfm` on the Profile page so users see a formatted version when not in edit mode.

### Sprint 5 Details
- [x] Added `followUpMessages` to `AnalysisSession` type for per-session chat persistence
- [x] Created `followUpChat()` service in `jobAnalysisService.ts` with follow-up-specific system prompt
- [x] Added `followUpMessages`, `followUpLoading`, `sendFollowUpMessage()` to `AnalysisContext`
- [x] Built chat UI in `AnalysisHub.tsx`: message list with user/assistant styling, input with Enter-to-send, 5 quick-action suggestion pills
- [x] History persists across session switches and survives page reloads
- [x] 3 new tests for follow-up chat (8 total in jobAnalysisService, 54 total across project)
- [x] Installed `react-markdown` + `remark-gfm` for GitHub-flavored Markdown rendering
- [x] Replaced raw `whitespace-pre-wrap` profile view with `<ReactMarkdown>` render, dark-mode compatible via `prose-invert`

---

## 🎯 Future Sprints

### Sprint 6 — Local Database: IndexedDB Migration (Done)
Replaces localStorage with Dexie.js (IndexedDB wrapper) for scalable local persistence.

**Goal:** Remove the 5MB localStorage ceiling, enable relational queries, and support future features (Kanban, interview history, templates).

**Tasks:**
- [x] Install Dexie.js (`dexie` + `dexie-react-hooks`)
- [x] Design schema: `profiles`, `analysisSessions`, `metadata` (future placeholders ready for `applications`, `interviewSessions`, `templates`)
- [x] Create `src/app/db/schema.ts` — Dexie DB class with versioned schema
- [x] Create `src/app/db/profileRepo.ts` — CRUD for profiles (replaces `workspaceStorage.ts` functionality)
- [x] Create `src/app/db/sessionRepo.ts` — CRUD for analysis sessions
- [x] Create barrel export `src/app/db/index.ts`
- [x] Migration utility: `localStorage → IndexedDB` one-shot on first launch with self-healing checks
- [x] Replace `WorkspaceProfileContext` localStorage ops with Dexie calls
- [x] Replace `AnalysisContext` localStorage ops with Dexie calls
- [x] Add loading states while IndexedDB async ops resolve (Workspace Loader)
- [x] Test: profile create/switch/edit persist across reloads
- [x] Test: analysis sessions survive at 50+ sessions
- [x] Test: migration from existing localStorage data
- [x] Test: window.matchMedia mock safety in test environment

**Key Files to Create:**
- `src/app/db/schema.ts`
- `src/app/db/profileRepo.ts`
- `src/app/db/sessionRepo.ts`
- `src/app/db/applicationRepo.ts`
- `src/app/db/migrations.ts`
- `src/app/db/interviewRepo.ts`
- `src/app/db/templateRepo.ts`
- `src/app/db/index.ts`

---

### Sprint 6b — Code Quality & Technical Debt Cleanup (Active)

Systematic cleanup driven by [Fallow](https://docs.fallow.tools/quickstart) static analysis. Results from `npx fallow` (v2.88.2): 121 files analyzed, 14 entry points, 128 dead-code issues, 18 clone groups, 55 complexity hotspots.

**Goal:** Reduce dead code, eliminate duplication, and lower complexity before feature work resumes.

**Tasks:**

#### Dead Code — Unused Files (39 files)
- [ ] **Remove 29 unused shadcn/ui components** (not imported anywhere): accordion, alert-dialog, alert, aspect-ratio, avatar, breadcrumb, calendar, carousel, chart, checkbox, collapsible, command, context-menu, drawer, dropdown-menu, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, switch, table, tabs, textarea, toggle, toggle-group, tooltip
- [ ] **Remove `default_shadcn_theme.css`** — unused root-level CSS
- [ ] **Remove `src/app/components/figma/ImageWithFallback.tsx`** — unused Figma component
- [ ] **Verify remaining unused files** before deletion (confirm no runtime need)

#### Dead Code — Unused Exports (52 exports)
- [ ] **Prune `prompts.ts`** (12 unused): `cvGeneratePrompt`, `summaryRewritePrompt`, `bulletOptimizePrompt`, `atsOptimizePrompt`, `careerTransitionPrompt`, and 7 more
- [ ] **Prune `workspaceStorage.ts`** (7 unused): `profileDataKey`, `createDefaultSettings`, `loadProfileData`, `saveProfileData`, `loadManifest`, and 2 more
- [ ] **Prune `card.tsx`** (6 unused exports), **`select.tsx`** (5), **`dialog.tsx`** (4)
- [ ] **Prune `errors.ts`** (3 unused): `ErrorDomain`, `ErrorSeverity`, `ERROR_CATALOG`
- [ ] **Prune `sessionRepo.ts`** (2 unused): `getSession`, `deleteSessionsForProfile`
- [ ] **Prune `badge.tsx`** — `badgeVariants` unused
- [ ] **Prune type exports** (5 unused): re-exports in `db/index.ts`, `clBuilderService.ts` `CLContent`, `types/cv.ts` `CVSection`
- [ ] **Review remaining 6 files** with partial unused exports

#### Dead Code — Unused Dependencies (13 packages)
- [ ] **Remove unused npm packages:** `@emotion/react`, `@emotion/styled`, `@mui/icons-material`, `@mui/material`, `@popperjs/core`, `canvas-confetti`, `dexie-react-hooks`, `motion`, `react-dnd`, `react-dnd-html5-backend`, and 3 more (run `npx fallow dead-code --format json` for full list)

#### Dead Code — Broken Imports
- [ ] **Fix unresolved imports** in `clBuilderService.ts` (`:6 ../types/cl` and `:145 ../types/cl`)
- [ ] **Resolve duplicate export** `CLContent` in `clBuilderService.ts` ↔ `src/types/cl.ts`

#### Duplication — 18 Clone Groups (716 lines, 5.5%)
- [ ] **CLBuilder ↔ CVBuilder** (7 groups, 150 lines): Extract shared state initialization, PDF print logic, theme picker, error display, and markdown download into shared hooks/components
- [ ] **InteractiveCVPreview ↔ InteractiveCLPreview** (1 group, 79 lines): Extract shared preview rendering logic
- [ ] **InteractiveCVPreview self-duplication** (3 groups, 38 lines): Extract repeated inline editing logic
- [ ] **cvBuilderService.ts self-duplication** (2 groups, 21 lines): Extract `normalizeSection` repeated patterns
- [ ] **clBuilderService.ts self-duplication** (2 groups, 20 lines): Extract repetitive section processing
- [ ] **llmService.ts** (2 groups, 19 lines): Extract shared API call boilerplate
- [ ] **Test file duplication** (1 group, 17 lines): Extract shared test setup/mocks in `__tests__/profileChatService.test.ts` and `profileMergeService.test.ts`

#### Complexity — Large Functions (10 over 60 lines)
- [ ] **Refactor `AnalysisHub.tsx`** (417 lines) — split into sub-components
- [ ] **Refactor `CVBuilder.tsx`** (380 lines) — split into sub-components
- [ ] **Refactor `CLBuilder.tsx`** (378 lines) — split into sub-components
- [ ] **Refactor `WorkspaceProfileContext.tsx`** (337 lines) — split provider logic
- [ ] **Refactor `Profile.tsx`** (316 lines) — split into sub-components
- [ ] **Refactor `InteractiveCVPreview.tsx`** (260 lines) — split inline editing
- [ ] **Refactor `renderingEngine.ts` `renderCVToHTML`** (233 lines) — break into focused functions
- [ ] **Refactor `AnalysisContext.tsx`** (216 lines) — split provider logic

#### Complexity — High Complexity Functions (55 total)
- [ ] **Refactor `clParser.ts:parsePlainTextToCLContent`** (51 cyclomatic, 109 cognitive, CRITICAL)
- [ ] **Refactor `renderingEngine.ts:renderCVToHTML`** (43 cyclomatic, 65 cognitive, CRITICAL)
- [ ] **Refactor `migrations.ts:migrateFromLocalStorage`** (34 cyclomatic, 51 cognitive, CRITICAL)
- [ ] **Refactor `InteractiveCVPreview.tsx:InteractiveCVPreview`** (22 cyclomatic, CRITICAL CRAP)
- [ ] **Refactor `llmService.ts:chatCompletion`** (21 cyclomatic, HIGH)
- [ ] **Refactor `chart.tsx`** (4 critical/high functions, 20/16/16/12 cyclomatic)
- [ ] **Refactor `cvBuilderService.ts:normalizeSection`** (19 cyclomatic, HIGH)
- [ ] **Refactor `jobAnalysisService.ts:validateAnalysisResult`** (14 cyclomatic, HIGH)
- [ ] **Refactor `prompts.ts:classifyEditIntent`** (13 cyclomatic, HIGH)
- [ ] **Address remaining 46 high-complexity functions** (see `npx fallow health`)

#### Complexity — Refactoring Targets (34 targets)
- [ ] **5 low-effort wins:** Remove 100% dead exports from `hover-card.tsx`, `resizable.tsx`, `avatar.tsx`, `collapsible.tsx`, `alert.tsx`
- [ ] **26 medium-effort:** Extract shared logic from `cvBuilderService.ts`, `card.tsx`, `chart.tsx`, `workspaceStorage.ts`, `sheet.tsx`, and 21 more
- [ ] **3 high-effort:** Major extraction from `InteractiveCVPreview.tsx`, `CVBuilder.tsx`, `CLBuilder.tsx`

**Key Files to Delete (after verification):**
- `default_shadcn_theme.css`
- `src/app/components/figma/ImageWithFallback.tsx`
- 29 unused shadcn/ui components in `src/app/components/ui/`

**Dependencies:** None (self-contained cleanup)

---

### Sprint 7 — Chrome Extension: One-Click Job Import (Done)

**Goal:** Click extension icon on any job page → extract content → pre-fill in Analysis Hub.

**Tasks:**
- [x] Create `src/extension/manifest.json` — Chrome MV3 manifest with scripting, activeTab, storage permissions
- [x] Create `src/extension/background.ts` — Service worker with `chrome.action.onClicked` → injects extraction via `chrome.scripting.executeScript`
- [x] Create `src/app/hooks/useExtensionImport.ts` — React hook listening for `chrome.runtime.onMessage` + `chrome.storage.session`
- [x] Create `vite.ext.config.ts` — Separate Vite build producing `dist-ext/`
- [x] Switch `createBrowserRouter` → `createHashRouter` for extension pathname compatibility
- [x] Change default `serverUrl` from Vite proxy (`/api/lmstudio`) to absolute URL (`http://192.168.8.171:1234`)
- [x] LinkedIn smart extraction: MutationObserver waits for DOM stability, trims content at "About the job" / "About the company" boundaries
- [x] Non-LinkedIn fallback: instant `document.body.innerText` extraction
- [x] Wire `useExtensionImport` into `AnalysisHub.tsx` with formatting callback
- [x] Fix `closingIdx` ReferenceError in `clParser.ts` (hoisted block-scoped variable)
- [x] Add `build:ext` script to `package.json`, update `.gitignore`
- [x] Merge ChromExt branch into main

**Key Files Created:**
- `src/extension/manifest.json`
- `src/extension/background.ts`
- `src/app/hooks/useExtensionImport.ts`
- `vite.ext.config.ts`

**Key Files Modified:**
- `src/app/routes.tsx` — hash router
- `src/app/config/defaults.ts` — absolute serverUrl
- `src/app/pages/AnalysisHub.tsx` — extension hook
- `src/app/utils/clParser.ts` — scope fix

---

### Sprint 8 — Application Kanban (Pipeline Tracker)
Visual pipeline for tracking job applications through the hiring stages.

**Goal:** Users manage their full job hunt pipeline — from saved → applied → interviewing → offer → closed.

**Tasks:**
- [ ] Define `Application` type in `src/app/types/application.ts`:
  - `id`, `company`, `role`, `url`, `status`, `notes`, `timeline[]` (status changes + dates)
  - `linkedSessionId?` (optional link to analysis session)
  - `contactName?`, `contactEmail?`, `nextFollowUp?`
- [ ] Wire up via `ApplicationContext.tsx` with Dexie CRUD
- [ ] Build KanbanBoard component (column layout, react-dnd drag & drop)
- [ ] Columns: Saved → Applied → Phone Screen → Interview → Offer → Rejected → Accepted
- [ ] Card component: company, role, date, status badge, quick actions
- [ ] Click card → expand detail panel: full info, notes, timeline, linked analysis
- [ ] Create application from Analysis Hub: "Save to pipeline" button after analysis
- [ ] Manual create: "Add Application" button with company/role/URL fields
- [ ] Auto-fill from job fetch: when user fetches a URL, pre-fill the create form
- [ ] **Bonus: Email fetch for status checking:**
  - Create `src/app/services/emailFetchService.ts` — IMAP/Gmail API connector
  - Config UI per profile: IMAP server/credentials or Google OAuth
  - Scan inbox for job-related emails (by company/role keywords)
  - Auto-update Kanban status (e.g., "Interview scheduled" email → move to Interview column)
  - Flag emails for manual review when confidence is low
  - Security note: credentials stored locally in IndexedDB, never sent to cloud
- [ ] New route: `/pipeline`
- [ ] Sidebar navigation entry: "Pipeline"
- [ ] Test: drag & drop column transitions
- [ ] Test: application CRUD (create, edit, archive, delete)
- [ ] Test: linking application to analysis session
- [ ] Test: email fetch parsing (mock IMAP responses)

**Key Files to Create:**
- `src/app/types/application.ts`
- `src/app/context/ApplicationContext.tsx`
- `src/app/components/pipeline/KanbanBoard.tsx`
- `src/app/components/pipeline/KanbanColumn.tsx`
- `src/app/components/pipeline/ApplicationCard.tsx`
- `src/app/components/pipeline/ApplicationDetail.tsx`
- `src/app/pages/Pipeline.tsx`
- `src/app/services/emailFetchService.ts`

**Dependencies:** Sprint 6 (IndexedDB), Sprint 7 (URL→App auto-create)

---

### Sprint 9 — Outreach Generator
Generate personalized cold messages for LinkedIn, email, and follow-ups.

**Goal:** One-click generation of outreach messages based on profile + job context.

**Tasks:**
- [ ] Create `src/app/services/outreachService.ts`:
  - `linkedInMessage(profile, jobContext, style)` — cold message for recruiter
  - `coldEmail(profile, jobContext, style)` — email to hiring manager
  - `followUpMessage(context, stage)` — post-interview thank-you / status check
  - Style variants: technical-focus, culture-focus, short-pitch
- [ ] Write prompt templates in `prompts.ts` for each message type
- [ ] Add "Outreach" tab/panel in Analysis Hub after analysis completes
- [ ] Quick-select style via buttons (Technical, Cultural, Short)
- [ ] Copy-to-clipboard + "Open in LinkedIn" link
- [ ] Save generated messages to application (Sprint 8) timeline
- [ ] Template editor: user can save custom templates per profile
- [ ] Test: generated messages reference actual profile skills + job requirements
- [ ] Test: style variants produce distinctly different tones
- [ ] Test: saved messages persist in IndexedDB

**Key Files to Create:**
- `src/app/services/outreachService.ts`

**Dependencies:** Sprint 8 (application timeline, template storage)

---

### Sprint 10 — Cloud LLM Fallback
Support cloud LLM providers so users without local models can use the app.

**Goal:** OpenAI / Anthropic API key configuration as fallback when local LLM is unavailable.

**Tasks:**
- [ ] Add provider options to Config: `Local (LMStudio/Ollama)`, `OpenAI`, `Anthropic`
- [ ] API key input fields (masked, stored in IndexedDB, never logged)
- [ ] Create `src/app/services/cloudLlmService.ts`:
  - `openaiChatCompletion(messages, opts)` — calls `/v1/chat/completions`
  - `anthropicChatCompletion(messages, opts)` — calls `/v1/messages`
- [ ] Create unified `LlmRouter` in `llmService.ts`:
  - Try local first → if timeout/connection refused → fall back to cloud
  - Configurable: local-only, cloud-only, local→cloud fallback
- [ ] Test connection for cloud providers
- [ ] Token usage tracking (optional, for user awareness)
- [ ] Warning banner on Analysis Hub when falling back to cloud ("Using OpenAI — data leaves your machine")
- [ ] Test: provider switching mid-session
- [ ] Test: local → cloud fallback chain
- [ ] Test: API key validation (bad key → clear error, not cryptic 401)

**Key Files to Create:**
- `src/app/services/cloudLlmService.ts`

**Dependencies:** Sprint 6 (IndexedDB for secure key storage)

---

### Sprint 11 — Interview Simulator (v2 target)
Interactive mock interviews with structured STAR feedback.

**Goal:** Text-based interview practice against a job, with actionable feedback.

**Tasks:**
- [ ] New route: `/interview`
- [ ] Create `src/app/services/interviewService.ts`:
  - `generateBehavioralQuestion(jobContext)` — role-specific behavioral prompts
  - `generateTechnicalQuestion(role, skills)` — role-specific technical questions
  - `evaluateSTAR(answer, question)` — score answer against STAR rubric
  - `generateFeedback(session)` — full session report
- [ ] Interview modes: Behavioral (STAR), Technical, Mixed, Cultural Fit
- [ ] Chat-style UI: question → user types answer → feedback → next question
- [ ] Session persistence: save interview history to IndexedDB
- [ ] Final report: strengths, weaknesses, STAR compliance score, suggested improvements
- [ ] Question bank seeded by profile skills + job requirements
- [ ] Test: STAR evaluation consistency
- [ ] Test: technical question relevance to listed skills
- [ ] Test: session save/restore

**Key Files to Create:**
- `src/app/pages/Interview.tsx`
- `src/app/services/interviewService.ts`
- `src/app/context/InterviewContext.tsx`

**Dependencies:** Sprint 6 (IndexedDB), Sprint 8 (pipeline → interview linking)

---

### Sprint 12 — Desktop App & Monetization
Package as downloadable desktop app with one-time purchase.

**Goal:** Users download and install Artemis Quiver as a native app. Monetize via buy-once license.

**Tasks:**
- [ ] Choose wrapper: **Tauri** (Rust, smaller binary, better perf) vs Electron (larger ecosystem)
- [ ] Scaffold Tauri/Electron project
- [ ] Port Vite dev config to Tauri/Electron build pipeline
- [ ] Native file system access (for exports, profile imports)
- [ ] Auto-update mechanism (Tauri updater or electron-updater)
- [ ] License key validation (simple offline check or Gumroad API)
- [ ] Landing page: `artemis-quiver.dev` — features, screenshots, demo video
- [ ] Gumroad / LemonSqueezy product page — $19 one-time
- [ ] Trial mode: 14-day full-featured trial, then lock behind license
- [ ] Distribution: Windows (MSI), macOS (DMG), Linux (AppImage)
- [ ] Test: install from fresh download on all 3 platforms
- [ ] Test: auto-update from v1 → v2 (schema migration on upgrade)
- [ ] Test: offline functionality (no internet = full access with local LLM)

**Dependencies:** All previous sprints (stable feature set before packaging)

---

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
| [useExtensionImport.ts](file:///F:/Dev/Artemis_Quiver/src/app/hooks/useExtensionImport.ts) | React hook for receiving Chrome Extension import data. |
| [ApplicationContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/ApplicationContext.tsx) | Kanban pipeline state management with Dexie CRUD. |
| [outreachService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/outreachService.ts) | Cold message generation for LinkedIn, email, follow-ups. |
| [cloudLlmService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/cloudLlmService.ts) | OpenAI/Anthropic API integration with fallback routing. |
| [interviewService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/interviewService.ts) | Mock interview Q&A + STAR evaluation + feedback reports. |
| [emailFetchService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/emailFetchService.ts) | IMAP/Gmail connector for auto-status from inbox. |
| `src/app/db/` (dir) | Dexie database layer: schema, repos, migrations. |
