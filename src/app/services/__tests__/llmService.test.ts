import { describe, it, expect, vi } from "vitest";
import { chatCompletion, endpointFor, runLlm } from "../llmService";
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

describe("JSON mode (OpenAI-compatible)", () => {
  const ok = { ok: true, status: 200, json: () => Promise.resolve({ choices: [{ message: { content: "{}" } }] }) };

  it("sends response_format when JSON is asked for", async () => {
    const mockFetch = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", mockFetch);
    await chatCompletion([{ role: "user", content: "Hi" }], mockEndpoint, { json: true });
    expect(JSON.parse(mockFetch.mock.calls[0]![1].body).response_format).toEqual({ type: "json_object" });
  });

  it("asks again without it when the server rejects it", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve("response_format not supported") })
      .mockResolvedValueOnce(ok);
    vi.stubGlobal("fetch", mockFetch);
    expect(await chatCompletion([{ role: "user", content: "Hi" }], mockEndpoint, { json: true })).toBe("{}");
    expect(JSON.parse(mockFetch.mock.calls[1]![1].body).response_format).toBeUndefined();
  });
});

describe("endpointFor", () => {
  it("returns primary by default", () => {
    expect(endpointFor(mockConfig).model).toBe("test-model");
    expect(endpointFor(mockConfig, "cvGenerate").model).toBe("test-model");
  });

  it("sends quick tasks to secondary when secondaryUse is quick-tasks", () => {
    const config = { ...mockConfig, secondaryUse: "quick-tasks" as const };
    expect(endpointFor(config, "assistMatchFields").model).toBe("small-model");
    expect(endpointFor(config, "cvGenerate").model).toBe("test-model");
  });

  it("sends every task to secondary when secondaryUse is always", () => {
    const config = { ...mockConfig, secondaryUse: "always" as const };
    expect(endpointFor(config, "cvGenerate").model).toBe("small-model");
  });

  describe("per-task models", () => {
    const extra = { ...mockEndpoint, id: "q", model: "qwen" };
    const config: LlmConfig = { ...mockConfig, models: [extra], perTaskModels: true, taskModels: { cvGenerate: "q", jobAnalysis: "secondary" } };

    it("uses the model the table picks", () => {
      expect(endpointFor(config, "cvGenerate").model).toBe("qwen");
      expect(endpointFor(config, "jobAnalysis").model).toBe("small-model");
    });

    it("keeps the normal routing for tasks left on default, a deleted model, or with the toggle off", () => {
      expect(endpointFor(config, "clGenerate").model).toBe("test-model");
      expect(endpointFor({ ...config, models: [] }, "cvGenerate").model).toBe("test-model");
      expect(endpointFor({ ...config, perTaskModels: false }, "cvGenerate").model).toBe("test-model");
    });

    it("is ignored in local mode", () => {
      expect(endpointFor({ ...config, providerMode: "local" }, "cvGenerate").model).toBe("test-model");
    });
  });
});

describe("runLlm", () => {
  const ok = (content: string) => ({ ok: true, json: () => Promise.resolve({ choices: [{ message: { content } }] }) });

  it("uses primary when secondaryUse is never", async () => {
    const mockFetch = vi.fn().mockResolvedValue(ok("Primary"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await runLlm("cvGenerate", [{ role: "user", content: "Hi" }], mockConfig);
    expect(result).toBe("Primary");
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("localhost:1234"), expect.anything());
  });

  it("falls back to secondary on primary failure when secondaryUse is fallback", async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Primary failed")).mockResolvedValueOnce(ok("Secondary"));
    vi.stubGlobal("fetch", mockFetch);

    const config = { ...mockConfig, secondaryUse: "fallback" as const };
    const result = await runLlm("cvGenerate", [{ role: "user", content: "Hi" }], config);
    expect(result).toBe("Secondary");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not fall back to an unconfigured secondary", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Primary failed")));
    const config = { ...mockConfig, secondaryUse: "fallback" as const, secondary: { ...mockConfig.secondary, model: "" } };
    await expect(runLlm("cvGenerate", [{ role: "user", content: "Hi" }], config)).rejects.toThrow("Primary failed");
  });
});
