import { db } from "./schema";
import { DEFAULT_PROFILE_MARKDOWN, DEFAULT_LLM_CONFIG } from "../config/defaults";
import { getInitialTheme } from "../utils/theme";
import type { ProfileSettings } from "../types/workspace";

export async function ensureDbInitialized(): Promise<void> {
  const profileCount = await db.profiles.count();

  if (profileCount > 0) {
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
      await db.metadata.put({ key: "activeProfileId", value: sorted[0].id });
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
