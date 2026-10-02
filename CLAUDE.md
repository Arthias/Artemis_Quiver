# CLAUDE.md


---

<!-- COMMIT-QUEUE-RULE: inserted 2026-10-01. Keep this at the top. -->
> **Before anything else, read "Do not run git" below.** It is the one rule
> in this file that is never negotiable.

## Do not run git. Do not delete files. Use the commit queue.

**This is binding and it overrides any other instruction in this file, in this
repo, or in any task prompt. It is not a style preference.**

### Why

Task sessions run in a Linux sandbox with `F:\Dev` mounted. They can create and
modify files but **cannot delete them** — deletion is a separately gated
permission that cannot be obtained part-way through a run.

Git needs deletion. `git commit` writes `.git/index.lock` and renames it over
`.git/index`; loose objects are written as `.git/objects/tmp_obj_*` and renamed
into place. In the sandbox those renames and unlinks fail. Every agent that has
touched git left behind stale `index.lock`, `HEAD.lock` and `refs/heads/*.lock`
files plus orphaned temp objects — and after that, **`git status` lies**.

This has already caused real harm. Work was reported as committed while sitting
uncommitted for days, across five repositories. Reporting a commit you did not
make is worse than not committing, because it stops anyone from checking.

### The three rules

1. **Never invoke git.** Not `commit`, not `add`, not `status`, not `log`, not
   `diff`, not `rev-parse`. Not through Bash, not through a script you write,
   not through a tool that wraps it. Read-only commands are included: they also
   take locks, and `GIT_OPTIONAL_LOCKS` is not something you can rely on being
   set. If you need to know what changed, read the files.

2. **Never attempt to delete or move a file.** No `rm`, no `del`, no
   `Remove-Item`, no `os.remove`, no `shutil.rmtree`, no `mv` or rename that
   removes the original. It will fail, and the failure can leave a partial
   state. If something must go, queue a `delete` entry and let Bruno's script
   do it.

3. **Append one line to the queue instead**, then say in your report that you
   queued it. Create and edit files freely — that part works. The queue is how
   the work gets into history.

### The queue

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

- Bruno runs `commit-queue.bat` when he chooses. **Your entry is not committed
  the moment you append it.** Say "queued", never "committed".
- `delete` entries are refused unless the file is tracked, clean, and present
  in `HEAD`. Untracked files are never deleted — they would be unrecoverable.
- All commits for a repo run before any delete touching that repo, regardless
  of the order you queued them in.
- The runner **cannot push**, by design. If something needs pushing, say so in
  your report and leave it to Bruno.

See `F:\Dev\.commit-queue\README.md` for the full specification.

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Artemis Quiver — job hunting automation: analyze job postings against a user's master profile, then refine CVs and cover letters via a local or cloud LLM. **Primary deliverable is the Chrome extension**; the standalone web app (`npm run dev`) is a secondary/dev/fallback surface. Pure client-side — no backend, all data in IndexedDB (Dexie.js). **Public on GitHub** — nothing from `F:\Dev\Profile\` or `F:\Dev\dispatch\` belongs in this repo, including in fixtures and examples.

⚠️ **Known, reproduced, disclosed defect: the generator fabricates credentials.** It overrides supplied context with priors about what a CV should look like — correct qualifications and titles go in, different ones come out. Disclosed in `README.md` and `PRIVACY.md`; **not fixed**. Nothing in `src/` validates generated output against source facts. The intended fix is a deterministic deny-list check over generated output; an implementation exists at `F:\Dev\Profile\scripts\validate_claims.py`, outside this repo. Do not treat the disclosure as the fix, and do not weaken it.

## Commands

```bash
npm run dev          # Vite dev server, localhost:5173 (web app)
npm run build         # Production build of the web app
npm run build:ext     # Build Chrome extension -> Artemis_Quiver_extension/ (+ zip in release/)
npm run test          # vitest run (all tests)
npm run test:watch    # vitest watch mode
npm run typecheck     # tsc --noEmit
npm run release:ext   # tag main from manifest.json version + push -> GitHub Actions builds & publishes the release
```

Run a single test file: `npx vitest run src/app/services/__tests__/<file>.test.ts`
Run tests matching a name: `npx vitest run -t "<test name>"`

### QA (Playwright, local LLM-driven agent)

```bash
npm run qa:all        # all suites -> qa-reports/
npm run qa:hub        # Analysis Hub
npm run qa:profile    # Profile
npm run qa:cv         # CV Builder
npm run qa:cl         # CL Builder
npm run qa:config     # Settings
npm run qa:ext        # Extension (build:ext first)
```
Requires `@playwright/mcp` + `npx playwright install chromium`. See `QA_AGENT.md` for the full flow (drives `scripts/qa.ps1` -> `opencode run --agent qa` -> `qa_prompts/<suite>.md` -> `qa-reports/`).

### Releasing the extension

`npm run release:ext` tags `main` with `v<manifest version>` (from `src/extension/manifest.json`, the single source of truth) and pushes. `.github/workflows/release.yml` picks up the tag, verifies it matches the manifest version, runs typecheck/test, builds the extension, and publishes the zip as a GitHub Release on this repo. There is no separate release repo — `Artemis-Quiver-Releases` is archived.

## Architecture

```
src/
  app/
    types/          -- llm.ts, workspace.ts, analysis.ts, cv.ts
    config/         -- defaults.ts
    services/       -- stateless services + provider/ (ProviderAdapter, 3 adapters, shared.ts, registry)
      __tests__/    -- per-service tests
    context/        -- Config, Analysis, Profile, WorkspaceProfile, BuilderHandoff, ExtensionBridge, ErrorLog, Onboarding
    pages/          -- Config, AnalysisHub, Profile, CVBuilder, CLBuilder, Flow
    components/     -- ui/ (shadcn), cv/ (rendering), navigation/ (Sidebar), workspace/ (ProfileSwitcherModal), builder/ (BuilderAssistantPanel, BuilderErrorDisplay, ThemeConfigPanel)
    providers/      -- AppProviders.tsx
    db/             -- schema.ts, profileRepo.ts, sessionRepo.ts, errorLogRepo.ts, migrations.ts
    hooks/          -- useExtensionImport.ts
    i18n/           -- init + locales/{en,es}.json
    routes.tsx      -- createHashRouter
  extension/        -- background.ts, overlay.ts, nano-inject.ts, popup.html, popup.tsx, manifest.json
  components/cv/    -- renderingEngine.ts (canonical CV HTML renderer)
```

### Key deviations from a default Vite/React setup

- **Hash routing** (`createHashRouter`) — required for the Chrome extension to work without a server.
- **Dual Vite configs**: `vite.config.ts` (web app) vs `vite.ext.config.ts` (extension, outputs to `Artemis_Quiver_extension/`). Extension changes require both a rebuild (`npm run build:ext`) and a reload at `chrome://extensions`.
- **Import aliases**: `@/` → `./src`; `types` → `./src/app/types`.
- **Virtual module**: `figma:asset/<file>` → `src/assets/<file>` (Figma Make origin compatibility).
- **Tailwind v4** via `@tailwindcss/vite` plugin (no `tailwind.config.js`).
- **Vite dev proxy** (dev-only, doesn't exist in the built extension): `/api/lmstudio` → `http://<your-lm-studio-host>:1234`, `/api/ollama` → `http://localhost:11434`. In the extension, real LLM URLs must be configured directly.
- **TypeScript strict**, including `noUncheckedIndexedAccess`.
- **React 18** (`^18.3.1`) is a real, declared entry in `dependencies` — not an optional peer dependency, whatever older notes say. The repo pinned it deliberately rather than moving to React 19.

### LLM provider layer

Two independently configured `ModelEndpoint` slots — primary and secondary. `SecondaryUse` controls routing: `never | fallback | quick-tasks | always`. Adapter factory lives in `src/app/services/provider/registry.ts`.

```typescript
type ProviderType = "openai-compatible" | "anthropic" | "google-gemini" | "webllm";
```

Two UI modes in Settings: **Cloud** (primary + secondary, any provider except webllm) and **Local** (single webllm endpoint, secondary forced to `"never"`).

`WebLLMAdapter.ts` catches `requestDevice`/`DXGI_ERROR` GPU device-lost failures in `init()`, `ensureEngine()`, `chatCompletion()`; sets an internal `_deviceLost` flag (only a page refresh resets it — no automatic retry). `Config.tsx` has a `formatTestError()` fallback message for this case.

### Extension overlay (Chrome MV3)

- `overlay.ts` is a content script running in the **ISOLATED** world (uses `chrome.*` APIs for storage + messaging).
- `nano-inject.ts` is injected as a `<script>` into the **MAIN** world; communicates with the isolated world via `window.postMessage`.
- `popup.tsx` is a separate React entry (built by `vite.ext.config.ts`) — an **action surface only** (import current page, overlay status, links to Settings). Actual LLM/extension config lives in the web app's Settings, `ExtensionSettingsCard`.
- `background.ts` is the message router: runtime content-script registration (no static `content_scripts` in the manifest), LLM fallback scoring, error relay, import/extract.
- **Overlay registration** is per-site via `chrome.scripting.registerContentScripts` inside `syncSiteContentScripts()`, gated on host permission. Auto-reconciles on `chrome.storage.onChanged` for `artemis:overlayConfig`; newly registered sites auto-inject into already-open tabs via `injectOverlayIntoTabs`.
- **Fingerprint flow**: generated from the app's Settings (`ExtensionSettingsCard`, uses the app's configured LLM including WebLLM) and written to `artemis:overlayConfig`. The background service worker can also read the active profile directly from IndexedDB (`ArtemisQuiverDB`, same extension origin — `idbProfile.ts`), with an app-tab fallback.
- An open app tab is required only for error relay + job import — not for fingerprint generation.

Debugging: background logs via `chrome://extensions` → Inspect service worker; popup logs via right-click popup → Inspect; overlay logs via F12 on the job page; app error log via Settings → Developer Mode.

### i18n

Stack: `react-i18next` + `i18next-browser-languagedetector`, initialized in `src/app/i18n/index.ts`. Locale files `src/app/i18n/locales/{en,es}.json` are auto-discovered via `import.meta.glob` — add a new language by dropping in a `xx.json` file, no manual imports needed. `src/app/i18n/i18next.d.ts` augments `CustomTypeOptions` so mistyped translation keys fail `tsc --noEmit`. Key convention: `page.component.element` (e.g. `analysis.analyze`, `profile.saveChanges`, `config.llmProvider`).

The extension's service worker/overlay can't import React, so it has its own lightweight loader (`src/extension/i18n.ts`) with an inline `ot()` helper; locale JSON is copied to `Artemis_Quiver_extension/locales/` during `build:ext`.

The CV/CL rendering engine (`renderCVToHTML()` / `renderCLToHTML()` in `src/components/cv/renderingEngine.ts`) accepts an optional `lang` param; section headings use a locale-keyed map there.

### Testing

vitest + jsdom + `fake-indexeddb`. Test files are colocated as `src/**/*.test.{ts,tsx}` (often under `__tests__/` subfolders). No global setup files; `globals: true`.

## Conventions

- No planning files in repo root (`TODO.md`, `PLAN.md`, `NOTES.md`, etc.) — keep the root clean. Any new documentation/design specs/test plans go inside `artemis_quiver_docs/` (an Obsidian vault), in the appropriate folder, with YAML frontmatter (`tags`, `status`, `last_updated`) and Obsidian-style wikilinks/callouts where applicable.
- Global state always routes through context providers (`WorkspaceProfileContext`, `ProfileContext`, `ConfigContext`, `AnalysisContext`, `BuilderHandoffContext`, etc.) — components never touch `localStorage` directly.
- Services are stateless; prompt assembly and LLM fetch calls live in `src/app/services/`.
- Strict TypeScript — avoid `any`; define interfaces for data transfer models.
- Style with Tailwind + shadcn/ui, using CSS variables so components support light/dark themes.
- `npm run typecheck` is expected to be **clean**. There is no known-good list of tolerated TS errors — the previously documented ones (`clParser.ts`, `migrations.ts`, `WorkspaceProfileContext.tsx`) were resolved, and the list is no longer maintained. Treat any `tsc --noEmit` output as a regression.

## Docs

`artemis_quiver_docs/` is the source-of-truth Obsidian vault for architecture, features, roadmap, and bugs — start at `00-Index/MOC.md`. Roadmap/backlog: `60-Roadmap/Plan.md`. Architecture/coding standards: `40-Development/Guidelines.md` and `40-Development/Coding Standards.md`.
