import {
  DEFAULT_LLM_CONFIG,
  MINIMAL_PROFILE_MARKDOWN,
} from "../config/defaults";
import type { ProfileSettings, ProfileWorkspaceData } from "../types/workspace";
import { getInitialTheme } from "./theme";

export const MAX_WORKSPACE_PROFILES = 3;

function createDefaultSettings(): ProfileSettings {
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

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}
