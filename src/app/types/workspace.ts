import type { AnalysisSession } from "./analysis";
import type { ChatMessage, LlmConfig } from "./llm";

export type ThemeMode = "light" | "dark";

export interface ProfileSettings extends LlmConfig {
  theme: ThemeMode;
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
