import { db } from "./schema";
import { DEFAULT_PROFILE_MARKDOWN, DEFAULT_LLM_CONFIG } from "../config/defaults";
import { getInitialTheme } from "../utils/theme";
import type { ProfileSettings } from "../types/workspace";
import type { ProviderMode } from "../types/llm";

/**
 * Backfill providerMode for profiles created before the field was added.
 * Heuristic: if primary provider was already set to a cloud provider (not webllm),
 * the user was using Cloud mode — set to "cloud". Otherwise default to "local".
 */
async function backfillProviderMode(): Promise<void> {
  const allProfiles = await db.profiles.toArray();
  for (const profile of allProfiles) {
    if (!profile.settings) continue;
    if (profile.settings.providerMode !== undefined) continue;

    const inferredMode: ProviderMode =
      profile.settings.primary?.provider &&
      profile.settings.primary.provider !== "webllm"
        ? "cloud"
        : "local";

    profile.settings = {
      ...profile.settings,
      providerMode: inferredMode,
    };

    await db.profiles.put(profile);
    console.info(
      `[Artemis Quiver] Backfilled providerMode="${inferredMode}" for profile "${profile.name}" (${profile.id})`
    );
  }
}

export async function ensureDbInitialized(): Promise<void> {
  const profileCount = await db.profiles.count();

  if (profileCount > 0) {
    // Backfill providerMode on old profiles before any other checks
    await backfillProviderMode();

    const metaRecord = await db.metadata.get("activeProfileId");
    const activeId = metaRecord ? metaRecord.value : null;

    if (activeId) {
      const activeProfile = await db.profiles.get(activeId);
      if (activeProfile) return;
    }

    const allProfiles = await db.profiles.toArray();
    if (allProfiles.length > 0) {
      const sorted = allProfiles.sort(
        (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
      );
      if (sorted[0]) {
        await db.metadata.put({ key: "activeProfileId", value: sorted[0].id });
      }
    }
    return;
  }

  const now = new Date().toISOString();
  const profileId = crypto.randomUUID();

  const settings: ProfileSettings = {
    ...DEFAULT_LLM_CONFIG,
    theme: getInitialTheme(),
  };

  await db.profiles.put({
    id: profileId,
    name: "Default",
    createdAt: now,
    lastUsedAt: now,
    lastModifiedAt: now,
    profileMarkdown: DEFAULT_PROFILE_MARKDOWN,
    settings,
    draftJobPosting: "",
    profileChat: [],
  });

  await db.metadata.put({ key: "activeProfileId", value: profileId });
}
