# Agent Context — Artemis Quiver

> **Caveman mode active.** This repo uses `/caveman full` for all agent interactions. Filler/pleasantries/hedging stripped. Fragments OK. Technical terms exact. See "Caveman Persistence" at bottom for rules.



> Handoff doc. Read `README.md` + `artemis_quiver_docs/` before changes.

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
| `npm run test:watch` | vitest watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run qa` | Interactive QA (dev + MCP, no auto-run) |
| `npm run qa:all` | Full auto-QA: run all suites → `qa-reports/` |
| `npm run qa:hub` | QA: Analysis Hub only |
| `npm run qa:cv` | QA: CV Builder only |
| `npm run qa:ext` | QA with extension loaded (`dist-ext/`) |
| `npm run qa:headless` | Full auto-QA headless |
| `opencode.json` | MCP server config for `@playwright/mcp` |

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

## Key Deviations from Defaults

- **Hash routing** (`createHashRouter`) — required by Chrome extension pathname compatibility
- **Dual Vite configs**: `vite.config.ts` (app) + `vite.ext.config.ts` (extension build → `dist-ext/`)
- **Import aliases**: `@/` → `./src`, `types` → `./src/app/types`
- **Virtual module**: `figma:asset/<file>` resolved to `src/assets/<file>`
- **Tailwind v4** via `@tailwindcss/vite` plugin (not PostCSS config)
- **Vite proxy** for local LLMs (CORS workaround): `/api/lmstudio` → `http://192.168.8.171:1234`, `/api/ollama` → `http://localhost:11434`
- **TypeScript strict** with `noUncheckedIndexedAccess` — all array/dict accesses need guards
- **Peer deps**: React 18 listed as optional peer (Figma Make compatibility)

## LLM Provider Layer

Two independently configured `ModelEndpoint` slots (primary + secondary). `SecondaryUse` controls routing: `never | fallback | quick-tasks | always`. Adapter factory in `src/app/services/provider/registry.ts`.

Two UI modes: **Cloud** (primary + secondary, any provider except webllm) and **Local** (single webllm endpoint, secondary forced to "never"). Switching modes snapshots cloud settings in `savedCloudEndpoints` for round-trip preservation.

```typescript
type ProviderType = "openai-compatible" | "anthropic" | "google-gemini" | "webllm";
```

### WebLLM GPU Device-Lost Handling

WebLLM (`WebLLMAdapter.ts`) can crash the GPU adapter (DXGI_ERROR_DEVICE_REMOVED) when the model exceeds VRAM. The adapter:
- Catches `requestDevice` / `DXGI_ERROR` failures in `init()`, `ensureEngine()`, and `chatCompletion()`
- Sets an in-memory `_deviceLost` flag (lost on page refresh) that short-circuits all subsequent calls with a friendly message
- Does NOT retry device-lost errors (was making it worse)
- Still retries transient "model not loaded" errors once

Config.tsx has a fallback `formatTestError()` helper that catches any raw DXGI/device-lost errors that slip through the adapter and replaces them with: `"WebGPU device crashed. Close other GPU-heavy tabs, restart Chrome, and try a smaller model."`

Known issue: "Object has already been disposed" errors appear after device loss — the WebLLM engine's GPU context is destroyed and the JS engine object is dead. `_deviceLost` flag catches this on subsequent calls, but if the page is refreshed, the flag resets and the engine is gone. User must re-download the model or use a smaller one.

## Testing

- vitest + jsdom + `fake-indexeddb`
- Test files colocated: `src/**/*.test.{ts,tsx}`
- No setup files; globals enabled

## QA Workflow (Playwright MCP)

After a dev cycle, run automated UI/UX QA via Playwright MCP:

```
npm run qa:all          # Run all suites, reports go to qa-reports/
npm run qa:hub          # Analysis Hub only
npm run qa:cv           # CV Builder only  
npm run qa:headless     # Full run, no browser window
```

**How it works:**

1. `scripts/qa.ps1` starts Vite dev server + Playwright MCP (SSE on port 3099)
2. Feeds the prompt from `qa_prompts/<suite>.md` to `opencode run --agent qa`
3. The `qa` agent (`.opencode/agents/qa.md`) uses `ollama/qwen2.5-coder:7b` by default
4. The agent uses Playwright MCP browser tools (navigate, snapshot, click, eval)
5. Results saved to `qa-reports/qa-report-<timestamp>.md`

**Override model** (e.g. for a different local model):
```
npm run qa:hub -- --Model ollama/qwen2.5-coder:1.5b
```

**Bugs found during QA** → file in `artemis_quiver_docs/30-Bugs-and-Fixes/`

## Common Pitfalls

- **CORS**: Local LLM servers lack CORS headers. Use Vite proxy paths or enable CORS in server settings
- **IndexedDB wipe**: Clearing browser data destroys all profiles. Re-created from defaults on next load
- **Extension**: Always uses hash routing. Load `dist-ext/` in `chrome://extensions` after `npm run build:ext`
- **LLM timeout**: 120s generation, 30s test connection. Override per-call via `timeoutMs`
- **Pre-existing TS errors**: `clParser.ts` (undefined checks), `migrations.ts` (`ThemeMode` assertion), `WorkspaceProfileContext.tsx` (possibly undefined vars) — known, not fixed

## Extension Overlay

- **Content script** (`overlay.ts`) runs in `"world": "ISOLATED"` (default) — `chrome.*` APIs needed for storage + messaging
- **Gemini Nano** access via `nano-inject.ts` — injected as `<script>` tag into MAIN world, communicates via `window.postMessage`
- **Config popup** (`popup.tsx`) — separate React entry built alongside app by `vite.ext.config.ts`
- **Background** (`background.ts`) — message router: fingerprint gen, LLM fallback scoring, error relay
- **Fingerprint** generation flow:
  1. Popup → `ARTEMIS_GENERATE_FINGERPRINT` → background
  2. Background → `ARTEMIS_REQUEST_PROFILE` → app tab
  3. App (`ExtensionBridgeContext.respondWithProfile`) returns `{profileMarkdown, primaryEndpoint, secondaryEndpoint}`
  4. Background calls `callRemoteLLM` with endpoint from app (real URL, not Vite proxy path)
  5. Fingerprint stored in `chrome.storage.local` alongside endpoint config for later LLM calls
- **Fallback modes**: basic (no AI), secondary (follows app's `SecondaryUse` routing), primary (always primary endpoint)
- **Job sites** configurable from both extension popup and main app Settings page
- **Pending imports** flow through `ExtensionBridgeContext` — sidebar shows them above "Recent Analyses"

### Extension Debugging

| What | Where |
|------|-------|
| Background logs | `chrome://extensions` → Inspect views "service worker" |
| Popup logs | Right-click popup → Inspect → Console |
| Overlay logs | F12 on the job page → Console |
| App error log | Settings → Developer Mode (togglable, persists to IndexedDB) |

### Overlay Quick-Start Checklist

If the overlay shows as a non-interactive rectangle:
1. **Click it** — the collapsed header now expands (was broken: `setupToggle` blocked clicks on `[data-drag]`)
2. **Look for status** — badge shows `?` (no fingerprint), `...` (analyzing), or score (ready)
3. **No fingerprint?** Open extension popup → "Generate fingerprint" (requires app tab open with a profile)
4. **No score after fingerprint?** Change `fallbackMode` from "basic" to "secondary"/"primary" in popup
5. **Check console** — overlay logs `[Artemis] Overlay init`, config, match state on F12

### Overlay State Reference

| Badge | Label | Meaning |
|-------|-------|---------|
| `?` gray | Not Configured | No profile fingerprint — open popup to generate one |
| `...` gray | Analyzing... | Fingerprint exists, scoring in progress |
| `85%` green | Match Score | Score ≥70 |
| `55%` yellow | Match Score | Score 40-69 |
| `20%` red | Match Score | Score <40 |
| ✕ close | — | Dismisses overlay (re-appears on page reload) |

### Error Log System

- `errorLogRepo.ts` — IndexedDB table `errorLogs` (auto-evicts at 500 entries)
- `ErrorLogContext.tsx` — captures `window.onerror`, `unhandledrejection`, extension relay messages
- **Extension relay**: overlay + popup monkey-patch `console.error` → `ARTEMIS_LOG_ERROR` → background → app tab → IndexedDB
- **Background relay**: `relayErrorToApp()` forwards errors from background handlers to app tab
- **Real-time updates**: `addErrorLog` fires listeners → `ErrorLogContext` reloads logs → UI updates

### Known Extension Quirks

- **App tab must be open** for fingerprint gen and error relay (background talks to app via `chrome.tabs.sendMessage`)
- **Vite proxy paths** (`/api/lmstudio`, `/api/ollama`) don't exist in extension context. `fixExtensionBaseUrl()` translates them to real IPs. But better to set real URLs in Settings — `fixLegacyEndpoint` only rewrites if the label has legacy suffix (`(LMStudio)`/`(Ollama)`).
- **Reasoning models** (gemma-4-e2b) put output in `reasoning_content` instead of `content`. `callRemoteLLM` falls back to `reasoning_content?.trim()`.
- **Rebuild always**: `npm run build:ext && chrome://extensions → reload` after any change to extension files.
- **Build includes app**: `vite.ext.config.ts` builds everything (app + extension). The `dist-ext/` folder has both `index.html` (app) and extension files.
- **popup.html path**: built to `dist-ext/src/extension/popup.html`, copied to `dist-ext/popup.html` by `extensionAssets` plugin.
- **`nano-inject.js`** declared in `web_accessible_resources` with `"matches": ["<all_urls>"]`.
- **Host permissions** in manifest: `http://192.168.8.171:1234/*`, `http://localhost:11434/*` — needed for background `fetch()` to local LLMs.

## Docs to Reference

- `artemis_quiver_docs/` — Obsidian vault, source of truth for specs, bugs, roadmap
- `artemis_quiver_docs/30-Bugs-and-Fixes/_Index.md` — check before fixing bugs
- `artemis_quiver_docs/60-Roadmap/Plan.md` — sprint backlog (Sprint 9 WebLLM, 9a cleanup, 10 Kanban)
- `artemis_quiver_docs/40-Development/Coding Standards.md` — code conventions

## Conventions (.cursorrules)

- No planning markdown files in root (`TODO.md`, `PLAN.md`, `NOTES.md`)
- Context providers own global state; components never access localStorage directly
- Services are stateless; prompts + LLM fetch in `src/app/services/`
- Strict TypeScript (no `any`)

## Caveman Persistence

`/caveman full` active every response. No revert after many turns. No filler drift. Rules:
- Drop articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact.
- Drop caveman for: security warnings, irreversible actions, multi-step where order ambiguous
- Pattern: `[thing] [action] [reason]. [next step].`
