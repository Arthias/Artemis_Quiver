---
tags: [feature, extension, overlay, gemini-nano]
status: draft
last_updated: 2026-08-14
---

# Extension Overlay

On-device AI overlay on job pages. Match score badge, expandable detail panel, import to app.

## Architecture

```
Job Page DOM
  └── Overlay UI (content script, dynamically registered per-site)
        └── chrome.runtime.sendMessage
              └── Background (service worker)
                    ├── chrome.storage.local (fingerprint, config)
                    ├── Gemini Nano (on-device)
                    └── Remote LLM (primary/secondary fallback)
```

| Layer | Files | Role |
|-------|-------|------|
| Overlay UI | `overlay.ts` | Draggable floating badge with score; expand for details + import |
| Toolbar Popup | `popup.html`, `popup.tsx` | Action surface: import current page, overlay status, links to Settings |
| Background | `background.ts` | Message routing, runtime content-script registration, LLM dispatch |
| Fingerprint | `Config.tsx` `ExtensionSettingsCard` | Compact profile summary (≤300 chars), generated from the app |
| Config | `Config.tsx` `ExtensionSettingsCard` | Overlay toggle, job sites, fallback mode, fingerprint — all live in **app Settings** |

## Content-Script Registration (runtime, per-site)

There is **no static `content_scripts` block** in the manifest. The overlay is
registered per site via `chrome.scripting.registerContentScripts` in
`syncSiteContentScripts()` (`background.ts`) and only runs on sites the user
explicitly added **and** granted host permission for.

Reconciliation is triggered automatically whenever `artemis:overlayConfig`
changes in `chrome.storage.local` — from the popup **or** the app's Settings
page (`chrome.storage.onChanged` listener). No manual `ARTEMIS_SYNC_SITE_SCRIPTS`
message needed.

After registering a site's content script, `background.ts` auto-injects
`overlay.js` into already-open matching tabs (`injectOverlayIntoTabs`), so the
overlay appears without reloading. If it still doesn't show (e.g. SPA hiccup),
reload the page.

## Key Flows

### Overlay on page load
Registered content script runs → reads fingerprint + config from `chrome.storage.local` → if the site matches `config.jobSites` and overlay is enabled → injects overlay → scores match via Nano/fallback.

### Fingerprint generation
Lives in the **app Settings** (`Config.tsx` `ExtensionSettingsCard`), where the
profile markdown + real LLM config (incl. WebLLM) already live. Result is written
to `artemis:overlayConfig` in `chrome.storage.local`. The background can also
generate it from IndexedDB directly (`idbProfile.ts`) if needed.

### Match scoring
Overlay sends job text to background. Background routes: Nano (on-device) > secondary endpoint > primary endpoint > null (basic mode). Returns 0-100 score.

### Import flow
Overlay import button → `ARTEMIS_IMPORT_JOB` → background stores in `chrome.storage.session` as pending import → sidebar shows pending pill above "Recent Analyses".

## Toolbar Popup (action surface)

The toolbar popup is **not** a config editor — config lives in Settings. It is an
action surface for when the overlay isn't available:

- **Import this job → Artemis** — extracts the current page (`ARTEMIS_EXTRACT_AND_IMPORT`) and enqueues a pending import + opens the app. Works on any page, overlay-independent.
- **Overlay status** — active on current site? If not, an editable **site URL** field (prefilled with the current page) plus **Enable overlay here** (`chrome.permissions.request` + auto-sync/auto-inject). Enter a path to scope the overlay to that area (e.g. `https://www.awin.com/gb/careers/vacancies/*`); a bare hostname stays domain-only. Shows a reload hint as a fallback.
- **Fingerprint status** — present + last updated, links to Settings for regeneration.
- **Manage in Settings** → `index.html#/config`.

## Config (app Settings, `ExtensionSettingsCard`)

- Overlay enable/disable
- Job sites (default list w/ exclusion + custom, incl. path patterns)
- Profile fingerprint generation/regeneration (uses the app's configured LLM)
- **Overlay fallback mode** — basic / secondary / primary; `secondary` is disabled until a secondary endpoint is configured

## Overlay States

| Badge | Meaning |
|-------|---------|
| `?` gray | No fingerprint — generate in Settings |
| `...` gray | Analyzing... |
| `85%` colored | Score ready (green ≥70, yellow 40-69, red <40) |
| `!` red | Scoring failed — retry |
| ✕ | Dismissed (re-appears on reload) |

## Debugging (overlay not loading)

1. `npm run build:ext` → `chrome://extensions` → **reload** the extension.
2. Open the popup → confirm the site chip / "Enable overlay here" state.
3. Background SW console (`chrome://extensions` → Inspect views: service worker):
   - `chrome.scripting.getRegisteredContentScripts()` → expect `overlay-*` entries
   - `chrome.permissions.getAll()` → confirm the site's origins are granted
   - `chrome.storage.local.get("artemis:overlayConfig")` → check `jobSites` / `enabled` / `fingerprint`
   - Watch for `[Artemis] Registered overlay content script for <site>` / `[Artemis] Injected overlay.js into open tab`
4. F5 the job page → F12 console: expect `[Artemis] Overlay init on <host> ...`. Silences = script never injected; "Not a known job site" = entry/path mismatch.
5. If scripts are empty but config has sites → re-save a site in Settings/popup to re-trigger the `storage.onChanged` sync.
6. App-side errors surface in **Settings → Developer Mode** (relayed via `ARTEMIS_LOG_ERROR`, needs an app tab open).

## Known Quirks
- **App tab required only for** error relay + job import (fingerprint gen reads the profile from IndexedDB directly — no app tab needed)
- **Vite proxy paths** don't exist in extension — set real URLs in Settings
- **Reasoning models** output in `reasoning_content`, falls back to `reasoning_content?.trim()`
- **Rebuild always**: `npm run build:ext && chrome://extensions → reload` after any extension change
- **`nano-inject.ts`** injected as `<script>` into MAIN world for Gemini Nano access, communicates via `window.postMessage`
- **Raw keys in popup/overlay** (e.g. `extension.importJob`) = stale `chrome.storage.local` i18n cache from an older build. The cache key is versioned by the manifest version (`i18n_cache_<version>`), so reloading at the same version never invalidates it — bump the manifest version to force a re-fetch, or clear extension storage.
- **Legacy path-pinned sites:** entries saved by the pre-3.6.0 popup can carry a page path (`www.linkedin.com/jobs/search-results`) that silently restricts the overlay to that exact path. The background migrates such entries on known job boards to the domain (`normalizeSiteEntry`); the overlay applies the same rule at load. Wildcard pins (`site.com/jobs/*`) and non-board pins (e.g. `www.awin.com/gb/careers/vacancies`) are preserved.
