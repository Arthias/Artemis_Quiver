import { describe, it, expect, vi } from "vitest";
import { mergeProfileFromUpload } from "../profileMergeService";
import type { LlmConfig } from "../../types/llm";

vi.mock("../llmService", () => ({
  chatCompletion: vi.fn(),
}));

import { chatCompletion } from "../llmService";

const mockConfig: LlmConfig = {
  provider: "lmstudio",
  serverUrl: "/api/lmstudio",
  model: "test",
  temperature: 0.7,
  autoSaveProfile: false,
};

describe("mergeProfileFromUpload", () => {
  it("should return trimmed LLM response", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("# Merged Profile\n\n## Overview\n\nUpdated overview\n");

    const result = await mergeProfileFromUpload("# Current Profile", "Uploaded text", mockConfig);
    expect(result).toBe("# Merged Profile\n\n## Overview\n\nUpdated overview");
  });

  it("should pass both current profile and upload to LLM", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("# Merged");

    await mergeProfileFromUpload("# Current", "New content", mockConfig);

    const calls = vi.mocked(chatCompletion).mock.calls;
    const lastCall = calls[calls.length - 1]!;
    const content = lastCall[0][1]!.content ?? "";
    expect(content).toContain("Current");
    expect(content).toContain("New content");
  });
});
