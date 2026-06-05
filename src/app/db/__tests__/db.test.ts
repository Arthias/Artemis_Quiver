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
      expect(sessions[0].id).toBe(sessionId);
      expect(sessions[0].result.score).toBe(85);

      await deleteSession(sessionId);
      const postDelete = await getSessions(profileId);
      expect(postDelete.length).toBe(0);
    });
  });

  describe("Database Initialization", () => {
    it("should create a default profile when DB is empty", async () => {
      await ensureDbInitialized();

      const profiles = await getProfiles();
      expect(profiles.length).toBe(1);
      expect(profiles[0].name).toBe("Default");

      const activeId = await getActiveProfileId();
      expect(activeId).toBe(profiles[0].id);
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
      expect(profiles[0].name).toBe("Existing");
    });
  });
});
