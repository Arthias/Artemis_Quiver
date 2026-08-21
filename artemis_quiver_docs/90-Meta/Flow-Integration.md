---
tags: [integration, flow, cross-app, config]
status: revised — see correction notes below; supersedes the batch-analyze and unified-interface sections
last_updated: 2026-08-18
---

# Flow Integration — Quiver-Side Plan

> How Artemis Quiver detects, communicates with, and orchestrates Artemis Flow as a background search engine.

> [!WARNING] **Correction (2026-08-17)**: The original "Batch Analysis Endpoint" design below — Flow doing a lightweight pre-vet, then POSTing batches to Quiver for the real scoring — is **superseded**. Confirmed directly with Bruno: Flow must be able to score its own jobs independently of Quiver/the browser being open at all; that independence is the entire reason Flow exists as a separate service rather than a Quiver feature. Flow's own scoring/model/backlog design now lives in `F:\Dev\Artemis_Flow\artemis_flow_docs\60-Roadmap\Search-Scoring-Independence-and-Backlog-Management.md`. LLM config between the two apps is explicitly **not** auto-synced — see the new "Send Config to Flow" section below for the actual mechanism. The "Unified Interface" section's iframe/shared-component-library framing is also superseded — see the joint strategy doc for the current thinking (Quiver builds native pages against Flow's API; whether Flow's own `frontend/` gets retired is still an open call, not decided). Everything else below (Detection & Health Check, general panel concept) is still directionally correct. Full joint-decisions record: `F:\Dev\BrainVault\+\2026-08-17-Quiver-Flow-Integration-Strategy.md`.

> [!WARNING] **Correction (2026-08-18)**: Bruno made a top-level product-framing decision — **Quiver is the standalone/main app; Flow is a dependent part of Quiver's toolset, not a symmetric peer.** ("Quiver can run alone, flow cannot, as it will be a part of quiver's toolset.") Concretely, this changes several things below: the digest view (Flow Panel section) is no longer "still open" — a ranked-list digest is the decided default. Flow has no profile of its own anymore — Quiver pushes one (new "Send Profile to Flow" section). Mail-related UI stays hidden/absent per Flow's mail-descoping decision. Three new sections are added: dual-vantage-point endpoint testing, chat-driven Flow tuning, and an explicit "Start Flow" control distinct from connecting. Design Principles gets the asymmetry stated explicitly. Full rationale: `F:\Dev\BrainVault\+\2026-08-17-Quiver-Flow-Integration-Strategy.md` (see the 2026-08-18 update at the top) and `F:\Dev\Artemis_Flow\artemis_flow_docs\60-Roadmap\Search-Scoring-Independence-and-Backlog-Management.md`.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Detection & Health Check](#detection--health-check)
3. [Flow Panel (Config Page)](#flow-panel-config-page)
4. [Connect & Configure Flow](#connect--configure-flow)
5. [Send Config to Flow](#send-config-to-flow)
6. [Test Endpoint from Quiver or Flow](#test-endpoint-from-quiver-or-flow)
7. [Chat-Driven Flow Tuning](#chat-driven-flow-tuning)
8. [Gemini Nano — Scope Decision](#gemini-nano--scope-decision)
9. [On-Demand Live Description Fetch](#on-demand-live-description-fetch)
10. [Schema Additions](#schema-additions)
11. [~~Batch Analysis Endpoint~~ (superseded)](#batch-analysis-endpoint-superseded)
12. [~~Unified Interface~~ (superseded)](#unified-interface-superseded)

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

And one more, from the 2026-08-18 reframe — stated explicitly because it changes how "zero dependency" above should be read:

| Principle | Rule |
|-----------|------|
| **Quiver is standalone; Flow is dependent** | Quiver runs fully on its own — nothing in this doc is required for Quiver's core features (analysis, CV/CL, extension) to work. Flow is the opposite: it has no meaningful standalone path anymore. It starts inert, has no profile or LLM config of its own, and does nothing useful until Quiver connects, pushes both, and issues an explicit start signal (see Connect & Configure Flow, below). "Zero dependency" above still means Quiver must degrade gracefully when Flow is absent — it does **not** mean Flow is expected to work well on its own; it isn't meant to. |

---

## Detection & Health Check

Unchanged in concept from the original design — ping Flow's health endpoint (e.g. `/api/settings/status`, which already exists on Flow's side) on app mount / periodically, show the Flow panel only when reachable, hide everything Flow-related (no errors) when it isn't. This pattern still holds regardless of what ends up inside the panel.

```typescript
// src/app/services/flowBridge.ts (new file)

interface FlowStatus {
  running: boolean;
  service?: string;   // must equal "artemis-flow" — see note below
  totalJobs?: number;
  strategy?: { keywords: string[]; locations: string[] };
}

async function checkFlowHealth(baseUrl: string): Promise<FlowStatus> {
  try {
    const res = await fetch(`${baseUrl}/api/settings/status`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { running: false };
    const body = await res.json();
    if (body.service !== "artemis-flow") return { running: false };
    return { running: true, ...body };
  } catch {
    return { running: false };
  }
}
```

`baseUrl` should be user-configurable in Quiver's settings (default `http://localhost:8000`, but not hardcoded — Flow's actual host is deliberately not assumed anywhere in this design, per the 2026-08-17 decision to keep servito/deployment-host questions out of the app-level design). Entered as an explicit **IP/host + port** field in Quiver's settings — no auto-discovery, since Flow could reasonably be on the same machine, a different machine on the LAN, or a homelab box.

**2026-08-18 requirement**: `/api/settings/status` needs an explicit `service: "artemis-flow"` identifier field, checked above. Without it, a 200 response from *any* unrelated service running on the configured host:port would be misread as "Flow is present" — a real false-positive risk once the host/port is user-entered rather than hardcoded. This is a small addition to Flow's existing status endpoint, not a new endpoint.

---

## Flow Panel (Config Page)

Same general shape as the original mockup — a panel showing connection status, current strategy, and controls — but the controls now map to Flow's *own* independent search/scoring pause-resume model (see Flow's roadmap doc) rather than a Quiver-orchestrated batch-analyze loop. Concretely, the panel needs:

- Connection status (from the health check above), including whether Flow is merely *connected* vs. actually *configured and started* — these are now distinct states, see Connect & Configure Flow below.
- Independent Start/Pause/Resume controls for **search** and for **scoring** — two separate controls, not one combined toggle, per Flow's design. (Not to be confused with the one-time "Start Flow" action in Connect & Configure Flow — that starts Flow's whole lifecycle; these control search/scoring once Flow is already running.)
- Current backlog state (unscored count, soft/hard cap position) and the configurable soft cap / hard cap / archive retention / deletion threshold values, editable from here or deep-linked to Flow's own settings.
- A ranked view of Flow's scored jobs — the actual "review findings" surface. **Decided 2026-08-18** (previously open): a ranked-list digest of the best matches is the default presentation — "a main digest as the front for flow, showing status and a digest with the best matches," Bruno's words. Automatic notifications on top of this digest are explicitly deferred, not decided against — build the digest first.
- A chat entry point for tuning Flow's strategy (see Chat-Driven Flow Tuning, below) — surfaced from this same panel rather than a separate settings form.
- Mail-related controls stay absent from this panel entirely, per Flow's mail-integration descoping decision — not just hidden-when-disconnected, but not built at all until that integration is revived.

## Connect & Configure Flow

New section (2026-08-18), formalizing Flow's three-stage lifecycle (inert → connect+configure → start — full rationale in Flow's roadmap doc) from Quiver's side. This replaces the earlier, vaguer "user must configure and start the engine" principle with a concrete three-step UI flow:

1. **Connect.** User enters Flow's host:port in Quiver's settings; Quiver runs the health check above. On success, the Flow panel becomes visible (per the Zero dependency / Graceful degradation principles) but shows a "connected, not yet configured" state — no search/scoring controls active yet.
2. **Configure.** Two explicit pushes, each its own user action (not bundled into one "set up Flow" button, so the user can see and re-trigger each independently if their profile or LLM config changes later):
   - **Send Profile to Flow** — pushes the current profile as a raw markdown blob to a new Flow endpoint (e.g. `PUT /api/profile`, replacing Flow's old file-based profile entirely per its roadmap doc). No transformation on Quiver's side; Flow's existing `generateStrategy()` consumes the blob as-is.
   - **Send Config to Flow** — the existing action, see below, unchanged.
3. **Start.** Only once both pushes have succeeded does Quiver enable a "Start Flow" action — a separate, explicit control from connecting or configuring, hitting whatever start endpoint Flow's lifecycle work exposes. Before both pushes succeed, this control is disabled (not hidden — showing it disabled communicates what's still needed more clearly than hiding it would).

```typescript
async function sendProfileToFlow(flowBaseUrl: string, profileMarkdown: string): Promise<void> {
  await fetch(`${flowBaseUrl}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "text/markdown" },
    body: profileMarkdown,
  });
}
```

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

## Test Endpoint from Quiver or Flow

New section (2026-08-18). `localhost` (and sometimes other addresses) resolve differently depending on where the request originates from — Quiver running in a browser tab, vs. Flow running in its own process, container, or on a different machine entirely. An endpoint that's reachable from Quiver's vantage point isn't guaranteed reachable from Flow's, and vice versa — a real, non-hypothetical failure mode once the user is pointing either app at a non-default endpoint (e.g. a local Ollama instance, or a homelab-hosted model).

Both tests are triggered from Quiver's UI, next to whichever endpoint is being configured:

- **Test from Quiver**: a direct `fetch` from the browser to the candidate endpoint — the same kind of check Quiver's own endpoint settings already do today for its own Primary/Secondary config.
- **Test from Flow**: Quiver calls a new Flow-side endpoint, passing the candidate endpoint details, and Flow attempts the connection from its own vantage point and reports back success/failure. Mirrors the pattern Flow already has for `testEmailConnection`.

```typescript
async function testEndpointFromFlow(
  flowBaseUrl: string,
  endpoint: Pick<ModelEndpoint, "provider" | "model" | "baseUrl" | "apiKey">,
): Promise<{ reachable: boolean; error?: string }> {
  const res = await fetch(`${flowBaseUrl}/api/settings/llm/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(endpoint),
    signal: AbortSignal.timeout(5000),
  });
  return res.json();
}
```

Result surfaced as two independent status indicators ("Reachable from Quiver: yes/no", "Reachable from Flow: yes/no") rather than one combined pass/fail — a user needs to know *which side* failed to fix it, since a `localhost` endpoint reachable from Quiver's browser but not from Flow's container is a config problem with a specific, addressable cause (point Flow at the host's real LAN IP instead), not a generic connection error.

## Chat-Driven Flow Tuning

New section (2026-08-18). Rather than a settings form for adjusting Flow's search strategy (keywords, locations, exclusions), tuning happens through a chat panel — reusing the existing CV/CL-builder "AI Assistant" chat-panel UI pattern already built in Quiver, pointed at Flow's feedback loop instead. The user types something like "I'd like to now look for jobs within Europe, or Italy. Remote ideally," and the interpreting LLM turns that into a strategy update via Flow's existing `submitFeedback()` call — no new backend mechanism on Flow's side, just a new caller.

The one new requirement this adds (documented in full on Flow's side, in its roadmap doc): the interpreting prompt must reason about remote/hybrid/on-site feasibility relative to the user's actual home location from their profile, not just extract "remote"/"hybrid" as bare keywords. Bruno's test case, worth keeping literal: hybrid-in-Germany should be flagged as infeasible from Manta, Italy; hybrid-in-Turin should be treated as plausible. Since the profile is already pushed to Flow (see Connect & Configure Flow, above), Flow's feedback-interpretation prompt has what it needs for this without any new data being sent from Quiver — the chat panel just needs to call the existing endpoint with the user's message.

Surfaced from the Flow panel (see above) rather than as a standalone page — tuning strategy is something the user does while looking at Flow's status/digest, not a separate destination.

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
- `60-Roadmap/UI-Restructure-Proposals.md` — **open discussion, not decided (2026-08-21)**: a proposal to give Flow its own top-level page (`/flow.html`) instead of being a route inside Quiver's app, which would revise the "Flow Panel (Config Page)" framing above if adopted. Also covers a separate, unrelated proposal to replace the job-page overlay with a browser side panel. Neither is scoped — read before assuming this doc's "Flow Panel" section is still the final shape.
