---
tags: [roadmap, plan, extension, sidepanel, flow, cross-app]
status: planned
last_updated: 2026-10-17
---

# Assisted Apply: build plan (branch `feat/assisted-apply`)

> [!NOTE] Status: planned, nothing built
> This replaces the architecture in [[Assisted Application Flow]] (2026-10-16 proposal)
> where the two disagree. Branch-only work: it may never reach `main`.

## Principles
- **Flow is a service at a URL.** Nothing may assume where it runs or who operates it, or that it shares a filesystem with the browser.
- **No personal constraints in code.** Work mode, relocation, authorisation, languages and degree are user preferences. Unset means flag only, never filter.
- **Never click submit.** Never fill without an explicit click. Never auto-answer EEO/demographic questions.
- A check that could not run shows as *not checkable*, never as passed. Excluded jobs are shown with their reason.

## What changed from the proposal

| Proposal | Plan |
|---|---|
| Flow reads and writes the user's own record files | **Flow's DB is the record**: `applications`, `company_rules`, `disqualifications`. Exportable as CSV/JSON. |
| A personal claims register as the validator | **Generic claim check against the user's profile**, under user control |
| Dexie `version(4)` | Queue and outbox in the existing `metadata` store. A version bump on a branch breaks `main`'s build on the same database. |
| Flow resolves the CV's disk path | **CVs come from the linked CV folder** (favourites, company-name sort) and are attached by default, with read-back verification |
| Fixed form-gate table ("hybrid → block") | A generic question-type dictionary *detects*; the user's preferences *judge* |
| Start button in Flow's frontend | `/flow` page in Quiver only |
| Jittered spacing timers | A daily-cap setting and one application per company per queue |

## Gates (Flow computes, Quiver displays)
- **Company history.** Any prior application to the company, in any outcome including no response, counts. An active interview process yields *ask*.
- **Company rules** (user-entered):
  - `block`, `ask`, or `quota`, where quota means N applications per D days plus a same-role cooldown.
  - A quota with budget left yields *ask*, with the arithmetic. With no budget left it yields *block* until a date.
  - Rules can expire.
- **Aggregator listings:** the employer is unknown, so the company gate shows *not checkable*.
- **Preferences:** work mode, location reachability, degree and languages. Each blocks only if the user set it.
- **Form (Phase 2):** sponsorship, office days, country selects, relocation and degree questions, judged against preferences before any fill.
- Every block can be overridden per job, with a reason, and the override is recorded.

## Phases

**0. Prove the base.** Run the [[Application-Assist]] browser checklist on Ashby, Greenhouse and one embedded-iframe form, and record the results. Separately, on `main`: remove the concrete degree/institution example from `CV_JSON_FORMAT` (`src/app/services/prompts.ts:71`).

**1. The record and the company gate.**
- `flowBridge.ts` fields and calls.
- `/flow`: *Start applying* with a score range and a limit, and the excluded list shown.
- Side panel: the rationale block (score, spread, passes, reasoning, verdicts with evidence), *Open next*, and tags `applied / not_applied / archived / closed / blocked`. *Blocked* takes a reason and quoted evidence, and optionally "block this company".
- *Log an outside application*.
- Queue and outbox in `metadata`. The outbox is written before the UI confirms and drains from the panel and from a `chrome.alarms` tick. A persistent badge shows while outcomes are unrecorded. On resume, an opened item that was never tagged asks *"Did you submit?"* (*Not sure* still counts).
- Settings: a company-rules editor and the daily cap.

**1.5. Preferences** (mostly Flow): the preference editor in Settings, and Flow's eligibility judged against it.

**2. Read the form, then pre-fill.**
- `scanGateFields()` over select, radio, checkbox and combobox fields. It runs before any fill and again on *Re-scan* (for multi-step forms and conditional questions). There's no LLM in it, and an unknown required field means *ask*.
- Pre-fill through Application Assist.
- Attach the recommended CV from the folder, then read back the file name.
- Salary, notice period, visa, degree and EEO questions are left to the human.

**3. Drafts behind the claim check.**
1. Extract checkable claims: degrees, people counts (including spelled-out numbers), years, amounts, employer names, titles, certifications.
2. Check each against the profile, sentence by sentence. Line breaks and bullets are normalised first.
3. A user-owned never-claim list. Each rule is `id, severity, explanation, pattern, allowed wording`. It's empty by default.
4. Per flag: *Accept as true* (logged), *Edit* or *Regenerate*. Strictness `off / warn / block-insert`, default `warn`. The check runs again on insert after edits, and every match is reported.
5. Built-in extractors ship with should-fail/should-pass examples that run in CI.

**Later: bulk lane.** "Apply to anything scored x–y", for users targeting volume roles. Decide it with outcome data from Phase 1. Whether it ever submits is an open decision.

## Flow API this depends on (additive; Flow branch `feat/assisted-apply`)
- `GET /api/apply/queue?min_score&max_score&limit&lane` returns `{ queue_id, built_at, items[], excluded[] }`, with `verdicts: [{ gate, verdict: pass|block|ask|no_evidence, detail }]`.
- `GET/POST/PATCH/DELETE /api/applications`. The client generates the `id`, which makes the POST idempotent. Records survive job purges.
- `GET/PUT/DELETE /api/company-rules`, `POST /api/disqualifications`.
- `ats_identity` (and parsed parts), `work_mode` and `apply_url` on job responses.

## Edge cases to test
- Aggregator rows.
- A posting closed when opened.
- An apply page that differs from the posting, or an embedded iframe.
- Multi-step forms.
- A synthetic file attach ignored by the ATS (detected by read-back).
- CV folder permission lapsed.
- Tagged but not yet synced while a new queue is built.
- Undo of a mistaken `applied`.
- Flow unreachable mid-queue.
- Flow at a non-default URL (host permission for the configured origin).
