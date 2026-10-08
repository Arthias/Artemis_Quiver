---
tags: [roadmap, extension, sidepanel, autofill]
status: planned
last_updated: 2026-10-08
---

# Application Assist — side panel help for filling job applications

> **Status: planned.** Nothing here is built. Code references describe the
> as-built state on 2026-10-08 (manifest v3.9.4).

## Goal

Extend the side panel from "score this posting" to "help me apply to it":

1. Detect the fields on an application form.
2. Propose values for the routine ones from what Quiver knows.
3. Draft the hard free-text ones ("Why do you want to work here?") on request.
4. Remember answers, including conditional ones (sponsorship needed for US
   roles, not for EU roles).
5. Keep a shelf of favourite CVs — including ones generated in Quiver — that
   can be attached to the page without hunting through Explorer.

Hard rules, from the start: **never submit a form**, **never fill anything
without an explicit click**, **never auto-answer EEO / demographic questions**.

## What exists today that this builds on

| Piece | Where | Reused for |
|---|---|---|
| Side panel React entry, tracks the active tab across switches/navigation | `src/extension/sidepanel.tsx` | Host for the new "Apply" and "Files" sections |
| Action click opens the panel → grants `activeTab` | `background.ts` `chrome.action.onClicked` | Script access to the current tab |
| `chrome.scripting.executeScript` with a self-contained function | `sidepanel.tsx` `runDeepAnalysis` + `pageExtract.ts` | Same pattern for the field scanner / filler |
| Per-site optional host permission flow | `sidepanel.tsx` `toggleAlwaysOn`, `job-sites.ts` | Persistent access on multi-page ATS flows |
| Dexie DB opened directly from the panel (same extension origin) | `src/app/db` | Facts, answer bank, shelf |
| `analyzeJobPosting`, `getActiveEndpoint`, saved `AnalysisSession`s | `services/`, `db/sessionRepo.ts` | Job context for drafts |
| PDF filename = parts joined with " - " (company, role…) | `utils/pdfFilename.ts` | Matching a shelf CV to the current job |

Gap that matters: **Quiver never holds the bytes of a generated CV.** Export is
Paged.js + `window.print()` (`utils/pagedExport.ts`); the browser writes the PDF.
See "Quiver-generated CVs" below.

## Feasibility findings

### Field detection and filling — feasible, well-trodden

Commercial tools (Simplify, Huntr, Teal) do exactly this. Mechanics:

- **Scan**: `input`, `textarea`, `select`, `[contenteditable]`, `[role=combobox]`,
  radio/checkbox groups. Resolve a label in this order: `autocomplete` attr →
  `label[for]` → wrapping `<label>` → `aria-labelledby` → `aria-label` →
  `fieldset > legend` → `placeholder` → nearest preceding text. Tag each with
  `data-artemis-field=<n>` so the panel can refer back to it. Capture type,
  `maxlength`, `required`, and option texts.
- **Fill**: plain `el.value = x` does not reach React/Vue state. Use the native
  setter (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set`)
  then dispatch `input`, `change`, `blur` with `bubbles: true`. `select` by
  option-text match; radios by label match.
- **Known hard cases**: custom comboboxes (react-select, Workday's prompt
  widgets) and multi-step flows. v1 shows the proposed value with a copy button
  instead of filling these.
- **Frames**: Greenhouse/Lever embeds on a company's own site run in a
  cross-origin iframe. `activeTab` covers the top frame only; the frame's
  origin needs its own optional host permission, then `allFrames: true`.
- **Navigation**: `activeTab` is revoked when the tab navigates. Multi-page
  flows (Workday) need the per-site permission the panel can already request.

### Attaching a file to the page — feasible, with one item to spike

- **Reliable path (content script)**: build a `File` from the stored blob,
  put it in a `new DataTransfer()`, assign `input[type=file].files = dt.files`,
  dispatch `change`. For dropzone widgets with no reachable input, dispatch a
  synthetic `drop` `DragEvent` carrying the same `DataTransfer` on the zone.
  Works on most React dropzones; needs a per-ATS check.
- **Drag from the side panel into the page**: unverified. The panel and the tab
  are separate documents; whether a `File` added in `dragstart`
  (`dataTransfer.items.add(file)`) survives the cross-document drop in Chrome
  is the open question. Existing extensions claim to do it. **Spike before
  committing to it**; the click-to-attach path above is the fallback and should
  ship regardless.
- **"Open the folder in Explorer"**: not possible from an extension, except the
  Downloads folder via `chrome.downloads.show` (adds the `downloads`
  permission). Not worth it — see the linked folder below, which makes it
  unnecessary.

### Linked CV folder — feasible

`showDirectoryPicker()` from an extension page returns a
`FileSystemDirectoryHandle`, storable in IndexedDB. Since Chrome 122 the
re-permission prompt offers "Allow on every visit", so it is a one-time grant.
The panel lists PDFs/DOCX in the folder and can read them into blobs on demand.
Spike: confirm the picker opens from the side panel context (needs a user
gesture; should be fine).

### Quiver-generated CVs

No PDF bytes exist in Quiver, and the browser has no API that returns
print-to-PDF bytes. Options:

| Option | Verdict |
|---|---|
| User saves the export into the **linked folder**; it appears on the shelf | **Recommended.** Zero new code beyond the folder; the filename already carries company/role, so the shelf can highlight "the CV for this job" |
| `chrome.debugger` + `Page.printToPDF` | Rejected — "is debugging this browser" banner and a scary permission for a public extension |
| Re-render with a JS PDF library | Rejected for now — second renderer that drifts from `renderingEngine.ts` |

## Design

### Data (Dexie v4, per profile)

- `applicationFacts` — structured key/value for routine fields: names, email,
  phone, city/country, links (LinkedIn, GitHub, portfolio), current
  title/company, years of experience, notice period, earliest start, salary
  expectation (per currency/region), how-did-you-hear default. **Seeded once by
  an LLM extraction pass over `profileMarkdown`, shown for confirmation**, then
  edited by hand in Settings.
- `answerBank` — `{ question, answer, scope, updatedAt }`. `scope` is
  `"always"` or a region tag (`US`, `EU`, `UK`, `other`). Plus one free-text
  **rules** note per profile ("I need sponsorship for US roles, not in the EU;
  open to relocating within Italy") fed to the LLM verbatim — a rules engine is
  not worth building for the long tail.
- `shelf` — favourites: `{ id, label, source: "folder" | "uploaded", fileName, blob? }`
  plus the stored directory handle in `metadata`.

Small facts could live on `ProfileRecord`; only the blobs need a table. Decide
at implementation time — whichever is the smaller migration.

### Panel UI — two new sections

**Apply** (shown when the page has form fields):

1. "Scan form" → list of detected fields, each with a proposed value and a
   source badge: *fact*, *saved answer*, *AI*, or *—*.
2. Checkboxes (pre-ticked for fact/saved-answer only) → "Fill selected".
3. Long text fields and unknowns get a "Draft" button.
4. "Pick a field" mode: the content script highlights fields on hover; click
   one to draft for it. (Optional extra: an editable-field context-menu entry,
   which adds the `contextMenus` permission.)
5. "Save my answers" — reads back the current field values, diffs against
   what was proposed, and offers to remember each changed answer, with the
   scope pre-guessed from the job's country.

**Files**: favourites first, then the linked folder's contents; the CV whose
filename matches the current company sits on top. Per file: "Attach" (fills
the detected resume input / dropzone) and drag (if the spike passes).

### Field classification

1. Deterministic dictionary (regex over label + `name` + `autocomplete`) for
   ~25 standard keys → `applicationFacts`. Covers most of a typical form with no
   LLM call.
2. Saved answers: match by normalised question text, then fuzzy.
3. Everything else, in **one** batched LLM call: field list (label, type,
   options, maxlength) + facts + rules note + job location/company → proposed
   values, `null` allowed. Marked *AI*, unticked by default.
4. **EEO / demographic** (gender, ethnicity, veteran, disability, sexual
   orientation): matched by dictionary and excluded from steps 3 and auto-tick.
   Filled only from an explicit saved answer.

### Free-text drafts

Inputs: question text, `maxlength`, the job context, profile, rules note, and
optionally a user hint ("mention the remote setup"). Job context comes from the
latest `AnalysisSession` whose company matches the page, else the current
quick-score entry, else a picker of recent sessions — the application page is
often not the posting page, so it can't simply re-extract the tab.

The draft opens in the panel for editing; "Insert" writes it to the field.

⚠️ **The known fabrication defect applies here at full strength** (see
`CLAUDE.md`: the generator overrides supplied facts with priors). A draft can
invent credentials and the user may paste it into a real application. Mitigate:
drafts never go in without the edit step, the prompt forbids claims absent from
the profile, and this feature should adopt the deny-list check when it lands in
`src/`. Do not market drafts as "ready to send".

## Phases

| # | Scope | Size | Depends on |
|---|---|---|---|
| 0 | **Spikes** (half a day): drag `File` panel→page on Greenhouse, Lever, Ashby, Workday; `showDirectoryPicker` from the panel; synthetic `drop` on each ATS's dropzone | S | — |
| 1 | **Files shelf**: link folder, favourites, click-to-attach, filename→company match; drag if spike 0 passed | S–M | 0 |
| 2 | **Scan + deterministic fill**: scanner/filler injected function, dictionary classifier, `applicationFacts` + seeding pass + Settings editor, EEO exclusion | M | — |
| 3 | **AI proposals + drafts**: batched unknown-field call, Draft / Pick-a-field, job-context resolution | M | 2 |
| 4 | **Answer bank + learning**: "Save my answers" diff, scoped answers, rules note | S–M | 2 |

Phases 1 and 2 are independent and each useful alone. Ship 1 first — smallest,
and it removes the most tedious step.

Each phase leaves one runnable check: the scanner/classifier against a few saved
HTML fixtures of real ATS forms (synthetic data only — this repo is public),
in `src/extension/__tests__/`.

## Permissions and privacy

- No new required permissions for phases 1–4 (`scripting`, `activeTab`,
  `storage` exist). Optional: `contextMenus` for right-click drafting.
- Per-site host permission requested from the panel when a flow navigates or
  embeds a cross-origin frame — the existing pattern.
- `PRIVACY.md` must gain: form field labels and options, plus profile/facts,
  are sent to the configured LLM for AI proposals and drafts. File contents are
  never sent anywhere; attaching happens inside the page.

## Explicitly out of scope

- Submitting forms or clicking "Next" in multi-step flows.
- Filling custom comboboxes in v1 (copy button instead).
- Account creation / login on ATS portals.
- Marking the job "applied" in Flow — a natural follow-up, separate design.

## Open questions

1. Folder-only shelf, or also uploaded copies stored in IndexedDB? (Recommended:
   folder first — it covers Quiver-generated CVs for free.)
2. Which ATSes matter most? Workday is the most expensive to support well;
   Greenhouse/Lever/Ashby are cheap. Flow's `jobs.db` could answer this by
   counting application hosts.
3. Should AI-proposed short answers be pre-ticked, or always opt-in? (Plan
   assumes opt-in.)
