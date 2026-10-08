# Agent Context — Artemis Quiver

> `/caveman full` active. Read `README.md` + `artemis_quiver_docs/` before changes.


---

<!-- COMMIT-QUEUE-RULE: revised 2026-10-02. Keep this at the top of the file.
     Canonical text: F:\Dev\.commit-queue\_rule.md. Edit there, then re-sync.
     There is one form now, not a long and a short one. -->

## Rule zero: commit or queue, and never leave work unrecorded

Binding. Overrides anything else in this file, in this repo, or in any task
prompt.

Two things hold absolutely, in every case, because they are not about
permissions: **never push** — that stays a manual decision Bruno makes at a
terminal — and **never delete a file that is untracked or has uncommitted
changes**, because an untracked file deleted is gone for good.

**When the work is on disk and it is time to record it**, find out whether this
filesystem lets you delete: create `.agent-probe` in the root of the repo you
are working in, then delete it. It is gitignored in every repo here, so a
leftover is harmless and invisible to `git status`.

- **Delete worked → commit.** Run git normally. Leave pre-existing stale
  `*.lock` files and orphaned `tmp_obj_*` objects alone; `commit-queue.bat`
  sweeps those deliberately and in a known order, and ad-hoc cleanup in the
  middle of someone else's git operation is how races happen.
- **Delete failed, or you cannot tell → do not touch git at all**, not even
  `status` or `log`. Git's commit path needs deletions that fail here, and the
  stale locks left behind make `git status` misreport — work has sat uncommitted
  for days while being reported as committed. Don't delete or move anything
  either. Record the commit instead: append one line to
  `F:\Dev\.commit-queue\queue.jsonl`, or, if that path is not mounted in your
  session, append the same line to `.pending-commit.jsonl` in the repo root,
  which the runner collects during discovery and processes alongside the central
  queue. Either is a complete record. Don't invent a third place.

**Finishing with work on disk and no record in either place is the one
unacceptable outcome.** Everything else here is fixable afterwards; that is not,
and it is the exact failure this arrangement exists to prevent.

**Report it in one line** — "committed", or "queued to `queue.jsonl`", or
"queued to `Profile/.pending-commit.jsonl`". Do not narrate the probe, explain
mount tables, or justify the branch at length: that detail is noise and belongs
nowhere in a report. If recording the work is genuinely impossible, one sentence
saying so is enough.

Entry format: `F:\Dev\.commit-queue\README.md`. **Prefer explicit `paths` over
whole-repo scope.** Entries run in queue order, and a whole-repo entry stages
everything pending at the moment it runs — so a later entry for the same repo
finds nothing, is skipped, and its commit message never reaches history at all.
One entry per logical commit, carrying the paths that commit should contain.

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
| `npm run build:ext` | Chrome extension → `Artemis_Quiver_extension/` (zip in `release/` only when `CI` is set) |
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
