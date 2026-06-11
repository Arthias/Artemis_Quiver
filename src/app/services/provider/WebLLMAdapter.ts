import type { ChatMessage, ModelEndpoint } from "../../types/llm";
import type { ProviderAdapter } from "./ProviderAdapter";
import type { MLCEngineInterface, InitProgressReport } from "@mlc-ai/web-llm";

/** Real @mlc-ai/web-llm model IDs from prebuiltAppConfig */
export const WEBLLM_MODELS = [
  { id: "Llama-3.2-3B-Instruct-q4f32_1-MLC", name: "Llama 3.2 (3B)", sizeGB: 2.3, vramGB: 4.5, recommended: true },
  { id: "Llama-3.2-1B-Instruct-q4f32_1-MLC", name: "Llama 3.2 (1B)", sizeGB: 0.88, vramGB: 2.0 },
  { id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC", name: "DeepSeek R1 (7B)", sizeGB: 4.8, vramGB: 8.0 },
  { id: "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC", name: "Hermes 2 Pro (8B)", sizeGB: 5.5, vramGB: 10.0 },
] as const;

export class WebLLMAdapter implements ProviderAdapter {
  private engine: MLCEngineInterface | null = null;
  private _progressCallback: ((pct: number) => void) | null = null;

  setProgressCallback(cb: (pct: number) => void) {
    this._progressCallback = cb;
  }

  /** Load model into WebGPU. Real download. */
  async init(endpoint: ModelEndpoint): Promise<void> {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    const modelId = endpoint.model;
    if (!modelId) throw new Error("WebLLM model ID is empty");

    this.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report: InitProgressReport) => {
        const pct = Math.round(report.progress * 100);
        if (this._progressCallback) this._progressCallback(pct);
      },
    });
  }

  async chatCompletion(
    messages: ChatMessage[],
    endpoint: ModelEndpoint,
    options?: { timeoutMs?: number }
  ): Promise<string> {
    if (!this.engine) {
      throw new Error("WebLLM engine not initialized. Call init() first or click Download.");
    }

    const reply = await this.engine.chat.completions.create({
      messages: messages as any,
      temperature: endpoint.temperature,
      max_tokens: endpoint.maxTokens || 4096,
    });

    return reply.choices?.[0]?.message?.content?.trim() || "";
  }

  async listModels(endpoint: ModelEndpoint): Promise<string[]> {
    return WEBLLM_MODELS.map(m => m.name);
  }

  /** Loads model — real test. Reuses existing engine if already loaded. */
  async testConnection(endpoint: ModelEndpoint): Promise<string> {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    const modelId = endpoint.model;
    if (!modelId) throw new Error("WebLLM model ID is empty");

    if (this.engine) {
      return `Model "${modelId}" already loaded. Ready.`;
    }

    if (hasModelInCache(modelId)) {
      return `Model "${modelId}" cached in browser. Click Download to load.`;
    }

    // Need to download + load
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    this.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report: InitProgressReport) => {
        const pct = Math.round(report.progress * 100);
        if (this._progressCallback) this._progressCallback(pct);
      },
    });

    return `Model "${modelId}" downloaded and ready.`;
  }
}