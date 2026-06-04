import type { ChatMessage, ModelEndpoint } from "../../types/llm";

export interface ChatCompletionOptions {
  timeoutMs?: number;
}

export interface ProviderAdapter {
  chatCompletion(
    messages: ChatMessage[],
    endpoint: ModelEndpoint,
    options?: ChatCompletionOptions
  ): Promise<string>;

  listModels(endpoint: ModelEndpoint): Promise<string[]>;

  testConnection(endpoint: ModelEndpoint): Promise<string>;
}
