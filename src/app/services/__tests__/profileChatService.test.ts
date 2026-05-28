import { describe, it, expect, vi } from "vitest";
import { profileChat, extractUpdatedProfile } from "../profileChatService";
import type { ChatMessage, LlmConfig } from "../../types/llm";

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

describe("profileChat", () => {
  it("should include system prompt with current profile", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Suggestion text");

    const messages: ChatMessage[] = [{ role: "user", content: "Improve my summary" }];
    const result = await profileChat(messages, "# Current profile", mockConfig);

    expect(result).toBe("Suggestion text");
    const callArgs = vi.mocked(chatCompletion).mock.calls[0]!;
    const systemContent = callArgs[0][0]!.content ?? "";
    expect(systemContent).toContain("# Current profile");
  });

  it("should pass user messages to LLM", async () => {
    vi.mocked(chatCompletion).mockResolvedValue("Response");

    const messages: ChatMessage[] = [
      { role: "user", content: "First message" },
      { role: "assistant", content: "First reply" },
      { role: "user", content: "Second message" },
    ];
    await profileChat(messages, "# Profile", mockConfig);

    const calls = vi.mocked(chatCompletion).mock.calls;
    const lastCall = calls[calls.length - 1]!;
    const userMessages = lastCall[0].filter(m => m.role === "user");
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
