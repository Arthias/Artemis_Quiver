import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema";
import {
  getActiveProfileId,
  setActiveProfileId,
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
import { migrateFromLocalStorage } from "../migrations";
import { DEFAULT_LLM_CONFIG } from "../../config/defaults";

describe("Database Repository & Migration Tests", () => {
  beforeEach(async () => {
    // Clear and reset the database before each test
    await db.profiles.clear();
    await db.analysisSessions.clear();
    await db.metadata.clear();
    localStorage.clear();
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

      // Create
      await createProfile(profile);
      
      // Get
      const loaded = await getProfile(profileId);
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe("Test Profile");
      expect(loaded?.profileMarkdown).toBe("# Hello");

      // Update
      loaded!.profileMarkdown = "# Updated Hello";
      await saveProfile(loaded!);
      const updated = await getProfile(profileId);
      expect(updated?.profileMarkdown).toBe("# Updated Hello");

      // List all
      const list = await getProfiles();
      expect(list.length).toBe(1);

      // Delete
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

  describe("LocalStorage Migration", () => {
    it("should migrate legacy data when present", async () => {
      // Seed legacy localStorage keys
      localStorage.setItem("artemis-profile", "# Legacy Profile");
      localStorage.setItem("artemis-llm-config", JSON.stringify({
        provider: "ollama",
        serverUrl: "http://localhost:11434",
        model: "llama3",
        temperature: 0.5,
        autoSaveProfile: false,
        theme: "light",
      }));
      localStorage.setItem("artemis-draft-job-posting", "Legacy job description");

      // Run migration
      await migrateFromLocalStorage();

      // Verify DB state
      const profiles = await getProfiles();
      expect(profiles.length).toBe(1);
      
      const activeId = await getActiveProfileId();
      expect(activeId).toBe(profiles[0].id);

      const profile = profiles[0];
      expect(profile.name).toBe("Default");
      expect(profile.profileMarkdown).toBe("# Legacy Profile");
      expect(profile.settings.provider).toBe("ollama");
      expect(profile.settings.theme).toBe("light");
      expect(profile.draftJobPosting).toBe("Legacy job description");

      // Verify localStorage was cleared
      expect(localStorage.getItem("artemis-profile")).toBeNull();
      expect(localStorage.getItem("artemis-llm-config")).toBeNull();
    });

    it("should migrate multi-profile workspace manifest and profile data", async () => {
      const profile1Id = crypto.randomUUID();
      const profile2Id = crypto.randomUUID();

      const manifest = {
        activeProfileId: profile1Id,
        profiles: [
          {
            id: profile1Id,
            name: "Profile One",
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
            lastModifiedAt: new Date().toISOString(),
          },
          {
            id: profile2Id,
            name: "Profile Two",
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
            lastModifiedAt: new Date().toISOString(),
          }
        ]
      };

      const profile1Data = {
        profileMarkdown: "# Profile One Markdown",
        settings: {
          provider: "lmstudio",
          serverUrl: "/api/lmstudio",
          model: "gemma",
          temperature: 0.7,
          autoSaveProfile: true,
          theme: "dark",
        },
        draftJobPosting: "Job One",
        profileChat: [],
        analysisSessions: [
          {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            jobPosting: "Job One Description",
            result: { score: 90, salaryRange: "$150k", tips: [], cvRecommendations: [], coverLetterDraft: "" },
            markdown: "Analysis Markdown One",
          }
        ]
      };

      const profile2Data = {
        profileMarkdown: "# Profile Two Markdown",
        settings: {
          provider: "ollama",
          serverUrl: "/api/ollama",
          model: "mistral",
          temperature: 0.8,
          autoSaveProfile: false,
          theme: "light",
        },
        draftJobPosting: "Job Two",
        profileChat: [],
        analysisSessions: []
      };

      localStorage.setItem("artemis-workspace", JSON.stringify(manifest));
      localStorage.setItem(`artemis-profile-data-${profile1Id}`, JSON.stringify(profile1Data));
      localStorage.setItem(`artemis-profile-data-${profile2Id}`, JSON.stringify(profile2Data));

      // Run migration
      await migrateFromLocalStorage();

      // Verify DB state
      const profiles = await getProfiles();
      expect(profiles.length).toBe(2);

      const activeId = await getActiveProfileId();
      expect(activeId).toBe(profile1Id);

      const p1 = await getProfile(profile1Id);
      expect(p1?.name).toBe("Profile One");
      expect(p1?.profileMarkdown).toBe("# Profile One Markdown");
      expect(p1?.draftJobPosting).toBe("Job One");

      const p2 = await getProfile(profile2Id);
      expect(p2?.name).toBe("Profile Two");
      expect(p2?.profileMarkdown).toBe("# Profile Two Markdown");
      expect(p2?.draftJobPosting).toBe("Job Two");

      const p1Sessions = await getSessions(profile1Id);
      expect(p1Sessions.length).toBe(1);
      expect(p1Sessions[0].markdown).toBe("Analysis Markdown One");

      // Verify localStorage was cleared
      expect(localStorage.getItem("artemis-workspace")).toBeNull();
      expect(localStorage.getItem(`artemis-profile-data-${profile1Id}`)).toBeNull();
      expect(localStorage.getItem(`artemis-profile-data-${profile2Id}`)).toBeNull();
    });
  });
});
