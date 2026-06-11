import type { ChatMessage, ModelEndpoint } from "../../types/llm";
import type { ProviderAdapter } from "./ProviderAdapter";

export interface WebLLMModelCatalog {
  [key: string]: Pick<ModelEndpoint, 'model' | 'baseUrl'> & { 
    sizeGB: number;
    vramGB: number;
    description?: string;
  };
}

const DEFAULT_WEBLLM_URLS = {
  "llama-3.2-3b-instruct": "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-WebLLM/resolve/main/model.guf",
  "llama-3.2-1b-instruct": "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-WebLLM/resolve/main/model.guf",
  "qwen2.5-3b-instruct-q4f32_1-mlc": "https://huggingface.co/mlc-ai/Qwen2.5-3B-Instruct-Q4_F32_1-MLC/resolve/main/model.guf",
  "phi-3.5-mini-128k-instruct-q4f32_1-MLC": "https://huggingface.co/mlc-ai/Phi-3.5-mini-128k-Instruct-Q4_F32_1-MLC/resolve/main/model.guf",
};

/**
 * Model catalog with VRAM requirements and sizes.
 */
export const WEBLLM_MODELS = [
  { id: "llama-3.2-3b-instruct", name: "Llama 3.2 (3B)", sizeGB: 2.3, vramGB: 4.5, default: true },
  { id: "llama-3.2-1b-instruct", name: "Llama 3.2 (1B)", sizeGB: 0.88, vramGB: 2.0, light: true },
  { id: "qwen2.5-3b-instruct-q4f32_1-mlc", name: "Qwen2.5 3B", sizeGB: 2.8, vramGB: 5.0, alt: true },
  { id: "phi-3.5-mini-128k-instruct-q4f32_1-MLC", name: "Phi-3.5 Mini", sizeGB: 3.7, vramGB: 6.0, alt2: true },
] as const;

export interface WebLLMAdapterOptions {
  baseUrl?: string;
}

/**
 * WebLLM Provider Adapter — runs models directly in-browser via WebGPU/WebAssembly.
 * No local server required. Ideal for non-technical users with low-end devices.
 */
export class WebLLMAdapter implements ProviderAdapter {
  private static engines = new WeakMap<WebLLMManager, string>();
  public engineReady = false;
  private manager: WebLLMManager | null = null;
  private baseUrl: string;

  constructor(baseUrl: string = "file://") {
    this.baseUrl = baseUrl;
  }

  /**
   * Initialize the WebLLM engine. Loads the specified model into browser memory.
   */
  async init(endpoint: ModelEndpoint): Promise<void> {
    if (!this.manager) {
      const module = await import("@mlc-ai/web-llm");
      const CreateMLCEngineFallback = (module as any).CreateMLCEngine as any;
      this.manager = CreateMLCEngineFallback ? new CreateMLCEngineFallback() : null;

      // Check for Service Worker extension in service workers environment
      if (!this.manager && typeof window !== "undefined") {
        const CreateExtensionServiceWorkerMLCEngineFallback = (module as any).CreateExtensionServiceWorkerMLCEngine as any;
        this.manager = CreateExtensionServiceWorkerMLCEngineFallback ? new CreateExtensionServiceWorkerMLCEngineFallback() : null;
      }
    }

    if (!this.manager) {
      throw new Error("WebLLM engine not found or unsupported runtime");
    }

    const modelId: string = endpoint.model.startsWith("llama-3") 
      ? endpoint.model
      : "llama-3.2-3b-instruct";

    return this.manager!.load(
      modelId,
      endpoint.baseUrl || this.baseUrl,
      {
        progressCallback: (progress?) => {
          // Optional: update UI with download progress
          console.log(`Downloading ${modelId}...`, progress ? `${Math.round(progress * 100)}%` : "starting");
        },
        initProgressCallback: () => {
          console.log(`Initializing model engine for ${endpoint.model}...`);
        }
      }
    );
  }

  async chatCompletion(
    messages: ChatMessage[],
    endpoint: ModelEndpoint,
    options?: { timeoutMs?: number }
  ): Promise<string> {
    if (!this.manager) {
      throw new Error("WebLLM engine not initialized. Call init() first.");
    }

    const request = await this.manager!.createChatRequest(endpoint.model);
    const data: any = request.data;
    
    // Handle reasoning_content from gemma-4-e2b, fallback to content
    let textContent: string | null = (data as any).reasoning_content?.[0]?.content || 
                                      (data as any).reasoning_content || 
                                      (data as any).content;
    let reasoningContent: string | null = (data as any).reasoning_content ?? null;

    // Prefer actual content field over reasoning
    if (!textContent) {
      textContent = ""
    }

    return (textContent || "")
      .replace(/```json\n?/g, "")
      .replace(/\n```\n?$/g, "")
      .trim();
  }

  async listModels(endpoint: ModelEndpoint): Promise<string[]> {
    // For WebLLM, models are loaded on-demand; return catalog for display
    return WEBLLM_MODELS.map(m => m.name);
  }

  /**
   * Test connection by sending a minimal ping.
   */
  async testConnection(endpoint: ModelEndpoint): Promise<string> {
    if (!this.manager) {
      const module = await import("@mlc-ai/web-llm");
      const CreateMLCEngine = (module as any).CreateMLCEngine;
      try {
        this.manager = new CreateMLCEngine() as WebLLMManager;
      } catch {}
    }

    if (!this.manager) {
      throw new Error("WebLLM engine not found. Please check browser compatibility and try again.");
    }

    const response = await this.manager!.ping();
    return response || "ok";
  }
}

// Simple mock type for WebLLM manager interface
export interface WebLLMManager {
  load(modelId: string): Promise<void>; // Simplified signature
  createChatRequest(model: string): Promise<any>;
  ping(): Promise<string | null>;
}