import { describe, it, expect } from "vitest";
import { normalizeBaseUrl } from "../shared";

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeBaseUrl("http://localhost:11434/")).toBe("http://localhost:11434");
    expect(normalizeBaseUrl("http://localhost:11434///")).toBe("http://localhost:11434");
  });

  it("strips a trailing /v1 so adapters don't double it up", () => {
    expect(normalizeBaseUrl("https://openrouter.ai/api/v1")).toBe("https://openrouter.ai/api");
    expect(normalizeBaseUrl("https://openrouter.ai/api/v1/")).toBe("https://openrouter.ai/api");
    expect(normalizeBaseUrl("https://api.openai.com/v1")).toBe("https://api.openai.com");
  });

  it("leaves URLs without a trailing /v1 unchanged", () => {
    expect(normalizeBaseUrl("http://localhost:11434")).toBe("http://localhost:11434");
    expect(normalizeBaseUrl("http://localhost:1234")).toBe("http://localhost:1234");
  });

  it("does not strip version suffixes that merely start with v1 (e.g. Gemini's v1beta)", () => {
    expect(normalizeBaseUrl("https://generativelanguage.googleapis.com/v1beta")).toBe(
      "https://generativelanguage.googleapis.com/v1beta"
    );
  });
});
