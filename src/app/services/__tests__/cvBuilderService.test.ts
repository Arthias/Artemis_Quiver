import { describe, it, expect, vi } from "vitest";
import { generateCv, editCv, optimizeCv } from "../cvBuilderService";
import type { LlmConfig, ModelEndpoint } from "../../types/llm";
import { AppError } from "../../utils/errors";

vi.mock("../llmService", () => ({
  runLlm: vi.fn(),
}));

import { runLlm } from "../llmService";

const endpoint: ModelEndpoint = {
  label: "Test",
  provider: "openai-compatible",
  baseUrl: "http://localhost:11434",
  model: "test-model",
  temperature: 0.7,
};

const mockConfig: LlmConfig = { providerMode: "cloud", primary: endpoint, secondary: endpoint, secondaryUse: "never", autoSaveProfile: false };

const validCvJson = JSON.stringify({
  name: "Test User",
  title: "Software Engineer",
  sections: [
    { type: "summary", content: "Experienced developer" },
    { type: "skills", skills: ["React", "TypeScript"] },
    { type: "experience", experience: [{ role: "Dev", company: "Co", period: "2020-2023", location: "Remote", bullets: ["Built stuff"] }] },
  ],
});

function lastSystemPrompt(): string {
  const calls = vi.mocked(runLlm).mock.calls;
  return calls[calls.length - 1]![1].find((m) => m.role === "system")!.content ?? "";
}

describe("generateCv", () => {
  beforeEach(() => {
    vi.mocked(runLlm).mockReset();
  });

  it("should return normalized JSON string on success", async () => {
    vi.mocked(runLlm).mockResolvedValue(validCvJson);

    const result = await generateCv("# Profile\nDeveloper", "Software Engineer", ["Add metrics"], mockConfig);

    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);
    expect(parsed.sections[0].type).toBe("summary");
  });

  it("should handle empty job description gracefully", async () => {
    vi.mocked(runLlm).mockResolvedValue(validCvJson);

    const result = await generateCv("# Profile\nDeveloper", undefined, undefined, mockConfig);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);
  });

  it("should retry 4 times on malformed JSON then throw AppError", async () => {
    vi.mocked(runLlm).mockResolvedValue("not json");

    await expect(generateCv("# Profile", "Job", [], mockConfig)).rejects.toThrow(AppError);
    expect(vi.mocked(runLlm)).toHaveBeenCalledTimes(4);
  });

  it("should succeed on 2nd attempt after initial JSON failure", async () => {
    vi.mocked(runLlm)
      .mockResolvedValueOnce("bad json")
      .mockResolvedValueOnce(validCvJson);

    const result = await generateCv("# Profile", "Job", [], mockConfig);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);
    expect(vi.mocked(runLlm)).toHaveBeenCalledTimes(2);
  });

  it("should include corrective feedback on 3rd attempt", async () => {
    vi.mocked(runLlm)
      .mockResolvedValueOnce("bad json")
      .mockResolvedValueOnce("bad json again")
      .mockResolvedValueOnce(validCvJson);

    const result = await generateCv("# Profile", "Job", [], mockConfig);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(3);

    const calls = vi.mocked(runLlm).mock.calls;
    // 3rd call (index 2) should have corrective feedback
    const thirdCallMessages = calls[2]?.[1] ?? [];
    const userRoles = thirdCallMessages.filter((m: any) => m.role === "user");
    expect(userRoles.length).toBeGreaterThanOrEqual(2);
    const lastUser = userRoles[userRoles.length - 1]?.content ?? "";
    expect(lastUser).toContain("Fix the JSON formatting error");
  });

  it("should normalize key-based sections to type-based", async () => {
    vi.mocked(runLlm).mockResolvedValue(JSON.stringify({
      name: "Test User",
      title: "Engineer",
      sections: [
        { summary: "Lead dev with 10 years" },
        { skills: ["Go", "Kubernetes"] },
      ],
    }));

    const result = await generateCv("# Profile", "Job", [], mockConfig);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("Test User");
    expect(parsed.sections[0].type).toBe("summary");
    expect(parsed.sections[0].content).toBe("Lead dev with 10 years");
    expect(parsed.sections[1].type).toBe("skills");
    expect(parsed.sections[1].skills).toEqual(["Go", "Kubernetes"]);
  });

  it("should strip placeholder values like 'N/A' from optional location fields", async () => {
    vi.mocked(runLlm).mockResolvedValue(JSON.stringify({
      name: "Test User",
      title: "Engineer",
      sections: [
        { type: "contact", email: "test@example.com", phone: "N/A", location: "Remote" },
        {
          type: "experience",
          experience: [{ role: "Dev", company: "Co", period: "2020-2023", location: "n/a", bullets: [] }],
        },
        {
          type: "education",
          education: [{ degree: "BSc", institution: "MIT", period: "2016-2020", location: "TBD" }],
        },
      ],
    }));

    const result = await generateCv("# Profile", "Job", [], mockConfig);
    const parsed = JSON.parse(result);
    const [contact, experience, education] = parsed.sections;
    expect(contact.phone).toBeUndefined();
    expect(contact.location).toBe("Remote");
    expect(experience.experience[0].location).toBeUndefined();
    expect(education.education[0].location).toBeUndefined();
  });

  it("should turn language objects into 'Language (Level)' strings", async () => {
    vi.mocked(runLlm).mockResolvedValue(JSON.stringify({
      name: "Test User",
      title: "Engineer",
      sections: [
        { type: "languages", languages: ["Italian (B2)", { language: "Spanish", level: "Native" }, { name: "English" }, { level: "C1" }] },
        { languages: [{ language: "French", proficiency: "A2" }] },
      ],
    }));

    const parsed = JSON.parse(await generateCv("# Profile", "Job", [], mockConfig));
    expect(parsed.sections[0].languages).toEqual(["Italian (B2)", "Spanish (Native)", "English"]);
    expect(parsed.sections[1]).toEqual({ type: "languages", languages: ["French (A2)"] });
  });

  it("should write in the chosen output language, not the app's", async () => {
    vi.mocked(runLlm).mockResolvedValue(validCvJson);
    await generateCv("# Profile", "Job", [], mockConfig, { locale: "it" });
    const system = lastSystemPrompt();
    expect(system).toContain("Respond ENTIRELY in Italian");

    vi.mocked(runLlm).mockResolvedValue(validCvJson);
    await editCv(validCvJson, "Shorter", "# Profile", mockConfig, "es");
    const editSystem = lastSystemPrompt();
    expect(editSystem).toContain("Respond ENTIRELY in Spanish");
  });

  it("should include recommendations in the prompt", async () => {
    vi.mocked(runLlm).mockResolvedValue(validCvJson);

    await generateCv("# Profile", "Job", ["Add cloud skills", "Improve metrics"], mockConfig);

    const calls = vi.mocked(runLlm).mock.calls;
    const lastCall = calls[calls.length - 1]!;
    const userContent = lastCall[1].find(m => m.role === "user")!.content ?? "";
    expect(userContent).toContain("Add cloud skills");
    expect(userContent).toContain("Improve metrics");
  });

  it("should pass industry and target role context in prompt", async () => {
    vi.mocked(runLlm).mockResolvedValue(validCvJson);

    await generateCv("# Profile", "Job", [], mockConfig, {
      targetRole: "Senior Engineer",
      industry: "FinTech",
    });

    const calls = vi.mocked(runLlm).mock.calls;
    const systemContent = calls[0]?.[1]?.find(m => m.role === "system")?.content ?? "";
    expect(systemContent).toContain("Senior Engineer");
    expect(systemContent).toContain("FinTech");
  });

  it("should return raw text for non-JSON optimization modes", async () => {
    vi.mocked(runLlm).mockResolvedValue("Concise summary text");

    const result = await generateCv("# Profile", undefined, undefined, mockConfig, {
      mode: "audit",
      targetRole: "Designer",
    });

    expect(result).toBe("Concise summary text");
  });
});

describe("editCv", () => {
  beforeEach(() => {
    vi.mocked(runLlm).mockReset();
  });

  it("should call LLM with edit prompt", async () => {
    vi.mocked(runLlm).mockResolvedValue(validCvJson);

    const result = await editCv(validCvJson, "Make it shorter", "# Profile", mockConfig);
    const parsed = JSON.parse(result);
    expect(parsed.sections).toBeDefined();
  });

  it("should retry on malformed JSON and throw AppError", async () => {
    vi.mocked(runLlm).mockResolvedValue("bad json");

    await expect(editCv(validCvJson, "Make it shorter", "# Profile", mockConfig)).rejects.toThrow(AppError);
    expect(vi.mocked(runLlm)).toHaveBeenCalledTimes(4);
  });
});

describe("optimizeCv", () => {
  beforeEach(() => {
    vi.mocked(runLlm).mockReset();
  });

  it("should call LLM with audit mode prompt", async () => {
    vi.mocked(runLlm).mockResolvedValue("Your CV is too vague in the experience section...");

    const result = await optimizeCv("# Profile", "audit", mockConfig, {
      targetRole: "PM",
      industry: "SaaS",
    });

    expect(result).toContain("vague");
  });

  it("should pass context fields to the prompt", async () => {
    vi.mocked(runLlm).mockResolvedValue("Hiring manager feedback");

    await optimizeCv("# Profile", "hiring-manager", mockConfig, {
      targetRole: "Product Manager",
      industry: "SaaS",
      jobDescription: "Looking for a PM",
    });

    const calls = vi.mocked(runLlm).mock.calls;
    const systemContent = calls[0]?.[1]?.find(m => m.role === "system")?.content ?? "";
    expect(systemContent).toContain("Product Manager");
    expect(systemContent).toContain("SaaS");
  });

  it("should handle all optimization modes without error", async () => {
    const modes = ["ats-optimize", "audit", "hiring-manager"] as const;

    for (const mode of modes) {
      vi.mocked(runLlm).mockResolvedValue(`Result for ${mode}`);
      const result = await optimizeCv("# Profile", mode, mockConfig);
      expect(result).toBe(`Result for ${mode}`);
    }
  });
});
