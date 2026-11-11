import type { ChatMessage, LlmConfig, LlmTask } from "../types/llm";
import { runLlm } from "./llmService";

/**
 * `runLlm` for a JSON answer. Asks the provider for JSON, then runs `parse`
 * (which should throw on a reply it can't use). On a parse failure it asks
 * again, showing the model its last reply and the error. Model and network
 * errors are not retried here. When every attempt fails, the last parse error
 * is thrown, or `onExhausted`'s error if given.
 */
export async function runLlmJson<T>(
  task: LlmTask,
  messages: ChatMessage[],
  config: LlmConfig,
  parse: (raw: string) => T,
  options?: { attempts?: number; timeoutMs?: number; onExhausted?: (lastError: unknown) => Error }
): Promise<T> {
  const attempts = options?.attempts ?? 2;
  let turn = messages;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const raw = await runLlm(task, turn, config, { json: true, timeoutMs: options?.timeoutMs });
    try {
      return parse(raw);
    } catch (err) {
      lastError = err;
      const why = err instanceof Error ? err.message : String(err);
      turn = [...messages,
        { role: "assistant", content: raw },
        { role: "user", content: `Fix the JSON formatting error above: ${why}. Return ONLY valid JSON. No markdown fences.` }];
    }
  }
  throw options?.onExhausted ? options.onExhausted(lastError) : lastError;
}
