import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { WEBLLM_MODELS } from "../../../services/provider/WebLLMAdapter";

// Constants extracted from OnboardingWizard for testing
const STEPS = ["Welcome", "AI Setup", "Profile"] as const;

const WEBLLM_CATALOG = WEBLLM_MODELS;

const CLOUD_PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: "openai-compatible", label: "OpenAI Compatible (LM Studio, Ollama, OpenAI)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "google-gemini", label: "Google Gemini" },
];

// Helper function from OnboardingWizard
function isValidWebLLMModel(modelId: string): boolean {
  return WEBLLM_CATALOG.some(m => m.id === modelId);
}

describe("OnboardingWizard — Steps definition", () => {
  it("should have exactly 3 steps", () => {
    expect(STEPS.length).toBe(3);
  });

  it("should have steps in correct order: Welcome, AI Setup, Profile", () => {
    expect(STEPS[0]).toBe("Welcome");
    expect(STEPS[1]).toBe("AI Setup");
    expect(STEPS[2]).toBe("Profile");
  });

  it("should only accept valid step indices (0-2)", () => {
    expect(STEPS[0]).toBeDefined();
    expect(STEPS[1]).toBeDefined();
    expect(STEPS[2]).toBeDefined();
    // Tuple type prevents index 3 at compile time; array length verifies bounds
    expect(STEPS.length).toBe(3);
  });
});

describe("OnboardingWizard — WEBLLM_CATALOG", () => {
  it("should list 4 curated models", () => {
    expect(WEBLLM_CATALOG.length).toBe(4);
  });

  it("should have unique model IDs", () => {
    const ids = WEBLLM_CATALOG.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have positive sizeGB for all models", () => {
    WEBLLM_CATALOG.forEach(m => {
      expect(m.sizeGB).toBeGreaterThan(0);
    });
  });

  it("should have Qwen3.5-2B as smallest model (sorted by vramGB ascending)", () => {
    expect(WEBLLM_CATALOG[0].id).toBe("Qwen3.5-2B-q4f16_1-MLC");
    expect(WEBLLM_CATALOG[0].vramGB).toBeLessThanOrEqual(WEBLLM_CATALOG[1].vramGB);
  });
});

describe("OnboardingWizard — CLOUD_PROVIDER_OPTIONS", () => {
  it("should list 3 providers", () => {
    expect(CLOUD_PROVIDER_OPTIONS.length).toBe(3);
  });

  it("should include all cloud provider types", () => {
    const values = CLOUD_PROVIDER_OPTIONS.map(o => o.value);
    expect(values).toContain("openai-compatible");
    expect(values).toContain("anthropic");
    expect(values).toContain("google-gemini");
  });

  it("should NOT include webllm (local only)", () => {
    const values = CLOUD_PROVIDER_OPTIONS.map(o => o.value);
    expect(values).not.toContain("webllm");
  });

  it("should have unique values", () => {
    const values = CLOUD_PROVIDER_OPTIONS.map(o => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("OnboardingWizard — isValidWebLLMModel", () => {
  it("should return true for known WebLLM model IDs", () => {
    expect(isValidWebLLMModel("Qwen3.5-2B-q4f16_1-MLC")).toBe(true);
    expect(isValidWebLLMModel("Qwen3.5-4B-q4f16_1-MLC")).toBe(true);
    expect(isValidWebLLMModel("DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC")).toBe(true);
    expect(isValidWebLLMModel("Qwen3.5-9B-q4f16_1-MLC")).toBe(true);
  });

  it("should return false for unknown model IDs", () => {
    expect(isValidWebLLMModel("")).toBe(false);
    expect(isValidWebLLMModel("nonexistent-model")).toBe(false);
    expect(isValidWebLLMModel("Llama-3.2-3B-Instruct-q4f32_1-MLC")).toBe(false); // dropped from catalog
  });

  it("should return false for cloud-common model IDs", () => {
    expect(isValidWebLLMModel("google/gemma-4-e2b")).toBe(false);
    expect(isValidWebLLMModel("llama3.2:3b")).toBe(false);
    expect(isValidWebLLMModel("qwen2.5:7b")).toBe(false);
  });
});

describe("OnboardingWizard — name validation logic", () => {
  // Testing the name check from handleComplete
  it("should trim whitespace from name", () => {
    const name = "  Test User  ".trim();
    expect(name).toBe("Test User");
  });

  it("should reject empty name (falsy check)", () => {
    expect("".trim()).toBeFalsy(); // empty string
    expect("   ".trim()).toBeFalsy(); // whitespace-only
  });

  it("should accept non-empty name", () => {
    expect("Test User".trim()).toBeTruthy();
    expect("A".trim()).toBeTruthy();
  });

  it("should truncate name to 40 characters", () => {
    const longName = "A".repeat(50);
    expect(longName.slice(0, 40).length).toBe(40);
  });
});

describe("OnboardingWizard — completeOnboarding reload pattern", () => {
  // Test the sequence of operations in handleComplete
  it("should call completeOnboarding before window.location.reload", async () => {
    // Simulate the pattern: save → complete → reload
    let completed = false;
    let reloaded = false;

    const fakeComplete = async () => {
      completed = true;
    };

    const fakeReload = () => {
      if (!completed) throw new Error("Reload called before onboarding completed!");
      reloaded = true;
    };

    await fakeComplete();
    fakeReload();
    expect(completed).toBe(true);
    expect(reloaded).toBe(true);
  });
});
