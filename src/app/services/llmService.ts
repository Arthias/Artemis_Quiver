import type { ChatMessage, LlmConfig, ModelEndpoint } from "../types/llm";
import { getAdapter } from "./provider";

function logLlmError(err: unknown, endpoint: ModelEndpoint) {
  void import("../db/errorLogRepo").then(({ addErrorLog }) => addErrorLog({
    timestamp: new Date().toISOString(),
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    source: "llm",
    code: err instanceof Error && "code" in err ? (err as any).code : undefined,
    severity: "ERROR",
    metadata: JSON.stringify({ endpoint: endpoint.label, provider: endpoint.provider, model: endpoint.model }),
  }));
}

export async function chatCompletion(
  messages: ChatMessage[],
  endpoint: ModelEndpoint,
  options?: { timeoutMs?: number }
): Promise<string> {
  const adapter = getAdapter(endpoint.provider);
  try {
    return await adapter.chatCompletion(messages, endpoint, options);
  } catch (err) {
    logLlmError(err, endpoint);
    throw err;
  }
}

export async function listModels(endpoint: ModelEndpoint): Promise<string[]> {
  const adapter = getAdapter(endpoint.provider);
  try {
    return await adapter.listModels(endpoint);
  } catch (err) {
    logLlmError(err, endpoint);
    throw err;
  }
}

export async function testConnection(endpoint: ModelEndpoint): Promise<string> {
  const adapter = getAdapter(endpoint.provider);
  try {
    return await adapter.testConnection(endpoint);
  } catch (err) {
    logLlmError(err, endpoint);
    throw err;
  }
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
