---
tags: [testing, quality-assurance, test-cases]
status: completed
last_updated: 2026-06-13
---

# Test Cases — AI Agent QA Guide

Guidelines for QA agents running automated checks via Playwright MCP. Human manual tester handles ad-hoc flows.

## QA Agent Checklist Per Feature

### 1. Analysis Hub (`/`)
- [ ] Sidebar renders "Recent Analyses" list
- [ ] Main area shows job posting textarea
- [ ] "Analyze Job Posting" button present + clickable
- [ ] Collapsible prompt card shows analyzed job (compressed by default, click to expand)
- [ ] Match score circle (0-100%) renders after analysis
- [ ] Tips, recommendations, cover letter draft appear
- [ ] "Generate CV with Recommendations" auto-generates CV on mount
- [ ] "Edit Profile" navigates to `/profile`
- [ ] Follow-up chat section: message input + Enter-to-send + suggestion pills
- [ ] Session switching via sidebar loads correct results
- [ ] Error state: misconfigured LLM shows error card, not crash
- [ ] Profile switcher appears in sidebar footer

### 2. Profile Workspace (`/#/profile`)
- [ ] Markdown editor with Edit/Preview tabs
- [ ] Autosave triggers (if enabled) — verify persistence on reload
- [ ] Smart file import (.txt/.md): upload → LLM merge → preview → apply
- [ ] AI Assistant tab: chat interface, "Apply to Editor" button
- [ ] Chat history persists per-profile

### 3. CV Builder (`/#/cv-builder`)
- [ ] Pre-generation: job description input (pre-filled from handoff)
- [ ] Auto-generate on mount when `autoGenerate: true` in handoff
- [ ] Post-generation: left panel interactive preview, right panel AI assistant
- [ ] Inline editing on all sections (name, title, contact, summary, experience, skills, education, certifications)
- [ ] Theme config panel: Modern/Classic/Minimal switch + color picker
- [ ] CV iframe white background regardless of app dark mode
- [ ] Quick suggestion buttons (Add more metrics, Shorten experience, etc.)
- [ ] Export .md + PDF (via hidden iframe print)
- [ ] Error: retry button on retryable errors

### 4. Cover Letter Builder (`/#/cl-builder`)
- [ ] Company/position/description fields (pre-filled from handoff)
- [ ] Generate + interactive split-screen editing
- [ ] Inline editing on all structured fields
- [ ] Theme config + export .md / copy plain text / PDF

### 5. Settings (`/#/config`)
- [ ] Cloud/Local mode toggle
- [ ] Primary + Secondary model cards with provider selector
- [ ] Base URL / API key / model input per slot
- [ ] Temperature slider
- [ ] "Test Models" button per slot
- [ ] "Pull Models" fetches + shows model list
- [ ] Secondary routing selector (never/fallback/quick-tasks/always)
- [ ] Theme toggle (light/dark)
- [ ] Developer mode error log

### 6. Extension
- [ ] Popup renders: overlay toggle, fingerprint button, fallback mode, job sites list
- [ ] Fingerprint generation flow (works with no app tab open; provider-aware LLM)
- [ ] Overlay injects on job pages (check badge states: ? / ... / score / !)
- [ ] Click overlay expands detail panel
- [ ] Import to Artemis creates pending import in sidebar
- [ ] Config changes auto-save

## Prompt Optimization Modes (Unit Tests)

Run `npm run test` to verify:
- [ ] `generateCv()` accepts industry + target role context
- [ ] `summary-rewrite` mode returns text, not JSON
- [ ] `audit` mode returns structured critique
- [ ] `career-transition` includes previous/current field context
- [ ] All 9 non-standard modes execute without error

## Quick Reference: Common Test IDs

| Scenario | Key Assertion |
|----------|--------------|
| Fresh install | Default profile "Default" created in IndexedDB |
| LRU eviction | 4th profile evicts oldest, removes its sessions |
| Analysis error | Error card with user-friendly message, not raw error |
| Theme isolation | Each profile remembers its theme |
| Handoff purity | `consumeHandoff()` nullifies after use — no stale carryover |
