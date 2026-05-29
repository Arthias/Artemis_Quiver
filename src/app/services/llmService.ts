import type { ChatMessage, LlmConfig } from "../types/llm";
import { AppError, ErrorCodes } from "../utils/errors";

function normalizeBaseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, "");
}

export async function chatCompletion(
  messages: ChatMessage[],
  config: LlmConfig,
  options?: { timeoutMs?: number }
): Promise<string> {
  const baseUrl = normalizeBaseUrl(config.serverUrl);
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (config.provider === "lmstudio") {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: config.temperature,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AppError(
          ErrorCodes.LLM_API_FAILURE,
          `LMStudio request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
        );
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new AppError(ErrorCodes.LLM_EMPTY_RESPONSE, "LMStudio returned an empty response.");
      }
      return content;
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        options: { temperature: config.temperature },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new AppError(
        ErrorCodes.LLM_API_FAILURE,
        `Ollama request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      );
    }

    const data = await response.json();
    const content = data?.message?.content;
    if (!content || typeof content !== "string") {
      throw new AppError(ErrorCodes.LLM_EMPTY_RESPONSE, "Ollama returned an empty response.");
    }
    return content;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AppError(ErrorCodes.LLM_TIMEOUT, `Request timed out after ${timeoutMs}ms`);
    }

    if (error instanceof TypeError && error.message === "fetch failed") {
      throw new AppError(ErrorCodes.LLM_CONNECTION_REFUSED, error.message);
    }

    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.UNKNOWN, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
  }
}

export async function testConnection(config: LlmConfig): Promise<string> {
  const reply = await chatCompletion(
    [
      {
        role: "user",
        content: 'Reply with exactly the word "ok" and nothing else.',
      },
    ],
    config,
    { timeoutMs: 30_000 }
  );
  return reply.trim().slice(0, 80);
}
