import { describe, it, expect, vi } from "vitest";
import { profileChat, extractUpdatedProfile } from "../profileChatService";
import type { ChatMessage, LlmConfig, ModelEndpoint } from "../../types/llm";

vi.mock("../llmService", () => ({
  runLlm: vi.fn(),
}));

import { runLlm } from "../llmService";

const endpoint: ModelEndpoint = {
  label: "Test",
  provider: "openai-compatible",
  baseUrl: "/api/lmstudio",
  model: "test",
  temperature: 0.7,
};

const mockConfig: LlmConfig = { providerMode: "cloud", primary: endpoint, secondary: endpoint, secondaryUse: "never", autoSaveProfile: false };

describe("profileChat", () => {
  it("should include system prompt with current profile", async () => {
    vi.mocked(runLlm).mockResolvedValue("Suggestion text");

    const messages: ChatMessage[] = [{ role: "user", content: "Improve my summary" }];
    const result = await profileChat(messages, "# Current profile", mockConfig);

    expect(result).toBe("Suggestion text");
    const callArgs = vi.mocked(runLlm).mock.calls[0]!;
    const systemContent = callArgs[1][0]!.content ?? "";
    expect(systemContent).toContain("# Current profile");
  });

  it("should pass user messages to LLM", async () => {
    vi.mocked(runLlm).mockResolvedValue("Response");

    const messages: ChatMessage[] = [
      { role: "user", content: "First message" },
      { role: "assistant", content: "First reply" },
      { role: "user", content: "Second message" },
    ];
    await profileChat(messages, "# Profile", mockConfig);

    const calls = vi.mocked(runLlm).mock.calls;
    const lastCall = calls[calls.length - 1]!;
    const userMessages = lastCall[1].filter(m => m.role === "user");
    expect(userMessages).toHaveLength(2);
  });
});

describe("extractUpdatedProfile", () => {
  it("should extract profile after UPDATED_PROFILE: marker", () => {
    const reply = "Some text\nUPDATED_PROFILE:\n# New Profile\n\nContent";
    const result = extractUpdatedProfile(reply);
    expect(result).toBe("# New Profile\n\nContent");
  });

  it("should return null when marker is absent", () => {
    const result = extractUpdatedProfile("Just regular text");
    expect(result).toBeNull();
  });

  it("should handle marker at start of string", () => {
    const result = extractUpdatedProfile("UPDATED_PROFILE:\n# Profile");
    expect(result).toBe("# Profile");
  });
});
