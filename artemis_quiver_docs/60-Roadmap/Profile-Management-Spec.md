---
tags: [roadmap, spec, profile, flow, extension, cross-app]
status: built, not browser-tested
last_updated: 2026-10-26
---

# Profile management: master, preferences, fingerprint

> [!NOTE] Status (2026-10-26, r4): built, not browser-tested
> Implemented the same day on `feat/assisted-apply` in both repos (Quiver `0810fdd`, `99b5661`;
> Flow `2db79e1`, `b802f89`, `6ec7a7c`). How to test it, and where the build differs from this
> spec: [[Profile-Management-Test-Plan]]. Spec text below is unchanged.

## 0. Decisions (2026-10-26)

| # | Decision |
|---|---|
| P1 | Three profile layers, all from the master profile: **Master profile**, **Preferences** (the card), **Fingerprint**. |
| P2 | Profile management lives on the Profile page. Tabs: *Master profile*, *Preferences*, *Fingerprint*, *Applications* (the form profile, moved from Settings). The AI assistant tab is removed for now. |
| P3 | Preferences and fingerprint can each be written by hand or generated. A *Regenerate* button under Import/Export rebuilds both from the master profile. |
| P4 | The fingerprint is rendered from the preferences by a template, no LLM. |
| P5 | **Quiver owns every user setting, Flow's included.** Flow is a service: it keeps the last settings it was sent so it can run unattended, and replaces them whenever Quiver syncs. Flow settings appear in Quiver only while Flow is connected. |
| P6 | One hash over everything Quiver sends; Quiver syncs before it controls Flow, and only when the hash differs. |
| P7 | Flow implements the job-card experiment as a pre-score. |
| P8 | Export stays master-only. |
| P9 | Quiver warns before a different workspace profile replaces the profile Flow holds. |
| P10 | No re-scoring: jobs Flow already scored keep their scores when the profile changes. |
| P11 | **No company gating.** Flow never blocks or holds back a job because of earlier applications or company rules; a user may apply to the same company as often as they like. Instead Flow shows the company's application history ("Applied on <date>", linked to that job). Company rules are dropped, not moved. The applications log stays in Flow's database (assisted-apply D1 holds for `applications`). |
| P12 | **Flow's standalone frontend is retired** (removed 2026-10-26, Flow `31bfd2f`; last commit with it tagged `archive/flow-frontend-2026-10-26`). Flow's per-setting write endpoints go once Quiver syncs (§6). |

## 1. Profile layers

| Layer | What it is | Built from | Read by |
|---|---|---|---|
| **Master profile** | the user's markdown, as today | the user | job analysis, CV/CL builders, Flow scoring and strategy |
| **Preferences** | a structured card: hard limits plus what the user wants | by hand, or one LLM call over the master profile | Flow eligibility gates, Flow card pre-score (§8), the fingerprint |
| **Fingerprint** | one line, ≤300 chars | by hand, or a template over the preferences | overlay quick score (Gemini Nano or fallback) |

The form profile (applicant fields, saved answers, rules) moves to the Profile page's *Applications*
tab unchanged; it is applicant data, not a derivative, and is not synced to Flow.

Nothing about any particular user is hardcoded. Every preference is unset by default, and unset
means no filtering.

## 2. What it replaces

| Today | After |
|---|---|
| Flow preferences, edited in Settings → Flow, stored only in Flow (`backlog_config.preferences`) | **Preferences**, stored in Quiver, sent to Flow |
| Candidate card in Flow's experiment (`scripts/align_experiment.py`) | merged into **Preferences** |
| Fingerprint: LLM over the first 4,000 chars, generated in two places (`Config.tsx` `generateFingerprint`, `background.ts` `generateFingerprintFromProfile`), stored in `chrome.storage` | **Fingerprint** on the profile record |
| Flow settings stored in Flow, edited through per-setting PUTs (backlog, preferences, LLM) | stored in Quiver, sent in one sync (§6) |
| "Send Profile to Flow", "Send Primary/Secondary" buttons | automatic sync |
| Settings → Apply (form profile) | Profile page → *Applications* |
| Profile page AI assistant tab | removed for now; `profileChat` data and `profileChatService.ts` kept |

## 3. Data model (Quiver)

New optional fields on `ProfileRecord` (`db/schema.ts`) and `ProfileWorkspaceData`. They are not
indexed, so **no Dexie version bump**; deleting a profile removes them with the record.

```ts
interface Layer<T> {
  value: T;
  /** "manual" = written by hand; "generated" = built by Regenerate and not edited since. */
  origin: "manual" | "generated";
  /** For generated layers: SHA-256 of the source (master markdown for preferences, preferences JSON for the fingerprint). */
  sourceHash?: string;
  updatedAt: string;
}

preferences?: Layer<ProfilePreferences>;
fingerprint?: Layer<string>;
```

Editing a generated layer flips it to `manual`. The stale badge (§4) applies to both origins: it
compares the stored `sourceHash`, or the hash at the time of the manual edit, with the current source.

### `ProfilePreferences`

Flow's current `Preferences` model without its operational fields, plus the candidate-card fields.
Zod schema in `types/preferences.ts`, shared by the editor, the generator and the sync.

| Field | Type | Gate / weigh |
|---|---|---|
| `home_country` | ISO code \| null | gate |
| `work_authorisation`, `remote_from`, `relocation_countries` | place codes | gate |
| `work_modes.{remote,hybrid,onsite}` | null \| bool \| place list (cities or codes) | gate |
| `languages` | `{name, level?}[]`, level CEFR or `native` | gate |
| `has_degree` | bool \| null | gate |
| `fields` | string[], plain-language kinds of work | gate (field gate, §8) |
| `levels` | subset of entry / mid / senior / staff_principal / manager / director_plus | weigh |
| `skills` | string[], up to 25 | weigh |
| `years` | number \| null | weigh |
| `domains` | string[], industries | weigh |
| `weights` | `{skills, location, seniority, language, education}` \| null; null = defaults | — |
| `schema_version` | 1 | — |

### Flow run settings

New `flow?: FlowRunConfig` on `ProfileSettings`, next to the existing `flowBaseUrl`:

| Group | Fields | Today in Flow |
|---|---|---|
| `llm` | which Quiver endpoint Flow uses (primary/secondary), `soft_model`, `hard_model` | `config/llm.yaml` via `PUT /api/settings/llm` (provider, model, base_url, api_key, temperature only) |
| `backlog` | `soft_cap`, `hard_cap`, `hard_cap_min_score`, `archive_retention_days`, `archive_score_threshold`, `stale_new_days`, `skip_aggregator_boards` | `backlog_config` via `PUT /api/settings/backlog` |
| `apply` | `daily_cap`, `review_by` | inside the preferences JSON |
| `prescore` | `enabled`, `threshold` (default 60) | new (§8) |

Defaults are Flow's current defaults, copied into Quiver.

Stays in Flow (service internals, not user settings): scraper and board definitions
(`config/boards.yaml`, `ats.yaml`, `sources.yaml`), `seed`, `scoring_passes`, the LLM fallback block,
and Flow's working state (jobs, strategy and its history, applications, disqualifications).
`target_companies.yaml` is user-flavoured data in a service file; out of scope here.

### 3a. Company history instead of company gating (Flow)

Flow keeps the `applications` log and reports it; it no longer gates on it (P11).

| Today (Flow `feat/assisted-apply`) | After |
|---|---|
| `company_verdict` (`app/pipeline/apply.py`): any earlier application to the company = `block`; active process = `ask`; user rules block / ask / quota on top | removed. Each queue item and job carries `company_history`: `[{applied_at, job_id, title, job_url, outcome}]`, newest first, empty when none |
| Queue gates `"Applied to this company already (not yet synced)"` and `"Another job from this company is earlier in this queue"` | removed; several jobs from one company can sit in the same queue |
| `skip_applied_companies` (backlog setting): archives new jobs from applied or blocked companies (`rank.py` reapply gate, `blocked_company_keys`) | removed, with its column and its toggle in Quiver |
| `company_rules` table, `GET/PUT/DELETE /api/company-rules`, Quiver `CompanyRulesSection` and its `flowBridge` calls | removed. The table is left in place, unread, so existing rows are not lost; drop it in a later cleanup |
| *Blocked* tag with `block_company` (`POST /api/disqualifications`) | the per-job disqualification stays (archives that job, keeps the evidence); `block_company` is removed, in Flow and in `services/applyQueue.ts` |
| Company aliases (stored on rules) | gone with the rules; `company_key` falls back to `normalize_company` |

Eligibility and stated-requirement verdicts are unchanged: they are about the job, not the company.

**Shown in Quiver** wherever a Flow job appears (the `/flow` lists, job detail, the Apply tab and the
side-panel queue): *"Applied to <company> on <date>"*, each date linking to that job in Flow, plus
the outcome when known. Only with Flow connected; standalone Quiver has no application history.

The `GET /api/apply/queue` response changes shape (verdicts lose the `company` and `queue` gates,
items gain `company_history`), so Quiver and Flow ship this together.

## 4. Profile page

- **Tabs:** *Master profile*, *Preferences*, *Fingerprint*, *Applications*.
- **Header:** Import, Export, Save as today; **Regenerate preferences and fingerprint** under Import/Export.
- **Preferences tab:** the editor from `components/flow/PreferencesSection.tsx`, moved and extended
  with the card fields (list inputs for fields, skills, domains; checkboxes for levels; a number for
  years; name + level rows for languages; weights collapsed under *Advanced*). Empty state offers
  *Generate from master profile* and *Fill in by hand*. Works without Flow (§5).
- **Fingerprint tab:** a textarea with a character count, *Render from preferences*, and a line
  saying whether it is rendered or hand-written.
- **Applications tab:** `components/apply/ApplicationSettingsCard.tsx`, moved as is.
- **Stale badge** on Preferences when the master profile changed after it was built or last edited,
  and on Fingerprint when the preferences did. Nothing regenerates on its own.

### Generate preferences

1. One LLM call over the **whole** master profile (no truncation), JSON only, validated with zod.
2. The prompt uses `<placeholders>` only, never realistic example values (the 2026-10-22 experiment:
   the model copied example values into the output). Unstated = unset, never guessed.
3. Generated values are shown in the tab for review; nothing is saved until the user saves.
4. If the layer is `manual`, confirm first: "This replaces your hand-written preferences."

### Render the fingerprint

```
<fields, top 2> | <skills, top 5> | <years>y | <domains, top 3> | <levels>
```

Unset parts are dropped; capped at 300 chars. Same confirm rule when the fingerprint is `manual`.
Before deleting the old LLM path, score a handful of labelled postings in the overlay with both.

### Import / export

Importing a master profile marks preferences stale; it does not regenerate. Export is master-only (P8).

## 5. Place codes in Quiver

Validation and place lookup move from Flow (`GET /api/geo`, the `Preferences` validators) to Quiver:

- Country names and codes from `Intl.DisplayNames(["en"], { type: "region" })` (built into the browser).
- Region codes (`EUROPE`, `EU`, `EEA`, `EMEA`, …) as a small constant copied from Flow's `eligibility.py`.
- Flow keeps validating what it receives (it is a trust boundary) and rejects a bad bundle with the
  field named; Quiver shows that as the sync error. Flow's own geo code stays, since it locates jobs.

## 6. Sync

**Rule:** before Quiver controls Flow, Flow holds what Quiver has.

### Bundle and hash

```ts
interface FlowBundle {
  hash: string;            // SHA-256 of everything below, canonical JSON
  profile_name: string;    // workspace profile name, for display only
  master: string;
  preferences: ProfilePreferences | null;
  fingerprint: string | null;
  llm: { provider, model, base_url, api_key?, temperature, soft_model?, hard_model? };
  backlog: {...}; apply: {...}; prescore: {...};
}
```

### Flow endpoints

- `GET /api/sync` → `{hash, profile_name, synced_at}` (never returns the API key or the content).
- `PUT /api/sync` → validates the whole bundle, then replaces Flow's stored settings in one
  transaction: `profile.md`, preferences, LLM settings, backlog, apply, prescore, hash. Anything previously set by another route is discarded (P5).
- **Removed** once Quiver syncs: `PUT /api/profile`, `PUT /api/settings/preferences|backlog|llm`.
  Their only other client was Flow's retired frontend (P12). The
  GETs stay, for the first-sync import and for display.

### Quiver side

`ensureFlowSynced(baseUrl)` in `services/flowBridge.ts`:

1. Builds the bundle from the active profile record and its `flow` settings.
2. `GET /api/sync`; if the hash matches, done.
3. If Flow holds a different `profile_name`, confirm before replacing it (P9).
4. `PUT /api/sync`. Caches the hash in memory, so repeated calls cost nothing until something changes.

Called on **connect**, on opening the `/flow` page, from the shared **`flowPost` / `flowPut`**
helpers (every control call already goes through them), and after saving the profile or a Flow
setting while connected (debounced). A failed sync blocks the control call and shows the error.

Settings → Flow shows "Flow has: <profile name>, synced <time>" in place of the Send buttons;
`flowConfiguredAt` is set by the first successful sync.

Not covered: the extension's background worker (capture, outbox). It does not change what Flow scores against.

### First sync of an existing install

When Quiver has no `preferences` or `flow` settings yet but Flow does, Quiver offers once:
*"Use the settings Flow has now?"*, reading them through the existing GETs. Without this, the first
sync would reset a running deployment to defaults. After that, Quiver is the only source.

## 7. Removals in Quiver

- Settings → Extension: fingerprint section and `generateFingerprint` (`pages/Config.tsx`).
- Extension popup: the generate button becomes a link to the Profile page; the popup still shows
  whether a fingerprint exists and its date.
- `background.ts`: `generate_fingerprint` and `generateFingerprintFromProfile`. The overlay reads the
  fingerprint from the active profile record via `extension/idbProfile.ts`, which already reads that
  record. The score cache stays keyed by fingerprint text, so a new fingerprint invalidates old quick scores.
- Settings → Flow: *Send Profile*, *Send Primary/Secondary*, `PreferencesSection` (moved).
- Settings → Apply: `ApplicationSettingsCard` (moved).
- Settings → Flow: `CompanyRulesSection` and the `skip_applied_companies` toggle (deleted, §3a).
- Profile page: AI assistant tab and its handlers.

## 8. Flow: card pre-score

From `artemis_flow_docs/60-Roadmap/Job-Card-Framework-2026-10-22.md` and `scripts/align_experiment.py`.
Measured on 22 labelled jobs: the card separates "no" from the rest (AUC 1.00) but cannot order "yes"
over "maybe" (0.51), so it is the **filter** and the existing full scorer is the **order**.

### Per job

| Step | Kind | Depends on | Stored on the job |
|---|---|---|---|
| 1. Eligibility gates (existing `candidate.py`, `hard_requirements.py`) | code | preferences | as today |
| 2. Job card extraction | 1 LLM call, ~36 s on servito | the posting only | `job_card` JSON, `job_card_version` |
| 3. Field gate: is the job mainly work in `preferences.fields`? | 1 short LLM call, ~2 s | `fields` | `field_gate`, `prefs_hash` |
| 4. Skills coverage: which of the job's must-haves the candidate has | 1 short LLM call, ~6 s | `skills` | `skills_match` |
| 5. Alignment: weighted rows (skills, location, seniority, language, education) | code | preferences, `weights` | `align_score`, `align_rows` |
| 6. Full scorer, only when `align_score ≥ prescore.threshold` | existing | master profile | as today |

- Jobs below the threshold keep `align_score` and its rows, are marked `score_status = 'prescreened'`,
  and are not deep-scored. Quiver shows them in a separate list with their rows, never hides them silently.
- The job card is profile-independent, so it is extracted once per job and reused; it is redone only
  when the description changes or `job_card_version` is bumped.
- Steps 3–5 are keyed by `prefs_hash`. Per P10, jobs already scored are not redone when preferences change.

### Rules carried over from the experiment

- **The location row is derived from preferences only.** The experiment's `location_score` hardcoded
  one user's country and cities; production builds tiers from `home_country`, `work_modes`,
  `remote_from` and `relocation_countries` (remote reachable from `remote_from` or hybrid/on-site in
  a listed place = 1.0; relocation country = 0.8; elsewhere in a listed region = 0.5; else 0.2;
  no stated place = 0.6). Unknown never fails.
- **No ISCO codes** in the gate (a 9B model misplaces jobs at group boundaries); plain-language fields only.
- **Job-card prompt uses placeholders, not example values** (`CARD_PROMPT_V2` still has examples; fix
  before promoting). One value per field; unknown is a value.
- Default weights: skills 0.35, location 0.25, seniority 0.20, language 0.10, education 0.10.

### Rollout

Behind `prescore.enabled`, default **off**. Switched on after `scripts/eval_labels.py` on the 28-job
hold-out keeps every "yes" above the threshold. New code under `app/pipeline/` (card extraction,
alignment), called from `rank.py` before `_score_one`; the experiment scripts stay as the measurement harness.

## 9. Checks

One small test file each, no new framework:
- Quiver: preferences zod schema accepts Flow's current shape and rejects bad place codes; the
  fingerprint render drops unset parts and caps at 300 chars; `ensureFlowSynced` makes no PUT when the
  hash matches.
- Flow: `PUT /api/sync` rejects a bad bundle without changing anything, and a good one replaces every
  setting; the location row gives the same tiers for two users with different preferences and no
  hardcoded places; jobs below the threshold are never sent to the full scorer.

## 10. Order of work

1. **Flow:** `GET/PUT /api/sync`, the extended `Preferences` model, `daily_cap`/`review_by` and
   read from the synced settings.
1b. **Flow + Quiver together:** company gating out, `company_history` in (§3a).
2. **Quiver:** data model, Profile page tabs (assistant removed, Applications moved), preferences
   editor working without Flow.
3. **Quiver:** generate preferences, render the fingerprint, stale badges.
4. **Quiver:** `FlowRunConfig`, `ensureFlowSynced`, first-sync import,
   Settings → Flow status line; remove the Send buttons. Then remove Flow's per-setting PUTs.
5. **Quiver:** overlay reads the fingerprint from the record; remove the old generators.
6. **Flow:** card pre-score behind the toggle; measure; switch on.

Each step ships on its own. Until step 5 the old fingerprint path keeps working.
