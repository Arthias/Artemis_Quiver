---
tags: [feature, extension, overlay, gemini-nano]
status: draft
last_updated: 2026-06-13
---

# Extension Overlay

On-device AI overlay on job pages. Match score badge, expandable detail panel, import to app.

## Architecture

```
Job Page DOM
  └── Overlay UI (content script)
        └── chrome.runtime.sendMessage
              └── Background (service worker)
                    ├── chrome.storage.local (fingerprint, config)
                    ├── Gemini Nano (on-device)
                    └── Remote LLM (primary/secondary fallback)
```

| Layer | Files | Role |
|-------|-------|------|
| Overlay UI | `overlay.ts`, `overlay.css` | Draggable floating badge with score; expand for details + import |
| Config Popup | `popup.html`, `popup.tsx` | Toggle overlay, generate fingerprint, configure fallback |
| Background | `background.ts` | Message routing, storage, LLM dispatch |
| Fingerprint | `fingerprint.ts` | Compact profile summary (≤300 chars) |

## Key Flows

### Overlay on page load
Content script checks `location.hostname` against known job sites → injects overlay → reads fingerprint + config from `chrome.storage.local` → if fingerprint exists, scores match via Nano/fallback → shows badge.

### Fingerprint generation
Popup → `ARTEMIS_GENERATE_FINGERPRINT` → background → `ARTEMIS_REQUEST_PROFILE` → app tab returns `{profileMarkdown, primaryEndpoint, secondaryEndpoint}` → background calls remote LLM → stores in `chrome.storage.local`.

### Match scoring
Overlay sends job text to background. Background routes: Nano (on-device) > secondary endpoint > primary endpoint > null (basic mode). Returns 0-100 score.

### Import flow
Overlay import button → `ARTEMIS_IMPORT_JOB` → background stores in `chrome.storage.session` as pending import → sidebar shows pending pill above "Recent Analyses".

## Config Popup
- Toggle overlay enable/disable
- Generate fingerprint button (status display)
- Fallback mode radio: basic (import only) / secondary (uses app SecondaryUse rule) / primary
- Job sites list (add/remove with path patterns)
- Auto-saves on change

## Overlay States

| Badge | Meaning |
|-------|---------|
| `?` gray | No fingerprint — generate in popup |
| `...` gray | Analyzing... |
| `85%` colored | Score ready (green ≥70, yellow 40-69, red <40) |
| `!` red | Scoring failed — retry |
| ✕ | Dismissed (re-appears on reload) |

## Known Quirks
- **App tab must be open** for fingerprint gen + error relay
- **Vite proxy paths** don't exist in extension — set real URLs in Settings
- **Reasoning models** output in `reasoning_content`, falls back to `reasoning_content?.trim()`
- **Rebuild always**: `npm run build:ext && chrome://extensions → reload` after any extension change
- **`nano-inject.ts`** injected as `<script>` into MAIN world for Gemini Nano access, communicates via `window.postMessage`
