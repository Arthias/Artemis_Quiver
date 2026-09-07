import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema";
import {
  getActiveProfileId,
  getProfiles,
  getProfile,
  saveProfile,
  createProfile,
  deleteProfile,
} from "../profileRepo";
import {
  getSessions,
  saveSession,
  deleteSession,
} from "../sessionRepo";
import { ensureDbInitialized } from "../migrations";
import { DEFAULT_LLM_CONFIG } from "../../config/defaults";
import type { ProviderMode } from "../../types/llm";

describe("Database Repository & Init Tests", () => {
  beforeEach(async () => {
    await db.profiles.clear();
    await db.analysisSessions.clear();
    await db.metadata.clear();
  });

  describe("Profile Repository CRUD", () => {
    it("should create, read, update, and delete profiles", async () => {
      const profileId = crypto.randomUUID();
      const profile = {
        id: profileId,
        name: "Test Profile",
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        profileMarkdown: "# Hello",
        settings: {
          ...DEFAULT_LLM_CONFIG,
          theme: "dark" as const,
        },
        draftJobPosting: "Developer role",
        profileChat: [],
      };

      await createProfile(profile);

      const loaded = await getProfile(profileId);
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe("Test Profile");
      expect(loaded?.profileMarkdown).toBe("# Hello");

      loaded!.profileMarkdown = "# Updated Hello";
      await saveProfile(loaded!);
      const updated = await getProfile(profileId);
      expect(updated?.profileMarkdown).toBe("# Updated Hello");

      const list = await getProfiles();
      expect(list.length).toBe(1);

      await deleteProfile(profileId);
      const deleted = await getProfile(profileId);
      expect(deleted).toBeNull();
    });

    it("should create new profiles with providerMode set by default", async () => {
      const profileId = crypto.randomUUID();
      await createProfile({
        id: profileId,
        name: "Fresh Profile",
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        profileMarkdown: "# Fresh",
        settings: { ...DEFAULT_LLM_CONFIG, theme: "dark" as const },
        draftJobPosting: "",
        profileChat: [],
      });

      const loaded = await getProfile(profileId);
      expect(loaded).not.toBeNull();
      expect(loaded!.settings.providerMode).toBe("cloud");
    });
  });

  describe("Session Repository CRUD", () => {
    it("should save and load analysis sessions", async () => {
      const profileId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const session = {
        id: sessionId,
        profileId,
        createdAt: new Date().toISOString(),
        jobPosting: "Job description text",
        result: {
          score: 85,
          salaryRange: "$100k-$120k",
          tips: ["Fix resume"],
          cvRecommendations: ["Add TypeScript"],
          coverLetterDraft: "Dear hiring manager...",
        },
        markdown: "Parsed analysis markdown",
        followUpMessages: [{ role: "user" as const, content: "hi" }],
      };

      await saveSession(session);

      const sessions = await getSessions(profileId);
      expect(sessions.length).toBe(1);
      expect(sessions[0]?.id).toBe(sessionId);
      expect(sessions[0]?.result.score).toBe(85);

      await deleteSession(sessionId);
      const postDelete = await getSessions(profileId);
      expect(postDelete.length).toBe(0);
    });
  });

  describe("Database Initialization & Migration", () => {
    it("should create a default profile with providerMode when DB is empty", async () => {
      await ensureDbInitialized();

      const profiles = await getProfiles();
      expect(profiles.length).toBe(1);
      expect(profiles[0]?.name).toBe("Default");
      expect(profiles[0]?.settings.providerMode).toBe("cloud");

      const activeId = await getActiveProfileId();
      expect(activeId).toBe(profiles[0]?.id);
    });

    it("should not overwrite existing profiles", async () => {
      const profileId = crypto.randomUUID();
      await createProfile({
        id: profileId,
        name: "Existing",
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        profileMarkdown: "# Existing",
        settings: { ...DEFAULT_LLM_CONFIG, theme: "dark" },
        draftJobPosting: "",
        profileChat: [],
      });

      await ensureDbInitialized();

      const profiles = await getProfiles();
      expect(profiles.length).toBe(1);
      expect(profiles[0]?.name).toBe("Existing");
    });

    describe("backfillProviderMode migration", () => {
      async function createProfileWithoutProviderMode(
        id: string,
        name: string,
        primaryProvider: string
      ) {
        await createProfile({
          id,
          name,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          lastModifiedAt: new Date().toISOString(),
          profileMarkdown: "# " + name,
          settings: {
            autoSaveProfile: true,
            theme: "dark" as const,
            providerMode: undefined as unknown as ProviderMode,
            primary: {
              label: "Primary",
              provider: primaryProvider as any,
              baseUrl: "http://localhost:11434",
              model: "test-model",
              temperature: 0.7,
            },
            secondary: {
              label: "Secondary",
              provider: "openai-compatible",
              baseUrl: "http://localhost:11434",
              model: "test-model-2",
              temperature: 0.5,
            },
            secondaryUse: "never" as const,
          },
          draftJobPosting: "",
          profileChat: [],
        });
      }

      it("should backfill providerMode='cloud' for profiles with non-webllm primary provider", async () => {
        const id = crypto.randomUUID();
        await createProfileWithoutProviderMode(id, "Cloud User", "openai-compatible");

        await ensureDbInitialized();

        const profile = await getProfile(id);
        expect(profile).not.toBeNull();
        expect(profile!.settings.providerMode).toBe("cloud");
      });

      it("should backfill providerMode='local' for profiles with webllm primary provider", async () => {
        const id = crypto.randomUUID();
        await createProfileWithoutProviderMode(id, "Local User", "webllm");

        await ensureDbInitialized();

        const profile = await getProfile(id);
        expect(profile).not.toBeNull();
        expect(profile!.settings.providerMode).toBe("local");
      });

      it("should NOT overwrite providerMode on profiles that already have it set", async () => {
        const id = crypto.randomUUID();
        await createProfile({
          id,
          name: "Already Configured",
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          lastModifiedAt: new Date().toISOString(),
          profileMarkdown: "# Already Configured",
          settings: { ...DEFAULT_LLM_CONFIG, theme: "dark" as const },
          draftJobPosting: "",
          profileChat: [],
        });

        // Verify it starts with "cloud" from DEFAULT_LLM_CONFIG
        let profile = await getProfile(id);
        expect(profile!.settings.providerMode).toBe("cloud");

        // Toggle to the non-default value to simulate a deliberate user choice.
        // This must differ from the default, otherwise the assertion below
        // would pass even if the migration did overwrite the field.
        profile!.settings.providerMode = "local";
        await saveProfile(profile!);

        // Run migration — must preserve the user's choice, not reset to default
        await ensureDbInitialized();

        profile = await getProfile(id);
        expect(profile!.settings.providerMode).toBe("local");
      });

      it("should backfill ALL providerMode-missing profiles, not just the first", async () => {
        const id1 = crypto.randomUUID();
        const id2 = crypto.randomUUID();
        await createProfileWithoutProviderMode(id1, "User A", "anthropic");
        await createProfileWithoutProviderMode(id2, "User B", "webllm");

        await ensureDbInitialized();

        const profile1 = await getProfile(id1);
        const profile2 = await getProfile(id2);
        expect(profile1!.settings.providerMode).toBe("cloud");
        expect(profile2!.settings.providerMode).toBe("local");
      });
    });
  });
});
