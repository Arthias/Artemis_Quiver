---
tags: [roadmap, test-plan, profile, flow, extension, cross-app]
status: current
last_updated: 2026-10-26
---

# Profile management: test plan

What was built for [[Profile-Management-Spec]] (r4) on 2026-10-26, how to test it, and where
it differs from the spec. Branch `feat/assisted-apply` in both repos, nothing pushed.

| Repo | Commits |
|---|---|
| Quiver | `0810fdd` profile layers, settings, sync · `99b5661` pre-screened counter · then the old-Flow error message and these docs |
| Flow | `2db79e1` sync bundle, no company gating · `b802f89` sync state for import · `6ec7a7c` card pre-score · then docs |

Automated checks, all green on 2026-10-26: Flow `pytest tests` 740 passed; Quiver
`npx tsc --noEmit` clean, `npx vitest run` 182 passed, `npm run build` and `npm run build:ext`
built. **Nothing has been tried in a browser or against real postings.**

## 0. Before you start

> [!WARNING] Quiver and Flow must move together
> New Quiver needs Flow's `/api/sync`; old Quiver calls Flow endpoints that are gone.
> - `dist-ext` has been rebuilt with the new Quiver. Chrome loads it on its next restart (or
>   **Reload** in `chrome://extensions`). Against servito's current Flow, every Flow control from
>   Quiver then fails with *"This Flow is older than Quiver: it has no /api/sync"*. Test against a
>   local Flow first (§3), or deploy Flow (§5) before restarting Chrome.
> - Deploying this Flow to servito breaks the Quiver build you run today in the same way.

Back up first:
- Flow: `config/llm.yaml` (untracked) and `data/jobs.db`. The first sync rewrites `profile.md`,
  the preferences and the backlog settings, and merges the LLM keys into `llm.yaml`.
- Quiver: Profile → **Export** the master profile.

## 1. Quiver alone (no Flow)

1. **Profile page.** Tabs read *Master profile, Preferences, Fingerprint, Applications*; no AI assistant.
   Import, Export (and Save while editing) at the top right, **Regenerate preferences and fingerprint** below them.
2. **Generate.** With a saved master profile, press **Regenerate**. Expect: Preferences tab opens
   with a blue "Generated… check every field" note, **Discard**/**Save** buttons, and the
   Fingerprint tab holding a rendered draft. Check the generated values honestly: fields of work in
   plain words (not job titles), levels not "all of them", skills not thin, nothing copied from
   the prompt. Nothing is stored until **Save** (reload the page before saving: the draft is gone).
3. **Unsaved master.** Edit the master profile without saving, press Regenerate → error "Save the
   master profile first".
4. **Hand edits.** Edit any preference → origin line becomes "Written by hand" after Save. Press
   Regenerate again → confirm dialog naming *Preferences*.
5. **Places.** Type `Italy`, `it`, `EU` in place fields → accepted. Type `Atlantis` → red "Not a
   known country or region, left out". Home country works the same.
6. **Stale badges.** Save preferences, then change and save the master profile → *Stale* on
   Preferences. Save preferences again → badge gone; *Stale* now on Fingerprint (its source
   changed). **Render from preferences** + Save → gone.
7. **Fingerprint.** Hand-edit (counter shows n/300, max 300), Save. Template format:
   `fields | skills | Ny | industries | levels`, unset parts dropped.
8. **Applications tab.** Same form-profile card that was in Settings → Apply (which is gone).
   Fill from my profile and edits still work.
9. **Settings → Extension.** The fingerprint section is now a pointer to the Profile page.
10. **Workspace profiles.** Switch profile → its own preferences/fingerprint (or empty states).

## 2. Extension (overlay, side panel, popup)

Load the rebuilt `dist-ext` (or use the `playwright-quiver-ext` MCP server, which loads it).
1. Save a fingerprint on the Profile page with the app open **as the extension page** (the mirror
   only runs where `chrome.storage` exists).
2. `chrome.storage.local["artemis:overlayConfig"]` holds `fingerprint`, `lastFingerprintUpdate`,
   `fingerprintSource: "profile"`, `primaryEndpoint`/`secondaryEndpoint`.
3. Popup shows the fingerprint and its date. A job page's overlay quick-scores with it; a new
   fingerprint invalidates cached quick scores.
4. Switch to a workspace profile with no fingerprint → the mirrored one is removed and the
   overlay says to open the Profile page's Fingerprint tab. A fingerprint from before today (no
   `fingerprintSource`) stays until a profile fingerprint replaces it.
5. **Compare once** (spec P4 follow-up): score a handful of postings you have labelled with the
   rendered fingerprint vs the old LLM one before trusting the template.

## 3. Quiver + a local Flow

Start Flow locally (`.\scripts\up.ps1`), Quiver dev server or extension page.
1. **Connect** in Settings → Flow. With no Flow settings on this Quiver profile and a Flow never
   synced, the **Sync** block asks: *Import Flow's settings* / *Use this profile's settings*.
   - Import → backlog, daily cap, review date, pre-score, soft/hard models come from Flow; Flow's
     preferences fill the Preferences tab only if it was empty. Then the sync runs.
   - Check: `GET http://localhost:8000/api/sync` → `hash`, `profile_name`, `synced_at`.
2. **Sync line** shows "Flow holds "<profile>", synced <time>". **Start Flow** enabled after it.
3. **Auto-sync.** Change a backlog number in Settings → Flow, or save the master profile → within
   ~2 s `/api/sync` shows a new `hash`; `GET /api/settings/backlog` / `GET /api/profile` match.
4. **Control calls sync first.** Edit preferences, then immediately press Start search on the Flow
   page → Flow's log shows the `PUT /api/sync` before the search.
5. **Other profile.** Create a second workspace profile, connect it to the same Flow → "Flow holds
   the profile X… Replace it with this profile". Until you press it, Flow controls fail with a
   message pointing at Settings → Flow.
6. **Bad bundle.** A place Flow rejects (shouldn't happen with the editor; try via an old profile)
   → error naming the field; Flow's `hash` unchanged.
7. **Model choice.** *Model Flow uses* = secondary → `llm.yaml` gets the secondary endpoint; empty
   soft/hard model fields remove `soft_model`/`hard_model` from `llm.yaml`; `seed`,
   `scoring_passes`, `fallback:` survive.
8. **Company history.** Mark a job applied, then find another job from the same company: job card
   shows "Applied to X on <date>"; job detail and the Apply tab list each earlier application
   (title links to its posting). Nothing is excluded or blocked for it; two jobs from one company
   can sit in one apply queue. The side panel's *Blocked* tag has no "also block this company".
9. **Pre-score (off by default).** Turn on in Settings → Flow, threshold 60, preferences with
   fields and skills. Run scoring on a handful of jobs. Expect per job: one card call (~36 s on
   servito), a gate call, a skills call; jobs under 60 get *Pre-screened* (Flow page counter and
   list, card shows "card NN"), never a full score. `jobs.align_rows` holds `{gate, skills, rows}`.
   Changing preferences or the threshold releases pre-screened jobs back to *To score*. Turning it
   off releases them too.

## 4. Measure before switching the pre-score on for real

The card pipeline in `app/pipeline/prescore.py` is the experiment's logic with two changes (below);
it has not been compared with your labels. Re-run the label comparison on the 22 labelled jobs and
the 28-job hold-out (`scripts/eval_labels.py`, labels in `data/experiments/`) with
`align_score` from the pipeline before trusting it. Keep `prescore.enabled` off until then.

## 5. Deploying

Order: back up servito's `llm.yaml` and `jobs.db` → push Flow `feat/assisted-apply` to servito →
reload the extension (rebuilt `dist-ext`) → Settings → Flow → **Import Flow's settings** on the
first sync (otherwise servito's backlog caps and daily cap reset to Quiver's defaults).

## 6. Where the build differs from the spec

| Spec | Built | Why |
|---|---|---|
| §7: overlay reads the fingerprint from the profile record via `idbProfile.ts` | The app mirrors the saved fingerprint into `chrome.storage` (`hooks/useFingerprintMirror.ts`); `idbProfile.ts` removed | The overlay runs in job-site pages and cannot open Quiver's IndexedDB; overlay, side panel and background already read `chrome.storage`. The record stays the source. |
| §8: location tiers from home / work modes / relocation | Location row = the job's eligibility verdict (eligible 1.0, likely 0.8, sponsorship/timezone 0.5, unclear 0.6) | `eligibility.judge` already computes reach from the same preferences, generically; rebuilding tiers would duplicate it. |
| §8: job-card prompt | No ISCO field; placeholders only; fields: domain, seniority, mode, langs, edu, must | ISCO failed in the experiment; example values were copied by the model. |
| §3a: "Applied on" links to that job in Flow | Links to the job's posting URL | Flow's job detail is a dialog with no URL to link to. |
| §6: confirm before replacing | Sync stops with a prompt in Settings → Flow; control calls fail with a pointer there | No modal can be raised from inside `flowPost`. |
| §6: Flow's per-setting PUTs removed after Quiver syncs | Removed now, in the same change | The only other client (Flow's frontend) is retired. |

Also worth knowing:
- `FlowAutoSync` runs on every Quiver page, extension pages included, whenever the profile has a
  Flow URL; a Flow that is down just leaves an error in Settings → Flow.
- Regenerate/replace confirmations use `window.confirm`, as the CV builder already does.
- The first-sync import fills preferences only if the profile has none; it never overwrites.
- Pre-screened jobs stay `new` (visible, never archived by the pre-score) and are left out of the
  scoring backlog count, so they don't hold the soft cap.

## 7. Running this with Claude

Two Playwright MCP servers are configured at user scope (2026-10-26): `playwright` (your Chrome,
own profile) and `playwright-quiver-ext` (Chrome for Testing with `dist-ext` loaded; config in
`C:\Users\arthi\.cache\playwright-mcp-quiver-ext.json`). Both load in a new Claude Code session;
ask it to work through §1–§3 against a local Flow. The extension browser starts with an empty
profile: Quiver's endpoints and a master profile have to be set up in it once.
