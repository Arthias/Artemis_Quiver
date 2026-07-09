import type { ChatMessage, ModelEndpoint } from "../../types/llm";
import type { ProviderAdapter } from "./ProviderAdapter";
import type { MLCEngineInterface, InitProgressReport } from "@mlc-ai/web-llm";
import { estimateAvailableVRAM, recommendModel } from "../../utils/vram";

/** Real @mlc-ai/web-llm model IDs from prebuiltAppConfig (v0_2_84/base). Sorted by vramGB ascending for auto-downgrade stepping. */
export const WEBLLM_MODELS = [
  { id: "gemma3-1b-it-q4f16_1-MLC", name: "Gemma 3 (1B)", sizeGB: 0.4, vramGB: 0.7 },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 (1.5B)", sizeGB: 0.9, vramGB: 1.6 },
  { id: "gemma-2-2b-it-q4f16_1-MLC", name: "Gemma 2 (2B)", sizeGB: 1.1, vramGB: 1.9 },
  { id: "Llama-3.2-1B-Instruct-q4f32_1-MLC", name: "Llama 3.2 (1B)", sizeGB: 0.88, vramGB: 2.0, descKey: "config.webllmLite" },
  { id: "Qwen3-1.7B-q4f16_1-MLC", name: "Qwen3 (1.7B)", sizeGB: 1.1, vramGB: 2.0 },
  { id: "Qwen2.5-3B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 (3B)", sizeGB: 1.5, vramGB: 2.5 },
  { id: "Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC", name: "Ministral 3 (3B)", sizeGB: 1.7, vramGB: 2.9 },
  { id: "Qwen3-4B-q4f16_1-MLC", name: "Qwen3 (4B)", sizeGB: 2.1, vramGB: 3.4 },
  { id: "Phi-4-mini-instruct-q4f16_1-MLC", name: "Phi-4 Mini (3.8B)", sizeGB: 2.0, vramGB: 3.4 },
  { id: "Llama-3.2-3B-Instruct-q4f32_1-MLC", name: "Llama 3.2 (3B)", sizeGB: 2.3, vramGB: 4.5, descKey: "config.webllmRecommended" },
  { id: "Llama-3.1-8B-Instruct-q4f32_1-MLC-1k", name: "Llama 3.1 (8B)", sizeGB: 4.2, vramGB: 5.3 },
  { id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC", name: "DeepSeek R1 (7B)", sizeGB: 4.8, vramGB: 8.0, descKey: "config.webllmAdvanced" },
  { id: "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC", name: "Hermes 2 Pro (8B)", sizeGB: 5.5, vramGB: 10.0, descKey: "config.webllmExpert" },
] as const;

export type WebLLMStatusEvent =
  | { type: "loading"; progress: number }
  | { type: "ready"; model: string }
  | { type: "downgrade"; from: string; to: string }
  | { type: "fatal"; message: string }
  | { type: "unloaded" };

const DEVICE_LOST_PATTERNS = /device lost|device removed|requestDevice|DXGI_ERROR/i;

function isDeviceLostError(err: unknown): boolean {
  return DEVICE_LOST_PATTERNS.test(err instanceof Error ? err.message : String(err));
}

export class WebLLMAdapter implements ProviderAdapter {
  private engine: MLCEngineInterface | null = null;
  private _loadedModelId: string | null = null;
  private _progressCallback: ((pct: number) => void) | null = null;
  private _initPromise: Promise<void> | null = null;

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
      this._emitStatus({ type: "fatal", message: "WebLLM unavailable on this device \u2014 all models failed." });
    }

    return false;
  }

  /** Internal init with retry loop for auto-downgrade. */
  private async _doInit(modelId: string): Promise<void> {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    for (let attempt = 0; attempt < WEBLLM_MODELS.length; attempt++) {
      const currentModelId = this._effectiveModelId || modelId;
      this.engine = null;
      this._loadedModelId = null;

      try {
        this.engine = await CreateMLCEngine(currentModelId, {
          initProgressCallback: (report: InitProgressReport) => {
            const pct = Math.round(report.progress * 100);
            this._progressCallback?.(pct);
            this._emitStatus({ type: "loading", progress: pct });
          },
        });
        this._loadedModelId = currentModelId;
        this._effectiveModelId = currentModelId;
        this._consecutiveFailures = 0;
        this._emitStatus({ type: "ready", model: currentModelId });
        return;
      } catch (err) {
        if (isDeviceLostError(err)) {
          const downgraded = await this._tryDowngrade();
          if (downgraded) continue;
          throw new Error(
            "WebGPU device was lost and all recovery attempts failed. Close other GPU-heavy tabs, restart Chrome."
          );
        }
        throw err;
      }
    }
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
          await this.engine.reload(modelId);
          this._loadedModelId = modelId;
          this._effectiveModelId = modelId;
          return;
        } catch (err) {
          if (isDeviceLostError(err)) {
            this.engine = null;
            this._loadedModelId = null;
            this._initPromise = null;
            const downgraded = await this._tryDowngrade();
            if (downgraded) {
              await this.init(endpoint);
              return;
            }
            throw new Error(
              "WebGPU device was lost during model reload. All recovery attempts failed."
            );
          }
          throw err;
        }
      }
      throw new Error(
        `WebLLM model "${modelId}" not cached. Go to Settings \u2192 Download first.`
      );
    }

    if (!this.engine) {
      if (await hasModelInCache(modelId)) {
        await this.init(endpoint);
        return;
      }
      throw new Error(
        `WebLLM model "${modelId}" not cached. Go to Settings \u2192 Download first.`
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
        const reply = await this.engine!.chat.completions.create({
          messages: messages as any,
          temperature: endpoint.temperature,
          max_tokens: endpoint.maxTokens || 4096,
        });
        return reply.choices?.[0]?.message?.content?.trim() || "";
      } catch (err) {
        if (isDeviceLostError(err)) {
          this.engine = null;
          this._loadedModelId = null;
          this._initPromise = null;
          const downgraded = await this._tryDowngrade();
          if (downgraded) {
            await this.init(endpoint);
            continue;
          }
          throw new Error(
            "WebGPU device was lost during generation. All recovery attempts failed. Close other GPU-heavy tabs, restart Chrome."
          );
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (/model not loaded|reload/i.test(msg)) {
          this.engine = null;
          this._loadedModelId = null;
          this._initPromise = null;
          await this.ensureEngine(endpoint);
          const reply = await this.engine!.chat.completions.create({
            messages: messages as any,
            temperature: endpoint.temperature,
            max_tokens: endpoint.maxTokens || 4096,
          });
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

    return `Model "${modelId}" not cached. Go to Settings \u2192 select model \u2192 Download.`;
  }

  async unload(): Promise<void> {
    if (this.engine) {
      try { await this.engine.unload(); } catch { /* ignore */ }
    }
    this.engine = null;
    this._loadedModelId = null;
    this._effectiveModelId = null;
    this._originalModelId = null;
    this._initPromise = null;
    this._consecutiveFailures = 0;
    this._currentModelIndex = -1;
    this._progressCallback = null;
    this._emitStatus({ type: "unloaded" });
  }

  async interruptDownload(): Promise<void> {
    this._progressCallback = null;
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
