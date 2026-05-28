import { describe, it, expect, vi } from "vitest";
import { analyzeJobPosting, analysisToMarkdown, followUpChat } from "../jobAnalysisService";
import type { AnalysisResult } from "../../types/analysis";
import type { ChatMessage, LlmConfig } from "../../types/llm";

vi.mock("../llmService", () => ({
  chatCompletion: vi.fn(),
}));

import { chatCompletion } from "../llmService";

const mockConfig: LlmConfig = {
  provider: "lmstudio",
  serverUrl: "/api/lmstudio",
  model: "test-model",
  temperature: 0.7,
  autoSaveProfile: true,
};

describe("analyzeJobPosting", () => {
  it("should parse a valid LLM response", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
      score: 85,
      salaryRange: "$100k-$120k",
      summary: "Strong match",
      tips: ["Highlight React experience", "Emphasize leadership"],
      cvRecommendations: ["Add metrics", "Reorder skills"],
      coverLetterDraft: "Dear hiring manager...",
    }));

    const { result, markdown } = await analyzeJobPosting(
      "React Developer position",
      "## Profile\nSenior engineer",
      mockConfig
    );

    expect(result.score).toBe(85);
    expect(result.salaryRange).toBe("$100k-$120k");
    expect(result.tips).toHaveLength(2);
    expect(result.cvRecommendations).toHaveLength(2);
    expect(result.coverLetterDraft).toBe("Dear hiring manager...");
    expect(markdown).toContain("85%");
    expect(markdown).toContain("React Developer position");
  });

  it("should throw on missing score", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
      salaryRange: "$100k",
      tips: ["Tip 1"],
      cvRecommendations: ["Rec 1"],
      coverLetterDraft: "Draft",
    }));

    await expect(analyzeJobPosting("test", "profile", mockConfig)).rejects.toThrow("valid score");
  });

  it("should throw on missing required fields", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
      score: 80,
      salaryRange: "$100k",
      tips: [],
      cvRecommendations: [],
      coverLetterDraft: "",
    }));

    await expect(analyzeJobPosting("test", "profile", mockConfig)).rejects.toThrow("missing required fields");
  });

  it("should handle LLM returning markdown-wrapped JSON", async () => {
    vi.mocked(chatCompletion).mockResolvedValue('```json\n{"score": 92, "salaryRange": "$130k", "tips": ["Tip"], "cvRecommendations": ["Rec"], "coverLetterDraft": "Draft"}\n```');

    const { result } = await analyzeJobPosting("test", "profile", mockConfig);
    expect(result.score).toBe(92);
  });
});

describe("analysisToMarkdown", () => {
  const result: AnalysisResult = {
    score: 75,
    salaryRange: "$90k-$110k",
    summary: "Good fit",
    tips: ["Prepare for system design"],
    cvRecommendations: ["Add cloud skills"],
    coverLetterDraft: "Dear team...",
  };

  it("should generate markdown with all sections", () => {
    const md = analysisToMarkdown("Senior DevOps", result);
    expect(md).toContain("75%");
    expect(md).toContain("Senior DevOps");
    expect(md).toContain("Prepare for system design");
    expect(md).toContain("Add cloud skills");
    expect(md).toContain("Dear team...");
  });
});

describe("followUpChat", () => {
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
  });

  it("should call LLM with follow-up system prompt and context", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Here is tailored advice...");

    const messages: ChatMessage[] = [
      { role: "user", content: "Why should I work here?" },
    ];

    const reply = await followUpChat(
      "Software Engineer job at Google",
      "## Profile\nExperienced developer",
      messages,
      mockConfig
    );

    expect(reply).toBe("Here is tailored advice...");
    const calls = vi.mocked(chatCompletion).mock.calls;
    const systemContent = calls[0][0][0]?.content ?? "";
    expect(systemContent).toContain("job application coach");
    expect(systemContent).toContain("follow-up");
  });

  it("should handle empty message history", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("First follow-up response");

    const reply = await followUpChat("Job posting", "Profile", [], mockConfig);
    expect(reply).toBe("First follow-up response");
  });

  it("should include job posting and profile in the prompt", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Response");

    await followUpChat("Senior React role", "Frontend profile", [], mockConfig);

    const calls = vi.mocked(chatCompletion).mock.calls;
    const userContent = calls[0][0].find(m => m.role === "user")?.content ?? "";
    expect(userContent).toContain("Senior React role");
    expect(userContent).toContain("Frontend profile");
  });
});
