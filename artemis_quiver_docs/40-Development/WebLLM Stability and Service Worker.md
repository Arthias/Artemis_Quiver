---
tags: [development, webllm, architecture, implementation]
status: in-progress
last_updated: 2026-07-09
---

# WebLLM Stability & Service Worker

Implementation plan for making WebLLM in-browser mode production-ready. Covers 6 phases from service worker integration through testing.

> [!WARNING] Prerequisites
> Read [[../20-APIs/Local LLM Integration]] first for provider architecture context. This document assumes familiarity with the WebLLM adapter, provider registry, and dual-slot routing.

---

## Architecture Decision: Service Worker Mode

**Decision:** Use `CreateServiceWorkerMLCEngine()` instead of `CreateMLCEngine()`.

| Aspect | `CreateMLCEngine()` | `CreateServiceWorkerMLCEngine()` |
|---|---|---|
| Main thread blocking | Yes — model ops block UI | No — SW handles all GPU work |
| Page navigation | Model unloaded, must re-init | Model persists in SW |
| Memory pressure | Tab killed more easily | SW has separate lifecycle |
| Implementation complexity | Low | Medium (SW registration + messaging) |
| API surface | `MLCEngine` | `ServiceWorkerMLCEngine` + `ServiceWorkerMLCEngineHandler` |

Desktop/Electron apps use `CreateMLCEngine()`; web apps with navigation use SW mode. Since this is a SPA that must survive navigation and keep the main thread free, **SW mode is the default**.

**Fallback:** If `navigator.serviceWorker` is unavailable (certain incognito modes, some embedded views), fall back to `CreateMLCEngine()`.

---

## Phase 1: Service Worker Integration

**Goal:** Register a dedicated WebLLM service worker, route all `@mlc-ai/web-llm` calls through it, keep main thread free.

### New Files

| File | Purpose |
|---|---|
| `src/app/services/provider/webllm-sw.ts` | Service worker entry: registers `ServiceWorkerMLCEngineHandler` |
| `src/app/utils/sw-utils.ts` | SW registration helper with fallback logic |

### Modified Files

| File | Changes |
|---|---|
| `WebLLMAdapter.ts` | Add `useServiceWorker` config flag, SW init path, message-based `chatCompletion()` |
| `registry.ts` | Pass `useServiceWorker: true` to WebLLMAdapter constructor |
| `vite.config.ts` | Add `webllm-sw.ts` as build entry for SW output |
| `vite.ext.config.ts` | Copy SW entry to `Artemis_Quiver_extension/` |
| [[../20-APIs/Local LLM Integration]] | Document SW mode in WebLLM row |

### Implementation Steps

1. **Create `webllm-sw.ts`**:

```typescript
// @ts-ignore — web-llm SW types
import { ServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

let handler: ServiceWorkerMLCEngineHandler | null = null;

self.addEventListener("activate", () => {
  handler = new ServiceWorkerMLCEngineHandler();
  self.clients.claim();
});
```

2. **Create `sw-utils.ts`**:

```typescript
export async function registerWebLLMSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/webllm-sw.js", {
      scope: "/",
      type: "module",
    });
  } catch {
    return null;
  }
}
```

3. **Update `WebLLMAdapter.ts`** — Add `useServiceWorker` field, SW init path:

- Constructor accepts `{ useServiceWorker?: boolean }`
- `init()`: if `useServiceWorker`, call `registerWebLLMSW()` first, then `CreateServiceWorkerMLCEngine()` with same model/initProgressCallback
- `chatCompletion()`: identical API — `ServiceWorkerMLCEngine` has same `.chatCompletion()` interface
- Fallback: if SW registration fails, call `CreateMLCEngine()` and set `useServiceWorker = false`

4. **Update `vite.config.ts`**:

```typescript
build: {
  rollupOptions: {
    input: {
      app: "index.html",
      "webllm-sw": "src/app/services/provider/webllm-sw.ts",
    },
  },
},
```

> [!WARNING] Extension Build
> The SW entry generates `dist/webllm-sw.js`. During `build:ext`, this file must be copied to `Artemis_Quiver_extension/webllm-sw.js` so the extension's overridden URL scope can use it. Update `vite.ext.config.ts` to include this entry.

5. **Update `registry.ts`**:

```typescript
const webllmAdapter = new WebLLMAdapter({ useServiceWorker: true });
```

---

## Phase 2: Crash Recovery — Auto-Downgrade on Device Lost

**Goal:** Replace the permanent `_deviceLost` flag with a `_consecutiveFailures` counter that triggers automatic model downgrade. After downgrade, the user gets a notification that they can upgrade back if memory conditions improve.

### Modified Files

| File | Changes |
|---|---|
| `WebLLMAdapter.ts` | Replace `_deviceLost` with `_consecutiveFailures` + `_currentModelIndex` + `_maxFailuresBeforeDowngrade` |
| `Config.tsx` | Update `formatTestError()` to show downgrade info |

### Behavior

1. `_consecutiveFailures` starts at 0. `_currentModelIndex` starts at the user's selected model index in `WEBLLM_MODELS`.
2. On device-lost (or any GPU error in `init()` / `chatCompletion()` / `ensureEngine()`):
   - Increment `_consecutiveFailures`
   - If `_consecutiveFailures >= _maxFailuresBeforeDowngrade` (default: 2):
     - Decrement `_currentModelIndex` (move to next **smaller** model in `WEBLLM_MODELS`, sorted by `vramGB` ascending)
     - Call `engine.reload()` or re-init with the new model
     - Reset `_consecutiveFailures` to 0
     - Emit a status event: `{ type: "downgrade", from: oldModel, to: newModel }`
3. `WEBLLM_MODELS` must be sorted by `vramGB` ascending for this to work correctly (it already is — verify ordering).
4. If `_currentModelIndex` reaches 0 and still fails, emit `{ type: "fatal", message: "WebLLM unavailable on this device" }`.

### Status Events Interface

```typescript
type WebLLMStatusEvent =
  | { type: "loading"; progress: number }
  | { type: "ready"; model: string }
  | { type: "downgrade"; from: string; to: string }
  | { type: "fatal"; message: string }
  | { type: "unloaded" };
```

Add `onStatus(cb: (event: WebLLMStatusEvent) => void): void` to the adapter interface so the UI can subscribe.

### Config UI Updates

In `Config.tsx`, the `formatTestError()` function currently checks for "WebGPU device lost" substring. Replace with:

```typescript
function formatTestError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("WebGPU") && msg.includes("device lost")) {
    return "WebGPU device crashed. Auto-downgrading to a smaller model. Close other GPU-heavy tabs, restart Chrome if this persists.";
  }
  // ...existing cases...
}
```

### Catalog Unification

`WEBLLM_MODELS` (4 curated models: Qwen3.5-2B/4B/9B + DeepSeek-R1-7B) in `WebLLMAdapter.ts` is the canonical list. Delete the duplicate `WEBLLM_CATALOG` in:
- `Config.tsx`
- `OnboardingWizard.tsx`

Both should import `WEBLLM_MODELS` from `WebLLMAdapter.ts` instead.

---

## Phase 3: VRAM Detection & Auto-Sizing

**Goal:** Before download or load, estimate available VRAM and recommend the appropriate model. Skip models that exceed available VRAM, or auto-select the best fit.

### New Files

| File | Purpose |
|---|---|
| `src/app/utils/vram.ts` | VRAM estimation heuristics |

### Modified Files

| File | Changes |
|---|---|
| `WebLLMAdapter.ts` | Add `estimateVRAM()`, `recommendModel()`, `getDeviceInfo()` |
| `Config.tsx` | Show VRAM info + recommended model in WebLLM config panel |
| `OnboardingWizard.tsx` | Auto-select model based on VRAM estimate |
| `defaults.ts` | Update `DEFAULT_LLM_CONFIG` model |

### VRAM Estimation Heuristics

```typescript
interface DeviceInfo {
  vendor: string;
  architecture: string;
  deviceMemory: number;   // navigator.deviceMemory (GB), always integer
  vramEstimate: number;   // estimated VRAM in GB (float)
  unreliable: boolean;    // true if we had to guess
}

async function estimateAvailableVRAM(): Promise<DeviceInfo> {
  // 1. navigator.deviceMemory — Chrome-only, returns total system RAM in GB
  //    Integrated GPUs share system RAM → ~70% usable for GPU
  //    Dedicated GPUs don't report via deviceMemory → use heuristic
  const systemRAM = navigator.deviceMemory ?? 8;

  // 2. GPU adapter info — vendor, architecture
  let gpuInfo = { vendor: "unknown", architecture: "unknown" };
  if (navigator.gpu) {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter) {
      const info = await adapter.requestAdapterInfo();
      gpuInfo = { vendor: info.vendor ?? "unknown", architecture: info.architecture ?? "unknown" };
    }
  }

  // 3. Heuristic VRAM estimate
  const isIntegrated = isIntegratedGPU(gpuInfo.vendor, gpuInfo.architecture);
  const vramEstimate = isIntegrated
    ? systemRAM * 0.7
    : Math.min(systemRAM * 0.5, getDedicatedVRAMHeuristic(gpuInfo.vendor));

  // 4. If engine already active, use getMaxStorageBufferBindingSize() for real device limit
  //    (but this requires an active GPU device, so not available pre-init)

  return { ...gpuInfo, deviceMemory: systemRAM, vramEstimate, unreliable: !navigator.deviceMemory };
}

function isIntegratedGPU(vendor: string, architecture: string): boolean {
  const integratedVendors = ["qualcomm", "arm", "apple silicon"];
  const integratedArchitectures = ["integrated", "apple", "mali", "adreno"];
  const dedicatedVendors = ["nvidia", "amd", "intel"];
  // Intel UHD/Iris → integrated; Intel Arc → dedicated
  if (dedicatedVendors.some(v => vendor.toLowerCase().includes(v)) &&
      !architecture.toLowerCase().includes("integrated")) return false;
  return true; // conservative default
}
```

### Model Recommendation

```typescript
function recommendModel(models: typeof WEBLLM_MODELS, vramGB: number): string {
  const safeVRAM = vramGB * 0.8; // 20% safety margin
  let best = models[0]!.model;   // default to smallest
  for (const m of models) {
    if (m.vramGB <= safeVRAM) best = m.model;
    else break;
  }
  return best;
}
```

### Default Model Change

In `defaults.ts`, the default WebLLM model is:
```typescript
model: "Qwen3.5-2B-q4f16_1-MLC"  // 2.2 GB VRAM — lightest curated card
```

This is a safe default that runs on integrated/low VRAM. VRAM auto-sizing recommends larger cards (Qwen3.5-4B, DeepSeek-R1-7B, Qwen3.5-9B) if memory permits.

---

## Phase 4: Streaming Support

**Goal:** Add `streamCompletion()` to `WebLLMAdapter` using `chatCompletion({ stream: true })`. Wire through the service layer so Analysis Hub and Builder pages can show token-by-token output.

### Modified Files

| File | Changes |
|---|---|
| `WebLLMAdapter.ts` | Add `streamCompletion()` method |
| `ProviderAdapter.ts` | Add optional `streamCompletion` to interface |
| `llmService.ts` | Add `streamCompletion()` routing |
| Service consumers | Optional: consume streamed tokens |

### Implementation

```typescript
// ProviderAdapter.ts — add optional method
interface ProviderAdapter {
  chatCompletion(...): Promise<string>;
  streamCompletion?(messages: ChatMessage[], endpoint: ModelEndpoint, options?: {
    signal?: AbortSignal;
    onToken?: (token: string) => void;
  }): Promise<string>;  // Resolves when stream is complete
  listModels(...): Promise<string[]>;
  testConnection(...): Promise<string>;
}
```

```typescript
// WebLLMAdapter.ts
async streamCompletion(
  messages: ChatMessage[],
  _endpoint: ModelEndpoint,
  options?: { signal?: AbortSignal; onToken?: (token: string) => void }
): Promise<string> {
  await this.ensureEngine();
  let fullContent = "";
  const stream = await this._engine!.chatCompletion({
    messages: this.formatMessages(messages),
    stream: true,
  });
  for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
    if (options?.signal?.aborted) {
      this._engine!.interruptGenerate();
      throw new AppError(ErrorCodes.LLM_TIMEOUT, "Generation cancelled");
    }
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      fullContent += delta;
      options?.onToken?.(delta);
    }
  }
  return fullContent;
}
```

```typescript
// llmService.ts
async streamCompletion(
  messages: ChatMessage[],
  options?: { signal?: AbortSignal; onToken?: (token: string) => void }
): Promise<string> {
  const adapter = getAdapter(localConfig.provider);
  if (!adapter.streamCompletion) {
    return this.chatCompletion(messages, options); // fallback
  }
  return adapter.streamCompletion(messages, this.getEffectiveEndpoint("primary"), options);
}
```

> [!NOTE] Provider Interface
> Only `WebLLMAdapter` implements `streamCompletion()` initially. Cloud adapters can be extended later. The service layer falls back to `chatCompletion()` when streaming is unavailable.

---

## Phase 5: Download UX & Cancellation

**Goal:** Replace the current download modal with a robust flow: show model size + VRAM estimate before starting, provide cancel button during download, handle partial downloads, allow model deletion.

### Modified Files

| File | Changes |
|---|---|
| `Config.tsx` | WebLLM config section: VRAM display, recommended model, cancel button |
| `OnboardingWizard.tsx` | WebLLM step: auto-select + VRAM info |
| `WebLLMAdapter.ts` | Add `unload()`, `interruptDownload()`, `getDownloadProgress()`, `hasModelInCache()` |

### Implementation

```typescript
// WebLLMAdapter.ts additions

async interruptDownload(): Promise<void> {
  this._onProgress = null;
  if (this._swRegistration) {
    await this._swRegistration.unregister();
    this._swRegistration = null;
  }
  await this.unload();
}

async hasModelInCache(modelId: string): Promise<boolean> {
  return this._engine?.hasModelInCache?.(modelId) ?? false;
}
```

**Download Cancellation Constraints:**
- `@mlc-ai/web-llm` v0.2.84 has no official download cancellation API
- Workaround: call `this._engine?.unload()` to tear down the engine mid-download, or in SW mode unregister the SW
- Partial downloads may be cached by the browser Cache API — retrying reuses already-downloaded shards
- This is best-effort, not guaranteed clean

### UI Flow

1. **Pre-download confirmation**: Model name + size, estimated VRAM usage, device VRAM estimate, "Model runs entirely in-browser" note
2. **Download**: Progress bar via `initProgressCallback`, cancel button visible
3. **Cancel**: Confirmation dialog ("Cancel download? Partial progress will be cached."), calls `interruptDownload()`, resets UI
4. **Complete**: "Ready" badge, "Test Connection" enabled, "Unload Model" button
5. **Delete Model**: `caches.delete(engineCacheName)` — unsupported directly; call `unload()` and re-download to overwrite on next load

---

## Phase 6: Testing

**Goal:** Comprehensive test coverage for WebLLM adapter with mocked `@mlc-ai/web-llm`. Add adapter-level tests for all crash/retry/downgrade/streaming/unload paths.

### New Test File

`src/app/services/provider/__tests__/WebLLMAdapter.test.ts`

### Test Scenarios

| Test | Description |
|---|---|
| init success | Valid init returns true, sets `_ready` flag |
| init device-lost | GPU error in init → auto-downgrade to smaller model |
| init all models fail | All models exhaust → fatal event emitted |
| chatCompletion success | Normal completion returns content |
| chatCompletion device-lost | GPU error mid-generation → auto-downgrade |
| consecutiveFailures threshold | 2 failures trigger downgrade (configurable) |
| streaming success | Stream completes with all tokens |
| streaming abort | Abort signal cancels stream mid-generation |
| unload | `unload()` sets `_ready` to false, engine torn down |
| interruptDownload | `interruptDownload()` stops pending download |
| hasModelInCache | Returns cached status |
| estimateVRAM | Returns `DeviceInfo` with reasonable defaults |
| recommendModel | Returns smallest model for low VRAM, largest for high VRAM |
| SW registration failure | Falls back to `CreateMLCEngine()` |

### Mock Strategy

```typescript
vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: vi.fn(),
  CreateServiceWorkerMLCEngine: vi.fn(),
}));

Object.defineProperty(navigator, "serviceWorker", {
  value: { register: vi.fn().mockResolvedValue({ unregister: vi.fn() }) },
  configurable: true,
});

Object.defineProperty(navigator, "gpu", {
  value: { requestAdapter: vi.fn() },
  configurable: true,
});
```

### Service Layer Tests

Add to `llmService.test.ts`:
- `streamCompletion()` routing to WebLLM adapter
- Fallback to `chatCompletion()` when streaming unavailable on provider

---

## Summary: Implementation Order

| Phase | Dependencies | Effort | Risk | Priority |
|---|---|---|---|---|
| L1: SW Integration | None | Medium | High | High |
| L2: Auto-Downgrade | None | Low | Low | **Highest** |
| L3: VRAM Detection | None | Low | Low | High |
| L4: Streaming | L1 | Medium | Medium | Medium |
| L5: Download UX | L3 | Medium | Low | Medium |
| L6: Tests | All | Medium | None | High |

**Recommended build order:** L2 → L3 → L5 → L1 → L4 → L6

L2 (auto-downgrade) is the highest-impact fix for existing users — it requires no new infrastructure and directly fixes the "device lost = dead" UX. SW mode (L1) is architecturally important but higher risk; do it after crash recovery is solid.

---

## Cross-References

- [[../20-APIs/Local LLM Integration]] — Provider architecture context
- [[../60-Roadmap/Plan]] — Sprint planning (Sprint 9c)
- [[../10-Architecture/Context Providers]] — State flow for status events
- [WebLLMAdapter.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/provider/WebLLMAdapter.ts) — Target file
- [@mlc-ai/web-llm docs](https://www.npmjs.com/package/@mlc-ai/web-llm) — API reference
