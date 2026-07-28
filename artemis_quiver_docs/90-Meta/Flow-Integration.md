---
tags: [integration, flow, cross-app, config]
status: draft
last_updated: 2026-07-24
---

# Flow Integration — Quiver-Side Plan

> How Artemis Quiver detects, communicates with, and orchestrates Artemis Flow as a background search engine.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Detection & Health Check](#detection--health-check)
3. [Flow Engine Panel (Config Page)](#flow-engine-panel-config-page)
4. [Batch Analysis Endpoint](#batch-analysis-endpoint)
5. [Schema Additions](#schema-additions)
6. [Cross-App Status Sync](#cross-app-status-sync)
7. [Unified Interface (Future)](#unified-interface-future)

---

## Design Principles

| Principle | Rule |
|-----------|------|
| **Zero dependency** | If Flow is not running, Quiver shows nothing Flow-related. No errors, no broken UI. |
| **Graceful degradation** | If Flow disconnects mid-session, Quiver continues with cached data. |
| **User consent** | Flow integration is opt-in. User must configure and start the engine. |
| **Local communication only** | Both apps discover each other on localhost. No remote connections. |

---

## Detection & Health Check

### On App Mount

In `App.tsx` or `Config.tsx`, ping Flow's health endpoint:

```typescript
// src/app/services/flowBridge.ts (new file)

const FLOW_HEALTH_URL = "http://localhost:8000/health";

interface FlowStatus {
  running: boolean;
  version?: string;
  totalJobs?: number;
  strategy?: {
    keywords: string[];
    locations: string[];
  };
  lastRun?: string;
}

async function checkFlowHealth(): Promise<FlowStatus> {
  try {
    const res = await fetch(FLOW_HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { running: false };
    const data = await res.json();
    return { running: true, ...data };
  } catch {
    return { running: false };
  }
}
```

When `running === true`:
- Show "Flow Engine" section in Config page
- Add Flow status indicator in sidebar (subtle dot: green/red)
- Enable batch analysis features

When `running === false`:
- Hide all Flow-related UI
- No errors, no broken components

---

## Flow Engine Panel (Config Page)

### Location

New section in `src/app/pages/Config.tsx`, below LLM provider config.

### UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Flow Engine                                             │
│                                                             │
│  ● Connected  v0.4    ● Strategy: "Rust backend"           │
│                                                             │
│  ┌──────┬────────────────────────────────────────────────┐  │
│  │       │  Search Settings                               │  │
│  │ [▶]   │  Batch size:  [10]  jobs per cycle             │  │
│  │ Start │  Parallel:    [3]   concurrent analyses        │  │
│  │       │  Min score:   [65]  % threshold                │  │
│  │       │  Auto-archive below threshold  [x]             │  │
│  │       │  Continuous mode              [x]              │  │
│  │       │                                                │  │
│  │       │  [Run Once]  [Start Engine]  [Stop Engine]     │  │
│  └──────┴────────────────────────────────────────────────┘  │
│                                                             │
│  Status: ● Idle  |  Last run: 2m ago  |  47 jobs found     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 10/10 complete      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State Machine

```
Idle → Running (Continuous) → Idle
Idle → Running (One Batch) → Idle
Running → Paused (user pause) → Running
```

### Controls

| Control | Action | API Call |
|---------|--------|----------|
| **Run Once** | Execute single batch | `POST /api/pipeline/search?batch={size}` |
| **Start Engine** | Begin continuous loop | `POST /api/pipeline/daemon/start` |
| **Stop Engine** | Halt continuous loop | `POST /api/pipeline/daemon/stop` |
| **Batch size** | Jobs per cycle | Passed as param |
| **Parallel** | Concurrent LLM calls | Passed to `batch-analyze` |
| **Min score** | Auto-archive threshold | Written to Flow config |
| **Auto-archive** | Toggle archiving | Written to Flow config |

### Status Polling

When engine is running, poll every 5 seconds:

```
GET /api/pipeline/daemon/status
Response: {
  "state": "running" | "idle" | "error",
  "cycle": 3,
  "jobs_this_cycle": 7,
  "total_jobs_found": 142,
  "total_analyzed": 89,
  "total_archived": 53,
  "last_run": "2026-07-24T14:30:00Z",
  "errors": []
}
```

---

## Batch Analysis Endpoint

Quiver exposes a lightweight HTTP endpoint for Flow to send batch analysis requests.

### Implementation Options

**Option A: Embedded HTTP server in Quiver (recommended)**

Start a tiny HTTP server alongside the Vite dev server that handles Flow's batch requests:

```typescript
// src/app/services/flowBridge.ts
// Quiver runs a small HTTP listener on :5174

POST /api/quiver/batch-analyze
Content-Type: application/json

Body: {
  "jobs": [
    {
      "id": "uuid",
      "title": "Senior Rust Engineer",
      "company": "Anthropic",
      "description": "Full job description text...",
      "url": "https://..."
    }
  ],
  "profile": "markdown profile text",
  "parallelism": 3,
  "model": "deep"  // "quick" for pre-vet only, "deep" for full analysis
}

Response: {
  "results": [
    {
      "id": "uuid",
      "score": 82,
      "reasoning": "Strong match: 5/6 rubric categories align",
      "shortDescription": "Senior Rust role building distributed systems...",
      "analysisSessionId": "quiver-uuid",
      "cvSuggestions": ["Add distributed systems to summary", "Highlight Rust mentorship"],
      "error": null
    }
  ],
  "errors": []  // per-job errors, doesn't fail the batch
}
```

**Option B: Write to shared JSON file**

Simpler, no HTTP needed on Quiver's side. Flow writes batch requests to a temp file, Quiver polls it.

```
Recommended: Option A. HTTP is cleaner, gives real-time control, and avoids file-locking issues.
```

### Adding the Server to Quiver

```typescript
// In vite.config.ts or a new server.ts:
// Start a small Express/Hono server on :5174 when Vite starts
// Route requests to Quiver's LLM service layer

// Or simpler: keep it in Config.tsx as a toggleable feature
// "Enable Flow Bridge" → starts a tiny Bun/Node HTTP listener
```

**Even simpler**: Skip the HTTP server. Quiver already runs on `localhost:5173`. Add a simple route handler via Vite's middleware or a service worker that Flow can POST to. Or use Vite's `server.proxy` to route Flow's calls.

For MVP: Quiver calls Flow's API (`/api/pipeline/search`), Flow completes the search, then Quiver polls `/api/jobs?status=new` and analyzes whatever it finds. No batch endpoint needed on Quiver side initially.

---

## Schema Additions

### Quiver's `analysisSessions` — New Fields

```typescript
interface AnalysisSessionRecord {
  // ... existing fields
  flowJobId?: string;
  // The Flow jobs.id that this analysis corresponds to
  // Allows Quiver to link results back to Flow's kanban

  flowScore?: number;
  // Score written back to Flow (mirrors this session's result.score)

  flowStatus?: "pending" | "synced" | "failed";
  // Whether the score/status was successfully written back to Flow
}
```

### IndexedDB Migration

```typescript
// src/app/db/migrations.ts
const MIGRATIONS = [
  // ... existing migrations
  {
    version: 4,
    upgrade: (db) => {
      // flowJobId and flowScore are optional, no schema change needed
      // Just document the new optional fields
    }
  }
];
```

`flowJobId` and `flowScore` are optional fields on existing records. No breaking schema change — Dexie.js handles missing fields gracefully.

---

## Cross-App Status Sync

### Write Flow Status from Quiver

When Quiver completes an analysis:

```typescript
async function syncAnalysisToFlow(analysis: AnalysisSessionRecord) {
  if (!analysis.flowJobId) return;

  try {
    await fetch(`http://localhost:8000/api/jobs/${analysis.flowJobId}/score`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: analysis.result.score,
        fit_reasoning: analysis.markdown,
        status: "analyzed",
        quiver_session_id: analysis.id,
        quiver_notes: JSON.stringify({
          cvGenerated: analysis.result.cvGenerated,
          clGenerated: analysis.result.clGenerated,
          recommendations: analysis.result.recommendations,
        }),
      }),
    });
  } catch (err) {
    // Flow not running? Log and continue. No hard failure.
    console.warn("Failed to sync analysis to Flow:", err);
  }
}
```

### Poll Flow for New Jobs

When Flow is running, Quiver can poll for newly discovered jobs:

```typescript
let pollInterval: number | null = null;

function startPollingFlow() {
  const FLOW_API = "http://localhost:8000/api/jobs";

  pollInterval = setInterval(async () => {
    const res = await fetch(`${FLOW_API}?status=analyzed&limit=5`);
    const jobs = await res.json();

    // Update a "Flow Results" section in Quiver's sidebar
    // User can click to open each job in Analysis Hub
  }, 10000); // every 10 seconds
}
```

### Status Mapping

| Quiver Action | Flow Status Update | Flow Column |
|---------------|-------------------|-------------|
| Analysis started | `analyzing` | Kanban: Analyzing |
| Analysis complete | `analyzed` + score + reasoning | Kanban: Analyzed (sorted by score) |
| User generates CV | Append to `quiver_notes` | Job detail: shows CV was generated |
| User marks Applied | `applied` | Kanban: Applied |
| User writes note | Append to `quiver_notes` | Job detail: shows note |

---

## Unified Interface (Future Phase)

### When Both Apps Are Detected

Offer a settings toggle:

```
┌────────────────────────────────────┐
│  Interface Mode                    │
│                                    │
│  ○ Standalone (current)           │
│  ● Unified — Use Quiver as main   │
│    shell, embed Flow features      │
│                                    │
│  [Save & Reload]                   │
└────────────────────────────────────┘
```

### Unified Mode Layout

When enabled, Quiver's sidebar gets additional tabs:

```
🏹 Artemis
├── 🔍 Discover      ← Flow search UI (embedded)
├── 📊 Kanban        ← Flow kanban (embedded)
├── 📋 Analyze       ← existing Analysis Hub
├── 📝 Profile       ← existing Profile Workspace
├── 📄 CV Builder    ← existing
├── ✉️ Cover Letter  ← existing
└── ⚙️ Config        ← existing + Flow Engine section
```

**Implementation options:**

1. **Iframe**: Embed Flow's frontend pages in Quiver tabs. Simplest, but two React apps compete for resources.
2. **Shared component library**: Extract Flow's SearchPage and KanbanBoard into a shared package. Both apps import them. Most work, best UX.
3. **Quiver becomes the shell**: Run Flow backend-only (no frontend server). Quiver implements Search + Kanban pages using Flow's API. Flow's React frontend becomes optional/deprecated.

**Recommendation**: Start with (1) iframe for MVP of unified mode. Move to (3) if integration proves valuable. Skip (2) — too much overhead for a personal project.

---

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/app/services/flowBridge.ts` | **Create** | All Flow API calls, health check, status polling |
| `src/app/components/flow/FlowEnginePanel.tsx` | **Create** | Config page UI for Flow controls |
| `src/app/components/flow/FlowEngineConfig.tsx` | **Create** | Batch size, parallelism, threshold inputs |
| `src/app/components/flow/FlowStatusIndicator.tsx` | **Create** | Sidebar dot showing Flow connection status |
| `src/app/pages/Config.tsx` | **Modify** | Import and render FlowEnginePanel |
| `src/app/components/navigation/Sidebar.tsx` | **Modify** | Optionally show FlowStatusIndicator |
| `src/app/db/migrations.ts` | **Modify** | Document new optional fields (no schema change needed) |
| `src/app/context/AnalysisContext.tsx` | **Modify** | Call `syncAnalysisToFlow()` after analysis completes |
| `src/app/providers/AppProviders.tsx` | **Modify** | Optionally initialize flowBridge |

---

## References

- [[../90-Meta/CHANGELOG|Changelog]]
- `F:\Dev\Artemis_Flow\artemis_flow_docs\90-Meta\INTEGRATION_STRATEGY.md`
- `F:\Dev\Artemis_Flow\artemis_flow_docs\90-Meta\STRATEGIC_REVIEW_2026.md`