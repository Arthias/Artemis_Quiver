import { describe, it, expect, vi } from "vitest";
import { generateCv, editCv } from "../cvBuilderService";
import type { LlmConfig } from "../../types/llm";

vi.mock("../llmService", () => ({
  chatCompletion: vi.fn(),
}));

import { chatCompletion } from "../llmService";

const mockConfig: LlmConfig = {
  provider: "ollama",
  serverUrl: "http://localhost:11434",
  model: "test-model",
  temperature: 0.7,
  autoSaveProfile: true,
};

const validCvJson = JSON.stringify({
  sections: [
    { type: "summary", content: "Experienced developer" },
    { type: "skills", skills: ["React", "TypeScript"] },
    { type: "experience", experience: [{ role: "Dev", company: "Co", period: "2020-2023", description: "Built stuff" }] },
  ],
});

describe("generateCv", () => {
  it("should return normalized JSON string on success", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    const result = await generateCv("# Profile\nDeveloper", "Software Engineer", ["Add metrics"], mockConfig);

    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);
    expect(parsed.sections[0].type).toBe("summary");
  });

  it("should handle empty job description gracefully", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    const result = await generateCv("# Profile\nDeveloper", undefined, undefined, mockConfig);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);
  });

  it("should throw on malformed JSON response", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("not json");

    await expect(generateCv("# Profile", "Job", [], mockConfig)).rejects.toThrow();
  });

  it("should normalize key-based sections to type-based", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
      sections: [
        { summary: "Lead dev with 10 years" },
        { skills: ["Go", "Kubernetes"] },
      ],
    }));

    const result = await generateCv("# Profile", "Job", [], mockConfig);
    const parsed = JSON.parse(result);
    expect(parsed.sections[0].type).toBe("summary");
    expect(parsed.sections[0].content).toBe("Lead dev with 10 years");
    expect(parsed.sections[1].type).toBe("skills");
    expect(parsed.sections[1].skills).toEqual(["Go", "Kubernetes"]);
  });

  it("should include recommendations in the prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    await generateCv("# Profile", "Job", ["Add cloud skills", "Improve metrics"], mockConfig);

    const calls = vi.mocked(chatCompletion).mock.calls;
    const lastCall = calls[calls.length - 1]!;
    const userContent = lastCall[0][2]!.content ?? "";
    expect(userContent).toContain("Add cloud skills");
    expect(userContent).toContain("Improve metrics");
  });
});

describe("editCv", () => {
  it("should call LLM with edit prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    const result = await editCv(validCvJson, "Make it shorter", "# Profile", mockConfig);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toBeDefined();
  });
});
