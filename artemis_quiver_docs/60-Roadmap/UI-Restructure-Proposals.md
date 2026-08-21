---
tags: [roadmap, discussion, ui, extension, flow, sidebar]
status: Idea 2 decided and in implementation (2026-08-21); Idea 1 still open discussion
last_updated: 2026-08-21
---

# UI Restructure Proposals

> Two separate ideas Bruno raised in the same conversation (2026-08-21), about Quiver's UI feeling cluttered and Flow/Quiver being disjointed to use together. Idea 1 (Flow as its own page) is **still open discussion — not decided, not scoped.** Idea 2 (overlay → side panel) was worked through to a concrete design across several follow-up messages the same day and is **decided and being implemented** — see the Decisions Log under Idea 2 below for exactly what was settled and why.
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

**Constraints, verified against Chrome's current docs (2026-08-21), not assumed:**
- `chrome.sidePanel.open()` requires a genuine user gesture — an action-icon click, keyboard shortcut, context menu action, or a click inside an extension page/content script. It **cannot** be triggered automatically by a tab navigating to a matching URL. So the overlay's current behavior (badge appears the instant you land on a job page, no click needed) has no direct equivalent — this is a real, intentional trade, not an oversight. See the Decisions Log below for how this gets mitigated.
- `chrome.sidePanel.setOptions()` **can** be called without a gesture (e.g. from a `chrome.tabs.onUpdated` listener), so the extension can silently pre-configure what the panel would show for a tab before it's ever opened.
- Side panels are per-browser-window, not global — a second window needs its own panel opened. Once opened, though, it persists across tab switches and in-window navigation without closing, which is the property that actually matters for "stays open while I review jobs."
- Panel width is narrow (roughly 300–400px, user-resizable) — fine for score + summary + buttons, too tight for the full CV theme editor or a five-column board. "Light preview and edit, full work happens in the main tab" (Bruno's own framing) is the right scope, not an accidental limitation.

## Idea 2 — Decisions Log (2026-08-21)

Reached across several follow-up messages the same day. Recorded here in full so implementation doesn't have to be re-derived from chat history.

**Opening mechanism — the badge/icon, not an always-visible overlay.** The toolbar icon signals "this is a recognized job page" (badge text/color change, the same pattern password managers and ad blockers already use) and clicking it opens the side panel. Verified mechanism: `chrome.action.setPopup({tabId, popup: ""})` clears the manifest's `default_popup` for that one tab only ("Automatically resets when the tab is closed," per Chrome's docs) so `chrome.action.onClicked` fires there and can call `chrome.sidePanel.open({tabId})` — every other tab keeps opening the existing popup untouched. This was checked directly against Chrome's `chrome.action` reference, not assumed.

**Two extraction paths, chosen per site, not globally.**
- **Default (no permission needed): click-to-look.** Opening the panel or pressing "Analyze" pulls the current tab's content on demand via `chrome.scripting.executeScript` — the same mechanism the popup's existing "extract and import" flow already uses, gated only by `activeTab`. No standing host permission, no per-site grant prompt. This is the default for every site, including single-posting career pages where you're only checking a handful of roles by hand.
- **Opt-in per site: "Always quick analyze this site."** This **reuses and renames the existing overlay-enable toggle** — same per-site list, same `chrome.permissions.request()` host-permission flow already built for the overlay (Config.tsx's `ExtensionSettingsCard` / the popup's site list). Turning it on for a site keeps a standing, lightweight watcher active there so a fresh quick score appears automatically as you click between listings on an aggregator, without pressing anything per job. Label changes from "Show overlay on job pages" to **"Always quick analyze this site."**
- The trigger for "automatically as you click between listings" is the same settle-detection the overlay already has (`initUrlWatch` in `overlay.ts`: patches `pushState`/`replaceState`, waits for `document.body.innerText` to stabilize before treating it as a real navigation) — reused as the signal that fires a fresh quick score, not re-invented.

**Cost control — auto-triggering is capped at quick score, full stop.** "Always quick analyze this site" **never** auto-fires deep analysis or CV/CL generation, regardless of how many job listings you click through — only the cheap quick-score call. Deep analysis and content generation stay explicit, per-job, user-initiated actions in every mode. Direct quote: "Never auto deep score, as that would potentially shoot costs to the moon." This is a hard rule, not a default that can drift.

**Caching, with an explicit re-run always available.** Quick scores are cached per job (by URL/content identity) so re-visiting or scrolling back to an already-scored listing doesn't re-fire the LLM. The cached result is what's shown — but a manual "Re-analyze" action stays visible and available even when a cached score exists, in case the user wants a fresh read (e.g. after editing their profile).

**Deep analysis handoff reuses existing plumbing.** A "Deep analysis" button in the panel runs the real analysis (via the same service the full Analysis Hub uses) and writes a genuine `analysisSessions` record — not a lighter, panel-specific format. Handoff to the main Quiver tab reuses the existing pending-storage pattern already built for job imports (`chrome.storage.session` stash + message-on-focus, or open a new tab if none exists), extended to carry a session id instead of raw job data — this is a small extension of proven code, not new infrastructure.

**Explicitly deferred, not forgotten:**
- The floating overlay badge's own rendering (`overlay.ts`'s shadow-DOM UI) is not being torn out in this pass. The per-site permission/content-script mechanism it already uses is being reused to drive the panel; whether the floating badge itself should be retired once the panel covers its role is a follow-up call, not decided here.
- CV/CL "light preview and edit" inside the panel (per the original framing) is scoped down for now to what the deep-analysis handoff supports; the actual in-panel text-editing surface is a separate, later pass — it needs its own design pass on exactly what "light edit" means given the panel's width, not something to improvise mid-implementation.
- `30-Features/Extension Overlay.md` needs a real rewrite once the panel exists and the floating-badge question above is resolved — not touched yet.
- This will reshape Sprint 10 (Application Kanban) in `60-Roadmap/Plan.md` — worth revisiting its scope once the panel is real, not before.

## How these two relate

Independent proposals, but not unrelated: if Flow gets its own page (Idea 1) *and* the sidebar becomes the quick-glance surface for jobs (Idea 2), Flow's full page becomes purely the "manage" surface — Strategy edits, Archive review, Stats — while the sidebar covers the moment-to-moment "is this job worth a look" decision without opening either Quiver or Flow at all. That's a bigger claim than either idea makes on its own and isn't something to assume; noted here only so whoever revisits this sees the connection.

## References

- `90-Meta/Flow-Integration.md` — current (pre-this-proposal) framing of Flow as a panel inside Quiver.
- `30-Features/Extension Overlay.md` — current overlay architecture, would need rework under Idea 2.
- `10-Architecture/Database.md` — Dexie/IndexedDB structure both ideas rely on being shared.
- `60-Roadmap/Plan.md` — Sprint 10 (Application Kanban), whose scope Idea 2 would likely affect.
- `vite.ext.config.ts` — existing multi-entry build pattern both ideas would extend.
