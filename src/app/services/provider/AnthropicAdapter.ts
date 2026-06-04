import type { ChatMessage, ModelEndpoint } from "../../types/llm";
import { AppError, ErrorCodes } from "../../utils/errors";
import type { ChatCompletionOptions, ProviderAdapter } from "./ProviderAdapter";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export const anthropicAdapter: ProviderAdapter = {
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

    const apiMessages = nonSystemMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": endpoint.apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: endpoint.model,
          system: systemMessages.map((m) => m.content).join("\n") || undefined,
          messages: apiMessages,
          max_tokens: endpoint.maxTokens ?? 1024,
          temperature: endpoint.temperature,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AppError(
          ErrorCodes.LLM_API_FAILURE,
          `Anthropic request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
        );
      }

      const data = await response.json();
      const content = data?.content?.[0]?.text;
      if (!content || typeof content !== "string") {
        throw new AppError(ErrorCodes.LLM_EMPTY_RESPONSE, "Anthropic returned an empty response.");
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

  async listModels(): Promise<string[]> {
    return [];
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
