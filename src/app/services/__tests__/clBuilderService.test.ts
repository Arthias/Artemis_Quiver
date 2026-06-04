import { describe, it, expect, vi } from "vitest";
import { generateCoverLetter, editCoverLetter } from "../clBuilderService";
import type { ModelEndpoint } from "../../types/llm";

vi.mock("../llmService", () => ({
  chatCompletion: vi.fn(),
}));

import { chatCompletion } from "../llmService";

const mockEndpoint: ModelEndpoint = {
  label: "Test",
  provider: "openai-compatible",
  baseUrl: "/api/lmstudio",
  model: "test",
  temperature: 0.7,
};

const validJson = JSON.stringify({
  senderName: "Jane Doe",
  senderTitle: "Engineer",
  date: "May 29, 2026",
  recipientName: "Hiring Manager",
  companyName: "ACME",
  position: "Senior Dev",
  subject: "Application for Senior Dev",
  salutation: "Dear Hiring Manager,",
  bodyParagraphs: ["I am writing to express my interest..."],
  closing: "Sincerely,",
});

const validEditJson = JSON.stringify({
  senderName: "Jane Doe",
  salutation: "Dear Hiring Manager,",
  bodyParagraphs: ["Revised content..."],
  closing: "Sincerely,",
});

describe("generateCoverLetter", () => {
  it("should call LLM with profile and options", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validJson);

    const result = await generateCoverLetter(
      "# Profile\nEngineer",
      { companyName: "ACME", position: "Senior Dev", jobDescription: "React role", seedDraft: "Draft text" },
      mockEndpoint
    );

    const parsed = JSON.parse(result);
    expect(parsed.senderName).toBe("Jane Doe");
    expect(parsed.companyName).toBe("ACME");

    const callArgs = vi.mocked(chatCompletion).mock.calls[0]!;
    const systemContent = callArgs[0].find(m => m.role === "system")?.content ?? "";
    const userContent = callArgs[0].find(m => m.role === "user")?.content ?? "";
    expect(systemContent).toContain("ACME");
    expect(systemContent).toContain("Senior Dev");
    expect(userContent).toContain("React role");
  });

  it("should use defaults for missing options", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validJson);

    const result = await generateCoverLetter("# Profile", {}, mockEndpoint);
    const parsed = JSON.parse(result);
    expect(parsed.senderName).toBe("Jane Doe");
  });

  it("should handle undefined job description safely", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validJson);

    const result = await generateCoverLetter(
      "# Profile",
      { companyName: undefined, position: undefined },
      mockEndpoint
    );
    const parsed = JSON.parse(result);
    expect(parsed.senderName).toBe("Jane Doe");
  });
});

describe("editCoverLetter", () => {
  it("should call LLM with edit request", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(validEditJson);

    const result = await editCoverLetter(validJson, "Make it formal", "# Profile", mockEndpoint);
    const parsed = JSON.parse(result);
    expect(parsed.bodyParagraphs[0]).toBe("Revised content...");
  });
});
