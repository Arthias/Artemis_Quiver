# Agent Context — Artemis Quiver

> `/caveman full` active. Read `README.md` + `artemis_quiver_docs/` before changes.

## TL;DR

React 18 SPA (Vite, Tailwind v4, shadcn/ui, React Router v7, Dexie.js).
No backend — all data in IndexedDB. Chrome MV3 extension optionally surfaces content.

## Commands

| Command | What |
|---------|------|
| `npm run dev` | Vite dev server (localhost:5173) |
| `npm run build` | Production build |
| `npm run build:ext` | Chrome extension → `Artemis_Quiver_extension/` (+ zip in `release/`) |
| `npm run test` | vitest (130 tests, 12 files) |
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
    context/        -- Config, Analysis, Profile, WorkspaceProfile, BuilderHandoff, ExtensionBridge, ErrorLog
    pages/          -- Config, AnalysisHub, Profile, CVBuilder, CLBuilder
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
- **Vite proxy**: `/api/lmstudio` → `http://192.168.8.171:1234`, `/api/ollama` → `http://localhost:11434`
- **TypeScript strict** with `noUncheckedIndexedAccess`
- **React 18** listed as optional peer dep (Figma Make compatibility)

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

**Phase 2 complete** — All 7 listed files now use `t()` calls. Overlay uses inline `ot()` helper (cannot import in MV3 content script).

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
