import type { ChatMessage, ModelEndpoint } from "../../types/llm";
import { AppError, ErrorCodes } from "../../utils/errors";
import type { ChatCompletionOptions, ProviderAdapter } from "./ProviderAdapter";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function buildParts(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : m.role,
    parts: [{ text: m.content }],
  }));
}

export const geminiAdapter: ProviderAdapter = {
  async chatCompletion(
    messages: ChatMessage[],
    endpoint: ModelEndpoint,
    options?: ChatCompletionOptions
  ): Promise<string> {
    const baseUrl = normalizeBaseUrl(endpoint.baseUrl);
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    try {
      const response = await fetch(
        `${baseUrl}/v1/models/${endpoint.model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": endpoint.apiKey ?? "",
          },
          body: JSON.stringify({
            system_instruction: systemMessages.length > 0
              ? { parts: systemMessages.map((m) => ({ text: m.content })) }
              : undefined,
            contents: buildParts(nonSystemMessages),
            generationConfig: {
              temperature: endpoint.temperature,
              maxOutputTokens: endpoint.maxTokens ?? 1024,
            },
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AppError(
          ErrorCodes.LLM_API_FAILURE,
          `Gemini request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
        );
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text || typeof text !== "string") {
        throw new AppError(ErrorCodes.LLM_EMPTY_RESPONSE, "Gemini returned an empty response.");
      }
      return text;
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
  },

  async listModels(endpoint: ModelEndpoint): Promise<string[]> {
    const baseUrl = normalizeBaseUrl(endpoint.baseUrl);
    const headers: Record<string, string> = {};
    if (endpoint.apiKey) {
      headers["x-goog-api-key"] = endpoint.apiKey;
    }

    const response = await fetch(`${baseUrl}/v1/models`, { headers });
    if (!response.ok) {
      throw new AppError(ErrorCodes.LLM_API_FAILURE, `Failed to list models (${response.status})`);
    }

    const data = await response.json();
    const models: string[] = [];
    if (Array.isArray(data?.models)) {
      for (const m of data.models) {
        if (m?.name && typeof m.name === "string") {
          models.push(m.name.replace(/^models\//, ""));
        }
      }
    }
    return models;
  },

  async testConnection(endpoint: ModelEndpoint): Promise<string> {
    const reply = await this.chatCompletion(
      [{ role: "user", content: 'Reply with exactly the word "ok" and nothing else.' }],
      endpoint,
      { timeoutMs: 30_000 }
    );
    return reply.trim().slice(0, 80);
  },
};
