import type { ChatMessage, ModelEndpoint } from "../../types/llm";
import type { ProviderAdapter } from "./ProviderAdapter";
import type { MLCEngineInterface, InitProgressReport } from "@mlc-ai/web-llm";

/** Real @mlc-ai/web-llm model IDs from prebuiltAppConfig (v0_2_84/base) */
export const WEBLLM_MODELS = [
  { id: "Llama-3.2-3B-Instruct-q4f32_1-MLC", name: "Llama 3.2 (3B)", sizeGB: 2.3, vramGB: 4.5, recommended: true },
  { id: "Llama-3.2-1B-Instruct-q4f32_1-MLC", name: "Llama 3.2 (1B)", sizeGB: 0.88, vramGB: 2.0 },
  { id: "gemma3-1b-it-q4f16_1-MLC", name: "Gemma 3 (1B)", sizeGB: 0.4, vramGB: 0.7 },
  { id: "gemma-2-2b-it-q4f16_1-MLC", name: "Gemma 2 (2B)", sizeGB: 1.1, vramGB: 1.9 },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 (1.5B)", sizeGB: 0.9, vramGB: 1.6 },
  { id: "Qwen2.5-3B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 (3B)", sizeGB: 1.5, vramGB: 2.5 },
  { id: "Qwen3-1.7B-q4f16_1-MLC", name: "Qwen3 (1.7B)", sizeGB: 1.1, vramGB: 2.0 },
  { id: "Qwen3-4B-q4f16_1-MLC", name: "Qwen3 (4B)", sizeGB: 2.1, vramGB: 3.4 },
  { id: "Phi-4-mini-instruct-q4f16_1-MLC", name: "Phi-4 Mini (3.8B)", sizeGB: 2.0, vramGB: 3.4 },
  { id: "Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC", name: "Ministral 3 (3B)", sizeGB: 1.7, vramGB: 2.9 },
  { id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC", name: "DeepSeek R1 (7B)", sizeGB: 4.8, vramGB: 8.0 },
  { id: "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC", name: "Hermes 2 Pro (8B)", sizeGB: 5.5, vramGB: 10.0 },
  { id: "Llama-3.1-8B-Instruct-q4f32_1-MLC-1k", name: "Llama 3.1 (8B)", sizeGB: 4.2, vramGB: 5.3 },
] as const;

const DEVICE_LOST_PATTERNS = /device lost|device removed|requestDevice|DXGI_ERROR/i;

function isDeviceLostError(err: unknown): boolean {
  return DEVICE_LOST_PATTERNS.test(err instanceof Error ? err.message : String(err));
}

export class WebLLMAdapter implements ProviderAdapter {
  private engine: MLCEngineInterface | null = null;
  private _loadedModelId: string | null = null;
  private _progressCallback: ((pct: number) => void) | null = null;
  private _initPromise: Promise<void> | null = null;
  private _deviceLost = false;

  setProgressCallback(cb: (pct: number) => void) {
    this._progressCallback = cb;
  }

  /** Load model into WebGPU. Real download. Dedupes concurrent inits per model. */
  async init(endpoint: ModelEndpoint): Promise<void> {
    const modelId = endpoint.model;
    if (!modelId) throw new Error("WebLLM model ID is empty");

    if (this._deviceLost) {
      throw new Error(
        "WebGPU device was lost. Close other GPU-heavy tabs, restart Chrome, and try a smaller model."
      );
    }
    if (this._loadedModelId === modelId && this.engine) return;

    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    this._initPromise = (async () => {
      try {
        this.engine = await CreateMLCEngine(modelId, {
          initProgressCallback: (report: InitProgressReport) => {
            const pct = Math.round(report.progress * 100);
            if (this._progressCallback) this._progressCallback(pct);
          },
        });
        this._loadedModelId = modelId;
        this._deviceLost = false;
      } catch (err) {
        if (isDeviceLostError(err)) {
          this._deviceLost = true;
          this.engine = null;
          this._loadedModelId = null;
          throw new Error(
            "WebGPU device was lost (GPU out of memory or driver crash). Close other GPU-heavy tabs, restart Chrome, and try a smaller model."
          );
        }
        throw err;
      }
    })();

    return this._initPromise;
  }

  /** Ensure engine is loaded with the correct model — reloads if model changed. */
  private async ensureEngine(endpoint: ModelEndpoint): Promise<void> {
    if (this._deviceLost) {
      throw new Error(
        "WebGPU device was lost. Close other GPU-heavy tabs, restart Chrome, and try a smaller model."
      );
    }

    const modelId = endpoint.model;
    if (!modelId) throw new Error("WebLLM model ID is empty");

    if (this.engine && this._loadedModelId === modelId) return;

    const { hasModelInCache } = await import("@mlc-ai/web-llm");

    // Engine exists but with a different model — reload
    if (this.engine && this._loadedModelId !== modelId) {
      if (await hasModelInCache(modelId)) {
        try {
          await this.engine.reload(modelId);
          this._loadedModelId = modelId;
          return;
        } catch (err) {
          if (isDeviceLostError(err)) {
            this._deviceLost = true;
            this.engine = null;
            this._loadedModelId = null;
            throw new Error(
              "WebGPU device was lost during model reload. Restart Chrome and try again."
            );
          }
          throw err;
        }
      }
      throw new Error(
        `WebLLM model "${modelId}" not cached. Go to Settings → Download first.`
      );
    }

    // No engine — init from cache or error
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
    if (this._deviceLost) {
      throw new Error(
        "WebGPU device was lost. Close other GPU-heavy tabs, restart Chrome, and try a smaller model."
      );
    }

    await this.ensureEngine(endpoint);

    try {
      const reply = await this.engine!.chat.completions.create({
        messages: messages as any,
        temperature: endpoint.temperature,
        max_tokens: endpoint.maxTokens || 4096,
      });

      return reply.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      if (isDeviceLostError(err)) {
        this._deviceLost = true;
        this.engine = null;
        this._loadedModelId = null;
        this._initPromise = null;
        throw new Error(
          "WebGPU device was lost during generation (GPU out of memory). Close other GPU-heavy tabs, restart Chrome, and try a smaller model."
        );
      }
      // Transient engine state (model not loaded after tab switch) — reset and retry once
      const msg = err instanceof Error ? err.message : String(err);
      if (/model not loaded|reload/i.test(msg) && !this._deviceLost) {
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

  async listModels(_endpoint: ModelEndpoint): Promise<string[]> {
    return WEBLLM_MODELS.map(m => m.name);
  }

  /** Checks cache state. Loads engine from cache if cached. Reloads if model changed. */
  async testConnection(endpoint: ModelEndpoint): Promise<string> {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    const modelId = endpoint.model;
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
}