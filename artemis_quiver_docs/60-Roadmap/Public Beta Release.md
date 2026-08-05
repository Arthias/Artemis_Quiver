---
tags: [roadmap, release, public-beta, extension, distribution]
status: in-progress
last_updated: 2026-08-05
---

# Public Beta Release

Release-readiness checklist for shipping Artemis Quiver as a Chrome extension to public beta testers **without making the repo public**, distributed as **versioned zips**.

> [!NOTE] Strategy
> The repo (`Arthias/Artemis_Quiver`) stays private. Distribution = **`release/Artemis_Quiver_extension-vX.Y.Z.zip`** attached to GitHub **Releases** (manual "Load unpacked" install). CI builds + attaches the zip on a version tag. **No Chrome Web Store** for now — avoids the $5 fee, listing assets, and review queue.

---

## Distribution Strategy

| Channel | Auto-update | Use |
|---------|-------------|-----|
| **GitHub Release + versioned zip** | ❌ Manual reinstall | Primary beta channel |
| Load-unpacked folder | — | Dev + QA |

Each release bumps `manifest.json` version → drives the zip filename (`vite.ext.config.ts` reads it) and the GitHub tag. Testers download the zip, unzip, and `Load unpacked` → `Artemis_Quiver_extension/`.

### CI Flow (proposed)

```
tag push vX.Y.Z
  └─ GH Action (private repo)
       ├─ npm ci
       ├─ npm run typecheck
       ├─ npm run test
       ├─ npm run build:ext          → release/Artemis_Quiver_extension-vX.Y.Z.zip
       ├─ npm run qa:ext
       ├─ compute SHA-256 of zip
       └─ attach zip + checksum to GitHub Release vX.Y.Z
```

No external service secrets (no Google API tokens). The tag version is confirmed against `manifest.json` before building.

---

## Changes needed (checklist)

### C1 — Version single-sourcing ✅ (implemented)
- **Problem:** `manifest.json` = `0.1.0`, `package.json` = `0.0.1`, changelog = `v3.4.0` — three divergent sources.
- **Fix:** Align all to `3.4.0`. Zip name and tag already derive from `manifest.json`. Keep a single source; bump all three together on each release.

### C2 — Remove hardcoded LAN host permissions (functional blocker)
- **File:** `src/extension/manifest.json:8` — `http://192.168.8.171:1234/*`.
- **Problem:** That IP is the dev layer's LMStudio endpoint; it won't exist for beta testers.
- **Fix:** Move to `optional_host_permissions` + runtime `chrome.permissions.request()`, or drop and route all LLM calls through the user-configured endpoints in the app.

### C3 — Narrow `<all_urls>` (recommended)
- **File:** `src/extension/manifest.json:20` (content script), `:32` (web_accessible_resources).
- **Problem:** Matching every site shows a broad-install warning and is a surface area risk.
- **Fix:** Scope to job-site host patterns (`*://*.linkedin.com/*`, `*://*.indeed.com/*`, `*://*.glassdoor.com/*`, ...). No longer a store-rejection blocker, but cleaner UX + smaller attack surface.

### C4 — App-tab dependency onboarding
- **Problem:** Fingerprint generation + error relay require an app tab open ([[../30-Features/Extension Overlay|Extension Overlay]]).
- **Fix:** Document in the release notes + popup first-run copy: "open the web app once to link your profile." Consider a popup status panel showing "app tab required."

### C5 — WebLLM stability
- **Problem:** 6.8 MB vendor chunk (WebLLM runtime); device-lost recovery is post-Sprint 9c hardening.
- **Fix:** Confirm Sprint 9c L1 (service-worker WebLLM) + L2 (auto-downgrade) are merged before beta. See [[../40-Development/WebLLM Stability and Service Worker|WebLLM Stability]].
- **Status:** L1 SW entry (`webllm-sw.js`) already emitted by `build:ext` ✅ — verify handler + registry wiring shipped.

---

## GitHub Release packaging checklist

| Item | Status | Notes |
|------|--------|-------|
| Version tag (`vX.Y.Z`) | ❌ | Must match `manifest.json` |
| Attach `Artemis_Quiver_extension-vX.Y.Z.zip` | ❌ | Produced by `build:ext` |
| SHA-256 checksum | ❌ | For integrity verification |
| Release notes | ❌ | Extract from [[../90-Meta/CHANGELOG|CHANGELOG]] |
| Install instructions | ❌ | Chickenized: download → unzip → `chrome://extensions` → Load unpacked → select `Artemis_Quiver_extension/` |
| Headline the app-tab requirement | ❌ | C4 |

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

---

## Open Questions

- Primary LLM for beta testers who **don't** have LMStudio/Ollama on the LAN — default to cloud API key (OpenAI/Anthropic/Gemini) or WebLLM download?
- Keep the bundled web app (6.8 MB) inside the extension zip, or ship extension-only and require the web app separately?

## Related
- [[../30-Features/Extension Overlay|Extension Overlay]]
- [[../20-APIs/Local LLM Integration|LLM Integration]]
- [[../40-Development/WebLLM Stability and Service Worker|WebLLM Stability]]
- [[../90-Meta/CHANGELOG|CHANGELOG]]