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
| **Sprint 9b** | **Direct Download — WebLLM In-Browser Models** | **HIGH PRIORITY** |
| Sprint 10 | Application Kanban — Pipeline Tracker | Planned |
| Sprint 11 | Outreach Generator — Cold Messages | Planned |
| Sprint 12 | Interview Simulator — STAR + Technical | Future |

---

## Sprint 9b — WebLLM Direct Download (High Priority)

Let non-technical users download and run a model directly in the browser via WebLLM, no external server needed.

**Goal:** First-run onboarding offers to download a small model (~2-4 GB) that runs in-browser via WebGPU.

**Key files:** `WebLLMAdapter.ts`, `ModelDownloadFlow.tsx`, catalog config

**Tasks:**
- [ ] Install `@mlc-ai/web-llm`, create `WebLLMAdapter.ts` wrapping `CreateMLCEngine()`
- [ ] Add `"wasm-unsafe-eval"` to extension CSP
- [ ] Model catalog: Llama 3.2 3B (default, ~2.3 GB), 1B (fallback, ~880 MB), Qwen2.5 3B, Phi-3.5-mini
- [ ] Download UI with progress bar via `initProgressCallback`
- [ ] Cache in browser Cache API, "Delete model" button
- [ ] VRAM estimation before load
- [ ] First-run onboarding: Local (download) vs Remote (server) choice
- [ ] Register `"webllm"` as provider type in registry
- [ ] Handle page reload, quota exceeded, load failure gracefully

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
