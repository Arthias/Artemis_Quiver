import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../db/schema";

// We test the raw DB operations that OnboardingContext wraps
const ONBOARDING_META_KEY = "artemis:onboardingComplete";

async function isOnboardingComplete(): Promise<boolean> {
  const meta = await db.metadata.get(ONBOARDING_META_KEY);
  return meta?.value === true;
}

async function completeOnboarding(): Promise<void> {
  await db.metadata.put({ key: ONBOARDING_META_KEY, value: true });
}

async function resetOnboarding(): Promise<void> {
  await db.metadata.delete(ONBOARDING_META_KEY);
}

describe("OnboardingContext DB operations", () => {
  beforeEach(async () => {
    await db.metadata.clear();
  });

  it("should start with no onboarding flag (return false)", async () => {
    const complete = await isOnboardingComplete();
    expect(complete).toBe(false);
  });

  it("should set onboarding complete flag in metadata", async () => {
    await completeOnboarding();
    const meta = await db.metadata.get(ONBOARDING_META_KEY);
    expect(meta).not.toBeNull();
    expect(meta?.key).toBe(ONBOARDING_META_KEY);
    expect(meta?.value).toBe(true);
  });

  it("should report onboarding complete after setting flag", async () => {
    await completeOnboarding();
    const complete = await isOnboardingComplete();
    expect(complete).toBe(true);
  });

  it("should reset onboarding by deleting metadata key", async () => {
    await completeOnboarding();
    expect(await isOnboardingComplete()).toBe(true);

    await resetOnboarding();
    expect(await isOnboardingComplete()).toBe(false);
  });

  it("should handle multiple complete/reset cycles", async () => {
    for (let i = 0; i < 5; i++) {
      await completeOnboarding();
      expect(await isOnboardingComplete()).toBe(true);
      await resetOnboarding();
      expect(await isOnboardingComplete()).toBe(false);
    }
  });

  it("should not throw when resetting already-clear state", async () => {
    await expect(resetOnboarding()).resolves.toBeUndefined();
    expect(await isOnboardingComplete()).toBe(false);
  });

  it("should overwrite existing value when completing again", async () => {
    await completeOnboarding();
    await completeOnboarding();
    const count = await db.metadata.where("key").equals(ONBOARDING_META_KEY).count();
    expect(count).toBe(1);
    expect(await isOnboardingComplete()).toBe(true);
  });

  it("should handle malformed metadata value gracefully", async () => {
    await db.metadata.put({ key: ONBOARDING_META_KEY, value: "not-a-boolean" });
    const complete = await isOnboardingComplete();
    expect(complete).toBe(false);

    // Reset should still work
    await resetOnboarding();
    expect(await isOnboardingComplete()).toBe(false);
  });

  it("should handle null metadata value gracefully", async () => {
    await db.metadata.put({ key: ONBOARDING_META_KEY, value: null });
    const complete = await isOnboardingComplete();
    expect(complete).toBe(false);
  });
});
