import { db } from "./schema";
import { STORAGE_KEYS, LEGACY_STORAGE_KEYS, DEFAULT_PROFILE_MARKDOWN, DEFAULT_LLM_CONFIG } from "../config/defaults";
import { getInitialTheme } from "../utils/theme";
import type { WorkspaceManifest, ProfileWorkspaceData, ProfileSettings } from "../types/workspace";

// Load JSON helper from localStorage
function loadLocalStorageJson<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

export async function migrateFromLocalStorage(): Promise<void> {
  const profileCount = await db.profiles.count();
  const metaRecord = await db.metadata.get("activeProfileId");
  const activeId = metaRecord ? metaRecord.value : null;

  // Self-healing: if we have profiles but activeId is missing or invalid
  if (profileCount > 0) {
    let isValid = false;
    if (activeId) {
      const activeProfile = await db.profiles.get(activeId);
      if (activeProfile) {
        isValid = true;
      }
    }

    if (!isValid) {
      const allProfiles = await db.profiles.toArray();
      if (allProfiles.length > 0) {
        const sorted = allProfiles.sort(
          (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
        );
        await db.metadata.put({ key: "activeProfileId", value: sorted[0].id });
        console.info(`[IndexedDB Migration] Self-healed activeProfileId to "${sorted[0].name}" (${sorted[0].id})`);
      }
    }
    return;
  }

  const manifest = loadLocalStorageJson<WorkspaceManifest | null>(STORAGE_KEYS.workspace, null);

  if (manifest && manifest.profiles && manifest.profiles.length > 0) {
    console.info("[IndexedDB Migration] Found workspace manifest in localStorage. Starting migration...");

    let migratedCount = 0;
    // Migrate each profile found in manifest
    for (const meta of manifest.profiles) {
      const dataKey = `${STORAGE_KEYS.profileDataPrefix}${meta.id}`;
      const data = loadLocalStorageJson<ProfileWorkspaceData | null>(dataKey, null);

      if (data) {
        // 1. Insert profile record (excluding analysisSessions)
        await db.profiles.put({
          id: meta.id,
          name: meta.name,
          createdAt: meta.createdAt || new Date().toISOString(),
          lastUsedAt: meta.lastUsedAt || new Date().toISOString(),
          lastModifiedAt: meta.lastModifiedAt || new Date().toISOString(),
          profileMarkdown: data.profileMarkdown,
          settings: data.settings,
          draftJobPosting: data.draftJobPosting || "",
          profileChat: data.profileChat || [],
        });
        migratedCount++;

        // 2. Insert analysis sessions into the separate table
        if (data.analysisSessions && data.analysisSessions.length > 0) {
          for (const session of data.analysisSessions) {
            await db.analysisSessions.put({
              id: session.id,
              profileId: meta.id,
              createdAt: session.createdAt,
              jobPosting: session.jobPosting,
              result: session.result,
              markdown: session.markdown,
              followUpMessages: session.followUpMessages || [],
            });
          }
        }
        
        // Remove individual profile data key from localStorage
        localStorage.removeItem(dataKey);
      }
    }

    // Set active profile
    if (manifest.activeProfileId) {
      await db.metadata.put({ key: "activeProfileId", value: manifest.activeProfileId });
    } else if (migratedCount > 0) {
      const all = await db.profiles.toArray();
      await db.metadata.put({ key: "activeProfileId", value: all[0].id });
    }

    // Remove manifest key
    localStorage.removeItem(STORAGE_KEYS.workspace);
    console.info("[IndexedDB Migration] Multi-profile migration from localStorage completed successfully.");
    return;
  }

  // Check for legacy single-profile data
  const hasLegacy =
    localStorage.getItem(LEGACY_STORAGE_KEYS.profile) != null ||
    localStorage.getItem(LEGACY_STORAGE_KEYS.llmConfig) != null;

  if (hasLegacy) {
    console.info("[IndexedDB Migration] Found legacy single-profile data. Migrating...");
    const now = new Date().toISOString();
    const profileId = crypto.randomUUID();

    const settings = loadLocalStorageJson<ProfileSettings>(LEGACY_STORAGE_KEYS.llmConfig, {
      ...DEFAULT_LLM_CONFIG,
      theme: getInitialTheme(),
    });
    if (!settings.theme) {
      settings.theme = getInitialTheme();
    }

    const markdown = localStorage.getItem(LEGACY_STORAGE_KEYS.profile) || DEFAULT_PROFILE_MARKDOWN;
    const draft = localStorage.getItem(LEGACY_STORAGE_KEYS.draftJobPosting) || "";
    const sessions = loadLocalStorageJson<any[]>(LEGACY_STORAGE_KEYS.analysisSessions, []);

    // 1. Create Default Profile
    await db.profiles.put({
      id: profileId,
      name: "Default",
      createdAt: now,
      lastUsedAt: now,
      lastModifiedAt: now,
      profileMarkdown: markdown,
      settings,
      draftJobPosting: draft,
      profileChat: [],
    });

    // 2. Create Analysis Sessions
    for (const session of sessions) {
      await db.analysisSessions.put({
        id: session.id || crypto.randomUUID(),
        profileId,
        createdAt: session.createdAt || now,
        jobPosting: session.jobPosting || "",
        result: session.result,
        markdown: session.markdown || "",
        followUpMessages: session.followUpMessages || [],
      });
    }

    // 3. Set Active Profile
    await db.metadata.put({ key: "activeProfileId", value: profileId });

    // Clean up legacy keys
    Object.values(LEGACY_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    console.info("[IndexedDB Migration] Legacy data migration completed successfully.");
    return;
  }

  // Fresh initialization case
  console.info("[IndexedDB Migration] No existing data in localStorage. DB will initialize empty.");
  const now = new Date().toISOString();
  const profileId = crypto.randomUUID();
  
  await db.profiles.put({
    id: profileId,
    name: "Default",
    createdAt: now,
    lastUsedAt: now,
    lastModifiedAt: now,
    profileMarkdown: DEFAULT_PROFILE_MARKDOWN,
    settings: {
      ...DEFAULT_LLM_CONFIG,
      theme: getInitialTheme(),
    },
    draftJobPosting: "",
    profileChat: [],
  });

  await db.metadata.put({ key: "activeProfileId", value: profileId });
}
