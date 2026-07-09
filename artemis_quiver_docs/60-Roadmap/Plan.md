---
tags: [roadmap, planning, backlog]
status: planning  
last_updated: 2026-06-13
---

# Development Plan & Sprint Backlog

> Local-first job hunting suite: downloadable, private, buy-once. No cloud dependency.

## Sprint Progress

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 0 | Workspace Profiles & Custom Themes | Done |
| Sprint 1 | Session History & Builder Handoffs | Done |
| Sprint 2 | Smart Profile Merging & Assistant Chats | Done |
| Sprint 3 | CV & Cover Letter Generation Services | Done |
| Sprint 4 | UI Polish & Testing Infrastructure | Done |
| Sprint 4b | Prompt Engineering & Optimization Modes | Done |
| Sprint 5 | Feature Polish (Follow-up Chat + MD Preview) | Done |
| Sprint 6 | IndexedDB Migration (Dexie.js) | Done |
| Sprint 6b | Code Quality & Technical Debt Cleanup | Done |
| Sprint 7 | Chrome Extension — One-Click Job Import | Done |
| Sprint 8 | LLM Multi-Provider Config | Done |
| Sprint 9a | Code Revision & Cleanup | Done |
| **Sprint 9b** | **Direct Download — WebLLM In-Browser Models** | **Done** |
| **Sprint 9c** | **WebLLM Stability — Crash Recovery & SW Mode** | **HIGH PRIORITY** |
| **Sprint 9d** | **General LLM Stability — Retry, Timeouts & Tests** | **HIGH PRIORITY** |
| Sprint 10 | Application Kanban — Pipeline Tracker | Planned |
| Sprint 11 | Outreach Generator — Cold Messages | Planned |
| Sprint 12 | Interview Simulator — STAR + Technical | Future |

---

## Sprint 9b — WebLLM Direct Download (High Priority)

Let non-technical users download and run a model directly in the browser via WebLLM, no external server needed.

**Goal:** First-run onboarding offers to download a small model (~2-4 GB) that runs in-browser via WebGPU.

**Completed:**
- `WebLLMAdapter.ts` created with `CreateMLCEngine()` wrapper
- Provider type `"webllm"` registered in registry
- `@mlc-ai/web-llm` installed (v0.2.84)
- Model catalog: `WEBLLM_MODELS` (13 models) in adapter, `WEBLLM_CATALOG` duplicate in Config/Onboarding (needs unification — see Sprint 9c)
- Download UI with progress bar via `initProgressCallback`
- First-run onboarding: Local vs Remote choice in OnboardingWizard
- Extension CSP updated with `"wasm-unsafe-eval"`
- "Delete model" button (Cache API)

**Remaining (folded into Sprint 9c):**
- VRAM estimation before load
- Handle page reload, device lost, quota exceeded gracefully
- Reliable download cancellation

---

## Sprint 9c — WebLLM Stability (High Priority)

Production-hardening for in-browser WebLLM mode. 6 phases, implemented in order L2 → L3 → L5 → L1 → L4 → L6.

**Goal:** Eliminate "device lost = dead" UX, auto-size models to available VRAM, add streaming, cancel downloads, integrate service worker.

**Key doc:** [[../40-Development/WebLLM Stability and Service Worker]]

**Tasks:**
### L2 — Auto-Downgrade on Device Lost
- [x] Replace `_deviceLost: boolean` with `_consecutiveFailures: number` + `_maxFailuresBeforeDowngrade`
- [x] On device-lost: increment counter, at threshold decrement `_currentModelIndex`, call `engine.reload()` with smaller model
- [x] Emit `WebLLMStatusEvent` for downgrade/fatal events
- [x] Add `onStatus()` subscription to adapter interface
- [x] Unify model catalogs: delete duplicate `WEBLLM_CATALOG` in Config.tsx + OnboardingWizard.tsx, import `WEBLLM_MODELS` from adapter
- [x] Update `formatTestError()` in Config.tsx

### L3 — VRAM Detection & Auto-Sizing
- [x] Create `src/app/utils/vram.ts` — `estimateAvailableVRAM()`, `recommendModel()`
- [x] `navigator.deviceMemory` + `GPUAdapter.requestAdapterInfo()` heuristics
- [x] `isIntegratedGPU()` heuristic (Qualcomm/ARM/Apple Silicon vs NVIDIA/AMD/Intel Arc)
- [x] Default model change: 3B → 1B in `defaults.ts`
- [x] VRAM info display in Config.tsx WebLLM panel
- [x] Auto-select best model in OnboardingWizard.tsx

### L5 — Download UX & Cancellation

### L5 — Download UX & Cancellation
- [x] `WebLLMAdapter.unload()`, `interruptDownload()`, `hasModelInCache()`
- [ ] Pre-download confirmation: model size, VRAM estimate, safety note
- [x] Cancel button during download (Config + Onboarding)
- [x] "Unload Model" and "Delete Model" buttons unload engine + clear cache

### L1 — Service Worker Integration
- [ ] Create `webllm-sw.ts` — `ServiceWorkerMLCEngineHandler` in dedicated SW
- [ ] Create `sw-utils.ts` — `registerWebLLMSW()` with fallback
- [ ] Update `WebLLMAdapter.ts` — constructor flag `useServiceWorker`, SW init path
- [ ] Update `vite.config.ts` — SW build entry
- [ ] Update `vite.ext.config.ts` — copy SW to `dist-ext/`
- [ ] Update `registry.ts` — `useServiceWorker: true` by default

### L4 — Streaming Support
- [ ] Add optional `streamCompletion()` to `ProviderAdapter` interface
- [ ] Implement in `WebLLMAdapter` via `chatCompletion({ stream: true })`
- [ ] Wire `llmService.streamCompletion()` with fallback to `chatCompletion()`

### L6 — Testing
- [ ] Create `src/app/services/provider/__tests__/WebLLMAdapter.test.ts`
- [ ] Mock `@mlc-ai/web-llm`, `navigator.serviceWorker`, `navigator.gpu`
- [ ] Test all scenarios: init, device-lost, auto-downgrade, streaming, unload, VRAM, SW fallback
- [ ] Add `llmService.test.ts` tests for `streamCompletion()` routing

---

## Sprint 9d — General LLM Stability (High Priority)

**Goal:** Fix dead code, add retry logic, propagate timeouts, fix pre-existing TS errors.

**Tasks:**
- [ ] Audit `chatCompletionWithFallback()` — currently dead code, never called. Decide: remove or wire into routing
- [ ] Add retry logic to `jobAnalysisService.ts` (currently zero retry on failure)
- [ ] Propagate `timeoutMs` from service layer → adapter layer (currently hardcoded per-adapter)
- [ ] Fix pre-existing TS errors: `clParser.ts` undefined checks, `migrations.ts` `ThemeMode` assertion, `WorkspaceProfileContext.tsx` possibly undefined vars
- [ ] Create `provider/__tests__/` directory with adapter-level tests for OpenAICompatibleAdapter, AnthropicAdapter, GeminiAdapter
- [ ] Add test for `listModels()` error handling (connection refused, auth failure, timeout)

---

## Sprint 10 — Application Kanban

Visual pipeline for tracking job applications through hiring stages.

**Goal:** Manage full job hunt pipeline — saved → applied → interviewing → offer → closed.

**Key files:** `application.ts`, `ApplicationContext.tsx`, `KanbanBoard.tsx`, `Pipeline.tsx`

**Tasks:**
- [ ] Define `Application` type with id, company, role, url, status, notes, timeline
- [ ] Wire `ApplicationContext.tsx` with Dexie CRUD
- [ ] KanbanBoard: react-dnd drag & drop across columns (Saved → Applied → Phone Screen → Interview → Offer → Rejected → Accepted)
- [ ] Card: company, role, date, status badge, quick actions
- [ ] Click card → detail panel with notes, timeline, linked analysis
- [ ] Create from Analysis Hub: "Save to pipeline" button
- [ ] Manual create + auto-fill from job fetch
- [ ] New route: `/pipeline`, sidebar nav entry
- [ ] Tests: drag-drop, CRUD, session linking

### Bonus: Email fetch for status checking
- `emailFetchService.ts` — IMAP/Gmail API connector
- Scan inbox for job-related emails, auto-update Kanban status
- Credentials stored in IndexedDB only

---

## Sprint 11 — Outreach Generator

Generate personalized cold messages for LinkedIn, email, follow-ups.

**Key file:** `outreachService.ts`

**Tasks:**
- [ ] `linkedInMessage()`, `coldEmail()`, `followUpMessage()` with style variants
- [ ] Prompt templates in `prompts.ts`
- [ ] "Outreach" panel in Analysis Hub
- [ ] Copy-to-clipboard + "Open in LinkedIn"
- [ ] Save to application timeline
- [ ] Template editor per profile

---

## Sprint 12 — Interview Simulator

Interactive mock interviews with structured STAR feedback.

**Key files:** `Interview.tsx`, `interviewService.ts`, `InterviewContext.tsx`

**Tasks:**
- [ ] Modes: Behavioral (STAR), Technical, Mixed, Cultural Fit
- [ ] Chat UI: question → answer → feedback → next
- [ ] Session persistence in IndexedDB
- [ ] Final report: strengths, weaknesses, STAR score
- [ ] Question bank seeded by profile skills + job requirements
