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
| `npm run build:ext` | Chrome extension → `dist-ext/` |
| `npm run test` | vitest (102 tests, 11 files) |
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
- **Dual Vite configs**: `vite.config.ts` (app) + `vite.ext.config.ts` (extension → `dist-ext/`)
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

## Common Pitfalls

- **CORS**: Local LLM servers lack CORS. Use Vite proxy paths or enable CORS
- **IndexedDB wipe**: Clearing browser data destroys profiles. Re-created from defaults on next load
- **Extension**: Always hash routing. Reload at `chrome://extensions` after rebuild
- **LLM timeout**: 120s generation, 30s test connection. Override via `timeoutMs`
- **Pre-existing TS errors**: `clParser.ts` (undefined checks), `migrations.ts` (`ThemeMode` assertion), `WorkspaceProfileContext.tsx` (possibly undefined vars) — known

## Extension Overlay

- Content script (`overlay.ts`) runs in ISOLATED world. `chrome.*` APIs for storage + messaging.
- `nano-inject.ts` injected as `<script>` into MAIN world, `window.postMessage` communication.
- Popup (`popup.tsx`) — separate React entry, built by `vite.ext.config.ts`.
- Background (`background.ts`) — message router: fingerprint gen, LLM fallback scoring, error relay.
- **Fingerprint flow**: Popup → `ARTEMIS_GENERATE_FINGERPRINT` → background → `ARTEMIS_REQUEST_PROFILE` → app tab returns `{profileMarkdown, primaryEndpoint, secondaryEndpoint}` → background calls remote LLM → stored in `chrome.storage.local`.
- **App tab must be open** for fingerprint gen + error relay.
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
