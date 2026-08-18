---
tags: [integration, flow, cross-app, implementation]
status: ready for implementation — verified against current code 2026-08-18
last_updated: 2026-08-18
---

# Flow Integration — Quiver-Side Implementation Plan

> Written for a fresh coding-agent session with no prior context. Read `90-Meta/Flow-Integration.md` first for the *why* (decisions, rationale, superseded designs) — this doc is the *what/where/how*, verified against the actual current codebase on 2026-08-18. Flow-side counterpart: `F:\Dev\Artemis_Flow\artemis_flow_docs\60-Roadmap\Phase-6-Implementation-Plan.md` — read it too, since several items here (send profile, send config) call endpoints documented as already-existing there.
>
> Joint/cross-app context: `F:\Dev\BrainVault\+\2026-08-17-Quiver-Flow-Integration-Strategy.md`.

## How to use this doc

Each section names the exact files involved (verified by reading them, not guessed), what already exists that should be reused rather than rebuilt, and what's net-new. Quiver's codebase is React 18 + Vite + Tailwind v4 + shadcn/ui, Dexie (IndexedDB) for storage, `react-router` with `createHashRouter`. Nothing here requires a schema version bump unless explicitly noted.

---

## Relevant existing code (verified 2026-08-18)

| Piece | File | Shape |
|---|---|---|
| Per-profile settings | `src/app/types/workspace.ts` — `ProfileSettings extends LlmConfig { theme }` | Stored as a plain object field (`settings`) inside each Dexie `ProfileRecord` (`src/app/db/schema.ts`). **Not a separately-indexed Dexie store** — adding new optional fields to `ProfileSettings`/`LlmConfig` requires zero Dexie schema/version changes, since it's just JS object shape inside an existing blob field. This matters: the natural place to store `flowBaseUrl` and Flow connection state is a new optional field on `ProfileSettings`, not a new table. |
| LLM config shape | `src/app/types/llm.ts` | `LlmConfig = { providerMode, primary: ModelEndpoint, secondary: ModelEndpoint, secondaryUse, savedCloudEndpoints?, autoSaveProfile }`. `ModelEndpoint = { label, provider, baseUrl, apiKey?, model, temperature, maxTokens? }`. This is exactly the shape to send to Flow's `PUT /api/settings/llm` (map fields: `provider`→same string space? verify — Quiver's `ProviderType` is `"openai-compatible" | "anthropic" | "google-gemini" | "webllm"`, Flow's accepts `"ollama" | "lmstudio" | "anthropic"` — **these vocabularies don't match 1:1**, see "Send Config to Flow" below for the mapping needed). |
| Config state + existing test-connection | `src/app/context/ConfigContext.tsx` | Exposes `config`, `updateConfig`, `saveConfig`, `testLlmConnection()` (tests `config.primary` via `services/llmService.ts`'s `testConnection`), `isTesting`. This is Quiver's own existing "test from Quiver" mechanism for its own endpoints — the new dual-vantage-point feature adds a parallel "test from Flow" call, it does not need to rebuild this. |
| Profile state | `src/app/context/ProfileContext.tsx` | `profile: string` (raw markdown), `saveProfile()`, auto-save on `config.autoSaveProfile` after 800ms debounce. This is exactly the markdown blob to push to Flow's `PUT /api/profile`. |
| Chat panel UI (reusable) | `src/app/components/builder/BuilderAssistantPanel.tsx` | **Already fully generic** — takes `suggestions`, `chatMessage`, `chatLoading`, `onChatMessageChange`, `onSubmit`, `accentClass?`, `panelBg?`. No CV/CL-specific logic inside the component itself. **Reuse this directly** for the Flow-tuning chat panel; do not build a new chat UI component. |
| Chat service pattern | `src/app/services/profileChatService.ts` | Pattern to copy: builds a system-prompted message list, calls `chatCompletion(messages, endpoint)` from `llmService.ts`. The Flow-tuning equivalent instead calls Flow's `/api/strategy/feedback` (a Flow backend call, not a direct LLM call) — different transport, same file-organization pattern. |
| LLM call layer | `src/app/services/llmService.ts` | `chatCompletion`, `testConnection`, `listModels`, `getActiveEndpoint`, `chatCompletionWithFallback` — all provider-adapter-based (`services/provider/*`). Not directly reused for Flow calls (Flow isn't an LLM endpoint, it's Quiver's own backend-of-sorts), but `testConnection`'s pattern (adapter-per-provider, try/catch/log via `errorLogRepo`) is worth mirroring for the new `flowBridge.ts` service for consistency. |
| Routing | `src/app/routes.tsx` | `createHashRouter`, lazy-loaded pages under `RootLayout`. Current routes: `/`, `/profile`, `/cv-builder`, `/cl-builder`, `/config`. |
| Nav | `src/app/components/navigation/Sidebar.tsx` | `navigation` is a **static module-level const array** of `{nameKey, href, icon}`, rendered unconditionally. Adding a Flow nav entry that only shows when Flow is connected requires converting this to be computed inside the component (reading Flow connection state), not just appending to the const — see "New Flow page/route" below for the recommended simpler alternative. |
| Settings mega-page | `src/app/pages/Config.tsx` | 53KB, not read in full during this research pass (too large for the scope of this doc) — existing home for LLM primary/secondary endpoint configuration. The new "Connect to Flow" one-time setup UI (host:port entry, connect, send profile, send config, dual-vantage test) belongs here as a new section/tab, consistent with where LLM config already lives. **Read this file directly before starting Item 2 below** to match its existing tab/section pattern rather than guessing at one. |
| i18n | `src/app/i18n/locales/{en,es}.json` | All UI strings must be added to both locale files — this codebase has a known-fixed bug history around locale-key gaps (see deep-review findings from earlier in this project), so don't skip the `es.json` half when adding new strings. |

---

## Item 1 — `flowBridge.ts`: connection, health check, profile/config push, test-from-Flow

New file: `src/app/services/flowBridge.ts`.

```typescript
export interface FlowStatus {
  connected: boolean;
  configured: boolean;   // both profile and LLM config have been successfully pushed
  totalJobs?: number;
  lastScrape?: string | null;
}

async function checkFlowIdentity(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const body = await res.json();
    return body.app === "artemis-flow";
  } catch {
    return false;
  }
}

export async function checkFlowHealth(baseUrl: string): Promise<FlowStatus> {
  const identified = await checkFlowIdentity(baseUrl);
  if (!identified) return { connected: false, configured: false };
  try {
    const res = await fetch(`${baseUrl}/api/settings/status`, { signal: AbortSignal.timeout(3000) });
    const status = res.ok ? await res.json() : {};
    return { connected: true, configured: false, totalJobs: status.total_jobs, lastScrape: status.last_scrape };
  } catch {
    return { connected: true, configured: false };
  }
}

export async function sendProfileToFlow(baseUrl: string, profileMarkdown: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: profileMarkdown, path: "" }),
  });
  if (!res.ok) throw new Error(`Failed to send profile to Flow: ${res.statusText}`);
}
```

Note: Flow's `PUT /api/profile` expects a JSON body `{content, path}` (verified in `Artemis_Flow/app/api/routes.py:25-27,71-77`), not raw markdown as the request body — this corrects an earlier assumption in the design doc that a raw-markdown `PUT` was needed; the endpoint already exists with this exact shape, use it as-is.

### Provider vocabulary mapping (needed for Send Config to Flow)

Quiver's `ProviderType`: `"openai-compatible" | "anthropic" | "google-gemini" | "webllm"`. Flow's `LLMConfigBody.provider` (verified `Artemis_Flow/app/api/routes.py:106-111` and `app/llm/provider.py:97-107`): `"ollama" | "lmstudio" | "anthropic"` (anything else raises `ValueError` in `generate()`). These don't line up — needs explicit mapping, not a pass-through:

```typescript
function mapProviderForFlow(endpoint: ModelEndpoint): { provider: string; base_url: string } {
  if (endpoint.provider === "anthropic") return { provider: "anthropic", base_url: endpoint.baseUrl || "https://api.anthropic.com" };
  if (endpoint.provider === "openai-compatible") {
    // Flow's "lmstudio" flavor is really just "generic OpenAI-compatible" on Flow's side
    // (see _openai_compat_generate in provider.py) — reuse it for any openai-compatible endpoint, including Ollama's OpenAI-compat surface.
    return { provider: "lmstudio", base_url: endpoint.baseUrl };
  }
  // "google-gemini" and "webllm" have no Flow-side equivalent — surface a clear error in the UI rather than silently mismapping.
  throw new Error(`Flow does not support the "${endpoint.provider}" provider. Choose an Anthropic or OpenAI-compatible endpoint to send to Flow.`);
}

export async function sendConfigToFlow(baseUrl: string, endpoint: ModelEndpoint): Promise<void> {
  const mapped = mapProviderForFlow(endpoint);
  const res = await fetch(`${baseUrl}/api/settings/llm`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: mapped.provider,
      model: endpoint.model,
      base_url: mapped.base_url,
      api_key: endpoint.apiKey,
      temperature: endpoint.temperature,
    }),
  });
  if (!res.ok) throw new Error(`Failed to send config to Flow: ${res.statusText}`);
}
```

This provider-mismatch gap was not caught in the earlier architecture debate — worth flagging to Bruno once implemented, since it means "google-gemini" and "webllm" endpoints genuinely can't be sent to Flow as-is (no code change to Flow needed for v1; just surface the limitation clearly in the UI, per the "Send Primary"/"Send Secondary" buttons being disabled-with-tooltip when the selected endpoint's provider is unsupported).

### Dual-vantage-point endpoint testing

```typescript
export async function testEndpointFromFlow(
  flowBaseUrl: string,
  endpoint: ModelEndpoint,
): Promise<{ reachable: boolean; error?: string }> {
  const mapped = mapProviderForFlow(endpoint);
  const res = await fetch(`${flowBaseUrl}/api/settings/llm/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: mapped.provider, model: endpoint.model, base_url: mapped.base_url, api_key: endpoint.apiKey }),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}
```

Depends on Flow-side Item 4 (`POST /api/settings/llm/test`) from the Flow implementation plan — this call will 404 until that's built there; sequence accordingly if building both sides in one pass.

"Test from Quiver" reuses the existing `testConnection()` from `services/llmService.ts` (`ConfigContext.tsx`'s `testLlmConnection` already does this) — no new code needed for that half, just surface both results side by side in the UI (see Item 3).

---

## Item 2 — Config.tsx: "Connect to Flow" section

**Read `src/app/pages/Config.tsx` in full before starting this item** — it's 53KB and wasn't read in full during this research pass; match its existing tab/section pattern rather than inventing a new one.

Add a new section (or tab, matching whatever pattern the file already uses) with:

- Host:port text input for Flow's base URL, stored on `ProfileSettings` as a new optional field `flowBaseUrl?: string` (add to `LlmConfig` or `ProfileSettings` in `src/app/types/llm.ts` / `types/workspace.ts` — no Dexie migration needed, see "Relevant existing code" above).
- A "Connect" button calling `checkFlowHealth(flowBaseUrl)` from Item 1; show connected/not-connected state.
- Once connected: "Send Profile to Flow" button (calls `sendProfileToFlow`, using `useProfile().profile` from `ProfileContext`) and "Send Primary"/"Send Secondary" buttons (calls `sendConfigToFlow` with `config.primary` / `config.secondary` from `useConfig()`) — kept as two explicit buttons per endpoint, not a single "send config" action with an inferred default (per the existing decision — no default, user picks).
- Track push success as local component state (or a new `ProfileSettings.flowConfiguredAt?: string` timestamp field) — this is what gates the "Start" control described in Item 4; there's no Flow-side "configured" flag to read back (Flow doesn't track who configured it), so Quiver has to remember locally that it successfully pushed both.
- "Test from Quiver" / "Test from Flow" buttons next to each endpoint being configured for Flow, using `testConnection` (existing) and `testEndpointFromFlow` (Item 1) respectively — render as two independent status indicators, not one combined pass/fail (a user needs to know which side failed).

i18n: add all new strings to `src/app/i18n/locales/en.json` and `es.json` — this project has a known history of English-only strings leaking through when the Spanish locale file isn't updated in lockstep.

---

## Item 3 — Flow panel page (status, digest, search/scoring controls, chat tuning)

New route `/flow`, new lazy-loaded page `src/app/pages/Flow.tsx`, registered in `src/app/routes.tsx` alongside the existing five routes.

**Nav visibility decision**: `Sidebar.tsx`'s `navigation` array is currently static. Two options:
1. Convert it to be computed inside the `Sidebar` component body, reading Flow connection state (from a new lightweight context or `ProfileSettings.flowBaseUrl` + a cached last-known-connected flag) — conditionally include the Flow entry only when connected.
2. Always show the nav entry; have `/flow` itself render a "Connect to Flow first" empty state when not connected, deep-linking to the Config.tsx section from Item 2.

**Recommend option 2** — simpler (no dynamic nav-array logic, no new context needed just for nav visibility), and still satisfies "no errors, no broken UI" since the empty state is informative rather than broken. Revisit option 1 later if Bruno wants a stricter zero-dependency nav (i.e., no Flow-related UI visible at all until connected).

Page contents:
- Connection/configured/started status (three states: not connected, connected-not-configured, configured — reuse `checkFlowHealth` + the locally-tracked configured flag from Item 2).
- Independent Start/Pause/Resume for search (`GET /api/pipeline/search/status`, `POST /api/pipeline/search`, `POST /api/pipeline/search/stop` — search stop is new on Flow's side, see Flow's implementation plan Phase 2) and for scoring (`GET/POST /api/pipeline/rank/status`, `/rank`, `/rank/stop` — already exist on Flow's side today, verified in `Artemis_Flow/frontend/src/api.ts:125-141`, safe to call from Quiver directly the same way Flow's own frontend already does).
- Backlog state (unscored count, soft/hard cap position) via a new `GET /api/settings/backlog` call (Flow-side Phase 3) — render current values, link to edit them (could live in Config.tsx's Flow section instead of here, since it's one-time-ish config, not a status the user checks daily — Bruno's call, either is defensible).
- Ranked digest: `GET /api/jobs?status=new&sort_by=score&sort_dir=desc&show_archived=false` (existing Flow endpoint, `Artemis_Flow/app/api/routes.py:463-548`, already supports all needed filters/sort) — render as a ranked list, per the decided default (not "still open").
- Chat tuning panel: reuse `BuilderAssistantPanel` (Item 1's table entry) with a new `src/app/services/flowChatService.ts`:

```typescript
// src/app/services/flowChatService.ts
export async function submitFlowFeedback(flowBaseUrl: string, feedback: string): Promise<{ refined: boolean; strategy: any }> {
  const res = await fetch(`${flowBaseUrl}/api/strategy/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  });
  if (!res.ok) throw new Error("Failed to submit feedback to Flow");
  return res.json();
}
```

This calls Flow's existing `/api/strategy/feedback` directly (verified `Artemis_Flow/app/api/routes.py:438-454`) — no LLM call happens client-side in Quiver for this feature; Flow's own backend does the interpretation (including the location-aware reasoning added in Flow's Phase 5). Wire `BuilderAssistantPanel`'s `onSubmit` to call `submitFlowFeedback`, show `strategy.reasoning` from the response as confirmation of what changed.

---

## Item 4 — "Start Flow" control

A single button in the Flow panel (Item 3), disabled until both `sendProfileToFlow` and `sendConfigToFlow` have succeeded at least once (tracked via the local state from Item 2). When enabled and clicked: call `POST /api/pipeline/search` to kick off the first search (which is itself gated by Flow's Phase 6 configured-state guard, so this is defense in depth, not the only check). No new Flow endpoint needed — "starting Flow" is just the first `POST /api/pipeline/search` call, made only reachable once the UI confirms both pushes succeeded.

---

## Item 5 — Mail-related UI: confirm absence

No mail-specific UI exists on Quiver's side today (verified — no `EmailPage`-equivalent in `src/app/pages/`), so there's nothing to hide here. This item is a **negative confirmation**, not a build task: when building the Flow panel (Item 3), do not add any mail-related surface (e.g. don't surface Flow's `email_threads`/`email/*` data even though the API exists), consistent with Flow's mail-descoping decision.

---

## Summary: files touched

| File | Item(s) |
|---|---|
| `src/app/services/flowBridge.ts` (new) | 1 |
| `src/app/services/flowChatService.ts` (new) | 3 |
| `src/app/types/llm.ts` / `types/workspace.ts` (add `flowBaseUrl?`, `flowConfiguredAt?`) | 1, 2 |
| `src/app/pages/Config.tsx` | 2 |
| `src/app/pages/Flow.tsx` (new) | 3, 4 |
| `src/app/routes.tsx` | 3 |
| `src/app/components/navigation/Sidebar.tsx` | 3 (only if option 1 is chosen instead of the recommended option 2) |
| `src/app/i18n/locales/en.json`, `es.json` | 2, 3 |

## Related

- `90-Meta/Flow-Integration.md` — design rationale and decisions this plan implements.
- `F:\Dev\Artemis_Flow\artemis_flow_docs\60-Roadmap\Phase-6-Implementation-Plan.md` — Flow-side counterpart; several items here depend on endpoints built there.
- `F:\Dev\BrainVault\+\2026-08-17-Quiver-Flow-Integration-Strategy.md` — joint decisions record.
