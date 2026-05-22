import {
  DEFAULT_LLM_CONFIG,
  DEFAULT_PROFILE_MARKDOWN,
  LEGACY_STORAGE_KEYS,
  MINIMAL_PROFILE_MARKDOWN,
  STORAGE_KEYS,
} from "../config/defaults";
import type { ProfileSettings, ProfileWorkspaceData, WorkspaceManifest, WorkspaceProfileMeta } from "../types/workspace";
import { getInitialTheme } from "./theme";
import { loadJson, loadText, saveJson } from "./storage";

export const MAX_WORKSPACE_PROFILES = 3;

export function profileDataKey(profileId: string): string {
  return `${STORAGE_KEYS.profileDataPrefix}${profileId}`;
}

export function createDefaultSettings(): ProfileSettings {
  return {
    ...DEFAULT_LLM_CONFIG,
    theme: getInitialTheme(),
  };
}

export function createEmptyProfileData(): ProfileWorkspaceData {
  return {
    profileMarkdown: MINIMAL_PROFILE_MARKDOWN,
    settings: createDefaultSettings(),
    analysisSessions: [],
    draftJobPosting: "",
    profileChat: [],
  };
}

export function loadProfileData(profileId: string): ProfileWorkspaceData {
  return loadJson<ProfileWorkspaceData>(profileDataKey(profileId), createEmptyProfileData());
}

export function saveProfileData(profileId: string, data: ProfileWorkspaceData): void {
  saveJson(profileDataKey(profileId), data);
}

export function loadManifest(): WorkspaceManifest | null {
  return loadJson<WorkspaceManifest | null>(STORAGE_KEYS.workspace, null);
}

export function saveManifest(manifest: WorkspaceManifest): void {
  saveJson(STORAGE_KEYS.workspace, manifest);
}

function createProfileMeta(name: string, now: string): WorkspaceProfileMeta {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: now,
    lastUsedAt: now,
    lastModifiedAt: now,
  };
}

function migrateLegacyData(): { manifest: WorkspaceManifest; data: ProfileWorkspaceData } {
  const now = new Date().toISOString();
  const meta = createProfileMeta("Default", now);
  const settings = loadJson<ProfileSettings>(LEGACY_STORAGE_KEYS.llmConfig, createDefaultSettings());
  if (!settings.theme) {
    settings.theme = getInitialTheme();
  }

  const data: ProfileWorkspaceData = {
    profileMarkdown: loadText(LEGACY_STORAGE_KEYS.profile, DEFAULT_PROFILE_MARKDOWN),
    settings,
    analysisSessions: loadJson(LEGACY_STORAGE_KEYS.analysisSessions, []),
    draftJobPosting: loadText(LEGACY_STORAGE_KEYS.draftJobPosting, ""),
    profileChat: [],
  };

  saveProfileData(meta.id, data);

  Object.values(LEGACY_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));

  return {
    manifest: { activeProfileId: meta.id, profiles: [meta] },
    data,
  };
}

export function initializeWorkspace(): {
  manifest: WorkspaceManifest;
  activeData: ProfileWorkspaceData;
} {
  const existing = loadManifest();
  if (existing && existing.profiles.length > 0) {
    const activeData = loadProfileData(existing.activeProfileId);
    return { manifest: existing, activeData };
  }

  const hasLegacy =
    localStorage.getItem(LEGACY_STORAGE_KEYS.profile) != null ||
    localStorage.getItem(LEGACY_STORAGE_KEYS.llmConfig) != null;

  if (hasLegacy) {
    const { manifest, data } = migrateLegacyData();
    saveManifest(manifest);
    return { manifest, activeData: data };
  }

  const now = new Date().toISOString();
  const meta = createProfileMeta("Default", now);
  const data: ProfileWorkspaceData = {
    profileMarkdown: DEFAULT_PROFILE_MARKDOWN,
    settings: createDefaultSettings(),
    analysisSessions: [],
    draftJobPosting: "",
    profileChat: [],
  };
  const manifest: WorkspaceManifest = {
    activeProfileId: meta.id,
    profiles: [meta],
  };
  saveProfileData(meta.id, data);
  saveManifest(manifest);
  return { manifest, activeData: data };
}

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
