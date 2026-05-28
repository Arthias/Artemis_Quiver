import { describe, it, expect, vi } from "vitest";
import { generateCv, editCv, optimizeCv } from "../cvBuilderService";
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
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
  });

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
    const userContent = lastCall[0].find(m => m.role === "user")!.content ?? "";
    expect(userContent).toContain("Add cloud skills");
    expect(userContent).toContain("Improve metrics");
  });

  it("should pass industry and target role context in prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    await generateCv("# Profile", "Job", [], mockConfig, {
      targetRole: "Senior Engineer",
      industry: "FinTech",
    });

    const calls = vi.mocked(chatCompletion).mock.calls;
    const systemContent = calls[0][0].find(m => m.role === "system")?.content ?? "";
    expect(systemContent).toContain("Senior Engineer");
    expect(systemContent).toContain("FinTech");
  });

  it("should return raw text for non-JSON optimization modes", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Concise summary text");

    const result = await generateCv("# Profile", undefined, undefined, mockConfig, {
      mode: "summary-rewrite",
      targetRole: "Designer",
    });

    expect(result).toBe("Concise summary text");
  });
});

describe("editCv", () => {
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
  });

  it("should call LLM with edit prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    const result = await editCv(validCvJson, "Make it shorter", "# Profile", mockConfig);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toBeDefined();
  });
});

describe("optimizeCv", () => {
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
  });

  it("should call LLM with audit mode prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Your CV is too vague in the experience section...");

    const result = await optimizeCv("# Profile", "audit", mockConfig, {
      targetRole: "PM",
      industry: "SaaS",
    });

    expect(result).toContain("vague");
  });

  it("should pass context fields to the prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Transition feedback");

    await optimizeCv("# Profile", "career-transition", mockConfig, {
      previousField: "Marketing",
      newField: "Product",
      jobDescription: "Looking for a PM",
    });

    const calls = vi.mocked(chatCompletion).mock.calls;
    const systemContent = calls[0][0].find(m => m.role === "system")?.content ?? "";
    expect(systemContent).toContain("Marketing");
    expect(systemContent).toContain("Product");
  });

  it("should handle all optimization modes without error", async () => {
    const modes = [
      "summary-rewrite", "bullet-optimize", "ats-optimize",
      "career-transition", "audit", "work-history-align",
      "skills-section", "headline", "hiring-manager",
    ] as const;

    for (const mode of modes) {
      vi.mocked(chatCompletion).mockResolvedValue(`Result for ${mode}`);
      const result = await optimizeCv("# Profile", mode, mockConfig);
      expect(result).toBe(`Result for ${mode}`);
    }
  });
});
