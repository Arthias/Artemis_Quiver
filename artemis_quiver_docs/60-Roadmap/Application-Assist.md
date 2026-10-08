---
tags: [roadmap, extension, sidepanel, autofill]
status: planned
last_updated: 2026-10-08
---

# Application Assist — side panel help for filling job applications

> **Status: planned.** Nothing here is built. Code references describe the
> as-built state on 2026-10-08 (manifest v3.9.4). Revision 2: scope narrowed
> after the first review (decisions log at the bottom).

## Goal

Extend the side panel from "score this posting" to "help me apply to it":

1. **CV folder** — link a local folder of CVs, attach them to the page from the
   panel; Quiver-generated CVs go to a subfolder of it.
2. **Form profile** — one editable JSON of standard fields and saved answers,
   used to fill the routine text fields of an application form.
3. **Drafts on request** — for the hard free-text questions, the user asks and
   the main model drafts.

Target ATSes, in order: **Ashby** first, Greenhouse second (Greenhouse's own
autofill already covers its standard fields well, so there the value is mainly
custom questions and drafts).

Hard rules: **never submit a form**, **never fill without an explicit click**,
**never auto-answer EEO / demographic questions**, **never generate unless the
user asks**.

Out of scope by decision: dropdowns, radios, checkboxes and custom comboboxes —
fixed-choice fields are quick for the user and are skipped entirely. Only text
inputs and textareas are handled.

## What exists today that this builds on

| Piece | Where | Reused for |
|---|---|---|
| Side panel, tracks the active tab across switches/navigation | `src/extension/sidepanel.tsx` | Host for the new "Apply" and "CVs" sections |
| Action click opens the panel → grants `activeTab` | `background.ts` `chrome.action.onClicked` | Script access to the current tab |
| `chrome.scripting.executeScript` with a self-contained function | `runDeepAnalysis` + `pageExtract.ts` | Same pattern for scanner / filler |
| Per-site optional host permission request | `toggleAlwaysOn`, `job-sites.ts` | "Review & fill" permission ask |
| Dexie opened directly from the panel (same extension origin) | `src/app/db` | Form profile, folder handle |
| Gemini Nano via `LanguageModel` | `nano-inject.ts`, `overlay.ts` | Optional local field identification |
| Main-model plumbing + saved `AnalysisSession`s | `getActiveEndpoint`, `analyzeJobPosting`, `db/sessionRepo.ts` | Drafts and their job context |
| PDF filename = `CV - <name> - <job label>` | `CVBuilder.tsx:167`, `utils/pdfFilename.ts` | Matching a CV to the current job |

## 1. CV folder (phase 1 — ship first)

**Link**: "Link CV folder" in the panel → `showDirectoryPicker({ mode: "readwrite" })`
→ handle stored in IndexedDB. Chrome ≥122 offers "Allow on every visit", so
it is a one-time grant; on later sessions call `handle.queryPermission()` and,
if needed, `requestPermission()` from a click.

**Layout** (Quiver owns only the subfolder):

```
<user's CV folder>/            ← the user's own CVs, read-only to Quiver
  Quiver/                      ← generated CVs land here, created on first save
```

**Panel list**: user's CVs first (favourites pinned on top, stored by filename),
then `Quiver/`. The generated CV whose filename contains the current page's
company sorts to the top with a "for this job" tag.

**Attach**: per file, "Attach" → read the file to a blob → inject a function
that puts it in a `DataTransfer`, assigns `input[type=file].files`, dispatches
`change` (bubbling). If the form has several file inputs (resume + cover
letter), the user picks which from the scan's list. For dropzones with no
reachable input, dispatch a synthetic `drop` carrying the `DataTransfer`.

**Drag**: experiment only, after attach ships. A file dragged out of the panel
must survive a cross-document drop; unverified. Attach is the real path —
some sites don't accept drops at all.

### Saving generated CVs into `Quiver/`

The catch: Quiver never holds PDF bytes. CV export is Paged.js +
`window.print()` (`utils/pagedExport.ts`); the browser writes the file. So:

- **Manual save (works today, ~no code)**: the first time, the user picks
  `<folder>/Quiver/` in Chrome's Save-as-PDF dialog. Chrome remembers the last
  save location, so every later export defaults there. The panel picks the file
  up on its next listing. The CV Builder can show a one-line hint with the
  folder path.
- **Automatic save (the requested option) — needs a spike.** Requires PDF
  bytes, which only `chrome.debugger` + `Page.printToPDF` can produce. Plan:
  - `debugger` as an **optional** permission, requested only when the user
    turns on "Auto-save generated CVs" in Settings.
  - Chrome shows an "Artemis Quiver started debugging this browser" bar while
    attached — a few seconds per export. Disclose it next to the toggle.
  - **Unknown**: whether the debugger can attach to Quiver's own
    `chrome-extension://` tab (attaching to extension *background* pages needs a
    command-line flag; tabs are unclear). If it can't, render the CV into a
    throwaway `about:blank`/`data:` tab and print that.
  - On success, write the bytes with the folder handle:
    `getDirectoryHandle("Quiver", { create: true })` → `getFileHandle(name, { create: true })`
    → `createWritable()`.
  - If the spike fails, the toggle doesn't ship; manual save stands.

Rejected: a second PDF renderer (drifts from `renderingEngine.ts`); a raster
"screenshot PDF" (ATS parsers can't read it).

## 2. Form profile (phase 2)

One mutable JSON per Quiver profile, stored on the profile record, editable in
Settings as raw JSON (validated on save; import/export comes for free) and
updated from the panel.

```json
{
  "fields": {
    "first_name":   { "value": "…", "aliases": ["first name", "given name"] },
    "email":        { "value": "…", "aliases": ["email", "e-mail address"] },
    "linkedin":     { "value": "…", "aliases": ["linkedin", "linkedin profile"] },
    "salary_expectation": { "value": "…", "aliases": ["desired salary", "compensation expectations"] },
    "how_heard":    { "value": "LinkedIn", "aliases": ["how did you hear"] }
  },
  "answers": [
    { "question": "Will you require visa sponsorship?", "answer": "Yes", "scope": "US" },
    { "question": "Will you require visa sponsorship?", "answer": "No",  "scope": "EU" }
  ],
  "rules": "Free text the model reads verbatim, e.g. sponsorship needed for US roles, not for EU."
}
```

- **Seed**: ships with ~25 standard keys and default aliases, empty values. A
  "Fill from my profile" button runs one main-model extraction over
  `profileMarkdown` and shows the proposed values for confirmation.
- **Learning is the aliases list.** When a field label is matched to a key
  (by the user, or by Nano / the main model), the label is appended to that key's
  `aliases`. Next time the match is a plain string lookup, no model.
- **Answers**: saved from the panel ("Save answer" next to any filled field).
  `scope` is `"always"` or a region tag; the panel pre-guesses it from the job's
  country (from the matching analysis session), the user confirms.

## 3. Review & fill (phase 2)

A single **"Review & fill"** button in the panel:

1. **Permission**: if Quiver lacks host access to the page, request it in
   that click (`chrome.permissions.request`) — the current origin plus the
   embed origins of the target ATSes (`jobs.ashbyhq.com`,
   `job-boards.greenhouse.io`, `boards.greenhouse.io`), since company career
   sites embed those as cross-origin iframes. Requesting a known list up front
   keeps the request inside the click's user gesture; discovering frames first
   would need async work that can lose it.
2. **Scan** (all frames): text `input`s (not hidden/password/file) and
   `textarea`s, plus `input[type=file]` for the CV section. Label resolution:
   `autocomplete` → `label[for]` → wrapping `<label>` → `aria-labelledby` →
   `aria-label` → `placeholder` → nearest preceding text. Tag each field with
   `data-artemis-field=<n>`. Capture `maxlength`, `required`, current value.
3. **Match**, cheapest first:
   1. Alias lookup (normalised label) → `fields`.
   2. Saved answer for the question, filtered by scope.
   3. **Gemini Nano**, if available: unmatched labels → field keys, JSON-schema
      constrained (`responseConstraint`), `null` allowed. Labels and key names
      only — no profile values go to the model.
   4. Fallback when Nano isn't available: the same classification via the main
      model, still labels + keys only.
   5. EEO / demographic labels (dictionary) are excluded from all of the above.
4. **Review list** in the panel: each field with its proposed value and source
   badge (*profile*, *saved answer*, *—*). Already-filled fields (e.g.
   Greenhouse's own autofill) are shown but unticked. Long free-text fields get
   a **"Draft"** button instead of a value.
5. **Fill selected**: native value setter + `input`/`change`/`blur` events
   (bubbling), so React-controlled inputs (Ashby) register it. Skip any field
   the user already typed in.

**Why Nano only for identification**: the task is small, private and
repetitive, and Nano can do it offline. It needs >4 GB VRAM or 16 GB RAM and
22 GB free disk, so it can never be required — the main model is always the
fallback. In the side panel, `LanguageModel` can be called directly; the
MAIN-world bridge (`nano-inject.ts`) is only needed inside web pages.
Verify availability in the side-panel context during the spike.

## 4. Drafts on request (phase 3)

Only from the **"Draft"** button (or a "pick a field" mode: hover-highlight,
click to choose). The **main model** drafts — never Nano.

Inputs: question text, `maxlength`, profile, form-profile `rules`, optional
user hint, and the job context. Job context = latest `AnalysisSession` whose
company matches the page, else the quick-score entry, else a picker of recent
sessions (the application page is often not the posting page).

The draft opens in the panel for editing; "Insert" writes it to the field;
"Save answer" stores it in `answers` for reuse.

⚠️ **The known fabrication defect applies here at full strength** (see
`CLAUDE.md`: the generator overrides supplied facts with priors). Drafts are
never inserted without the edit step, the prompt forbids claims absent from the
profile, and this feature adopts the deny-list check when it lands in `src/`.

## Phases

| # | Scope | Size |
|---|---|---|
| 0 | **Spikes**: `showDirectoryPicker` + persistent permission from the side panel; `DataTransfer` attach on Ashby and Greenhouse (top frame and embedded); `chrome.debugger` → `Page.printToPDF` on a Quiver tab; `LanguageModel` in the side panel | S |
| 1 | **CV folder**: link, list, favourites, attach, "for this job" match, `Quiver/` subfolder, manual-save hint; auto-save toggle if spike passed | S–M |
| 2 | **Form profile + Review & fill**: JSON store + Settings editor + seeding, scanner/filler, alias/answer/Nano/main-model matching, save-answer | M |
| 3 | **Drafts**: Draft button, pick-a-field, job-context resolution | S–M |
| — | Drag-from-panel experiment | S, after 1 |

Each phase leaves one runnable check in `src/extension/__tests__/`: scanner +
matcher against saved HTML fixtures of an Ashby and a Greenhouse form, with
synthetic data only (this repo is public).

## Permissions and privacy

- Required: unchanged (`scripting`, `activeTab`, `storage`, `sidePanel`).
- Optional, requested at use: per-site host access ("Review & fill"),
  `debugger` (auto-save toggle only).
- `PRIVACY.md` additions: field labels go to Nano (local) or the configured
  LLM for identification; profile, rules and job context go to the configured
  LLM for drafts; CV files are never sent anywhere; the debugger banner and why.

## Decisions log

- 2026-10-08 r1: initial plan.
- 2026-10-08 r2 (Bruno): skip fixed-choice fields; standard fields + saved
  answers live in one mutable JSON "form profile"; Nano for field identification
  where available, main model for drafts on request only; a "Review & fill"
  button asks for page permission; folders first, generated CVs in a subfolder,
  with an auto-save option; Ashby first, Greenhouse second; AI output is never
  pre-filled — the user generates when they want to.
