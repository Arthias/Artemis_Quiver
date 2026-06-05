---
tags: [feature, extension, overlay, gemini-nano]
status: draft
last_updated: 2026-06-05
---

# Extension Overlay — Smart Job Page Assistant

> On-device AI overlay that lives on job pages. Shows match score, expands for details, imports to the app. Config popup manages fingerprint, overlay toggle, and fallback routing.

---

## Architecture

```
                     ┌────────────────────┐
                     │   Job Page (DOM)    │
                     │  ┌──────────────┐   │
                     │  │ Overlay UI   │   │  ← content script injects this
                     │  │ (floating)   │   │
                     │  └──────┬───────┘   │
                     └─────────┼───────────┘
                               │ chrome.runtime.sendMessage
                               ▼
┌──────────────────────────────────────────────────┐
│               Background (service worker)         │
│  ┌────────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Fingerprint│  │  Config  │  │  LLM Router  │ │
│  │  cache     │  │  storage │  │  (Nano/local)│ │
│  └────────────┘  └──────────┘  └──────────────┘ │
└──────────────────────┬───────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   chrome.storage   Gemini Nano   Remote LLM
   (fingerprint,    (on-device)   (primary/secondary)
    config)
```

### Layers

| Layer | File(s) | Lives in | Role |
|-------|---------|----------|------|
| **Overlay UI** | `overlay.ts`, `overlay.css` | Content script (job page) | Draggable floating badge with match score; expands to show details + import button |
| **Config Popup** | `popup.html`, `popup.tsx` | Extension popup | Toggle overlay, generate fingerprint, configure fallback |
| **Background** | `background.ts` | Service worker | Message routing, storage reads/writes, LLM dispatch |
| **LLM Adapter** | `gemini-nano.ts`, `api-client.ts` | Background (or content) | Abstract on-device vs remote model calls |
| **Fingerprint** | `fingerprint.ts` | Background | Generate/store/retrieve compact profile summary |

---

## File Inventory

### New files

| Path | Purpose |
|------|---------|
| `src/extension/overlay.ts` | Content script — injects draggable overlay into page, handles position memory, expand/collapse, import flow |
| `src/extension/overlay.css` | Overlay styles (lightweight, no framework) |
| `src/extension/popup.html` | Popup entry HTML |
| `src/extension/popup.tsx` | Popup React app — toggle overlay, generate fingerprint, fallback config |
| `src/extension/gemini-nano.ts` | `LanguageModel` / `Summarizer` API adapter with availability detection |
| `src/extension/api-client.ts` | Remote LLM HTTP client (OpenAI-compatible) for fallback |
| `src/extension/fingerprint.ts` | Fingerprint type, generation prompt, storage helpers |

### Modified files

| Path | Change |
|------|--------|
| `src/extension/manifest.json` | Add `action.default_popup`, `content_scripts`, `storage` permission scope |
| `vite.ext.config.ts` | Add popup entry point, copy popup.html |
| `src/extension/background.ts` | Add message handlers for fingerprint, LLM routing, overlay config |

---

## Data Flow

### 1. Overlay appears on job page load

```
content script injects overlay
  → reads fingerprint + config from chrome.storage.local
  → if fingerprint exists:
      → calls LLM (Nano or remote) to score job vs fingerprint
      → shows match % badge
  → if no fingerprint:
      → shows "Import" badge only (no scoring)
```

### 2. User clicks the overlay

```
badge expands to detail panel
  → shows match score breakdown (if scored)
  → shows "Import to Artemis" button
  → imports via existing ARTEMIS_IMPORT mechanism
```

### 3. Config popup (click extension icon)

```
popup opens
  → reads current settings from chrome.storage.local
  → toggle: enable/disable overlay injection
  → button: "Generate fingerprint" → background generates via LLM → stores
  → radio: fallback mode (secondary-use / primary / basic)
  → saves to chrome.storage.local
```

### 4. Fingerprint generation

```
user clicks "Generate" in popup
  → background fetches profile markdown from IndexedDB (via app page or pre-saved in storage)
  → calls LLM (remote or Nano) with prompt:
      "Condense this professional profile into ≤300 chars.
       Include: role title, top 5 skills, years of experience, industries."
  → stores in chrome.storage.local as "artemis:fingerprint"
```

### 5. Match scoring

```
overlay has fingerprint + job text
  → sends to background with action "score_match"
  → background routes to active LLM:
      - if Gemini Nano available → use Prompt API
      - else if fallback = secondary-use → reads SecondaryUse, picks endpoint
      - else if fallback = primary → uses primary endpoint
      - else → returns null (basic mode)
  → prompt: "Score 0-100 how well this candidate matches this job. Only reply with the number."
  → returns score to overlay
```

---

## Component Design

### Overlay (vanilla JS + CSS)

```
┌──────────────────────────┐
│  ▲ 85%       ✕            │  ← collapased badge, draggable via ▲
│  Match                    │
└──────────────────────────┘

  ↓ click expands

┌──────────────────────────┐
│  ▲ 85% Match    ─ □ ✕   │  ← header bar (drag handle)
│──────────────────────────│
│  Job: Senior Engineer    │
│  at Acme Corp            │
│                          │
│  ✓ Skills match: 4/5     │
│  ✓ Experience: 7yr req   │
│  ⚠ Industry: different   │
│                          │
│  ┌────────────────────┐  │
│  │ Import to Artemis  │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

- **Drag**: `mousedown` on header → `mousemove` repositions → `mouseup` saves position to `chrome.storage.local`
- **Position**: stored as `{ x, y }` in `chrome.storage.local`. Default: bottom-right, 20px offset.
- **Z-index**: 2147483647 (max safe)
- **Resize**: No manual resize. Width 320px in expanded, 160px collapsed.

### Config Popup (React)

```
┌──────────────────────────┐
│  Artemis Quiver Config   │
│──────────────────────────│
│                          │
│  ☑ Show overlay on jobs  │
│                          │
│  ┌─────────────────────┐ │
│  │ Generate fingerprint │ │
│  └─────────────────────┘ │
│  Status: ✓ Ready (120ch) │
│                          │
│  ─── Fallback ────────   │
│  When Gemini Nano is     │
│  unavailable:            │
│                          │
│  ○ Basic (import only)   │
│  ● Use app secondary     │
│  ○ Use app primary       │
│                          │
│  ┌─────────────────────┐ │
│  │       Save          │ │
│  └─────────────────────┘ │
└──────────────────────────┘
```

---

## Gemini Nano Integration

### Availability check (in content script / popup)

```typescript
async function getNanoAvailability(): Promise<"available" | "downloadable" | "unavailable"> {
  if (typeof LanguageModel === "undefined") return "unavailable";
  try {
    return await LanguageModel.availability();
  } catch {
    return "unavailable";
  }
}
```

### Session lifecycle

```typescript
let session: AILanguageModel | null = null;

async function getSession() {
  if (session) return session;
  session = await LanguageModel.create({
    initialPrompts: [{ role: "system", content: "You are a job match scorer. Reply with only a number 0-100." }],
    monitor(m) { m.addEventListener("downloadprogress", (e) => { /* show progress in popup */ }); },
  });
  return session;
}

function destroySession() {
  session?.destroy();
  session = null;
}
```

### Limitations to handle

- **Model purges** mid-session — catch `destroyed` errors, re-create session
- **Availability changes** — re-check before each `prompt()` call
- **Content script context** — `LanguageModel` is available in content scripts (page context)
- **Not in service worker** — LLM calls must happen in content script, not background

---

## Fallback Configuration

| Fallback mode | Behavior |
|--------------|----------|
| `"basic"` | No AI at all. Overlay only shows "Import" button |
| `"secondary"` | Uses `SecondaryUse` rule: if `quick-tasks`, use secondary endpoint; else use primary endpoint. Calls the remote LLM via HTTP |
| `"primary"` | Always uses the primary `ModelEndpoint` via HTTP |

The endpoint settings (baseUrl, model, apiKey) are stored as a serialized copy in `chrome.storage.local` so the extension doesn't need to read IndexedDB.

---

## Build Configuration

Add to `vite.ext.config.ts`:

```typescript
input: {
  app: path.resolve(__dirname, "index.html"),
  background: path.resolve(__dirname, "src/extension/background.ts"),
  popup: path.resolve(__dirname, "src/extension/popup.html"),
}
```

The `overlay.ts` content script bundles as a separate chunk or inline. Content scripts are registered in `manifest.json` and loaded by Chrome directly, so they should be output as standalone JS files.

### Manifest additions

```json
{
  "action": {
    "default_popup": "popup.html",
    "default_title": "Artemis Quiver Config"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["overlay.js"],
    "css": ["overlay.css"],
    "run_at": "document_idle"
  }]
}
```

---

## Decisions (2026-06-05)

| Decision | Choice |
|----------|--------|
| Overlay scope | Known job sites, user-managed via config popup + main app Settings tab |
| LLM call location | Content script (reads `chrome.storage.local` directly, calls Nano in-page) |
| Fingerprint sync | Auto-sync (watch IndexedDB for profile changes via polling) |
| Import UX | Show checkmark → offer "Go to Artemis Quiver". Pending analyses section above "Recent Analyses" |
| MVP functions | Score + Smart extract + Summarize + Import |

---

## Data Flow (Updated)

### 1. Overlay appears on job page

```
content script checks location.hostname against known job sites
  → if matched, injects overlay
  → reads fingerprint + config from chrome.storage.local
  → if fingerprint exists → score match via Gemini Nano (in-page)
  → if no fingerprint → "Import" badge only
  → if Gemini Nano unavailable → fallback route
```

### 2. User clicks "Import to Artemis"

```
overlay sends import to background via chrome.runtime.sendMessage
  → background stores in chrome.storage.session as "artemis:pendingImport" (existing path)
  → overlay shows ✓ checkmark + "Open Artemis Quiver" link
  → sidebar shows pending analysis pill above "Recent Analyses"
```

### 3. Fingerprint auto-sync

```
Every 30s, content script checks chrome.storage.local for fingerprint freshness
  → if lastFingerprintUpdate is older than profile lastModifiedAt (from IndexedDB)
  → re-generates fingerprint via LLM
Alternative: background polls IndexedDB periodically, pushes update to storage
```

---

## Overlay MVP Functions

### Collapsed state
```
┌──────┐
│ 85%  │  ← match score (or "JD" if no fingerprint)
│      │
└──────┘  ← draggable, shows initials/icon
```

### Expanded state
```
┌──────────────────────────────┐
│ ▲ 85% Match       ─ □ ✕    │  ← drag handle, minimize, close
│──────────────────────────────│
│ 📋 Senior Software Engineer  │  ← smart extracted
│     at Acme Corp             │
│     💰 $120k-$160k           │
│                              │
│ 📊 Match breakdown           │
│   Skills: ██████░░░░ 6/10   │
│   Exp:    ████████░░ 8/10   │
│   Industry:████░░░░░░ 4/10  │
│                              │
│ 📝 TL;DR                     │
│  Senior engineer role...     │  ← summarizer output
│                              │
│ [Import to Artemis] ✓        │  ← grey-out on success
│ [Open in Artemis →]          │  ← after import
└──────────────────────────────┘
```

---

## Known Job Sites (default list)

```
linkedin.com
indeed.com
glassdoor.com
monster.com
ziprecruiter.com
careerbuilder.com
dice.com
simplyhired.com
upwork.com
freelancer.com
stackoverflow.com/jobs
weworkremotely.com
remoteok.com
```

User can add/remove via config popup or main app Settings tab.

---

## Settings Tab on Main App

New tab in the Settings page: **"Job Sites"** (or within an existing "Extension" tab if added later)

```
┌──────────────────────────────┐
│  Job Sites for Overlay       │
│                              │
│  Known sites:                │
│  ☑ linkedin.com             │
│  ☑ indeed.com               │
│  ☐ mycustomjobboard.com     │
│                              │
│  [+ Add site]                │
│                              │
│  Changes sync to             │
│  chrome.storage.local        │
└──────────────────────────────┘
```

---

## Pending Analyses (Sidebar)

Add a section in Sidebar above "Recent Analyses":

```
  ┌ Pending Analysis ────────┐
  │ 📄 Senior Engineer @ Acme │
  │ Just now                  │
  │ [Run Analysis →]          │
  └───────────────────────────┘
```

Stored in IndexedDB `analysisSessions` with `status: "pending"` and no result yet, or a lightweight in-memory list synced from `chrome.storage.session`.

---

## Storage Schema (`chrome.storage.local`)

```typescript
interface OverlayConfig {
  enabled: boolean;
  jobSites: string[];        // user-managed list
  fallbackMode: "basic" | "secondary" | "primary";
  position: { x: number; y: number };
  fingerprint?: string;
  lastFingerprintUpdate?: string;
  primaryEndpoint?: { baseUrl: string; model: string; apiKey?: string; provider: string };
  secondaryEndpoint?: { baseUrl: string; model: string; apiKey?: string; provider: string };
  secondaryUse?: SecondaryUse;
}
```

---

## Development Sequence

### Phase 1 — Foundation (this sprint)

| Step | What | Files |
|------|------|-------|
| 1 | Build config: entry points, manifest, copy steps | `vite.ext.config.ts`, `manifest.json` |
| 2 | Overlay shell: draggable, expand/collapse, position memory | `overlay.ts`, `overlay.css` |
| 3 | Config popup: toggle, fallback, generate fingerprint, manage sites | `popup.html`, `popup.tsx` |
| 4 | Background routing: messages, storage forwarding | `background.ts` |
| 5 | Auto-sync fingerprint via IndexedDB changes | `fingerprint.ts`, background |

### Phase 2 — Intelligence (next)

| Step | What | Files |
|------|------|-------|
| 6 | Gemini Nano adapter | `gemini-nano.ts` |
| 7 | Remote fallback HTTP client | `api-client.ts` |
| 8 | Match scoring: Nano + fallback | overlay integration |

### Phase 3 — Features (next)

| Step | What |
|------|------|
| 9 | Smart extraction + summarization in overlay |
| 10 | Import flow + pending analyses sidebar |
| 11 | Main app Settings tab for job sites |
