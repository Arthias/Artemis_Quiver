---
tags: [meta, changelog, history]
status: completed
last_updated: 2026-08-21
---

# Changelog

## [Extension v3.9.3] - August 21, 2026

**Side panel: badge entry, quick-analyze, and a deep-analysis result card that stays in the panel**

- **Replaces the floating overlay badge with `chrome.sidePanel`:** the toolbar icon badges recognized job pages; clicking it opens a persistent panel instead of a page-injected badge (`chrome.action.setPopup` + `onClicked` + `sidePanel.open`). The overlay content script (`overlay.ts`) now runs headless — no DOM, no shadow root — kept alive only to relay live scores from "Always quick analyze this site" pages via `ARTEMIS_QUICK_SCORE_UPDATE`.
- **Two extraction paths:** default "click to look" via `activeTab` + `executeScript` (no standing permission), or opt-in "Always quick analyze this site" (renamed overlay-enable toggle) for auto-scoring while browsing an aggregator. Auto-triggering is capped at the quick score, full stop — deep analysis and content generation are always explicit user actions.
- **Deep analysis stays in the panel:** running it no longer jumps to the main tab. The panel shows the score, a one-line write-up, and salary range, with three actions below — **Build CV** and **Build Cover Letter** hand off `jobPosting` + recommendations/draft to the respective builder (new `ARTEMIS_LOAD_BUILDER_HANDOFF` message + `chrome.storage.session` stash, picked up by a `RootLayout` effect, mirroring the existing `pendingSessionId` pattern) and **Go to full analysis** loads the saved session on the Analysis Hub.

### Follow-up fixes (same release)

- **Quick score now tries on-device Nano first**, same as the old overlay, instead of always calling a remote LLM — `handleQuickAnalyze` was skipping Nano entirely and calling `callRemoteLLM` unconditionally, including in "basic" fallback mode where it silently defaulted to `localhost:11434` and could hang for its full 30s timeout with no feedback.
- **Cache entries are now stamped with the fingerprint they were scored against** and only count as a hit if it still matches the current one — previously a regenerated fingerprint or a profile edit left old scores cached indefinitely with no way to tell they were stale.
- **Scoring prompts now request `{"score", "reason"}` as JSON** (Nano, remote quick-analyze, and the overlay's live relay) instead of "reply with only the number" — gives the panel a one-line reason under the score, and closes off a failure mode where the old regex parser could pick up an unrelated number from a model's chain-of-thought preamble.
- Added a loading spinner + elapsed-seconds indicator to the panel's quick-score state, and an **Analyze** button for the "no score yet" case — quick-analyze only auto-runs once per panel session, so every job page visited afterward previously had no way to trigger a score at all.
- Verified: typecheck clean (pre-existing unrelated `overlay.ts` dead-code + `chrome.tabs.TabChangeInfo` type warnings untouched), `build` and `build:ext` succeed, 141/144 tests pass (3 pre-existing `providerMode` failures, unrelated). Not live-tested in a browser — no bridge from this environment.

## [v3.8.0] - August 20, 2026

**CV Builder: 4 templates as data presets, per-section style mixing, and a real theme abstraction**

- **Root fix for template inconsistency:** "template" no longer means one bespoke component
  reimplementing header/contact/section chrome from scratch (Classic rendered inline as the
  fallback branch of `InteractiveCVPreview.tsx`, Executive a separate file that silently dropped
  drag-reorder, collapse, and page-break, hardcoded English section labels, and mostly ignored
  theme colors). Templates are now data presets (`src/components/cv/templates.ts`) consumed by
  4 shell components sharing one props contract and one chrome component (`SectionFrame.tsx`)
  for reorder/collapse/page-break — so every template gets those features by construction.
- **2 new templates, grounded in real resume-design categories:** **Modern** (clean sans-serif,
  accent-forward, single column) and **Minimal** (ultra-plain, no color, spacious — ATS-safe),
  alongside the existing **Classic** and **Executive**.
- **Per-section style mixing:** each of the 6 section types (summary, contact, skills,
  experience, education, certifications) has 2-3 independent visual variants (e.g. skills as
  tags/columns/inline, experience as classic/cards/timeline) selectable per-section regardless
  of which template is active — new "Section styles" control in `ThemeConfigPanel`. New
  `src/components/cv/sectionVariants/` registry.
- **Theme colors now reach entry text, not just the header:** `ExperienceItemCard`/
  `EducationItemCard`/`InlineTextarea` previously hardcoded gray Tailwind classes regardless of
  `accentColor`/`textColor`; all section variants now consume the theme consistently.
- **Fixed:** Cover Letter builder's template selector was a dead control — `InteractiveCLPreview`
  had no `templateId` concept, so picking "Executive" changed nothing. Removed the selector for
  CL entirely (`ThemeConfigPanel` gained a `showTemplateSelector` prop); color/font pickers,
  which did work, are unchanged. See `30-Bugs-and-Fixes/_Index.md`.
- **Theme choice now persists** per document type via `localStorage`
  (`artemis:cvThemeConfig` / `artemis:clThemeConfig`) — previously lost on reload/navigation.
- Collapsed the duplicated `ThemeConfig` type (`ThemeConfigPanel.tsx` had its own hand-written
  copy) onto the canonical zod-derived type in `src/types/cv.ts`, removing `as any` casts at
  both builder call sites.
- Full i18n coverage (en/es) for the 2 new templates and the section-style controls.
- `package.json` and the extension `manifest.json` bumped to 3.8.0.
- Verified: typecheck clean; existing suite still at 141/144 (the 3 failures are the
  pre-existing `providerMode` default mismatch noted in v3.7.0, untouched by this change).
  Verified via a real React-DOM render (not mocks) across all 4 templates with sample CV
  content: theme colors reach summary/experience text, independent section-variant selection
  works, Executive's page-break toggle now actually mutates content, and localStorage
  persistence round-trips. Dev server boots both builder routes with zero console errors.

## [v3.7.0] - August 18, 2026

**Artemis Flow integration: connect, push profile/config, and a Flow panel**

- **New `flowBridge.ts` service:** health check via Flow's `/api/health` identity field, profile push (`PUT /api/profile`), LLM config push with explicit provider-vocabulary mapping (Quiver's `openai-compatible`/`anthropic`/`google-gemini`/`webllm` vs Flow's `ollama`/`lmstudio`/`anthropic` — `google-gemini`/`webllm` are surfaced as unsupported rather than silently mismapped), dual-vantage-point endpoint testing (`/api/settings/llm/test`), and digest/search/rank status calls.
- **New "Flow" tab in Settings:** host:port entry + Connect, Send Profile to Flow, Send Primary/Send Secondary (two explicit actions, no inferred default), per-endpoint Test from Quiver / Test from Flow, and a Start Flow action gated on both a profile and an LLM config having been sent at least once.
- **New `/flow` page + always-visible sidebar entry:** connection status, independent Search/Scoring start-stop controls, a ranked digest of Flow's best-scoring new jobs, and a chat-tuning panel (reusing the CV/CL builder's `BuilderAssistantPanel`) wired to Flow's strategy feedback endpoint.
- Flow is treated as a dependent service, not a peer — nothing here is required for Quiver's own analysis/CV/CL/extension features, and the `/flow` page degrades to a "connect first" empty state rather than erroring when Flow isn't configured.
- Full i18n coverage (en/es) for all new strings.
- Corrects a version-number drift: `package.json` had been stuck at 3.5.1 since before the 3.6.0/3.6.1 releases below; it and the extension `manifest.json` are now both 3.7.0.
- Verified: typecheck clean, build succeeds, 141/144 tests pass (3 pre-existing unrelated failures — a `providerMode` default mismatch between `config/defaults.ts` and its own tests, not touched by this change). Both new surfaces verified live via Playwright against the dev server: render correctly with zero console errors, and a failed Flow connection degrades gracefully.

## [v3.6.0] - August 14, 2026

**Overlay loading fixes + toolbar popup rework (action surface)**

- **Overlay auto-reconcile:** background now re-registers content scripts whenever `artemis:overlayConfig` changes in `chrome.storage.local` (`chrome.storage.onChanged`) — no manual `ARTEMIS_SYNC_SITE_SCRIPTS`, no registration race with the popup's async save.
- **Auto-inject into open tabs:** after registering a site's content script, `overlay.js` is executed into already-open matching tabs (`injectOverlayIntoTabs`) so the overlay appears without reloading.
- **Domain-only "enable here":** popup + Settings add sites as domain entries by default (the old popup prefill baked in `/jobs/view/123` paths, so the overlay silently stopped matching other job URLs). Path-specific entries still supported via the Settings editor.
- **Popup = toolbar action surface:** hero "Import this job → Artemis" (`ARTEMIS_EXTRACT_AND_IMPORT`), overlay status with one-click enable, fingerprint status, and a deep link to Settings. Config UI (fallback, sites, fingerprint) moved out of the popup.
- **Config moved to app Settings** (`ExtensionSettingsCard`): added overlay **fallback mode** control (basic/secondary/primary, `secondary` disabled until a secondary endpoint is configured); app-side `addSite` now requests host permission before saving.
- **Pending-import key fix:** `handleExtractAndImport` stores into `artemis:pendingImports` (plural, what the app reads) and opens the app tab when none is open — toolbar imports no longer vanish.
- New i18n keys: `config.overlayFallback*`, `config.fallback*`, `config.permissionDenied`, `extension.import*`, `extension.overlay*`, `extension.enableOverlay`, `extension.reloadHint`, `extension.openSettings`, `extension.fingerprint*` (en + es).
- Verified: typecheck clean, 130/130 tests pass, `build` + `build:ext` succeed.

### Follow-up fixes (same release)

- **Raw i18n keys in popup/overlay:** the extension cached locale JSON in `chrome.storage.local` under a single `i18n_cache` key and served it without a staleness check — a cache written by an older build lacked the new keys, so the UI showed keys like `extension.importJob` literally. Cache key is now versioned (`i18n_cache_<manifest version>`), so a rebuilt extension always re-fetches its bundled `locales/*.json`.
- **Editable site URL in popup:** "Enable overlay here" now defaults to the current site but shows an editable URL field, so the overlay can be scoped to a path (e.g. `https://www.awin.com/gb/careers/vacancies/*`) instead of only domain-wide. New `entryFromUrlInput()` helper (tested) converts any host/path input into a site entry; a root or empty path still yields a domain-only entry.
- **Toolbar import "No active tab":** popup-initiated `ARTEMIS_EXTRACT_AND_IMPORT` messages have no `_sender.tab`, so the background always replied "No active tab". The popup now queries its own active tab and passes `tabId` in the payload; the background prefers `payload.tabId`, falling back to `_sender.tab?.id`.
- **Settings navigation:** the Settings page is now tabbed (**AI Model** / **General** / **Extension**), so the extension config (fingerprint, fallback mode, sites) is one click away instead of buried at the bottom of a long page. New `config.tabModel` / `config.tabGeneral` / `config.tabExtension` keys (en + es).
- Verified: typecheck clean, 139/139 tests pass, `build:ext` succeeds.

## [v3.6.1] - August 17, 2026

**Overlay regression fix: legacy path-pin migration**

- **Problem:** configs saved by the pre-3.6.0 popup baked the page path into each site entry (e.g. `www.linkedin.com/jobs/search-results`), which silently restricted both content-script registration and in-page matching to that exact path — on LinkedIn job postings (`/jobs/view/*`) the overlay never appeared with no error. Reproduced against real configs: LinkedIn job pages never matched; other path-scoped sites (WTTJ `/jobs/`, awin `/gb/careers/vacancies`) still worked.
- **Fix:** new `normalizeSiteEntry()` collapses non-wildcard path pins on known job boards to the domain. The background (`syncSiteContentScripts`) migrates + persists the cleaned `jobSites` list on every reconcile (registering the corrected domain-wide script; stale script IDs cleaned up as before), and the overlay applies the same rule at load (`KNOWN_BOARDS` inlined — content scripts can't import).
- **Preserved:** deliberate wildcard pins (`site.com/jobs/*`) and pins on non-board sites (e.g. `www.awin.com/gb/careers/vacancies`) are left untouched.
- **LinkedIn quickscan scoring no job text:** the overlay's quickscan captured the page text as soon as LinkedIn's title card rendered, while the "About the job" description section was still loading — so `nano-score` received a page without the description and Nano replied "no job posting was provided" (import worked because it runs later, after the page settled). `cleanPageText()` now waits for actual description content (marker line + substantial text after it, up to 8s) instead of gating on the title element.
- Verified live: the user's stored config (`www.linkedin.com/jobs/search-results`, `www.hitachienergy.com/`, `app.welcometothejungle.com/jobs/`, `www.awin.com/gb/careers/vacancies`) migrates to `www.linkedin.com` and now matches LinkedIn job postings + searches, with awin/WTTJ scoping intact. Description-wait logic validated against realistic LinkedIn DOM states. Typecheck clean, 144/144 tests pass (5 new `normalizeSiteEntry` cases), `build:ext` OK.

## [v3.5.1] - August 7, 2026

**Curated WebLLM model catalog**

- Replaced the default WebLLM pull-down (former 13-card catalog) with 4 curated models spread across average-hardware tiers: `Qwen3.5-2B` (2.2 GB), `Qwen3.5-4B` (3.9 GB), `DeepSeek-R1-Distill-Qwen-7B` (5.1 GB), `Qwen3.5-9B` (6.4 GB). Default changed to `Qwen3.5-2B` — capable of job-eval + CV generation on the lightest cards.
- Dropped the `descKey` localization branches (now show `(x.x GB)` sizes directly); removed `WEBLLM_CATALOG` test fixtures aligned to the old list; updated locale size strings (en + es).
- Note: Gemma 4 (E2B/E4B) is not among WebLLM 0.2.84's shipped models and remains unavailable in-browser.
- Verified: typecheck clean, 124/124 tests pass, `build` + `build:ext` succeed.

## [v3.5.0] - August 6, 2026

**Extension permission model + fingerprint flow hardening**

- **Runtime content-script registration (C3):** Removed the static `<all_urls>` content script. The overlay now only runs on sites the user explicitly adds — the popup requests the specific origin via `chrome.permissions.request`, and the background registers a per-site overlay script (`chrome.scripting.registerContentScripts`) only when host permission is granted. `onInstalled`/`onStartup`/`ARTEMIS_SYNC_SITE_SCRIPTS` reconcile with stored job sites.
- **Fingerprint gen no longer needs an app tab:** background reads the active profile directly from IndexedDB (`idbProfile.ts`, same extension origin). Falls back to the app-tab round trip only when the DB has no profile.
- **Provider-aware background LLM:** fingerprint + fallback scoring now route through the app's openai-compatible / anthropic / gemini adapters (selected by the stored `provider` field), instead of a hardcoded OpenAI `/v1/chat/completions` call. Full endpoints (incl. `provider`) are persisted to `chrome.storage.local`.
- **Popup config merge fix:** popup saves now merge with the stored config, so `primaryEndpoint`/`secondaryEndpoint` cached during fingerprint gen are no longer wiped by any popup edit (this silently broke remote scoring after touching the popup).
- **`resolveEndpoint` hardening:** anything not `"secondary"` routes to primary (previously `"basic"` threw "No LLM endpoint configured").
- **WebLLM guard:** background refuses `webllm` endpoints with guidance to generate the fingerprint from the app's Settings page.
- **Bundled WebLLM model fix:** gemma3-1b shipped a config with BOTH `context_window_size` and `sliding_window_size` positive, which WebLLM 0.2.84 rejects. The catalog now carries per-model `overrides` (applied to `ModelRecord`) to work around such invalid configs.
- **Curated WebLLM catalog:** trimmed from 13 to 4 cards spread across average-hardware tiers — `Qwen3.5-2B` (2.2GB), `Qwen3.5-4B` (3.9GB), `DeepSeek-R1-Distill-Qwen-7B` (5.1GB), `Qwen3.5-9B` (6.4GB). Default changed to `Qwen3.5-2B`. (Gemma 4 E2B/E4B is not shipped by WebLLM and is unavailable in-browser.)
- New i18n keys: `background.noProfile`, `background.webllmNotSupported` (en + es).

## [v3.4.0] - July 6, 2026

**WebLLM Stability Implementation Plan (Documentation)**

- **Architecture Decision:** `CreateServiceWorkerMLCEngine()` over `CreateMLCEngine()` — SW mode for non-blocking GPU ops + page-navigation persistence
- **Phase L2:** Auto-downgrade on device-lost replacing permanent `_deviceLost` flag
- **Phase L3:** VRAM detection via `navigator.deviceMemory` + GPU adapter heuristics, auto-sizing model selection
- **Phase L5:** Download UX with cancel, unload, cache checks
- **Phase L1:** Dedicated `webllm-sw.ts` service worker with `ServiceWorkerMLCEngineHandler`
- **Phase L4:** Streaming support via `streamCompletion()` on ProviderAdapter interface
- **Phase L6:** Mock-based test suite for all adapter crash/recovery paths
- **Catalog unification:** `WEBLLM_MODELS` as single source (delete `WEBLLM_CATALOG` duplicates)
- **Sprint 9d scoped:** General LLM stability — dead code `chatCompletionWithFallback()`, retry, timeout propagation, TS error fixes

**CV Rendering Fixes:**
- Removed duplicate "Technical Proficiencies" heading from skills section
- Added `orphans: 3; widows: 3` to print styles to prevent last-page orphan lines
- Added `@page { margin: 0.5in }` for consistent print margins

**New doc:** `40-Development/WebLLM Stability and Crash Recovery.md`
**Updated:** `20-APIs/Local LLM Integration.md`, `60-Roadmap/Plan.md`, `00-Index/MOC.md`

## [v3.3.0] - June 13, 2026

**i18n Foundation (Multi-Language Support)**

- **Framework**: `react-i18next` + `i18next-browser-languagedetector`
- **Auto-discovery**: `import.meta.glob` loads locale JSON files in `src/app/i18n/locales/`
- **Type-safe**: `i18next.d.ts` augmentation for compile-time key validation
- **Languages**: `en.json` (~250 keys) + `es.json` (full Spanish)
- **Phase 1** — Setup: init, type augmentation, AppProviders wrap, `main.tsx` lang attr
- **Phase 2 (partial)** — String extraction: Sidebar, AnalysisHub, Profile, Config (developer mode), Builder components, ThemeConfigPanel, ProfileSwitcherModal
- **Phase 3** — Prompts: `locale` field in `PromptContext`, rendering engine `lang` param + locale-keyed section headings
- **Phase 4** — Errors: `userMessageKey` field on `ErrorRecord`
- **Phase 5** — Extension: `src/extension/i18n.ts` loader, locale JSON copy in `vite.ext.config.ts`
- **Intl Utils**: `src/app/utils/formatters.ts` with `formatDate()` / `formatCurrency()` via `Intl` API

## [v3.2.0] - June 10, 2026

**Strategic shift:** Local-first. Removed desktop app plans. Extension as primary delivery.

### Sprint 9b — WebLLM Direct Download (High Priority)
Prioritizing direct model download via WebLLM. Users pick model from catalog, one-click download + load via WebLLM. Privacy-first: all inference in-browser.

### Sprint 9a — Code Revision & Cleanup
- Extracted `InlineEdit` shared component (-158 lines duplicate code)
- Reverted Overlay ES module imports (MV3 content scripts can't use them)
- `.fallowrc.json` for proper entry points
- Replaced 6 `as any` in renderingEngine with type-safe `findSection<T>()`
- Typed `ExtensionBridgeContext` and `ErrorLogContext` message payloads
- Bug fixes: sidebar session click race, pending import ID tracking, LinkedIn PDF export, PDF header layout, export PDF second-click

## [v3.1.0] - June 5, 2026

- `clParser` cognitive complexity: 109→split into 7 helpers
- Extracted `shared.ts` for provider adapter utilities (-60 duplicated lines)
- Extracted `BuilderAssistantPanel`, `BuilderErrorDisplay`, `ThemeConfigPanel` (-100 duplicated lines)
- Removed unused `usePrintHandler.ts`, legacy localStorage migration code, 12 unused prompt functions

## [v3.0.0] - June 4, 2026

- Multi-provider LLM: `ProviderAdapter` interface (OpenAI-compatible, Anthropic, Google Gemini)
- Dual model slots (primary + secondary) with secondary routing strategies
- Config UI revamp with provider selector, API key, model list, temperature per slot
- Chrome Extension (MV3): one-click job import from any page, LinkedIn smart extraction
- Hash routing for extension compatibility
- IndexedDB migration via Dexie.js with one-shot localStorage → IndexedDB migration + self-healing

## [v2.8.0] - June 3, 2026

- Live theme application to interactive previews (Modern, Classic, Minimal)
- Skills category editing with drag-reorder
- CV Builder chat input matching CLBuilder pattern
- PDF export race condition fix (iframe onLoad + printPendingRef)

## [v2.7.0] - May 29, 2026

- CL Builder overhaul: structured JSON schema (CLContent) matching CV Builder pattern
- InteractiveCLPreview with inline editing on every field
- Themed HTML/PDF export for CL (3 themes)
- Retry with corrective feedback (up to 3 attempts)
- Copy plain text for application forms

## [v2.6.0] - May 29, 2026

- Centralized error code system: `ErrorCodes` + `ERROR_CATALOG` replacing ad-hoc enum
- All services throw `AppError` with domain-specific codes
- Structured logging (`errorLogger.ts`)
- Retry buttons on retryable errors

## [v2.5.0] - May 29, 2026

- CV retry with corrective feedback (up to 3 attempts on parse/schema errors)
- Interactive CV preview with inline click-to-edit

## [v2.4.0] - May 29, 2026

- Interactive CV Preview replacing static iframe
- Enhanced CV schema: name/title/location, bullets, categories
- Professional themes with print CSS
- Prompt updates for v3 schema

## [v2.3.0] - May 28, 2026

- Follow-up Chat on Analysis Hub with persistent history per session
- Quick-action suggestion pills (5 scenarios)
- 3 new tests for follow-up chat

## [v2.2.0] - May 28, 2026

- Centralized `prompts.ts` with 10 optimization modes + intent classifier
- `optimizeCv()` public API for targeted optimizations
- 5 new cvBuilderService tests

## [v2.1.0] - May 28, 2026

- Collapsible prompt view, two CV Optimization buttons, auto-generate handoff
- 46 tests across 8 files (vitest), strict TypeScript
- Bug fixes: session sync, dark theme, CSS escaping, missing break, PDF printing

## [v2.0.0] - May 28, 2026

- Structured JSON output with Zod validation
- Themed HTML rendering (Modern, Classic, Minimal)
- PDF export via hidden iframe printing
- XSS protection via content escaping

## [v1.0.0] - Original

Plain Markdown generation via chat completion, exported as `.md` via blob URLs.
