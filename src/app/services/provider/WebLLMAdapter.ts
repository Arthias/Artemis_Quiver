import type { ChatMessage, ModelEndpoint } from "../../types/llm";
import type { ProviderAdapter } from "./ProviderAdapter";
import type { MLCEngineInterface, InitProgressReport, AppConfig, ChatOptions } from "@mlc-ai/web-llm";
import { estimateAvailableVRAM, recommendModel } from "../../utils/vram";
import { registerWebLLMSW } from "../../utils/sw-utils";

export interface WebLLMModelEntry {
  id: string;
  name: string;
  sizeGB: number;
  vramGB: number;
  descKey?: string;
  /**
 * Runtime overrides applied to the model's mlc-chat-config via
 * `ModelRecord.overrides`. Used to work around invalid/shipped configs —
 * e.g. WebLLM 0.2.84 rejected models with BOTH context_window_size and
 * sliding_window_size positive. All curated models below are confirmed to ship
 * a valid config with `context_window_size: 4096`, so no overrides are needed.
 */
  overrides?: ChatOptions;
}

/** Curated @mlc-ai/web-llm model IDs from prebuiltAppConfig (v0_2_84/base).
 * Sorted by vramGB ascending for auto-downgrade stepping.
 * Only 4 cards, spread across average-hardware tiers:
 *   1. Qwen3.5-2B  — integrated / very low VRAM; still capable of job-eval + CV gen
 *   2. Qwen3.5-4B  — low discrete GPU
 *   3. DeepSeek-R1-Distill-Qwen-7B — mid discrete GPU; reasoning for honesty checks
 *   4. Qwen3.5-9B  — upper tier; best quality
 * Gemma 4 (E2B/E4B) is not shipped by WebLLM 0.2.84 and therefore unavailable. */
export const WEBLLM_MODELS = [
  { id: "Qwen3.5-2B-q4f16_1-MLC", name: "Qwen3.5 (2B)", sizeGB: 1.9, vramGB: 2.2 },
  { id: "Qwen3.5-4B-q4f16_1-MLC", name: "Qwen3.5 (4B)", sizeGB: 3.2, vramGB: 3.9 },
  { id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC", name: "DeepSeek R1 (7B)", sizeGB: 4.4, vramGB: 5.1 },
  { id: "Qwen3.5-9B-q4f16_1-MLC", name: "Qwen3.5 (9B)", sizeGB: 7.0, vramGB: 6.4 },
] as const;

export type WebLLMStatusEvent =
  | { type: "loading"; progress: number }
  | { type: "ready"; model: string }
  | { type: "downgrade"; from: string; to: string }
  | { type: "fatal"; message: string }
  | { type: "unloaded" };

/**
 * Patterns indicating a fatal, unrecoverable-in-place failure that should
 * trigger auto-downgrade / a fatal status event:
 *  - GPU device loss (WebGPU context lost, driver crash, requestDevice, etc.)
 *  - A dead/unresponsive service worker channel — e.g. the SW itself was
 *    killed under memory pressure. This surfaces as a closed message port,
 *    a "disconnected" postMessage failure, or (via our own SW_ROUNDTRIP_TIMEOUT_MS
 *    race below) a plain timeout when the SW never replies at all.
 */
const FATAL_ERROR_PATTERNS = /device lost|device removed|requestDevice|DXGI_ERROR|message port closed|disconnected|no response|timed out/i;

function isFatalError(err: unknown): boolean {
  return FATAL_ERROR_PATTERNS.test(err instanceof Error ? err.message : String(err));
}

/** Max time to wait for a reply over the WebLLM service-worker message channel
 * before treating it as a dead/unresponsive service worker. */
const SW_ROUNDTRIP_TIMEOUT_MS = 30_000;

export class WebLLMAdapter implements ProviderAdapter {
  private engine: MLCEngineInterface | null = null;
  private _loadedModelId: string | null = null;
  private _progressCallback: ((pct: number) => void) | null = null;
  private _initPromise: Promise<void> | null = null;
  private _useServiceWorker: boolean;
  private _swRegistration: ServiceWorkerRegistration | null = null;

  /** User's originally configured model — detects when user changes model in settings */
  private _originalModelId: string | null = null;
  /** Actual model in use (may be downgraded from original) */
  private _effectiveModelId: string | null = null;
  /** Index into WEBLLM_MODELS for the current effective model */
  private _currentModelIndex = -1;
  /** Consecutive device-lost failures before triggering downgrade */
  private _consecutiveFailures = 0;
  private readonly _maxFailuresBeforeDowngrade = 2;
  private _statusCallback: ((event: WebLLMStatusEvent) => void) | null = null;

  constructor(options?: { useServiceWorker?: boolean }) {
    this._useServiceWorker = options?.useServiceWorker ?? false;
  }

  setProgressCallback(cb: (pct: number) => void) {
    this._progressCallback = cb;
  }

  onStatus(cb: (event: WebLLMStatusEvent) => void): void {
    this._statusCallback = cb;
  }

  private _emitStatus(event: WebLLMStatusEvent): void {
    this._statusCallback?.(event);
  }

  /**
   * Races a promise that goes over the service-worker message channel against
   * a timeout, so a silently-dead service worker (killed under memory
   * pressure, never posts a reply) surfaces as a clear timeout error instead
   * of hanging forever. No-op (returns the promise unmodified) when this
   * adapter isn't running in service-worker mode.
   */
  private _withSwTimeout<T>(promise: Promise<T>): Promise<T> {
    if (!this._useServiceWorker) return promise;
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          "WebLLM service worker did not respond — message port closed or timed out."
        ));
      }, SW_ROUNDTRIP_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]);
  }

  /**
   * Try to downgrade to the next smaller model after consecutive failures.
   * Updates _effectiveModelId and resets engine state on success.
   * Returns true if downgraded, false if no smaller model is available.
   */
  private async _tryDowngrade(): Promise<boolean> {
    this._consecutiveFailures++;

    if (this._consecutiveFailures >= this._maxFailuresBeforeDowngrade && this._currentModelIndex > 0) {
      const fromModel = this._effectiveModelId || this._loadedModelId || "unknown";

      this._currentModelIndex--;
      const newModelEntry = WEBLLM_MODELS[this._currentModelIndex];
      if (!newModelEntry) return false;

      this._effectiveModelId = newModelEntry.id;
      this._loadedModelId = null;
      this.engine = null;
      this._initPromise = null;
      this._consecutiveFailures = 0;

      this._emitStatus({ type: "downgrade", from: fromModel, to: newModelEntry.id });
      return true;
    }

    if (this._currentModelIndex <= 0 && this._consecutiveFailures >= this._maxFailuresBeforeDowngrade) {
      this._emitStatus({ type: "fatal", message: "WebLLM unavailable on this device — all models failed." });
    }

    return false;
  }

  /** Internal init with retry loop for auto-downgrade. */
  private async _doInit(modelId: string): Promise<void> {
    const mod = await import("@mlc-ai/web-llm");
    const createEngine = this._useServiceWorker
      ? mod.CreateServiceWorkerMLCEngine
      : mod.CreateMLCEngine;
    const prebuilt: AppConfig = mod.prebuiltAppConfig as AppConfig;

    for (let attempt = 0; attempt < WEBLLM_MODELS.length; attempt++) {
      const currentModelId = this._effectiveModelId || modelId;
      this.engine = null;
      this._loadedModelId = null;

      try {
        // Apply per-model overrides to work around invalid shipped configs
        // (e.g. gemma3-1b ships with both context_window_size and
        // sliding_window_size positive, which WebLLM 0.2.84 rejects).
        const entry = WEBLLM_MODELS.find((m) => m.id === currentModelId) as
          | (WebLLMModelEntry & { id: string })
          | undefined;
        const appConfig = entry?.overrides
          ? this._withModelOverrides(prebuilt, currentModelId, entry.overrides)
          : undefined;

        // When running in service-worker mode, this round-trips through the
        // SW's message channel — race it against a timeout so a dead SW
        // surfaces as a fatal error instead of hanging forever.
        const enginePromise: Promise<MLCEngineInterface> = createEngine(currentModelId, {
          appConfig,
          initProgressCallback: (report: InitProgressReport) => {
            const pct = Math.round(report.progress * 100);
            this._progressCallback?.(pct);
            this._emitStatus({ type: "loading", progress: pct });
          },
        });
        this.engine = await this._withSwTimeout(enginePromise);
        this._loadedModelId = currentModelId;
        this._effectiveModelId = currentModelId;
        this._consecutiveFailures = 0;
        this._emitStatus({ type: "ready", model: currentModelId });
        return;
      } catch (err) {
        if (isFatalError(err)) {
          const downgraded = await this._tryDowngrade();
          if (downgraded) continue;
          throw new Error(
            "WebGPU device was lost (or the WebLLM service worker stopped responding) and all recovery attempts failed. Close other GPU-heavy tabs, restart Chrome."
          );
        }
        throw err;
      }
    }
  }

  /** Clone the app config so the target model's record carries merged overrides. */
  private _withModelOverrides(appConfig: AppConfig, modelId: string, overrides: ChatOptions): AppConfig {
    const model_list = (appConfig.model_list || []).map((m) =>
      m.model_id === modelId ? { ...m, overrides: { ...m.overrides, ...overrides } } : m
    );
    return { ...appConfig, model_list };
  }

  /** Load model into WebGPU. Real download. Dedupes concurrent inits per model. */
  async init(endpoint: ModelEndpoint): Promise<void> {
    if (!endpoint.model) throw new Error("WebLLM model ID is empty");

    const modelId = this._effectiveModelId || endpoint.model;

    if (this._loadedModelId === modelId && this.engine) return;

    if (!this._originalModelId) {
      this._originalModelId = endpoint.model;
    }

    const idx = WEBLLM_MODELS.findIndex(m => m.id === modelId);
    if (idx >= 0) this._currentModelIndex = idx;

    // Attempt SW registration before engine init; fall back to direct mode on failure
    if (this._useServiceWorker && !this._swRegistration) {
      const reg = await registerWebLLMSW();
      if (reg) {
        this._swRegistration = reg;
      } else {
        this._useServiceWorker = false;
      }
    }

    this._initPromise = this._doInit(modelId);
    return this._initPromise;
  }

  /** Ensure engine is loaded with the correct model — uses effective model for downgrade support. */
  private async ensureEngine(endpoint: ModelEndpoint): Promise<void> {
    if (this._originalModelId && endpoint.model !== this._originalModelId) {
      this._originalModelId = endpoint.model;
      this._effectiveModelId = endpoint.model;
    }

    const modelId = this._effectiveModelId || endpoint.model;
    if (!modelId) throw new Error("WebLLM model ID is empty");

    if (this.engine && this._loadedModelId === modelId) return;

    const { hasModelInCache } = await import("@mlc-ai/web-llm");

    if (this.engine && this._loadedModelId !== modelId) {
      if (await hasModelInCache(modelId)) {
        try {
          await this._withSwTimeout(this.engine.reload(modelId));
          this._loadedModelId = modelId;
          this._effectiveModelId = modelId;
          return;
        } catch (err) {
          if (isFatalError(err)) {
            this.engine = null;
            this._loadedModelId = null;
            this._initPromise = null;
            const downgraded = await this._tryDowngrade();
            if (downgraded) {
              await this.init(endpoint);
              return;
            }
            throw new Error(
              "WebGPU device was lost (or the WebLLM service worker stopped responding) during model reload. All recovery attempts failed."
            );
          }
          throw err;
        }
      }
      throw new Error(
        `WebLLM model "${modelId}" not cached. Go to Settings → Download first.`
      );
    }

    if (!this.engine) {
      if (await hasModelInCache(modelId)) {
        await this.init(endpoint);
        return;
      }
      throw new Error(
        `WebLLM model "${modelId}" not cached. Go to Settings → Download first.`
      );
    }
  }

  async chatCompletion(
    messages: ChatMessage[],
    endpoint: ModelEndpoint,
    _options?: { timeoutMs?: number }
  ): Promise<string> {
    await this.ensureEngine(endpoint);

    for (let attempt = 0; attempt < WEBLLM_MODELS.length; attempt++) {
      try {
        // In service-worker mode this call round-trips over the SW message
        // channel — race it against a timeout so a dead SW surfaces as a
        // clear error instead of hanging forever.
        const reply = await this._withSwTimeout(
          this.engine!.chat.completions.create({
            messages: messages as any,
            temperature: endpoint.temperature,
            max_tokens: endpoint.maxTokens || 4096,
          })
        );
        return reply.choices?.[0]?.message?.content?.trim() || "";
      } catch (err) {
        if (isFatalError(err)) {
          this.engine = null;
          this._loadedModelId = null;
          this._initPromise = null;
          const downgraded = await this._tryDowngrade();
          if (downgraded) {
            await this.init(endpoint);
            continue;
          }
          throw new Error(
            "WebGPU device was lost (or the WebLLM service worker stopped responding) during generation. All recovery attempts failed. Close other GPU-heavy tabs, restart Chrome."
          );
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (/model not loaded|reload/i.test(msg)) {
          this.engine = null;
          this._loadedModelId = null;
          this._initPromise = null;
          await this.ensureEngine(endpoint);
          const reply = await this._withSwTimeout(
            this.engine!.chat.completions.create({
              messages: messages as any,
              temperature: endpoint.temperature,
              max_tokens: endpoint.maxTokens || 4096,
            })
          );
          return reply.choices?.[0]?.message?.content?.trim() || "";
        }
        throw err;
      }
    }

    throw new Error("WebLLM generation failed after exhausting all recovery attempts.");
  }

  async listModels(_endpoint: ModelEndpoint): Promise<string[]> {
    return WEBLLM_MODELS.map(m => m.name);
  }

  /** Checks cache state. Loads engine from cache if cached. Reloads if model changed. */
  async testConnection(endpoint: ModelEndpoint): Promise<string> {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    const modelId = this._effectiveModelId || endpoint.model;
    if (!modelId) throw new Error("WebLLM model ID is empty");

    if (this.engine && this._loadedModelId === modelId) {
      return `Model "${modelId}" already loaded. Ready.`;
    }

    if (await hasModelInCache(modelId)) {
      await this.init(endpoint);
      return `Model "${modelId}" loaded from cache. Ready.`;
    }

    return `Model "${modelId}" not cached. Go to Settings → select model → Download.`;
  }

  async unload(): Promise<void> {
    if (this.engine) {
      try { await this.engine.unload(); } catch { /* ignore */ }
    }
    if (this._swRegistration) {
      try { await this._swRegistration.unregister(); } catch { /* ignore */ }
    }
    this.engine = null;
    this._loadedModelId = null;
    this._effectiveModelId = null;
    this._originalModelId = null;
    this._initPromise = null;
    this._swRegistration = null;
    this._consecutiveFailures = 0;
    this._currentModelIndex = -1;
    this._progressCallback = null;
    this._emitStatus({ type: "unloaded" });
  }

  async interruptDownload(): Promise<void> {
    this._progressCallback = null;
    if (this._swRegistration) {
      try { await this._swRegistration.unregister(); } catch { /* ignore */ }
      this._swRegistration = null;
    }
    await this.unload();
  }

  async hasModelInCache(modelId: string): Promise<boolean> {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    return hasModelInCache(modelId);
  }

  get isLoaded(): boolean {
    return this.engine !== null && this._loadedModelId !== null;
  }

  get loadedModelId(): string | null {
    return this._loadedModelId;
  }

  get isUnavailable(): boolean {
    return this._currentModelIndex <= 0 && this._consecutiveFailures >= this._maxFailuresBeforeDowngrade;
  }

  async estimateVRAM() {
    return estimateAvailableVRAM();
  }

  recommendModelFromVRAM(deviceInfo: Awaited<ReturnType<typeof estimateAvailableVRAM>>) {
    return recommendModel(deviceInfo);
  }
}
