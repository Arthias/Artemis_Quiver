# Agent Context — Artemis Quiver

> `/caveman full` active. Read `README.md` + `artemis_quiver_docs/` before changes.


---

<!-- COMMIT-QUEUE-RULE: inserted 2026-10-01, revised 2026-10-02. Keep this at the top. -->
> **Before anything else, read "Probe first, then commit or queue" below.** It is
> the one rule in this file that is never negotiable.

## Probe first, then commit or queue

**This is binding and it overrides any other instruction in this file, in this
repo, or in any task prompt. It is not a style preference.**

### Step one: run the capability probe

Before you touch git, and before you decide how your work reaches history, run
the probe. It writes a scratch file beside the queue and tries to delete it:

```bash
sh /path/to/Dev/.commit-queue/capability-probe.sh    # prints FULL or RESTRICTED
```

```powershell
F:\Dev\.commit-queue\capability-probe.ps1            # prints FULL or RESTRICTED
```

Inline, if you would rather not shell out to a file — POSIX:

```bash
P="/path/to/Dev/.commit-queue/.probe"
: > "$P" 2>/dev/null || { echo RESTRICTED; exit 1; }
rm -f "$P" 2>/dev/null; [ -e "$P" ] && echo RESTRICTED || echo FULL
```

PowerShell:

```powershell
$P = 'F:\Dev\.commit-queue\.probe'
try { Set-Content -LiteralPath $P -Value '' -ErrorAction Stop } catch { 'RESTRICTED'; exit 1 }
Remove-Item -LiteralPath $P -Force -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $P) { 'RESTRICTED' } else { 'FULL' }
```

Do **not** try to work out which product or harness you are instead. Agents
cannot introspect that reliably and the answer drifts as tooling changes. What
actually matters is whether this filesystem lets you delete, so test that
directly.

Two things about the probe that are deliberate and must not be changed:

- The target is `.commit-queue/.probe`, not anything under `.git`. Never probe
  by trying to remove a real lock file. `F:\Dev` is not itself a repo, so a
  leftover `.probe` dirties no `git status`, and the name is fixed so there is
  never more than one.
- It must be run from a path on the same filesystem as the repos. `/tmp` inside
  a sandbox **is** deletable, so probing `/tmp` returns FULL and is wrong.

**If the probe does not run, errors, or you cannot tell what it returned, you
are RESTRICTED.** Fail closed, never open.

### Step two, branch A — probe returned FULL

Deletion works, so git works. You may run git normally in this repo: `status`,
`diff`, `add`, `commit`. Commit your own work rather than queuing it; the queue
exists to work around a restriction you do not have.

Do not clean up stale `*.lock` files or orphaned `tmp_obj_*` / `tmp_pack_*`
objects left behind by earlier sandbox runs, even though you now could.
`commit-queue.bat` sweeps them deliberately, in a known order, before it does
anything else. Ad-hoc cleanup in the middle of somebody else's git operation is
exactly how a race gets created. Leave them; mention them in your report if you
want.

### Step two, branch B — probe returned RESTRICTED

You are in the sandbox. Git's commit path depends on deletion — `git commit`
writes `.git/index.lock` and renames it over `.git/index`; loose objects are
written as `.git/objects/tmp_obj_*` and renamed into place — and those renames
and unlinks fail here. Every agent that has run git in this state left stale
`index.lock`, `HEAD.lock` and `refs/heads/*.lock` files plus orphaned temp
objects, after which **`git status` lies**.

That has already caused real harm: work reported as committed while sitting
uncommitted for days, across five repositories. Reporting a commit you did not
make is worse than not committing, because it stops anyone from checking.

So, in this branch:

1. **Never invoke git.** Not `commit`, not `add`, not `status`, not `log`, not
   `diff`, not `rev-parse`. Not through Bash, not through a script you write,
   not through a tool that wraps it. Read-only commands are included: they also
   take locks, and `GIT_OPTIONAL_LOCKS` is not something you can rely on being
   set. If you need to know what changed, read the files.

2. **Never attempt to delete or move a file.** No `rm`, no `del`, no
   `Remove-Item`, no `os.remove`, no `shutil.rmtree`, no `mv` or rename that
   removes the original. It will fail, and the failure can leave a partial
   state. If something must go, queue a `delete` entry.

3. **Append one line to the queue instead**, then say in your report that you
   queued it. Create and edit files freely — that part works.

### Both branches, without exception

- **Never push.** Not in either branch. Pushing is a manual decision Bruno
  makes at a terminal, and having full filesystem access changes nothing about
  that. The queue runner cannot push by design; a native agent must not either.
  If something needs pushing, say so in your report and stop.
- **Never delete a file that is untracked, or that has uncommitted changes.**
  This is about recoverability, not permissions, so it survives the probe in
  both branches. An untracked file you delete is gone for good. A file with
  uncommitted changes loses those changes. History must be able to give it back
  before you remove it.
- **Say in your report which branch you took and why.** One line: the probe
  returned FULL and you committed, or it returned RESTRICTED and you queued.
  Never let a reader guess whether the work is in history. The original harm
  here was work reported as committed when it was not, and that is only
  prevented by saying plainly which path you were on.

### The queue (branch B)

`F:\Dev\.commit-queue\queue.jsonl` — JSONL, one JSON object per line, **append
only**. Never rewrite it, never reorder it, never read-modify-write it. Another
session may be appending at the same time.

```json
{"ts":"2026-10-01T16:42:03Z","source":"session:abc123","repo":"F:/Dev/Profile","action":"commit","message":"Add round 3 interview prep","paths":["interviews/nearform-technical-lead/20-round-3.md"]}
```

| Field | Required | Meaning |
|---|---|---|
| `ts` | yes | ISO 8601 UTC, e.g. `2026-10-01T16:42:03Z`. |
| `source` | yes | Who queued it: `session:<id>` or a task name. Entries must be traceable. |
| `repo` | yes | Absolute path to the repo root. Forward slashes are easiest: `F:/Dev/Profile`. Backslashes must be doubled in JSON. |
| `action` | yes | `commit` or `delete`. Nothing else is accepted. |
| `message` | yes | Commit message. Punctuation, quotes and newlines are fine — JSON escapes them. |
| `paths` | see note | Repo-relative, forward slashes. Omit on `commit` to mean "everything changed in this repo". **Required on `delete`.** |

Six fields. That is the whole format.

To append, in Bash:

```bash
printf '%s\n' '{"ts":"...","source":"...","repo":"...","action":"commit","message":"...","paths":["..."]}' \
  >> /mnt/path/to/Dev/.commit-queue/queue.jsonl
```

Build the line with a JSON serialiser (`json.dumps`, `ConvertTo-Json -Compress`)
rather than by hand. A line that is not valid JSON is rejected, and your work
sits unqueued.

### What you can rely on

- Bruno runs `commit-queue.bat` when he chooses. **A queued entry is not
  committed the moment you append it.** Say "queued", never "committed".
- `delete` entries are refused unless the file is tracked, clean, and present
  in `HEAD`. Untracked files are never deleted — they would be unrecoverable.
- All commits for a repo run before any delete touching that repo, regardless
  of the order you queued them in.
- The runner **cannot push**, by design.

See `F:\Dev\.commit-queue\README.md` for the full specification.

---

## TL;DR

React 18 SPA (Vite 6, Tailwind v4, shadcn/ui, React Router v7, Dexie.js).
No backend — all data in IndexedDB.

**The Chrome MV3 extension is the primary deliverable**; the standalone web app
(`npm run dev`) is the secondary/dev/fallback surface. An older line here called the
extension optional — it isn't, and `README.md` and `CLAUDE.md` both say so.

**Public on GitHub.** Nothing from `F:\Dev\Profile\` or `F:\Dev\dispatch\` goes in
this repo, in any form, including in examples and test fixtures.

⚠️ **Known defect, disclosed in `README.md` and `PRIVACY.md`:** the generator
overrides supplied context with priors about what a CV should look like —
qualifications and titles come out different from the ones that went in. There is no
validation of generated output against source facts anywhere in `src/`. A
deny-list validator exists, but it lives at `F:\Dev\Profile\scripts\validate_claims.py`,
outside this repo. Do not close this as fixed on the strength of the disclosure; the
disclosure is a warning, not a fix.

## Commands

| Command | What |
|---------|------|
| `npm run dev` | Vite dev server (localhost:5173) |
| `npm run build` | Production build |
| `npm run build:ext` | Chrome extension → `Artemis_Quiver_extension/` (+ zip in `release/`) |
| `npm run test` | vitest — 144 tests across 12 files (counted 2026-09-25; `npm run test` is the authority, not this number) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run qa:all` | Full auto-QA → `qa-reports/` |

## Architecture

```
src/
  app/
    types/          -- llm.ts, workspace.ts, analysis.ts, cv.ts
    config/         -- defaults.ts
    services/       -- services + provider/ (ProviderAdapter, 3 adapters, shared.ts, registry)
      __tests__/    -- per-service tests
    context/        -- Config, Analysis, Profile, WorkspaceProfile, BuilderHandoff, ExtensionBridge, ErrorLog, Onboarding
    pages/          -- Config, AnalysisHub, Profile, CVBuilder, CLBuilder, Flow
    components/     -- ui/ (shadcn), cv/ (rendering), navigation/ (Sidebar), workspace/ (ProfileSwitcherModal), builder/ (BuilderAssistantPanel, BuilderErrorDisplay, ThemeConfigPanel)
    providers/      -- AppProviders.tsx
    db/             -- schema.ts, profileRepo.ts, sessionRepo.ts, errorLogRepo.ts, migrations.ts
    hooks/          -- useExtensionImport.ts
    routes.tsx      -- createHashRouter
  extension/        -- background.ts, overlay.ts, nano-inject.ts, popup.html, popup.tsx, manifest.json
  components/cv/    -- renderingEngine.ts (canonical CV HTML renderer)
```

## Key Deviations

- **Hash routing** (`createHashRouter`) — required by Chrome extension
- **Dual Vite configs**: `vite.config.ts` (app) + `vite.ext.config.ts` (extension → `Artemis_Quiver_extension/`)
- **Import aliases**: `@/` → `./src`
- **Virtual module**: `figma:asset/<file>` → `src/assets/<file>`
- **Tailwind v4** via `@tailwindcss/vite` plugin
- **Vite proxy**: `/api/lmstudio` → `http://<your-lm-studio-host>:1234`, `/api/ollama` → `http://localhost:11434`
- **TypeScript strict** with `noUncheckedIndexedAccess`
- **React 18** (`^18.3.1`) is a real entry in `dependencies`, not an optional peer dep — deliberately pinned rather than moving to React 19

## LLM Provider Layer

Two independently configured `ModelEndpoint` slots (primary + secondary). `SecondaryUse` controls routing: `never | fallback | quick-tasks | always`. Adapter factory in `src/app/services/provider/registry.ts`.

```typescript
type ProviderType = "openai-compatible" | "anthropic" | "google-gemini" | "webllm";
```

Two UI modes: **Cloud** (primary + secondary, any provider except webllm) and **Local** (single webllm endpoint, secondary forced to "never").

### WebLLM GPU Device-Lost
`WebLLMAdapter.ts` catches `requestDevice` / `DXGI_ERROR` failures in `init()`, `ensureEngine()`, `chatCompletion()`. Sets `_deviceLost` flag (page refresh resets). No retry on device loss. Config.tsx has `formatTestError()` fallback: `"WebGPU device crashed. Close other GPU-heavy tabs, restart Chrome, try smaller model."`

## Testing

- vitest + jsdom + `fake-indexeddb`
- Test files colocated: `src/**/*.test.{ts,tsx}`
- No setup files; globals enabled

## i18n (Internationalization)

**Stack**: `react-i18next` + `i18next-browser-languagedetector`. Init in `src/app/i18n/index.ts`.

**Locale files**: `src/app/i18n/locales/{en,es}.json` auto-discovered via `import.meta.glob`. Add new language → drop a `xx.json` file, no manual imports.

**Type safety**: `src/app/i18n/i18next.d.ts` augments `react-i18next` `CustomTypeOptions`. Mistyped keys fail at `tsc --noEmit`.

**Key convention**: `page.component.element` — e.g., `analysis.analyze`, `profile.saveChanges`, `config.llmProvider`.

**Extension**: Lightweight `src/extension/i18n.ts` loader for service worker/overlay (no React). Locale JSON copied to `Artemis_Quiver_extension/locales/` during `build:ext`.

**Rendering Engine**: `renderCVToHTML()` / `renderCLToHTML()` accept optional `lang` param. Section headings use locale-keyed map in `renderingEngine.ts`.

The overlay uses the inline `ot()` helper because an MV3 content script cannot import the React i18n stack. For what is and isn't translated, read the locale files and grep for `t(` — don't rely on a phase label here.

## Common Pitfalls

- **CORS**: Local LLM servers lack CORS. Use Vite proxy paths or enable CORS
- **IndexedDB wipe**: Clearing browser data destroys profiles. Re-created from defaults on next load
- **Extension**: Always hash routing. Reload at `chrome://extensions` after rebuild
- **LLM timeout**: 120s generation, 30s test connection. Override via `timeoutMs`
- **TS errors**: none tolerated. `npm run typecheck` must be clean; treat any output as a regression. (The old "pre-existing errors" list — `clParser.ts`, `migrations.ts`, `WorkspaceProfileContext.tsx` — was resolved and removed.)

## Extension Overlay

- Content script (`overlay.ts`) runs in ISOLATED world. `chrome.*` APIs for storage + messaging.
- `nano-inject.ts` injected as `<script>` into MAIN world, `window.postMessage` communication.
- Popup (`popup.tsx`) — separate React entry, built by `vite.ext.config.ts`. It's an **action surface** (import current page, overlay status, links to Settings) — config lives in the app's Settings `ExtensionSettingsCard`.
- Background (`background.ts`) — message router: **runtime content-script registration** (no static `content_scripts` in manifest), LLM fallback scoring, error relay, import/extract.
- **Overlay registration**: per-site via `chrome.scripting.registerContentScripts` in `syncSiteContentScripts()`, gated on host permission. Auto-reconciles on `chrome.storage.onChanged` for `artemis:overlayConfig`; newly registered sites auto-inject into already-open tabs (`injectOverlayIntoTabs`).
- **Fingerprint flow**: generated from the **app Settings** (`ExtensionSettingsCard`, uses the app's configured LLM incl. WebLLM) and written to `artemis:overlayConfig`. The background can also read the active profile **directly from IndexedDB** (`ArtemisQuiverDB`, same extension origin — see `idbProfile.ts`) with an app-tab fallback.
- **App tab required only for** error relay + job import (not fingerprint gen).
- **Rebuild always**: `npm run build:ext && chrome://extensions → reload` after extension changes.

### Debugging

| What | Where |
|------|-------|
| Background logs | `chrome://extensions` → Inspect service worker |
| Popup logs | Right-click popup → Inspect |
| Overlay logs | F12 on job page |
| App error log | Settings → Developer Mode |

## Conventions

- No root planning files (`TODO.md`, `PLAN.md`, `NOTES.md`)
- Context providers own global state; components never access localStorage
- Services stateless; prompts + LLM fetch in `src/app/services/`
- Strict TypeScript (no `any`)
