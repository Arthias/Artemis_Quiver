import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LlmConfig } from "../../types/llm";

vi.mock("../llmService", () => ({ runLlm: vi.fn() }));

import { runLlm } from "../llmService";
import { runLlmJson } from "../llmJson";

const ep = { label: "T", provider: "openai-compatible" as const, baseUrl: "http://x", model: "m", temperature: 0 };
const config: LlmConfig = { providerMode: "cloud", primary: ep, secondary: ep, secondaryUse: "never", autoSaveProfile: false };
const parse = (raw: string) => JSON.parse(raw) as { ok: boolean };

describe("runLlmJson", () => {
  beforeEach(() => { vi.mocked(runLlm).mockReset(); });

  it("asks for JSON mode and returns the parsed reply", async () => {
    vi.mocked(runLlm).mockResolvedValueOnce('{"ok":true}');
    expect(await runLlmJson("cvGenerate", [{ role: "user", content: "hi" }], config, parse)).toEqual({ ok: true });
    expect(vi.mocked(runLlm).mock.calls[0]![3]).toMatchObject({ json: true });
  });

  it("repairs once by showing the model its reply and the error", async () => {
    vi.mocked(runLlm).mockResolvedValueOnce("oops").mockResolvedValueOnce('{"ok":true}');
    expect(await runLlmJson("cvGenerate", [{ role: "user", content: "hi" }], config, parse)).toEqual({ ok: true });
    const retry = vi.mocked(runLlm).mock.calls[1]![1];
    expect(retry).toHaveLength(3);
    expect(retry[1]).toEqual({ role: "assistant", content: "oops" });
    expect(retry[2]!.content).toContain("Fix the JSON formatting error");
  });

  it("throws onExhausted's error after the last attempt", async () => {
    vi.mocked(runLlm).mockResolvedValue("oops");
    await expect(runLlmJson("cvGenerate", [], config, parse, { attempts: 3, onExhausted: () => new Error("gave up") }))
      .rejects.toThrow("gave up");
    expect(runLlm).toHaveBeenCalledTimes(3);
  });

  it("does not retry model or network errors", async () => {
    vi.mocked(runLlm).mockRejectedValue(new Error("down"));
    await expect(runLlmJson("cvGenerate", [], config, parse)).rejects.toThrow("down");
    expect(runLlm).toHaveBeenCalledTimes(1);
  });
});
