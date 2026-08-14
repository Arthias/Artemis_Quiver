---
tags: [roadmap, release, public-beta, extension, distribution]
status: in-progress
last_updated: 2026-08-05
---

# Public Beta Release

Release-readiness checklist for shipping Artemis Quiver as a Chrome extension to public beta testers **without making the repo public**, distributed as **versioned zips**.

> [!NOTE] Strategy
> The source repo (`Arthias/Artemis_Quiver`) stays private. Distribution = **public artifacts repo** [`Arthias/Artemis-Quiver-Releases`](https://github.com/Arthias/Artemis-Quiver-Releases) holding versioned `Artemis_Quiver_extension-vX.Y.Z.zip` files, each tagged + published as a GitHub Release with install README. **No Chrome Web Store** for now — avoids the $5 fee, listing assets, and review queue.

---

## Distribution Strategy

| Channel | Auto-update | Use |
|---------|-------------|-----|
| **Public release repo + GitHub Releases** | ❌ Manual reinstall | Primary beta channel |
| Load-unpacked folder | — | Dev + QA |

Each release bumps `manifest.json` version → drives the zip filename (`vite.ext.config.ts` reads it) and the GitHub tag. Testers download the zip from the release page, unzip, and `Load unpacked` → `Artemis_Quiver_extension/`.

### Release Repo

- **URL:** https://github.com/Arthias/Artemis-Quiver-Releases (public, artifacts only — no source)
- **Layout:** nested repo at `release/` (gitignored by the parent repo)
- **Contents:** versioned zips + `README.md` (install instructions) + `.gitignore`
- **Process:** one command — `npm run release:ext`

### Publish flow (manual, one command)

```
npm run release:ext            → scripts/release.ps1
  ├─ npm run build:ext           → release/Artemis_Quiver_extension-vX.Y.Z.zip
  ├─ commit + tag vX.Y.Z + push  → release/ nested repo
  └─ gh release create vX.Y.Z    → attaches zip + notes to public repo
```

Flags: `-SkipBuild` (use existing zip), `-SkipPublish` (commit/tag/push only).

---

## Changes needed (checklist)

### C1 — Version single-sourcing ✅ (implemented)
- **Problem:** `manifest.json` = `0.1.0`, `package.json` = `0.0.1`, changelog = `v3.4.0` — three divergent sources.
- **Fix:** Align all to `3.4.0`. Zip name and tag already derive from `manifest.json`. Keep a single source; bump all three together on each release.

### C2 — Remove hardcoded LAN host permissions ✅ (implemented)
- **File:** `src/extension/manifest.json`, `src/extension/background.ts`.
- **Problem:** `host_permissions` + background `VITE_PROXY_MAP` logged a dev-layer IP (`http://192.168.8.171:1234`); it won't exist for beta testers and forced an over-broad static permission.
- **Fix:** Removed the LAN IP. `host_permissions` now only `http://localhost/*` + `http://127.0.0.1/*`. Added `optional_host_permissions: ["http://*/*", "https://*/*"]`; `background.ts` calls `ensureHostPermission()` before fetching a non-local endpoint, requesting the origin at runtime via `chrome.permissions.request`.

### C3 — Overlay only runs on user-added sites (runtime registration) ✅ (implemented)
- **File:** `src/extension/manifest.json`, `src/extension/background.ts`, `src/extension/popup.tsx`, `src/extension/job-sites.ts`.
- **Problem:** Static `<all_urls>` content script (or even a fixed job-domain pattern list) shows a broad-install warning and is a surface area risk.
- **Fix:** No static `content_scripts` block at all. Popup requests the specific origin via `chrome.permissions.request` when the user adds a site; background registers a per-site script (`overlay-<domain><path>`, truncated 32-char id) via `chrome.scripting.registerContentScripts` — only when `permissions.contains` passes. `optional_host_permissions: ["*://*/*"]`; WAR narrowed to `["http://*/*","https://*/*"]`.
- **v3.6.0 hardening:** Reconcile now auto-triggers on `chrome.storage.onChanged` (no manual sync message / no race with the async save). Newly registered sites auto-inject `overlay.js` into already-open matching tabs. Popup "Enable overlay here" adds domain-only entries (path pinning was a common "overlay stopped appearing" cause). `chrome.permissions.request` also wired into the app's Settings page add-site flow.
- **Result:** Overlay can never inject on a site the user didn't authorize. Verified live: with only `www.linkedin.com/jobs/search-results` stored (no host permission granted), `chrome.scripting.getRegisteredContentScripts()` = `[]` and `#artemis-overlay` does not inject.

### C4 — App-tab dependency onboarding ⏳ (awaiting user screenshots)
- **Problem:** Error relay + job import require an app tab open ([[../30-Features/Extension Overlay|Extension Overlay]]). Fingerprint gen no longer does — the background reads the active profile directly from IndexedDB (v3.5.0), and since v3.6.0 fingerprint + fallback + sites are configured in the app's Settings page (`ExtensionSettingsCard`).
- **Fix:** Add a 4th "Extension" step to `OnboardingWizard.tsx` (currently `["Welcome", "AI Setup", "Profile"]`) + `en.json`/`es.json` keys, explaining the app-tab requirement and how to enable the overlay from the toolbar popup.
- **v3.6.0 rework:** The toolbar popup is now an action surface (import current page, one-click overlay enable, links to Settings) rather than a config editor — config management moved to app Settings. Deep-link from popup → `index.html#/config`.
- **Blocked on:** user-supplied screenshots — needs `permission-prompt.png` (Chrome permission dialog after clicking Add in the popup). Reference/staging images already exist under `src/assets/onboarding/`: `popup-add-site.png`, `overlay-badge.png`, `overlay-expanded.png` (user will retake tuned versions against real sites).

### C5 — WebLLM stability
- **Problem:** 6.8 MB vendor chunk (WebLLM runtime); device-lost recovery is post-Sprint 9c hardening.
- **Fix:** Confirm Sprint 9c L1 (service-worker WebLLM) + L2 (auto-downgrade) are merged before beta. See [[../40-Development/WebLLM Stability and Service Worker|WebLLM Stability]].
- **Status:** L1 SW entry (`webllm-sw.js`) already emitted by `build:ext` ✅ — verify handler + registry wiring shipped. Catalog curated to 4 cards (Qwen3.5-2B/4B/9B + DeepSeek-R1-7B) ✅; gemma3-1b invalid-config crash fixed via per-model `overrides` ✅.

---

## GitHub Release packaging checklist

| Item | Status | Notes |
|------|--------|-------|
| Public release repo | ✅ | `Arthias/Artemis-Quiver-Releases` created |
| Version tag (`vX.Y.Z`) | 🔄 | `v3.4.0`, `v3.5.0`, `v3.5.1` published; **`v3.6.0` this release** |
| Attach `Artemis_Quiver_extension-vX.Y.Z.zip` | 🔄 | Produced by `build:ext`; `v3.6.0` zip built + ready to attach |
| Release notes | ✅ | Generated from CHANGELOG + install steps |
| Install README | ✅ | `release/README.md` — unzip → `chrome://extensions` → Load unpacked → `Artemis_Quiver_extension/` |
| Headline the app-tab requirement | ✅ | In README + release notes (C4) |
| SHA-256 checksum | ❌ | Optional; not yet automated |
| CI automation (tag-triggered) | ❌ | Deferred — manual `release:ext` for now |

---

## QA Gate (every release)

```
npm run typecheck
npm run test
npm run build:ext
npm run qa:ext          # Extension QA (Playwright)
```

- Load `Artemis_Quiver_extension/` unpacked on a **fresh Chrome profile**.
- Verify: overlay on LinkedIn + a generic page, fingerprint flow, import to app, popup config, zip contents (`manifest.json` at root).

---

## Completed (this sprint)

- ✅ `build:ext` outputs to `Artemis_Quiver_extension/` and packages `release/Artemis_Quiver_extension-v<version>.zip` (version read from `manifest.json`) — see `vite.ext.config.ts`.
- ✅ C1 version single-sourcing to `3.4.0`.
- ✅ `.gitignore` covers `Artemis_Quiver_extension/` + `release/`.
- ✅ Doc references updated (README, AGENTS, QA_AGENT, i18n, WebLLM).
- ✅ `release/` initialized as nested public repo `Arthias/Artemis-Quiver-Releases` with install README.
- ✅ `v3.4.0` tagged + GitHub Release published with zip attached.
- ✅ `npm run release:ext` script automates build → commit → tag → push → publish.
- ✅ C2 hardcoded LAN host permission removed (optional host permissions + runtime grant).
- ✅ C3 runtime content-script registration — overlay only on user-authorized sites (verified live, `getRegisteredContentScripts()` = `[]` without host grant). Version bumped to `3.5.1`.
- ✅ **`v3.6.0`** — overlay auto-reconcile (`storage.onChanged`), auto-inject into open tabs, toolbar popup rework (action surface), fallback-mode control + site CRUD moved to app Settings, pending-import key fix, versioned i18n cache, path-scoped "Enable overlay here", popup import tabId fix, tabbed Settings page. Verified: typecheck clean, 139/139 tests, `build:ext` OK, zip packaged. **Ready to tag + publish.**

---

## Open Questions

- Primary LLM for beta testers who **don't** have LMStudio/Ollama on the LAN — default to cloud API key (OpenAI/Anthropic/Gemini) or WebLLM download?
- Keep the bundled web app (6.8 MB) inside the extension zip, or ship extension-only and require the web app separately?

## Related
- [[../30-Features/Extension Overlay|Extension Overlay]]
- [[../20-APIs/Local LLM Integration|LLM Integration]]
- [[../40-Development/WebLLM Stability and Service Worker|WebLLM Stability]]
- [[../90-Meta/CHANGELOG|CHANGELOG]]