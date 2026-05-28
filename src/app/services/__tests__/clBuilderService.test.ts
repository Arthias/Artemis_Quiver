import { describe, it, expect, vi } from "vitest";
import { generateCoverLetter, editCoverLetter } from "../clBuilderService";
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

describe("generateCoverLetter", () => {
  it("should call LLM with profile and options", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Dear ACME team...");

    const result = await generateCoverLetter(
      "# Profile\nEngineer",
      { companyName: "ACME", position: "Senior Dev", jobDescription: "React role", seedDraft: "Draft text" },
      mockConfig
    );

    expect(result).toBe("Dear ACME team...");
    const callArgs = vi.mocked(chatCompletion).mock.calls[0]!;
    const content = callArgs[0][1]!.content ?? "";
    expect(content).toContain("ACME");
    expect(content).toContain("Senior Dev");
    expect(content).toContain("React role");
  });

  it("should use defaults for missing options", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Dear hiring manager...");

    const result = await generateCoverLetter("# Profile", {}, mockConfig);
    expect(result).toBe("Dear hiring manager...");
  });

  it("should handle undefined job description safely", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Dear team...");

    const result = await generateCoverLetter(
      "# Profile",
      { companyName: undefined, position: undefined },
      mockConfig
    );
    expect(result).toBe("Dear team...");
  });
});

describe("editCoverLetter", () => {
  it("should call LLM with edit request", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Revised letter content");

    const result = await editCoverLetter("Original", "Make it formal", "# Profile", mockConfig);
    expect(result).toBe("Revised letter content");
  });
});
