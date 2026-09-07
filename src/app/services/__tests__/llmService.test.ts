import { describe, it, expect, vi } from "vitest";
import { chatCompletion, getActiveEndpoint, chatCompletionWithFallback } from "../llmService";
import type { ModelEndpoint, LlmConfig } from "../../types/llm";

// llmService fire-and-forgets an error-log write via a dynamic import of
// errorLogRepo (Dexie/IndexedDB) whenever a chat completion fails. This
// suite doesn't polyfill IndexedDB, so leaving it unmocked produces an
// unhandled rejection from that untracked promise on every error-path test.
vi.mock("../../db/errorLogRepo", () => ({
  addErrorLog: vi.fn().mockResolvedValue(undefined),
}));

const mockEndpoint: ModelEndpoint = {
  label: "Test",
  provider: "openai-compatible",
  baseUrl: "http://localhost:1234",
  model: "test-model",
  temperature: 0.7,
};

const mockConfig: LlmConfig = {
  providerMode: "cloud",
  primary: mockEndpoint,
  secondary: { ...mockEndpoint, label: "Secondary", baseUrl: "http://localhost:11434", model: "small-model" },
  secondaryUse: "never",
  autoSaveProfile: false,
};

describe("chatCompletion", () => {
  it("should call OpenAI-compatible endpoint via adapter", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "Hello" } }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await chatCompletion([{ role: "user", content: "Hi" }], mockEndpoint);
    expect(result).toBe("Hello");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:1234/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test-model"),
      })
    );
  });

  it("should throw AppError on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server error"),
    }));

    await expect(
      chatCompletion([{ role: "user", content: "Hi" }], mockEndpoint)
    ).rejects.toThrow("OpenAI-compatible request failed (500)");
  });
});

describe("getActiveEndpoint", () => {
  it("should return primary by default", () => {
    const ep = getActiveEndpoint(mockConfig);
    expect(ep.model).toBe("test-model");
  });

  it("should return secondary for quick-tasks when secondaryUse is quick-tasks", () => {
    const config = { ...mockConfig, secondaryUse: "quick-tasks" as const };
    const ep = getActiveEndpoint(config, "quick");
    expect(ep.model).toBe("small-model");
  });
});

describe("chatCompletionWithFallback", () => {
  it("should use primary when secondaryUse is never", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "Primary" } }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await chatCompletionWithFallback([{ role: "user", content: "Hi" }], mockConfig);
    expect(result).toBe("Primary");
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("localhost:1234"), expect.anything());
  });

  it("should fallback to secondary on primary failure when secondaryUse is fallback", async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error("Primary failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: "Secondary" } }] }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const config = { ...mockConfig, secondaryUse: "fallback" as const };
    const result = await chatCompletionWithFallback([{ role: "user", content: "Hi" }], config);
    expect(result).toBe("Secondary");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
