import type { ProviderType, ModelEndpoint } from "../../types/llm";
import type { ProviderAdapter } from "./ProviderAdapter";
import { openAICompatibleAdapter } from "./OpenAICompatibleAdapter";
import { anthropicAdapter } from "./AnthropicAdapter";
import { geminiAdapter } from "./GeminiAdapter";
import { WebLLMAdapter } from "./WebLLMAdapter";

// Singleton adapter instances with default initializers
const webllmAdapterInstance = new WebLLMAdapter();
const registry: Record<ProviderType, ProviderAdapter> = {
  "openai-compatible": openAICompatibleAdapter,
  "anthropic": anthropicAdapter,
  "google-gemini": geminiAdapter,
  "webllm": webllmAdapterInstance,
};

export function getAdapter(provider: ProviderType, _endpoint?: ModelEndpoint): ProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) {
    throw new Error(`No adapter registered for provider type: "${provider}"`);
  }
  return adapter;
}


