---
tags: [integration, flow, cross-app, config]
status: revised — see correction note below; supersedes the batch-analyze and unified-interface sections
last_updated: 2026-08-17
---

# Flow Integration — Quiver-Side Plan

> How Artemis Quiver detects, communicates with, and orchestrates Artemis Flow as a background search engine.

> [!WARNING] **Correction (2026-08-17)**: The original "Batch Analysis Endpoint" design below — Flow doing a lightweight pre-vet, then POSTing batches to Quiver for the real scoring — is **superseded**. Confirmed directly with Bruno: Flow must be able to score its own jobs independently of Quiver/the browser being open at all; that independence is the entire reason Flow exists as a separate service rather than a Quiver feature. Flow's own scoring/model/backlog design now lives in `F:\Dev\Artemis_Flow\artemis_flow_docs\60-Roadmap\Search-Scoring-Independence-and-Backlog-Management.md`. LLM config between the two apps is explicitly **not** auto-synced — see the new "Send Config to Flow" section below for the actual mechanism. The "Unified Interface" section's iframe/shared-component-library framing is also superseded — see the joint strategy doc for the current thinking (Quiver builds native pages against Flow's API; whether Flow's own `frontend/` gets retired is still an open call, not decided). Everything else below (Detection & Health Check, general panel concept) is still directionally correct. Full joint-decisions record: `F:\Dev\BrainVault\+\2026-08-17-Quiver-Flow-Integration-Strategy.md`.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Detection & Health Check](#detection--health-check)
3. [Flow Panel (Config Page)](#flow-panel-config-page)
4. [Send Config to Flow](#send-config-to-flow)
5. [Gemini Nano — Scope Decision](#gemini-nano--scope-decision)
6. [On-Demand Live Description Fetch](#on-demand-live-description-fetch)
7. [Schema Additions](#schema-additions)
8. [~~Batch Analysis Endpoint~~ (superseded)](#batch-analysis-endpoint-superseded)
9. [~~Unified Interface~~ (superseded)](#unified-interface-superseded)

---

## Design Principles

Still accurate, unchanged:

| Principle | Rule |
|-----------|------|
| **Zero dependency** | If Flow is not running, Quiver shows nothing Flow-related. No errors, no broken UI. |
| **Graceful degradation** | If Flow disconnects mid-session, Quiver continues with cached data. |
| **User consent** | Flow integration is opt-in. User must configure and start the engine. |
| **Local communication only** | Both apps discover each other on localhost (or wherever the user has pointed Quiver — no assumption of a specific host, e.g. servito, is baked in here). |

Add one more, from the 2026-08-17 debate:

| Principle | Rule |
|-----------|------|
| **No shared/implicit config** | Quiver never pushes its LLM config to Flow automatically. The user explicitly chooses to send one, via the action below. |

---

## Detection & Health Check

Unchanged in concept from the original design — ping Flow's health endpoint (e.g. `/api/settings/status`, which already exists on Flow's side) on app mount / periodically, show the Flow panel only when reachable, hide everything Flow-related (no errors) when it isn't. This pattern still holds regardless of what ends up inside the panel.

```typescript
// src/app/services/flowBridge.ts (new file)

interface FlowStatus {
  running: boolean;
  totalJobs?: number;
  strategy?: { keywords: string[]; locations: string[] };
}

async function checkFlowHealth(baseUrl: string): Promise<FlowStatus> {
  try {
    const res = await fetch(`${baseUrl}/api/settings/status`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { running: false };
    return { running: true, ...(await res.json()) };
  } catch {
    return { running: false };
  }
}
```

`baseUrl` should be user-configurable in Quiver's settings (default `http://localhost:8000`, but not hardcoded — Flow's actual host is deliberately not assumed anywhere in this design, per the 2026-08-17 decision to keep servito/deployment-host questions out of the app-level design).

---

## Flow Panel (Config Page)

Same general shape as the original mockup — a panel showing connection status, current strategy, and controls — but the controls now map to Flow's *own* independent search/scoring pause-resume model (see Flow's roadmap doc) rather than a Quiver-orchestrated batch-analyze loop. Concretely, the panel needs:

- Connection status (from the health check above).
- Independent Start/Pause/Resume controls for **search** and for **scoring** — two separate controls, not one combined toggle, per Flow's design.
- Current backlog state (unscored count, soft/hard cap position) and the configurable soft cap / hard cap / archive retention / deletion threshold values, editable from here or deep-linked to Flow's own settings.
- A ranked view of Flow's scored jobs — the actual "review findings" surface. Shape (ranked digest vs. something else) is still an open call, deliberately not decided yet — build the plumbing (fetch + render list) before committing to a specific presentation.

## Send Config to Flow

New section, from the 2026-08-17 decision. Explicit, user-initiated action — never automatic:

```typescript
async function sendConfigToFlow(
  flowBaseUrl: string,
  endpoint: ModelEndpoint,  // Quiver's Primary or Secondary, whichever the user picked
): Promise<void> {
  await fetch(`${flowBaseUrl}/api/settings/llm`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: endpoint.provider,
      model: endpoint.model,
      base_url: endpoint.baseUrl,
      api_key: endpoint.apiKey,
      temperature: endpoint.temperature,
    }),
  });
}
```

UI: two explicit buttons/options in the Flow panel — "Send Primary" and "Send Secondary" — rather than an inferred default. A user might reasonably want Flow running a cheap local model while Quiver stays on a cloud provider for CV generation, or the reverse; nothing here should guess which one the user means. Flow persists whatever it receives (`/api/settings/llm` already exists and already persists) so it keeps working independent of Quiver being open afterward.

## Gemini Nano — Scope Decision

Researched directly during the 2026-08-17 debate, in response to the question "could Flow's passive scoring run on Gemini Nano instead of a separate model?" **Answer: no, and Nano's role in this codebase should stay exactly where it already is** (an in-page assist while a human is actively looking at one posting, e.g. via `src/extension/nano-inject.ts`) — not expanded into Flow's background/batch role. Reasons, confirmed against current Chrome docs rather than assumed:

- Chrome's Prompt API is not available in Web Workers, and Manifest V3 extension background service workers are suspended after ~30 seconds of inactivity by design — the opposite of "runs passively in the background." Even with the browser open, there's no guarantee of continuous execution without active engineering to fight that (which MV3 is specifically designed to prevent).
- Hardware requirements (4GB+ VRAM or 16GB+ RAM/4-core CPU, 22GB free storage) are real and in the same territory that already caused WebLLM problems on other hardware — Nano is not a lighter-weight alternative to that risk, it's the same risk built into the browser instead of downloaded by the app.
- Structured JSON-schema output *is* supported now (Chrome 137+) — so this isn't a capability gap, it's an architectural one. Worth remembering if this question comes up again.

Sources: [Prompt API](https://developer.chrome.com/docs/ai/prompt-api), [Structured output for the Prompt API](https://developer.chrome.com/docs/ai/structured-output-for-prompt-api), [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

## On-Demand Live Description Fetch

New concept from the 2026-08-17 debate, resolving Flow's "job description gathering is hard" problem from Quiver's side rather than Flow's. Flow's server-side scraping will always have long-tail gaps (JS-heavy sites, redesigns, auth walls) — Quiver doesn't need to fix that. When the user opens a specific job from Flow's panel to actually act on it (generate a CV/CL, analyze it), and Quiver detects the stored description is thin/low-confidence (a flag Flow should set on jobs it wasn't fully confident it got complete data for — see Flow's roadmap doc), Quiver can use its own live-browser/content-script access to pull the full rendered posting directly from the DOM at that moment — something a headless scraper structurally can't match. This only needs to exist for the specific job the user is actually looking at, not as a general Flow-side fix.

## Schema Additions

Unchanged from the original design — still relevant if/when Quiver starts writing analysis results back to specific Flow job records (e.g. after generating a CV for a job sourced from Flow):

```typescript
interface AnalysisSessionRecord {
  // ... existing fields
  flowJobId?: string;    // the Flow jobs.id this analysis corresponds to
  flowScore?: number;    // Flow's own score, for reference/display only — Quiver does not compute this
  flowStatus?: "pending" | "synced" | "failed";
}
```

Optional fields, no breaking IndexedDB migration needed (Dexie handles missing fields gracefully), consistent with the original note.

---

## ~~Batch Analysis Endpoint~~ (superseded)

The original design here — Quiver running an embedded HTTP server that Flow POSTs job batches to for scoring — assumed Flow's scoring depended on Quiver being open. That's no longer the model; see the correction note at the top. Kept here, struck through, for history rather than deleted outright.

## ~~Unified Interface (Future Phase)~~ (superseded)

The original iframe / shared-component-library / "Quiver becomes the shell" options are superseded by the actual 2026-08-17 direction: if Quiver's own native Flow panel (built against Flow's API, in Quiver's own design system) reaches parity with Flow's existing `frontend/`, retiring the latter becomes a real option — but that's a call to make later, once the panel exists, not something decided now. No iframe embedding, no shared component package — whichever way this goes, it'll be native code on each side talking to Flow's API, per the working assumption in the joint strategy doc.

## References

- `F:\Dev\BrainVault\+\2026-08-17-Quiver-Flow-Integration-Strategy.md` — full joint-decisions record.
- `F:\Dev\Artemis_Flow\artemis_flow_docs\60-Roadmap\Search-Scoring-Independence-and-Backlog-Management.md` — Flow's own scoring/backlog/dedup design.
- `F:\Dev\Artemis_Flow\artemis_flow_docs\90-Meta\INTEGRATION_STRATEGY.md` — Flow-side correction note.
