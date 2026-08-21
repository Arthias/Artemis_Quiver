---
tags: [roadmap, discussion, ui, extension, flow, sidebar]
status: discussion — not scoped for implementation, no decisions made yet
last_updated: 2026-08-21
---

# UI Restructure Proposals (Open Discussion)

> Two separate ideas Bruno raised in the same conversation (2026-08-21), about Quiver's UI feeling cluttered and Flow/Quiver being disjointed to use together. **Neither is decided or scoped for implementation.** This doc exists so a future session — or Bruno revisiting this later — has the context without re-deriving it. Do not start building against this without an explicit go-ahead; that's the whole point of parking it here instead of turning it into a Phase-plan doc.
>
> The two ideas are independent of each other and can be adopted separately, together, or not at all.

## Idea 1 — Give Flow its own page instead of a route inside Quiver

**The problem.** Flow currently lives at `/index.html#/flow` — one route among Analysis Hub, Profile, CV Builder, and Cover Letter inside Quiver's single-page app. Flow itself has grown to six tabs (Digest, Board, Strategy, Search, Archive, Stats) as of this session's work. That's a lot of nested navigation for what is, in daily use, a fairly self-contained thing you go check on — and it adds to the general "Quiver feels cluttered" problem Bruno described, since Flow's own internal navigation is stacked on top of Quiver's main nav.

**The proposal.** Split Flow out to its own top-level HTML entry — `/flow.html` instead of `/index.html#/flow`. Concretely:
- A button on Quiver's main page (Analysis Hub or the sidebar nav) takes you to Flow.
- A button on Flow's page takes you back to Quiver.
- These are two pages of the same app/extension, not two products — same data, same styling, just not sharing one router.

**Feasibility, checked against the actual build (2026-08-21):** low risk. `vite.ext.config.ts` already builds multiple independent HTML/TS entry points — `app` (`index.html`, the main React tree), `background`, `overlay`, `nano-inject`, `popup`, `webllm-sw` — via `rollupOptions.input`. Adding `flow: path.resolve(__dirname, "flow.html")` as a sibling entry is the same pattern already in daily use, not a new build concept. Both pages would run in the same extension origin, so Quiver's Dexie-backed IndexedDB (profile, analysis sessions, metadata — see `10-Architecture/Database.md`) is automatically shared between them with zero sync work — this is genuinely "two doors into the same house," not a rearchitecture.

**What actually needs deciding before this becomes a real plan:**
- Does Flow's page get its own `<BrowserRouter>`/route structure for its six tabs (it likely already does internally via `Tabs`, not React Router, so this may be a non-issue), or does it stay tab-based as it is today, just hosted on a different HTML shell?
- What happens to `Config.tsx`'s existing Flow connection/settings panel (`tabFlow` in the Settings tabs — connect, send profile, send config, backlog settings)? Does that stay in Quiver's main Settings, move to Flow's own page, or split (connection setup stays in Quiver since Flow doesn't exist yet at that point in the flow; day-to-day settings move to Flow's page)?
- `90-Meta/Flow-Integration.md` (the authoritative cross-app integration doc) currently frames Flow's UI as a "panel" inside Quiver — that framing predates this proposal and would need a real update, not just a cross-link, if this gets adopted. Flagging rather than fixing now, since nothing is decided yet.
- Does "a button to go to Flow" mean `window.open()`/new tab, or an in-place navigation? A new tab is more consistent with "Flow's UI needs to remain open while you review jobs" (mentioned in the same conversation) than replacing the current tab.

## Idea 2 — Replace the job-page overlay with a browser side panel

**The problem.** The current per-job experience is the floating overlay (`src/extension/overlay.ts`, ~850 lines) — a badge injected into the job page's DOM via `chrome.scripting.registerContentScripts`, isolated in a shadow root and pinned to `position: fixed; z-index: 2147483647` specifically to survive whatever CSS the host site throws at it (see `30-Features/Extension Overlay.md`). It shows a match score and expands for a bit more, but running a deep analysis or generating a CV means leaving the job page and opening Quiver in a new tab, losing your place.

**The proposal (Bruno's framing).** Replace the overlay with a persistent sidebar — left or right — that runs the quick analysis inline, exposes a button to trigger deep analysis directly from the sidebar, and can kick off content generation (CV, etc.) with a lightweight preview/edit surface right there. Full review and heavier editing still happens in Quiver's main tab; the sidebar is for the quick pass and the launch point, not a full editor.

**Feasibility.** Manifest is already MV3 (`manifest.json`, permissions: `scripting`, `storage`, `activeTab`, no `sidePanel` yet). Chrome's `chrome.sidePanel` API is the natural fit — it persists per-browser-window independent of which tab is focused, unlike a tab you have to switch back to, and it lives outside the host page's DOM entirely, which removes the whole category of defensive shadow-DOM/z-index engineering the current overlay carries. Adding it is: one new manifest permission (`"sidePanel"`), one new build entry (same pattern as `popup`), and a `side_panel.default_path` in the manifest. The overlay's *config* (which sites, fallback mode, fingerprint) already lives in `chrome.storage.local`, which — unlike Dexie/IndexedDB — is uniformly accessible from every extension surface including a future side panel with no extra plumbing. Full profile/session data would come from the same shared IndexedDB as Idea 1 describes.

**Constraints worth knowing going in:**
- Side panels open on a user gesture per tab (e.g. a toolbar click), not silently on page load — the "quick score" moment still needs a trigger the first time per tab, same as any side-panel extension today.
- Side panels are per-browser-window, not global — a second window needs its own panel opened.
- Panel width is narrow (roughly 300–400px, user-resizable) — fine for score + summary + buttons, too tight for the full CV theme editor or a five-column board. "Light preview and edit, full work happens in the main tab" (Bruno's own framing) is the right scope, not an accidental limitation.

**Open questions:**
- Does this fully replace the overlay, or coexist with it for sites/cases where a side panel isn't appropriate?
- `30-Features/Extension Overlay.md` would need a substantial rewrite, not a patch, if this is adopted — it currently documents the shadow-DOM/registerContentScripts approach as the architecture.
- How does the sidebar know which job page is active as you tab between listings — a `chrome.tabs.onActivated` listener updating the panel's content, most likely, but not designed here.
- This would also reshape Sprint 10 (Application Kanban) in `60-Roadmap/Plan.md` — if day-to-day triage happens in the sidebar, the kanban's role shifts from "where you manage everything" to something narrower. Worth revisiting Sprint 10's scope alongside this, not before it.

## How these two relate

Independent proposals, but not unrelated: if Flow gets its own page (Idea 1) *and* the sidebar becomes the quick-glance surface for jobs (Idea 2), Flow's full page becomes purely the "manage" surface — Strategy edits, Archive review, Stats — while the sidebar covers the moment-to-moment "is this job worth a look" decision without opening either Quiver or Flow at all. That's a bigger claim than either idea makes on its own and isn't something to assume; noted here only so whoever revisits this sees the connection.

## References

- `90-Meta/Flow-Integration.md` — current (pre-this-proposal) framing of Flow as a panel inside Quiver.
- `30-Features/Extension Overlay.md` — current overlay architecture, would need rework under Idea 2.
- `10-Architecture/Database.md` — Dexie/IndexedDB structure both ideas rely on being shared.
- `60-Roadmap/Plan.md` — Sprint 10 (Application Kanban), whose scope Idea 2 would likely affect.
- `vite.ext.config.ts` — existing multi-entry build pattern both ideas would extend.
