import type { ChatMessage, LlmConfig, ModelEndpoint } from "../types/llm";
import { getAdapter } from "./provider";

export async function chatCompletion(
  messages: ChatMessage[],
  endpoint: ModelEndpoint,
  options?: { timeoutMs?: number }
): Promise<string> {
  const adapter = getAdapter(endpoint.provider);
  return adapter.chatCompletion(messages, endpoint, options);
}

export async function listModels(endpoint: ModelEndpoint): Promise<string[]> {
  const adapter = getAdapter(endpoint.provider);
  return adapter.listModels(endpoint);
}

export async function testConnection(endpoint: ModelEndpoint): Promise<string> {
  const adapter = getAdapter(endpoint.provider);
  return adapter.testConnection(endpoint);
}

export function getActiveEndpoint(
  config: LlmConfig,
  forTask?: "quick"
): ModelEndpoint {
  if (forTask === "quick" && config.secondaryUse === "quick-tasks") {
    return config.secondary;
  }
  return config.primary;
}

export async function chatCompletionWithFallback(
  messages: ChatMessage[],
  config: LlmConfig,
  options?: { timeoutMs?: number; forTask?: "quick" }
): Promise<string> {
  const primary = getActiveEndpoint(config, options?.forTask);

  if (config.secondaryUse === "always") {
    return chatCompletion(messages, config.secondary, options);
  }

  try {
    return await chatCompletion(messages, primary, options);
  } catch (err) {
    if (config.secondaryUse === "fallback") {
      return chatCompletion(messages, config.secondary, options);
    }
    throw err;
  }
}
