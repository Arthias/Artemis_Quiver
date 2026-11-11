# Agent Context — Artemis Quiver

<!-- COMMIT-RULE: revised 2026-10-17. Canonical text: F:\Dev\.commit-queue\_rule.md -->

## Git: commit your work, never push

- Commit your own changes with git as normal. Stage explicit paths, not `git add -A`:
  other sessions' work may be pending in the same repo.
- **Never push.** **Never delete a file that is untracked or has uncommitted changes.**
- If git fails on a stale lock (`index.lock`, `HEAD.lock`, `objects/maintenance.lock`,
  `tmp_obj_*`, left behind by a sandbox that can't delete files):
  - **On Windows** (PowerShell, `F:\Dev` local): run
    `pwsh -NoProfile -File F:\Dev\.commit-queue\run-queue.ps1 -SweepOnly -Apply`.
    It removes only locks older than 5 minutes and orphaned temp objects. Then retry
    the git command once. Never delete a lock by hand.
  - **On a Linux sandbox, or if the sweep or the retry fails:** stop. Don't retry and
    don't clean up the locks. Append one line to `F:\Dev\.commit-queue\queue.jsonl`
    — or to `.pending-commit.jsonl` in the repo root if `F:\Dev` isn't mounted — and
    Bruno commits it and runs the sweep:

    `{"ts":"2026-10-14T09:00:00Z","source":"session:<id>","repo":"F:\\Dev\\<Repo>","action":"commit","paths":["docs/a.md"],"message":"..."}`

    All six fields are required. `repo` is an absolute Windows path; it is JSON, so
    each backslash is written `\\`.
- Report in one line: "committed", "swept and committed", or "queued".

---

## Project

Artemis Quiver — job hunting automation: analyze job postings against a user's master profile, then refine CVs and cover letters via a local or cloud LLM. **Primary deliverable is the Chrome extension**; the standalone web app (`npm run dev`) is a secondary/dev/fallback surface. Pure client-side — no backend, all data in IndexedDB (Dexie.js). **Public on GitHub** — nothing from `F:\Dev\Profile\` or `F:\Dev\dispatch\` belongs in this repo, including in fixtures and examples.

⚠️ **Known, reproduced, disclosed defect: the generator fabricates credentials.** It overrides supplied context with priors about what a CV should look like — correct qualifications and titles go in, different ones come out. Disclosed in `README.md` and `PRIVACY.md`; **not fixed**. Nothing in `src/` validates generated output against source facts. Quiver is for any user, so the fix must be too: prompt changes, plus an optional flag comparing generated titles, qualifications, employers and dates against **the user's own profile** (anything not in the source is flagged, never blocked). See `artemis_quiver_docs/20-APIs/Fabrication Surface Analysis.md`. **Never validate against one person's data:** `F:\Dev\Profile\scripts\validate_claims.py` is Bruno's personal deny-list for his own CVs and does not belong in Quiver or its workflow. Don't run validation passes over Quiver output as part of normal work. Do not weaken the README/PRIVACY disclosure.

## Commands

```bash
npm run dev          # Vite dev server, localhost:5173 (web app)
npm run build         # Production build of the web app
npm run build:ext     # Build Chrome extension -> Artemis_Quiver_extension/ (zip in release/ only when CI is set)
npm run test          # vitest run (all tests)
npm run test:watch    # vitest watch mode
npm run typecheck     # tsc --noEmit
npm run release:ext   # Bruno only: tags + pushes. Agents never run it
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

**Bruno runs this by hand; agents never do (it pushes).** `npm run release:ext` tags `main` with `v<manifest version>` (from `src/extension/manifest.json`, the single source of truth) and pushes. `.github/workflows/release.yml` picks up the tag, verifies it matches the manifest version, runs typecheck/test, builds the extension, and publishes the zip as a GitHub Release on this repo. There is no separate release repo — `Artemis-Quiver-Releases` is archived.

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

**Every app LLM call goes through `runLlm(task, messages, settings)`** in `src/app/services/llmService.ts`. The caller names its `LlmTask` (`types/llm.ts`); `endpointFor` picks the model from the settings, and `runLlm` applies redaction, the task's timeout, error logging and fallback. Services take the `LlmConfig`, never a pre-picked endpoint. A new kind of call adds a task to `LlmTask` and to `TASKS` in `llmService.ts`. Calls that expect JSON use `runLlmJson(task, messages, settings, parse)` (`services/llmJson.ts`): it turns on the provider's JSON mode (OpenAI-compatible `response_format`, Gemini `responseMimeType`; retried without it if the server rejects it) and repairs a reply that fails `parse` by showing the model its reply and the error. Exceptions: `extension/background.ts` calls its adapters directly (its own redaction), and Flow makes its own calls with the endpoint Quiver sends it.

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

**Rule: the UI is localized — no hard-coded user-visible text.** Every string a user
sees (app, side panel, popup, toasts, errors shown in the UI) goes through `t()`, and every
new key is added to **both** `en.json` and `es.json` in the same change, with a real Spanish
translation. Extension keys (side panel, popup, background) are *not* type-checked — a
missing key renders as the raw key (`sidepanel.cv.title`); `src/extension/__tests__/i18nKeys.test.ts`
catches that and en/es drift, so run the tests. The overlay content script is the one
exception: it keeps its own inline `ot()` map.

Stack: `react-i18next` + `i18next-browser-languagedetector`, initialized in `src/app/i18n/index.ts`. Locale files `src/app/i18n/locales/{en,es}.json` are auto-discovered via `import.meta.glob` — add a new language by dropping in a `xx.json` file, no manual imports needed. `src/app/i18n/i18next.d.ts` augments `CustomTypeOptions` so mistyped translation keys fail `tsc --noEmit`. Key convention: `page.component.element` (e.g. `analysis.analyze`, `profile.saveChanges`, `config.llmProvider`).

The extension can't import the React i18n stack, so the side panel, popup and service worker use a lightweight loader (`src/extension/i18n.ts`) that fetches the locale JSON copied to `Artemis_Quiver_extension/locales/` during `build:ext` — uncached, falling back to English for an unsupported browser language. The overlay content script uses its own inline `ot()` map.

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

## Common pitfalls

- **CORS**: local LLM servers lack CORS. Use the Vite proxy paths or enable CORS.
- **IndexedDB wipe**: clearing browser data destroys profiles; they are re-created from defaults.
- **LLM timeout**: 120s generation, 30s test connection. Override via `timeoutMs`.
- **Extension**: rebuild (`npm run build:ext`) and reload at `chrome://extensions` after every change.

## Docs

`artemis_quiver_docs/` is the source-of-truth Obsidian vault for architecture, features, roadmap, and bugs — start at `00-Index/MOC.md`. Roadmap/backlog: `60-Roadmap/Plan.md`. Architecture/coding standards: `40-Development/Guidelines.md` and `40-Development/Coding Standards.md`.
