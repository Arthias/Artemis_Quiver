import { describe, it, expect, vi } from "vitest";
import { generateCv, editCv, optimizeCv } from "../cvBuilderService";
import type { ModelEndpoint } from "../../types/llm";
import { AppError, ErrorCodes } from "../../utils/errors";

vi.mock("../llmService", () => ({
  chatCompletion: vi.fn(),
}));

import { chatCompletion } from "../llmService";

const mockEndpoint: ModelEndpoint = {
  label: "Test",
  provider: "openai-compatible",
  baseUrl: "http://localhost:11434",
  model: "test-model",
  temperature: 0.7,
};

const validCvJson = JSON.stringify({
  name: "Test User",
  title: "Software Engineer",
  sections: [
    { type: "summary", content: "Experienced developer" },
    { type: "skills", skills: ["React", "TypeScript"] },
    { type: "experience", experience: [{ role: "Dev", company: "Co", period: "2020-2023", location: "Remote", bullets: ["Built stuff"] }] },
  ],
});

describe("generateCv", () => {
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
  });

  it("should return normalized JSON string on success", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    const result = await generateCv("# Profile\nDeveloper", "Software Engineer", ["Add metrics"], mockEndpoint);

    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);
    expect(parsed.sections[0].type).toBe("summary");
  });

  it("should handle empty job description gracefully", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    const result = await generateCv("# Profile\nDeveloper", undefined, undefined, mockEndpoint);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);
  });

  it("should retry 4 times on malformed JSON then throw AppError", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("not json");

    await expect(generateCv("# Profile", "Job", [], mockEndpoint)).rejects.toThrow(AppError);
    expect(vi.mocked(chatCompletion)).toHaveBeenCalledTimes(4);
  });

  it("should succeed on 2nd attempt after initial JSON failure", async () => {
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce("bad json")
      .mockResolvedValueOnce(validCvJson);

    const result = await generateCv("# Profile", "Job", [], mockEndpoint);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);
    expect(vi.mocked(chatCompletion)).toHaveBeenCalledTimes(2);
  });

  it("should include corrective feedback on 3rd attempt", async () => {
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce("bad json")
      .mockResolvedValueOnce("bad json again")
      .mockResolvedValueOnce(validCvJson);

    const result = await generateCv("# Profile", "Job", [], mockEndpoint);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);

    const calls = vi.mocked(chatCompletion).mock.calls;
    // 3rd call (index 2) should have corrective feedback
    const thirdCallMessages = calls[2][0];
    const userRoles = thirdCallMessages.filter((m: any) => m.role === "user");
    expect(userRoles.length).toBeGreaterThanOrEqual(2);
    const lastUser = userRoles[userRoles.length - 1].content ?? "";
    expect(lastUser).toContain("Fix the JSON formatting error");
  });

  it("should normalize key-based sections to type-based", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
      name: "Test User",
      title: "Engineer",
      sections: [
        { summary: "Lead dev with 10 years" },
        { skills: ["Go", "Kubernetes"] },
      ],
    }));

    const result = await generateCv("# Profile", "Job", [], mockEndpoint);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("Test User");
    expect(parsed.sections[0].type).toBe("summary");
    expect(parsed.sections[0].content).toBe("Lead dev with 10 years");
    expect(parsed.sections[1].type).toBe("skills");
    expect(parsed.sections[1].skills).toEqual(["Go", "Kubernetes"]);
  });

  it("should include recommendations in the prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    await generateCv("# Profile", "Job", ["Add cloud skills", "Improve metrics"], mockEndpoint);

    const calls = vi.mocked(chatCompletion).mock.calls;
    const lastCall = calls[calls.length - 1]!;
    const userContent = lastCall[0].find(m => m.role === "user")!.content ?? "";
    expect(userContent).toContain("Add cloud skills");
    expect(userContent).toContain("Improve metrics");
  });

  it("should pass industry and target role context in prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validCvJson);

    await generateCv("# Profile", "Job", [], mockEndpoint, {
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

    const result = await generateCv("# Profile", undefined, undefined, mockEndpoint, {
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

    const result = await editCv(validCvJson, "Make it shorter", "# Profile", mockEndpoint);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toBeDefined();
  });

  it("should retry on malformed JSON and throw AppError", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("bad json");

    await expect(editCv(validCvJson, "Make it shorter", "# Profile", mockEndpoint)).rejects.toThrow(AppError);
    expect(vi.mocked(chatCompletion)).toHaveBeenCalledTimes(4);
  });
});

describe("optimizeCv", () => {
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
  });

  it("should call LLM with audit mode prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Your CV is too vague in the experience section...");

    const result = await optimizeCv("# Profile", "audit", mockEndpoint, {
      targetRole: "PM",
      industry: "SaaS",
    });

    expect(result).toContain("vague");
  });

  it("should pass context fields to the prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Transition feedback");

    await optimizeCv("# Profile", "career-transition", mockEndpoint, {
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
      const result = await optimizeCv("# Profile", mode, mockEndpoint);
      expect(result).toBe(`Result for ${mode}`);
    }
  });
});
