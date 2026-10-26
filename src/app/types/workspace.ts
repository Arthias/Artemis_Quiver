import type { AnalysisSession } from "./analysis";
import type { ChatMessage, LlmConfig } from "./llm";
import type { FlowRunConfig, Layer, ProfilePreferences } from "./preferences";

export type ThemeMode = "light" | "dark";

export interface ProfileSettings extends LlmConfig {
  theme: ThemeMode;
  /** Flow's host:port, e.g. "http://localhost:8000" — entered explicitly, never auto-discovered. */
  flowBaseUrl?: string;
  /** Set by the first successful sync to Flow; gates the "Start Flow" control. */
  flowConfiguredAt?: string;
  /** Flow's run settings, owned here and sent in the sync (Profile-Management-Spec §3). */
  flow?: FlowRunConfig;
}

export interface WorkspaceProfileMeta {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string;
  lastModifiedAt: string;
}

export interface WorkspaceManifest {
  activeProfileId: string;
  profiles: WorkspaceProfileMeta[];
}

export interface ProfileWorkspaceData {
  profileMarkdown: string;
  settings: ProfileSettings;
  analysisSessions: AnalysisSession[];
  draftJobPosting: string;
  profileChat: ChatMessage[];
  /** Derived from the master profile (Profile-Management-Spec §3). */
  preferences?: Layer<ProfilePreferences>;
  fingerprint?: Layer<string>;
}

export interface BuilderHandoff {
  jobPosting: string;
  coverLetterDraft?: string;
  cvRecommendations?: string[];
  companyName?: string;
  position?: string;
  sourceSessionId?: string;
  autoGenerate?: boolean;
}
