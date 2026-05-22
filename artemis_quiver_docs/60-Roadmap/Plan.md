---
tags: [roadmap, planning, backlog]
status: completed
last_updated: 2026-05-22
---

# 📅 Development Plan & Sprint Backlog

This document maps out the roadmap, completed milestones, and pending backlog items for Artemis Quiver.

---

## 🏗️ Sprint Progress Overview

| Sprint | Goal / Focus | Status |
|---|---|---|
| **Sprint 0** | Workspace Profiles & Custom Themes | **Done** |
| **Sprint 1** | Session History & Builder Handoffs | **Done** |
| **Sprint 2** | Smart Profile Merging & Assistant Chats | **Done** |
| **Sprint 3** | CV & Cover Letter Generation Services | **Done** |
| **Sprint 4** | Optional Polish (Analysis chats & MD Previews) | **Not Started** |

---

## 🏃 Active & Backlog Tasks

### Sprint 4 — Polish (Backlog)
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
