import type { ChatMessage, LlmConfig, LlmTask, ModelEndpoint } from "../types/llm";
import { getAdapter } from "./provider";
import { redactorFor } from "./redaction";

function logLlmError(err: unknown, endpoint: ModelEndpoint) {
  void import("../db/errorLogRepo").then(({ addErrorLog }) => addErrorLog({
    timestamp: new Date().toISOString(),
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    source: "llm",
    code: err instanceof Error && "code" in err ? (err as any).code : undefined,
    severity: "ERROR",
    metadata: { endpoint: endpoint.label, provider: endpoint.provider, model: endpoint.model } as Record<string, unknown>,
  }));
}

export async function chatCompletion(
  messages: ChatMessage[],
  endpoint: ModelEndpoint,
  options?: { timeoutMs?: number }
): Promise<string> {
  const adapter = getAdapter(endpoint.provider);
  try {
    const redactor = await redactorFor(endpoint);
    if (!redactor) return await adapter.chatCompletion(messages, endpoint, options);
    return redactor.restore(await adapter.chatCompletion(redactor.redactMessages(messages), endpoint, options));
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

/** Per-task traits: "quick" tasks may go to the secondary model; timeouts for the long ones. */
const TASKS: Record<LlmTask, { quick?: boolean; timeoutMs?: number }> = {
  jobAnalysis: {},
  jobFollowUp: {},
  cvGenerate: {},
  cvEdit: {},
  cvOptimize: {},
  clGenerate: {},
  clEdit: {},
  profileChat: {},
  profileImport: { timeoutMs: 300_000 },
  profilePreferences: { timeoutMs: 180_000 },
  profileLists: { timeoutMs: 180_000 },
  assistMatchFields: { quick: true },
  assistExtractValues: {},
  assistDraftAnswer: {},
};

/** The model the settings assign to a task (no task: the model used by default). */
export function endpointFor(config: LlmConfig, task?: LlmTask): ModelEndpoint {
  if (config.secondaryUse === "always") return config.secondary;
  if (task && TASKS[task].quick && config.secondaryUse === "quick-tasks") return config.secondary;
  return config.primary;
}

/**
 * The one way the app calls a model: say what you are doing and pass the
 * messages; the settings pick the model, and this handles redaction, the
 * timeout, error logging and falling back to the secondary model.
 */
export async function runLlm(
  task: LlmTask,
  messages: ChatMessage[],
  config: LlmConfig,
  options?: { timeoutMs?: number }
): Promise<string> {
  const endpoint = endpointFor(config, task);
  const opts = { timeoutMs: options?.timeoutMs ?? TASKS[task].timeoutMs };
  try {
    return await chatCompletion(messages, endpoint, opts);
  } catch (err) {
    if (config.secondaryUse === "fallback" && endpoint !== config.secondary && config.secondary.model) {
      return chatCompletion(messages, config.secondary, opts);
    }
    throw err;
  }
}
