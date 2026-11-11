import type { ChatMessage, ModelEndpoint } from "../../types/llm";

export interface ChatCompletionOptions {
  timeoutMs?: number;
  /** Ask the provider to constrain the reply to a JSON object, where it can. */
  json?: boolean;
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
