---
tags: [index, bugfixes, issues, resolved]
status: completed
last_updated: 2026-09-07
---

# 🐛 Bugs & Fixes — Resolution Log

All bugs discovered and fixed in Artemis Quiver.

> [!TIP] Usage
> Always check this page **before** implementing fixes to avoid duplicate work or missing context.

## 2026-08-20: CV/CL Builder template consistency pass (v3.8.0)

### Issue: Cover Letter builder's "Template" selector did nothing

**Symptom:** `CLBuilder.tsx` rendered the same `ThemeConfigPanel` used by the CV builder,
including its Classic/Executive template picker. Clicking "Executive" highlighted the button
but the rendered cover letter never changed.

**Root Cause:** `InteractiveCLPreview.tsx` never had a `templateId` prop or any per-template
rendering logic — cover letters only ever had one fixed layout. `CLBuilder.tsx` read
`themeConfig.templateId` nowhere except to satisfy the shared `ThemeConfig` type. The control
was visually present but structurally unwired.

**Fix Applied:** Removed the template (and section-style) controls for the Cover Letter builder
specifically, rather than inventing a no-op template concept for letters. `ThemeConfigPanel`
gained a `showTemplateSelector` prop (default `true`); `CLBuilder.tsx` passes `false`. Color and
font pickers, which did have a real effect via `getCVTheme(themeConfig)`, are unchanged.

**Location:** `src/app/components/builder/ThemeConfigPanel.tsx`, `src/app/pages/CLBuilder.tsx`

---

## 2026-05-28: trim() Safety Issues (Commit: 2c97a87)

### Issue #1: Analysis Hub → CV Builder "Implement" button failed with LLM error (400)

**Error Message:**
```json
LLM request failed (400): {"error":"'messages' array must only contain objects with a 'role' field that is in [user, assistant, system, tool]. Got 'format'."}
```

**Root Cause:** Invalid role `"format"` used in chat messages instead of `"system"`.

**Status:** ✅ **ALREADY FIXED** in HEAD codebase - analysis showed HEAD version already had correct `role: "user"` usage.

---

### Issue #2: CV Builder "Generate CV" threw TypeError

**Error Message:**
```javascript
jobDescription?.trim is not a function
```

**Root Cause:** Unsafe optional chaining followed by `.trim()` throws when value is `undefined`, not just non-string.

**Fix Applied:**
```typescript
// Before ❌
const jobPart = jobDescription?.trim()
  ? `\n\n## Target job\n\n${jobDescription}`
  : "\n\n(No specific job — general CV from profile.)";

// After ✅ - Type-safe string validation
const jobPart = typeof jobDescription === "string" && jobDescription.trim().length > 0
  ? `\n\n## Target job\n\n${jobDescription}`
  : "\n\n(No specific job — general CV from profile.)";
```

**Location:** `src/app/services/cvBuilderService.ts` line 17

---

### Issue #3: Cover Letter Builder threw TypeError (4 instances)

Same issue across all 4 input parameters in CL generation:
- companyName  
- position  
- jobDescription  
- seedDraft

**Fix Applied to All:**
```typescript
// Before ❌ - Unsafe pattern
const company = options.companyName?.trim() || "the company";
// ... similar for role, jobPart, seedPart

// After ✅ - Type-safe pattern
const company = typeof options.companyName === "string" && options.companyName.trim() 
  ? options.companyName.trim() : "the company";
// ... same pattern applied to all 4 parameters
```

**Location:** `src/app/services/clBuilderService.ts` lines 18-23

---

## Pattern Applied

All fixes prevent `TypeError: xxx?.trim is not a function` by explicitly checking:
1. The value is actually a string, AND  
2. Has non-zero trimmed length

---

## 2026-05-28: CV Builder JS Runtime & Import Resolution Fixes

### Issue #4: Vite import resolution failed — `../types/cv` resolved to directory, not file

**Error Message:**
```
[plugin:vite:import-analysis] Failed to resolve import "../types/cv" from "src/app/services/cvBuilderService.ts". Does the file exist?
```

**Root Cause:** `src/app/types/cv` was a **directory** (containing misplaced copies of renderer files from `src/app/components/cv/`), not a `.ts` file.

**Fix Applied:**
- Created `src/app/types/cv.ts` — barrel file re-exporting from canonical `src/types/cv.ts`
- Fixed relative import paths in `src/app/components/cv/renderingEngine.ts` and duplicates

**Location:** `src/app/types/cv.ts` (created), `src/app/components/cv/renderingEngine.ts:16`

---

### Issue #5: Syntax error in canonical type file

**Error Message:**
```
ERROR: Expected ";" but found ">"
```

**Root Cause:** `src/types/cv.ts:92` had an extra `>` in the type export:
```typescript
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>>; // note >> at end
```

**Fix Applied:** Removed the duplicate `>`.

**Location:** `src/types/cv.ts:92`

---

### Issue #6: Missing `error` state variable in CVBuilder

**Error Message:**
```
ReferenceError: error is not defined at CVBuilder
```

**Root Cause:** `setError()` was called but `const [error, setError] = useState(...)` was never declared.

**Fix Applied:** Added `const [error, setError] = useState<string | null>(null)`.

**Location:** `src/app/pages/CVBuilder.tsx:37`

---

### Issue #7: Textarea missing `onChange` handler

**Warning:**
```
Warning: You provided a `value` prop to a form field without an `onChange` handler.
```

**Root Cause:** Job description `<Textarea>` had `value={jobDescription}` but no `onChange` handler.

**Fix Applied:** Added `onChange={(e) => setJobDescription(e.target.value)}`.

**Location:** `src/app/pages/CVBuilder.tsx:253`

---

### Issue #8: LLM returned 400 — invalid `role: "format"`

**Error Message:**
```
'messages' array must only contain objects with a 'role' field that is in [user, assistant, system, tool]. Got 'format'.
```

**Root Cause:** `cvBuilderService.ts` used `role: "format"` for schema injection messages. LMStudio's OpenAI-compatible API only accepts `user`, `assistant`, `system`, `tool`.

**Fix Applied:** Changed both `role: "format"` occurrences to `role: "system"`.

**Location:** `src/app/services/cvBuilderService.ts:70,94`

---

### Issue #9: JSON parse failed — LLM wrapped JSON in markdown fences

**Error Message:**
```
Invalid JSON structure generated. Please check console for details.
```

**Root Cause:** The LLM wrapped JSON output inside ` ```json ... ``` ` markdown code fences. `CVBuilder.tsx` used raw `JSON.parse()`.

**Fix Applied:** Replaced `JSON.parse(content)` with `extractJsonObject(content)`.

**Location:** `src/app/pages/CVBuilder.tsx:60`

---

### Issue #10: CV rendered blank — LLM output format didn't match schema

**Symptom:** JSON parsed successfully but iframe showed empty document.

**Root Cause:** The LLM generated sections keyed by type name (`{"summary": "text..."}`) instead of using the expected `type` discriminator (`{"type": "summary", "content": "text..."}`). The Zod schema `.toString()` was unreadable to the LLM.

**Fix Applied:**
1. Replaced cryptic Zod schema dump in prompts with a clear JSON example
2. Added `normalizeCvJson()` function that converts key-based format to type-based format
3. Both `generateCv()` and `editCv()` now pass output through the normalizer

**Location:** `src/app/services/cvBuilderService.ts`

---

## 2026-05-28: Session Sync & Analysis Hub Refinements (Session 2)

### Issue #11: Sidebar session click sometimes shows prompt instead of results

**Symptom:** Clicking a recent analysis in the sidebar would sometimes show the analysis results and other times show the editable prompt textarea.

**Root Cause:** `AnalysisContext.tsx:48` — The `useEffect` had `profileData.draftJobPosting` and `profileData.analysisSessions` in its dependency array. The `loadSession()` function calls `persistAnalysisState()`, which updates `profileData.analysisSessions`, triggering the effect to reset `currentResult`, `currentMarkdown`, and `activeSessionId` back to `null`.

**Fix Applied:** Changed dependency array from `[activeProfileId, profileData.draftJobPosting, profileData.analysisSessions]` to `[activeProfileId]`. Profile switches still reset correctly, but session operations within the same profile no longer get wiped.

**Location:** `src/app/context/AnalysisContext.tsx:55`

---

### Issue #12: CV rendered with dark background in dark mode

**Symptom:** When the app theme is set to dark, the CV preview iframe showed a dark background, making text unreadable.

**Root Cause:** `renderingEngine.ts` set explicit text colors (`#1e293b`, `#1a202c`) but never set an explicit `background`. The iframe inherited parent context styling in some browsers.

**Fix Applied:** Added `background: #ffffff` to `body` CSS in all three theme styles (modern, classic, minimal) and the default case.

**Location:** `src/components/cv/renderingEngine.ts:68,81,93,96`

---

### Issue #13: Minimal theme CSS overridden by default case

**Symptom:** Minimal theme rendered identical to the default fallback instead of its intended styling.

**Root Cause:** Missing `break` statement after `case "minimal"` in the theme switch — execution fell through to the `default` case, overwriting `styleRules`.

**Fix Applied:** Added `break;` after the minimal theme block.

**Location:** `src/components/cv/renderingEngine.ts:94`

---

### Issue #14: CSS escaping broke font-family declarations

**Symptom:** Font family strings in CSS (`'Inter', sans-serif`) were HTML-escaped to `&#x27;Inter&#x27;, sans-serif`, breaking font rendering in the iframe.

**Root Cause:** `escapeHtml()` was applied to the entire CSS string before injection into `<style>` tag. This was intended to prevent XSS via `primaryColor` but it corrupted legitimate CSS syntax.

**Fix Applied:** Replaced `escapeHtml(styleRules.replace(...))` with regex validation of `primaryColor` (`/^#[0-9A-Fa-f]{6}$/`). The CSS is now injected raw; only the color value is sanitized.

**Location:** `src/components/cv/renderingEngine.ts:111-116`

---

### Issue #15: Redundant past analyses dropdown

**Symptom:** Analysis Hub had both a sidebar "Recent Analyses" section and a page-level `<Select>` dropdown, both doing the same thing. If not perfectly aligned, clicking one would produce inconsistent state.

**Fix Applied:** Removed the dropdown entirely. Session navigation is now exclusively via the sidebar.

**Location:** `src/app/pages/AnalysisHub.tsx` (removed)

---

### Issue #16: Duplicate files scattered in wrong locations

**Symptom:** After the CV builder refactor, 7 duplicate files were left in `src/app/types/cv/`, `src/app/components/cv/`, and `src/app/cv.ts`, causing import confusion and stale code.

**Fix Applied:** Deleted all 7 duplicates. Canonical files remain at `src/components/cv/` and `src/types/`. Updated all import paths to point to canonical locations.

**Files Deleted:**
- `src/app/types/cv/CVRenderer.tsx`
- `src/app/types/cv/renderingEngine.ts`
- `src/app/types/cv/renderingEngine.test.ts`
- `src/app/components/cv/CVRenderer.tsx`
- `src/app/components/cv/renderingEngine.ts`
- `src/app/components/cv/renderingEngine.test.ts`
- `src/app/cv.ts`

---

---

## 2026-06-05: Overlay stuck as non-interactive blue rectangle

### Issue #17: Collapsed overlay header blocked expansion click

**Symptom:** Overlay appeared as a small dark rectangle that could only be dragged. Clicking to expand did nothing.

**Root Cause:** `setupToggle()` checked `(e.target as HTMLElement).closest("[data-drag]")` and returned early — but the collapsed overlay **IS** the `[data-drag]` header, so every click was suppressed. Also `isDragging` global was never reset after drag, causing state corruption.

**Fix Applied:**
1. Replaced `setupDrag()` + `setupToggle()` with single `setupOverlayEvents()` using event delegation on the overlay element
2. Drag uses local `wasDragged` flag (no globals)
3. Click handler checks `justDragged` flag to suppress toggle after drag
4. Event listeners attached once in `injectOverlay()` — no re-attachment on every render

### Issue #18: Close button only rendered in expanded state

**Symptom:** No way to dismiss overlay without reloading page.

**Fix Applied:** Close button (`data-action="close"`) always rendered in header regardless of expanded state.

### Issue #19: No visible status when fingerprint missing

**Symptom:** Default config has `fallbackMode: "basic"` and no fingerprint. Overlay showed "JD" badge with no indication of what to do.

**Fix Applied:** Collapsed view now shows:
- `?` badge (gray) + "Not Configured" label when no fingerprint
- `...` badge (yellow) + "Analyzing..." when fingerprint exists but no score yet
- `85%` badge (colored) + "Match Score" when scored

Expanded view shows guidance: "No profile fingerprint. Open the Artemis Quiver popup and generate a fingerprint to get AI match scores."

### Issue #20: No storage change listener

**Symptom:** Generating fingerprint in popup had no effect on already-injected overlay — required page refresh.

**Fix Applied:** Added `chrome.storage.onChanged` listener. When fingerprint becomes available, `computeMatch()` triggers automatically and overlay re-renders.

**Location:** `src/extension/overlay.ts`

---

## 2026-06-05: Overlay import & score failure handling (Session 2)

### Issue #21: `chrome.tabs` undefined in content script

**Symptom:** Import button threw `TypeError: Cannot read properties of undefined (reading 'query')` because `chrome.tabs` is not available in MV3 content scripts.

**Root Cause:** `handleImport()` and `openApp()` in `overlay.ts` called `chrome.tabs.query()` and `chrome.tabs.create()` directly. Content scripts only have access to a subset of `chrome.*` APIs — `chrome.tabs` is restricted to service workers and popups.

**Fix Applied:**
1. Added `ARTEMIS_IMPORT_JOB` message handler in `background.ts` — receives import payload from overlay, handles tab lookup/focus/creation
2. Added `ARTEMIS_OPEN_APP` message handler in `background.ts` — focuses or creates the app tab
3. `overlay.ts` now sends fire-and-forget messages to background instead of calling `chrome.tabs` directly

### Issue #22: Score failure stuck on "Analyzing..." indefinitely

**Symptom:** When LLM call failed/returned null, `matchScore` stayed `null` but `hasFingerprint` was `true`, so the overlay showed "Analyzing..." forever with no feedback.

**Root Cause:** `computeMatch` had no failure state — it only distinguished "no score yet" (matchScore === null) from "has score". LLM errors were silently caught and discarded.

**Fix Applied:**
1. Added `scoringFailed` boolean state variable
2. `computeMatch` sets `scoringFailed = true` when LLM returns null and fingerprint exists
3. Badge shows `!` (red) + label "Score Failed" when scoring fails
4. Expanded view shows error guidance: "Check that your LLM endpoint is configured in settings and the server is running"
5. Added **Retry** button in the error state that re-runs `computeMatch` with fresh config from storage

**Location:** `src/extension/overlay.ts`, `src/extension/background.ts`

---

## 2026-06-05: Import content empty + channel errors (Session 3)

### Issue #23: Pending import shows but job posting text is empty

**Symptom:** "Import to Artemis" creates a pending import entry, but clicking it shows a blank job posting on the Analysis Hub.

**Root Cause:** `Sidebar.tsx:handleRunPending()` called `setDraftJobPosting(pending.text)` **before** `clearCurrent()`. `clearCurrent()` resets `draftJobPosting` to `""` via `setDraftJobPosting("")`, wiping the import text immediately.

**Fix Applied:** Swapped order to `clearCurrent()` first, then `setDraftJobPosting(pending.text)`.

**Location:** `src/app/components/navigation/Sidebar.tsx:55-59`

### Issue #24: 403 error lacks endpoint URL in message

**Symptom:** When LM Studio returns 403, error says `LLM request failed: 403` with no indication of which URL was attempted.

**Fix Applied:** Error now includes the full URL: `LLM request failed: 403 for http://<your-lm-studio-host>:1234/v1/chat/completions`

**Location:** `src/extension/background.ts:160`

### Issue #25: Pending import contained full LinkedIn page noise

**Symptom:** Importing from LinkedIn included nav bars, notifications, search results, and all sidebar noise instead of just the job description.

**Root Cause:** `overlay.ts:handleImport()` used `document.body.innerText` directly — the content script sees the full DOM text including LinkedIn chrome. The `extractPageContent()` function in `background.ts` already had proper LinkedIn cleaning (DOM stabilization, marker-based extraction, title from `.jobs-unified-top-card__title`) but was only used by the extension icon click (`chrome.action.onClicked`), not by the overlay import path.

**Fix Applied:**
1. `overlay.ts:handleImport()` now sends `ARTEMIS_EXTRACT_AND_IMPORT` to background instead of raw `document.body.innerText`
2. Background receives message, gets tab ID from `_sender.tab.id`, runs `chrome.scripting.executeScript` with the existing `extractPageContent` function
3. Cleaned content (LinkedIn: job description between "about the job" / "people also viewed"; others: `document.body.innerText`) is forwarded to app tab or stored as pending

**Location:** `src/extension/overlay.ts:368-391`, `src/extension/background.ts`

---

### Issue #26: ExtensionBridge message handler could return ambiguous values

**Symptom:** `ExtensionBridgeContext` used two `if` blocks instead of `if/else if`, risking both blocks executing and returning a Promise for the wrong message type.

**Fix Applied:** Changed to `else if` pattern. Also changed `respondWithProfile()` from implicit Promise return to explicit `respondWithProfile().then(sendResponse); return true;` pattern for reliable channel handling.

**Location:** `src/app/context/ExtensionBridgeContext.tsx:39-46`

---

---

## 2026-07-28: LinkedIn overlay job detail extraction unreliable

### Issue #27: Overlay import + match scoring returns incomplete LinkedIn text

**Symptom:** Overlay overlay badge shows "Analyzing..." or imports blank/partial job description on LinkedIn. Non-LinkedIn sites work correctly.

**Root Cause:** Two issues:
1. `cleanPageText()` in `overlay.ts` had no DOM stabilization wait. LinkedIn is an SPA — job details render asynchronously. When the overlay injected, the job description section often hadn't loaded yet, so `document.body.innerText` returned an incomplete page.
2. Background's `extractPageContent()` had proper `waitForStable(8000)` but the overlay's import path (`handleImport` → `cleanPageText` → `ARTEMIS_IMPORT_JOB`) bypassed it entirely. The `ARTEMIS_EXTRACT_AND_IMPORT` handler existed in background.ts but was never called.

**Fix Applied:**
1. `cleanPageText()` is now `async`. For LinkedIn, it polls up to 6s for a known job title element (`.jobs-unified-top-card__title`, `.job-details-jobs-unified-top-card__job-title`) or the "about the job" text marker before extracting content.
2. Also added `.job-details-jobs-unified-top-card__job-title` to title selectors (LinkedIn's newer CSS class).

**Location:** `src/extension/overlay.ts:484-520`

---

## 2026-08-14: Overlay stops loading after v3.5.0 (runtime registration regression)

### Issue #28: Overlay not loading — no static content script anymore

**Symptom:** "The overlay was working and now it's not." Overlay never appears on job sites; app + import still work.

**Root Cause:** v3.5.0 (commit `d55009c`) removed the static `<all_urls>` content script. The overlay is now registered **dynamically per site** (`chrome.scripting.registerContentScripts`) and requires BOTH the site in `config.jobSites` AND a granted host permission. Contributing causes:
1. Existing installs that never granted host permissions for job sites (old flow used `<all_urls>`) → `permissions.contains` fails → sync skips every site.
2. Popup "Add site" prefilled `hostname + first 2 path segments`, so adding from a job page pinned the entry to that exact URL (`/jobs/view/123`) → the next job URL didn't match.
3. `saveConfig` (async storage write) fired before `ARTEMIS_SYNC_SITE_SCRIPTS` → background could read stale config and skip registration.
4. `registerContentScripts` only affects newly navigated documents — an already-open job tab needed an F5.

**Fix Applied:**
1. `background.ts` now auto-reconciles on `chrome.storage.onChanged` for `artemis:overlayConfig` (no manual sync message, no race).
2. Newly registered sites auto-inject `overlay.js` into already-open matching tabs (`injectOverlayIntoTabs`).
3. Popup "Enable overlay here" adds a **domain-only** entry (drops the path); path-specific entries remain supported via the Settings editor.
4. App Settings `addSite` also requests host permission before saving.
5. Popup shows a "reload this page" hint as a fallback for SPA quirks.

**Location:** `src/extension/background.ts`, `src/extension/popup.tsx`, `src/extension/job-sites.ts`, `src/app/pages/Config.tsx`

---

### Issue #29: Toolbar import stored to a pending key the app never reads

**Symptom:** `ARTEMIS_EXTRACT_AND_IMPORT` (background `handleExtractAndImport`) stored the job under `artemis:pendingImport` (singular), but the app's `ExtensionBridgeContext` reads `artemis:pendingImports` (plural array) — so toolbar imports could silently vanish when no app tab was open.

**Fix Applied:** `handleExtractAndImport` now pushes into `artemis:pendingImports` (same as the overlay's `ARTEMIS_IMPORT_JOB` path) and creates the app tab when none is open.

**Location:** `src/extension/background.ts`

---

## 2026-09-07: Default LLM config broken out of the box + QA session findings

### Issue #30: Default cloud LLM config 404s on every request

**Symptom:** A fresh install using the default Cloud/OpenRouter config gets `LLM request failed (404)` on every CV generation, Job Analysis, and Cover Letter request — even with a valid API key. Error message ("Check Settings > Test connection") reads as user misconfiguration.

**Root Cause:** `DEFAULT_LLM_CONFIG` (`src/app/config/defaults.ts`) ships `baseUrl: "https://openrouter.ai/api/v1"` — the officially documented OpenRouter base URL, which already ends in `/v1`. But `OpenAICompatibleAdapter.ts` unconditionally appended its own `/v1/chat/completions`, producing `https://openrouter.ai/api/v1/v1/chat/completions`. Any base URL entered in the documented `.../v1` format (OpenRouter, OpenAI itself) hit this; only URLs without the suffix (e.g. `http://localhost:11434`) worked by accident.

**Fix Applied:** `normalizeBaseUrl()` (`src/app/services/provider/shared.ts`) now strips a trailing `/v1` (case-insensitive) before adapters append their own suffix, so both `.../api/v1` and `.../api` style URLs converge to the same request. Verified Gemini's `/v1beta` suffix is unaffected (exact-match `/v1$` only). Added `src/app/services/provider/__tests__/shared.test.ts`.

**Location:** `src/app/services/provider/shared.ts`, `src/app/services/provider/OpenAICompatibleAdapter.ts`

---

### Issue #31: Weak-model CV generation leaks literal "N/A" into exported documents

**Symptom:** With a smaller local model (e.g. `gemma-4-e2b`), generated CVs show literal placeholder text like "2021 - Present | N/A" or "University of Technology, N/A" for optional fields (location) the model couldn't fill from the profile.

**Root Cause:** The CV generation prompt (`prompts.ts`) correctly marks `location` as optional, and the section-variant renderers (`sectionVariants/experience.tsx`, `education.tsx`) already guard with `{item.location && ...}` — but a weak model fills the optional field with a literal `"N/A"` string instead of omitting it, which is truthy and passes the guard unchanged.

**Fix Applied (safeguard):** `cvBuilderService.ts`'s `normalizeCvJson` pipeline now strips a fixed set of placeholder-like values (`"n/a"`, `"none"`, `"tbd"`, `"unknown"`, `"-"`, `"not specified"`, etc., case-insensitive) from `contact.{email,phone,linkedin,website,location}` and `experience[].location` / `education[].location` after generation, regardless of whether the model returned already-typed sections or the legacy key-based shape. Covered by a new test in `cvBuilderService.test.ts`.

**Location:** `src/app/services/cvBuilderService.ts`

---

### Issue #32: Profile empty state shows a blank box with no message

**Symptom:** If the master profile markdown is empty (cleared content, or a from-scratch profile that never got the onboarding sample text), the Profile Editor's preview pane renders nothing — just an empty muted box, no guidance.

**Fix Applied (safeguard):** `Profile.tsx` now renders a placeholder message (`profile.previewEmpty`, added to `en.json`/`es.json`) when `profile.trim()` is empty, instead of an empty `ReactMarkdown` container. Distinct from the existing `showOnboarding` banner, which only fires once on a specific "new profile" navigation, not on generic empty content.

**Location:** `src/app/pages/Profile.tsx`, `src/app/i18n/locales/{en,es}.json`

---

### Issue #33: Sidebar "Recent Analyses" list cannot scroll past the visible area

**Symptom:** Once enough sessions accumulate to overflow the sidebar's allotted height, older sessions become permanently inaccessible — the list neither scrolls nor shows a scrollbar thumb with any range.

**Root Cause:** The `ScrollArea` wrapping the session list (`Sidebar.tsx`) had `className="flex-1 px-3"` with no `overflow`/`min-h-0`. Per the CSS flexbox spec, a flex item's automatic minimum size stays content-based unless the item itself has non-`visible` overflow — so the `ScrollArea`'s own box grew to fit *all* sessions instead of clamping to the space `flex-1` allotted it, and the parent's `overflow-hidden` silently clipped the excess rather than the intended internal scroll ever activating.

**Fix Applied:** Added `min-h-0` to the `ScrollArea` className. Verified live by injecting 25 synthetic sessions directly into IndexedDB and confirming `scrollHeight > clientHeight` plus that scrolling reveals previously-inaccessible entries.

**Location:** `src/app/components/navigation/Sidebar.tsx`

---

## Known Limitations (not yet addressed)

### PDF rendering diverges from interactive preview

The PDF export (`renderingEngine.ts`) and the interactive preview (`InteractiveCVPreview.tsx`) are completely separate rendering paths:

| Aspect | Preview | PDF Export |
|--------|---------|-----------|
| Engine | React + Tailwind + `lucide-react` icons | Raw HTML string + hand-written CSS |
| Interactivity | Inline editing, drag-reorder, expand/collapse | Static output only |
| Icons | `lucide-react` SVG components | Inline SVG strings in HTML |
| State | React state (live) | Snapshot at print time |

**Impact:** Visual alignment between preview and PDF requires manual replication of every layout/design change. Minor spacing, font, and icon differences can appear. Not critical — PDF output is functional but may not be pixel-perfect.

**Suggested fix:** Would require either (a) rendering the preview components via `renderToStaticMarkup` for PDF (risky — preview components assume live DOM), or (b) using `dangerouslySetInnerHTML` in the preview to show the PDF-rendered HTML (loses all interactivity). Neither is a clear win; incremental improvements to `renderingEngine.ts` are the pragmatic path.

---

## Related Documentation

- [[../00-Index/MOC|Map of Content]] — Project documentation index
- [[../30-Features/Analysis Hub|Analysis Hub]] — Job analysis flow
- [[../30-Features/Document Builders|Document Builders]] — CV & Cover Letter Studio  
- [[../10-Architecture/Context Providers|Context Providers]] — State management
