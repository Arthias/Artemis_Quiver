import type { ProviderType } from "../../types/llm";
import type { ProviderAdapter } from "./ProviderAdapter";
import { openAICompatibleAdapter } from "./OpenAICompatibleAdapter";
import { anthropicAdapter } from "./AnthropicAdapter";
import { geminiAdapter } from "./GeminiAdapter";

const registry: Record<ProviderType, ProviderAdapter> = {
  "openai-compatible": openAICompatibleAdapter,
  "anthropic": anthropicAdapter,
  "google-gemini": geminiAdapter,
};

export function getAdapter(provider: ProviderType): ProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) {
    throw new Error(`No adapter registered for provider type: "${provider}"`);
  }
  return adapter;
}


