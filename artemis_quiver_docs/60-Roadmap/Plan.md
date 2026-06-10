---
tags: [roadmap, planning, backlog]
status: planning  
last_updated: 2026-06-07
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
| **Sprint 6b** | Code Quality & Technical Debt Cleanup | ✅ **Done** |
| **Sprint 7** | Chrome Extension — One-Click Job Import | **Done** |
| **Sprint 8** | LLM Provider Rebuild — Multi-Provider Config | **Done** |
| **Sprint 9** | Direct Download — WebLLM In-Browser Model | **Planned** |
| **Sprint 9a** | Code Revision & Cleanup | **✅ Done** |
| **Sprint 10** | Application Kanban — Pipeline Tracker | **Planned** |
| **Sprint 11** | Outreach Generator — Cold Messages | **Planned** |
| **Sprint 12** | Interview Simulator — STAR + Technical | **Future** |
| **Sprint 13** | Desktop App — Tauri Wrap & Monetize | **Future** |

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

### Sprint 6b — Code Quality & Technical Debt Cleanup (Done)

Systematic cleanup driven by [Fallow](https://docs.fallow.tools/quickstart) static analysis. Results from `npx fallow` (v2.88.2): 121 files analyzed, 14 entry points, 128 dead-code issues, 18 clone groups, 55 complexity hotspots.

**Goal:** Reduce dead code, eliminate duplication, and lower complexity before feature work resumes.

**Tasks:**

#### Dead Code — Unused Files (39 files)
- [x] **Remove 29 unused shadcn/ui components** — deleted
- [x] **Remove `default_shadcn_theme.css`** — deleted
- [x] **Remove `src/app/components/figma/ImageWithFallback.tsx`** — deleted
- [x] **Verify remaining unused files** — confirmed no runtime need

#### Dead Code — Unused Exports (52 exports)
- [x] **Prune `prompts.ts`** (12 unused) — removed
- [x] **Prune `workspaceStorage.ts`** (7 unused) — removed
- [x] **Prune `card.tsx`** (6), `select.tsx` (5), `dialog.tsx` (4) — removed
- [x] **Prune `errors.ts`** (3 unused) — removed
- [x] **Prune `sessionRepo.ts`** (2 unused) — removed
- [x] **Prune `badge.tsx`** — removed
- [x] **Prune type exports** (5 unused) — removed
- [x] **Review remaining 6 files** — cleared

#### Dead Code — Unused Dependencies (13 packages)
- [x] **Remove unused npm packages** — cleaned

#### Dead Code — Broken Imports
- [x] **Fix unresolved imports** in `clBuilderService.ts` — fixed
- [x] **Resolve duplicate export** `CLContent` — resolved

#### Duplication — 18 Clone Groups (716 lines, 5.5%)
- [x] **CLBuilder ↔ CVBuilder** — extracted shared hooks/components
- [x] **InteractiveCVPreview ↔ InteractiveCLPreview** — extracted shared preview logic
- [x] **InteractiveCVPreview self-duplication** — extracted inline editing logic
- [x] **cvBuilderService.ts self-duplication** — extracted normalizeSection
- [x] **clBuilderService.ts self-duplication** — extracted section processing
- [x] **llmService.ts** — extracted shared API call boilerplate
- [x] **Test file duplication** — extracted shared test setup/mocks

#### Complexity — Large Functions (10 over 60 lines)
- [x] **Refactor `AnalysisHub.tsx`** (417 lines) — split
- [x] **Refactor `CVBuilder.tsx`** (380 lines) — split
- [x] **Refactor `CLBuilder.tsx`** (378 lines) — split
- [x] **Refactor `WorkspaceProfileContext.tsx`** (337 lines) — split
- [x] **Refactor `Profile.tsx`** (316 lines) — split
- [x] **Refactor `InteractiveCVPreview.tsx`** (260 lines) — split
- [x] **Refactor `renderingEngine.ts` `renderCVToHTML`** (233 lines) — split
- [x] **Refactor `AnalysisContext.tsx`** (216 lines) — split

#### Complexity — High Complexity Functions (55 total)
- [x] **Refactor `clParser.ts:parsePlainTextToCLContent`** — reduced
- [x] **Refactor `renderingEngine.ts:renderCVToHTML`** — reduced
- [x] **Refactor `migrations.ts:migrateFromLocalStorage`** — reduced
- [x] **Refactor `InteractiveCVPreview.tsx:InteractiveCVPreview`** — reduced
- [x] **Refactor `llmService.ts:chatCompletion`** — reduced
- [x] **Refactor `chart.tsx`** — reduced
- [x] **Refactor `cvBuilderService.ts:normalizeSection`** — reduced
- [x] **Refactor `jobAnalysisService.ts:validateAnalysisResult`** — reduced
- [x] **Refactor `prompts.ts:classifyEditIntent`** — reduced
- [x] **Address remaining 46 high-complexity functions** — reduced

#### Complexity — Refactoring Targets (34 targets)
- [x] **5 low-effort wins** — completed
- [x] **26 medium-effort** — completed
- [x] **3 high-effort** — completed

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

### Sprint 8 — LLM Provider Rebuild: Multi-Provider Config (Done)

Overhauled the LLM configuration and service layer to support any provider, with primary/secondary model slots.

**Goal:** Users configure any LLM provider (local or cloud) per slot — OpenAI-compatible, Anthropic Claude, Google Gemini — with API keys, model listing, and connection testing.

**Tasks:**

#### Types & Config Model
- [x] Define `ProviderType` union: `"openai-compatible" | "anthropic" | "google-gemini"`
- [x] Define `ModelEndpoint` interface: `{ label, provider, baseUrl, apiKey, model, temperature, maxTokens }`
- [x] Replace flat `LlmConfig` with `{ primary: ModelEndpoint, secondary: ModelEndpoint, secondaryUse: "never" | "fallback" | "quick-tasks" | "always" }`
- [x] Update defaults in `src/app/config/defaults.ts`
- [x] Write migration for existing saved configs to new shape

#### Provider Abstraction Layer
- [x] Create `src/app/services/provider/ProviderAdapter.ts` — interface: `chatCompletion()`, `listModels()`, `testConnection()`
- [x] Create `src/app/services/provider/OpenAICompatibleAdapter.ts` — covers LMStudio, Ollama (OpenAI compat mode), OpenAI, Google Gemini via OpenAI compat, Groq, Together, etc.
- [x] Create `src/app/services/provider/AnthropicAdapter.ts` — native Claude Messages API (`POST /v1/messages`)
- [x] Create `src/app/services/provider/GeminiAdapter.ts` — native Gemini API (optional, OpenAI compat may suffice)
- [x] Create `src/app/services/provider/registry.ts` — factory that returns the correct adapter for a `ProviderType`

#### Model List API
- [x] `OpenAICompatibleAdapter.listModels()` — `GET {baseUrl}/v1/models` → extract model IDs
- [x] `AnthropicAdapter.listModels()` — return empty list (Claude has no public list API; user types manually)
- [x] `GeminiAdapter.listModels()` — `GET {baseUrl}/v1/models` or native equivalent
- [x] Wire list button in Config UI — toggleable dropdown, closes on selection

#### Config UI Revamp
- [x] Two collapsible cards: **Primary Model** + **Secondary Model**
- [x] Each card: provider dropdown, base URL, API key (always visible, blank for local servers), model selector (text input + list button), temperature slider
- [x] "Test Models" button — tests primary only if `secondaryUse: "never"`, tests both otherwise
- [x] "Pull Models" button per slot — fetches and shows model list, closes on select
- [x] Secondary routing strategy selector (never / fallback / quick-tasks / always)

#### Refactor llmService.ts
- [x] `chatCompletion()` accepts `ModelEndpoint` instead of `LlmConfig`
- [x] Routes to correct `ProviderAdapter` via registry
- [x] All existing service callers (jobAnalysisService, cvBuilderService, etc.) pass their designated endpoint
- [x] Implement `secondaryUse: "fallback"` — auto-retry primary → secondary on failure
- [x] Implement `secondaryUse: "quick-tasks"` — classification/scoring to secondary, generation to primary

#### Test Connection
- [x] Per-adapter `testConnection()` implementation
- [x] Send minimal ping (e.g. "Reply with 'ok'") with 30s timeout
- [x] Show success/failure in Config UI with model reply preview

**Key Files Created:**
- `src/app/services/provider/ProviderAdapter.ts`
- `src/app/services/provider/OpenAICompatibleAdapter.ts`
- `src/app/services/provider/AnthropicAdapter.ts`
- `src/app/services/provider/GeminiAdapter.ts`
- `src/app/services/provider/registry.ts`
- `src/app/services/provider/index.ts`

**Key Files Modified:**
- `src/app/types/llm.ts` — new types
- `src/app/config/defaults.ts` — new defaults
- `src/app/services/llmService.ts` — adapter routing
- `src/app/pages/Config.tsx` — dual-model UI
- `src/app/context/ConfigContext.tsx` — new config shape
- `src/app/context/WorkspaceProfileContext.tsx` — normalization
- `src/app/context/AnalysisContext.tsx` — getActiveEndpoint
- `src/app/db/migrations.ts` — upgradeOldConfig
- All service files — ModelEndpoint instead of LlmConfig
- All test files — ModelEndpoint mocks

**Dependencies:** None (self-contained)

---

### Sprint 9 — Direct Download: WebLLM In-Browser Model (Planned)

Let non-technical users download and run a model directly in the browser via WebLLM, no external server needed.

**Goal:** First-run onboarding offers to download a small model (~2-4 GB) that runs inside the extension via WebGPU.

**Tasks:**

#### WebLLM Integration
- [ ] Install `@mlc-ai/web-llm` package
- [ ] Create `src/app/services/provider/WebLLMAdapter.ts`
  - Wraps `CreateMLCEngine()` / `CreateExtensionServiceWorkerMLCEngine()`
  - Implements `chatCompletion()`, `listModels()`, `testConnection()`
  - Stores engine reference in service worker for persistence
- [ ] Add `"wasm-unsafe-eval"` to extension CSP in `manifest.json`
- [ ] Verify WebGPU availability on startup (graceful fallback if unavailable)

#### Model Download & Cache
- [ ] Model catalog for download: Llama 3.2 3B (default, ~2.3 GB), Llama 3.2 1B (fallback, ~880 MB), Qwen2.5 3B (alt, ~2.8 GB), Phi-3.5-mini (alt, ~3.7 GB)
- [ ] Download UI: model picker with size estimate, progress bar via WebLLM `initProgressCallback`
- [ ] Cache downloaded models in browser `Cache API` (persistent across restarts)
- [ ] "Delete model" button to free disk space
- [ ] Estimate VRAM before loading and warn if insufficient

#### First-Run Onboarding
- [ ] On first extension install, show onboarding flow:
  1. "Welcome! Choose how to run AI: Local (download a model) or Remote (connect to existing server)"
  2. If Local: pick model from catalog, show size estimate, start download
  3. Progress bar with time estimate
  4. On complete → test connection, show success
- [ ] If WebGPU unavailable → hide Local option, prompt Remote
- [ ] Skip option → user can configure later in Settings

#### Integration with Provider System
- [ ] WebLLM registers as a provider type (`"webllm"`) in the provider registry
- [ ] Can be assigned to primary or secondary slot like any other provider
- [ ] `WebLLMAdapter.listModels()` returns downloaded models
- [ ] `WebLLMAdapter.testConnection()` runs a quick inference, measures TTFT

#### Edge Cases
- [ ] Handle page reload — service worker persists engine
- [ ] Handle browser storage quota exceeded — show error with guidance
- [ ] Handle model load failure — fall back gracefully
- [ ] Handle tab close during download — resume on reopen (WebLLM caches partial downloads)

**Key Files to Create:**
- `src/app/services/provider/WebLLMAdapter.ts`
- `src/app/components/onboarding/ModelDownloadFlow.tsx`
- Model catalog config (model list with sizes, VRAM reqs, download URLs)

**Key Files to Modify:**
- `src/extension/manifest.json` — CSP for wasm-unsafe-eval
- `src/app/pages/Config.tsx` — WebLLM provider option
- `src/app/services/provider/registry.ts` — register WebLLM

**Dependencies:** Sprint 8a (provider abstraction layer)

---

### Sprint 9a — Code Revision & Cleanup (Done)

Pre-Kanban code hardening sprint.

**Goal:** Address technical debt, improve test coverage, tighten types, and harden the codebase before building the Kanban pipeline tracker.

> [!IMPORTANT] Cleanup phase mandate
> Every cleanup sprint **must** end with a full Fallow sweep (`npx fallow && npx fallow dead-code && npx fallow dupes && npx fallow health`). Multi-agent coding leaves residue (dead exports, clones, orphaned files). Fix all violations before closing. See `40-Development/Coding Standards.md` for details.

**Tasks:**

#### Test Coverage
- [x] **Extension extraction tests** — Unit tests for `extractPageContent()` LinkedIn/non-LinkedIn paths (mock DOM, MutationObserver)
- [x] **Extension job-site tests** — 21 tests for `parseSiteEntry`, `extractBaseUrl`, `matchJobSite`, `isKnownJobSite`
- [x] **Overlay config/position tests** — Unit tests for `loadConfig`, `loadPosition`, `getScoringFailedMessage`, error paths
- [ ] **useExtensionImport hook tests** — Deferred to future sprint
- [ ] **IndexedDB edge cases** — Deferred to future sprint
- [ ] **E2E smoke test** — Deferred to future sprint
- 102 total tests (11 files), all passing ✅

#### Code Quality
- [x] **Extract shared job-sites module** — `src/extension/job-sites.ts` with `SiteEntry` type, `parseSiteEntry`, `matchJobSite`, `extractBaseUrl`
- [x] **Improve overlay init** — `loadConfig`/`loadPosition` wrapped in try/catch; dynamic error msg per fallback mode
- [x] **Auto-save popup config** — No more "Save" button; every change persists immediately with visual feedback
- [x] **Inline site editing** — Popup + Settings: edit job sites in-place (rename, add path patterns) with Enter/Escape
- [x] **Default site exclusion** — Config UI can remove default job sites; stores `excludedSites` in storage
- [x] **Path-aware job site matching** — `matchJobSite()` supports path patterns like `linkedin.com/jobs/*`; overlay + popup use it
- [x] **Popup fingerprint error display** — Shows actual error message when fingerprint generation fails
- [x] **Auto-fill site from tab URL** — Popup pre-fills new-site input with current tab's hostname+path
- [x] **Import `DEFAULT_JOB_SITES` from extension** — Config.tsx no longer duplicates the list
- [x] **Remove legacy localStorage code** — Confirmed clean: all localStorage calls removed from source. Docs updated.
- [x] **Audit `any` types** — 6 `as any` in renderingEngine replaced with type-safe `findSection<T>()`. `msg: any` in ExtensionBridgeContext and ErrorLogContext replaced with typed interfaces. Remaining `any` in extension files (chrome.* API surface) is acceptable.
- [x] **Clone group reduction** — Extracted `InlineInput`/`InlineTextarea` to shared `InlineEdit.tsx` (-158 lines). Overlay now inlines job-site helpers with explanatory comment. Clone groups reduced from 30 to 24, 889→622 lines (7.8%→6.3%).
- [x] **Add `.fallowrc.json`** — Proper entry points for app + extension builds.
- [x] **Bug fixes** — Sidebar session click race, pending import clear by ID, PDF rendering (LinkedIn, layout, SVG icons, second-click export), scroll-to-top after generation.
- [ ] **Standardize error handling in extension** — Deferred to future sprint
- [ ] **Lint & typecheck CI** — Deferred to future sprint

#### Performance
- [ ] **Bundle size audit** — Deferred to future sprint
- [ ] **Lazy-load routes** — Deferred to future sprint
- [ ] **Dexie query optimization** — Deferred to future sprint

#### Developer Experience
- [x] **Update AGENTS.md** — Document current architecture decisions, file map, common commands
- [ ] **Add missing JSDoc** — Deferred to future sprint
- [ ] **Standardize import aliases** — Deferred to future sprint

#### Cleanup Sweep
- [x] **Full Fallow sweep** — Ran `npx fallow && npx fallow dead-code && npx fallow dupes && npx fallow health`. Results: 24 clone groups (down from 30), maintainability 90.8 (good), unused exports are all legitimate public API surface.

**Key Changes:**
- 4 commits on `cleanup/sprint-9a` branch
- Tests: 102 passing, no regressions
- Clone groups: 30→24 groups, 889→622 lines (7.8%→6.3%)
- Maintainability: 90.7→90.8

---

### Sprint 10 — Application Kanban (Pipeline Tracker)
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

**Dependencies:** Sprint 6 (IndexedDB), Sprint 9a (cleanup complete)

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
| [profileDefaults.ts](file:///F:/Dev/Artemis_Quiver/src/app/utils/profileDefaults.ts) | Default data factories: `createEmptyProfileData()`, `MAX_WORKSPACE_PROFILES`, `profileInitials()`. Replaced `workspaceStorage.ts` after IndexedDB migration. |
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
