import type { ChatMessage, ModelEndpoint } from "../../types/llm";
import { AppError, ErrorCodes } from "../../utils/errors";
import type { ChatCompletionOptions, ProviderAdapter } from "./ProviderAdapter";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function buildHeaders(endpoint: ModelEndpoint): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (endpoint.apiKey) {
    headers["Authorization"] = `Bearer ${endpoint.apiKey}`;
  }
  return headers;
}

export const openAICompatibleAdapter: ProviderAdapter = {
  async chatCompletion(
    messages: ChatMessage[],
    endpoint: ModelEndpoint,
    options?: ChatCompletionOptions
  ): Promise<string> {
    const baseUrl = normalizeBaseUrl(endpoint.baseUrl);
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: buildHeaders(endpoint),
        body: JSON.stringify({
          model: endpoint.model,
          messages,
          temperature: endpoint.temperature,
          max_tokens: endpoint.maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AppError(
          ErrorCodes.LLM_API_FAILURE,
          `OpenAI-compatible request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
        );
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new AppError(ErrorCodes.LLM_EMPTY_RESPONSE, "Model returned an empty response.");
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
  },

  async listModels(endpoint: ModelEndpoint): Promise<string[]> {
    const baseUrl = normalizeBaseUrl(endpoint.baseUrl);
    const headers: Record<string, string> = {};
    if (endpoint.apiKey) {
      headers["Authorization"] = `Bearer ${endpoint.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/models`, { headers });
    if (!response.ok) {
      throw new AppError(ErrorCodes.LLM_API_FAILURE, `Failed to list models (${response.status})`);
    }

    const data = await response.json();
    const models: string[] = [];
    if (Array.isArray(data?.data)) {
      for (const m of data.data) {
        if (m?.id && typeof m.id === "string") models.push(m.id);
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
