import { describe, it, expect, vi, beforeEach } from "vitest";
import { chatCompletion } from "../llmService";
import type { LlmConfig } from "../../types/llm";

const lmstudioConfig: LlmConfig = {
  provider: "lmstudio",
  serverUrl: "/api/lmstudio",
  model: "gemma-4-e2b",
  temperature: 0.7,
  autoSaveProfile: false,
};

const ollamaConfig: LlmConfig = {
  provider: "ollama",
  serverUrl: "http://localhost:11434",
  model: "gemma2",
  temperature: 0.5,
  autoSaveProfile: false,
};

describe("chatCompletion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should call LMStudio endpoint with correct URL and body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "Hello from LMStudio" } }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await chatCompletion(
      [{ role: "user", content: "Hi" }],
      lmstudioConfig
    );

    expect(result).toBe("Hello from LMStudio");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/lmstudio/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("gemma-4-e2b"),
      })
    );
  });

  it("should call Ollama endpoint with correct URL and body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "Hello from Ollama" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await chatCompletion(
      [{ role: "user", content: "Hi" }],
      ollamaConfig
    );

    expect(result).toBe("Hello from Ollama");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({
        body: expect.stringContaining("gemma2"),
      })
    );
  });

  it("should throw on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server error"),
    }));

    await expect(
      chatCompletion([{ role: "user", content: "Hi" }], lmstudioConfig)
    ).rejects.toThrow("LMStudio request failed (500)");
  });

  it("should throw on empty response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: null } }] }),
    }));

    await expect(
      chatCompletion([{ role: "user", content: "Hi" }], lmstudioConfig)
    ).rejects.toThrow("empty response");
  });

  it("should throw AbortError as timeout", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    const mockFetch = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      chatCompletion([{ role: "user", content: "Hi" }], lmstudioConfig)
    ).rejects.toThrow("Request timed out");
  });
});
