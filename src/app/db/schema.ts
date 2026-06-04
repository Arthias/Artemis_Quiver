import Dexie, { type Table } from "dexie";
import type { ProfileSettings } from "../types/workspace";
import type { AnalysisSession } from "../types/analysis";
import type { ChatMessage } from "../types/llm";

export interface ProfileRecord {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string;
  lastModifiedAt: string;
  profileMarkdown: string;
  settings: ProfileSettings;
  draftJobPosting: string;
  profileChat: ChatMessage[];
}

export interface AnalysisSessionRecord {
  id: string;
  profileId: string;
  createdAt: string;
  jobPosting: string;
  result: AnalysisSession["result"];
  markdown: string;
  followUpMessages?: ChatMessage[];
}

export interface AppMetadataRecord {
  key: string;
  value: any;
}

class ArtemisQuiverDB extends Dexie {
  profiles!: Table<ProfileRecord, string>;
  analysisSessions!: Table<AnalysisSessionRecord, string>;
  metadata!: Table<AppMetadataRecord, string>;

  constructor() {
    super("ArtemisQuiverDB");
    this.version(1).stores({
      profiles: "id, name, lastUsedAt",
      analysisSessions: "id, profileId, createdAt",
      metadata: "key",
    });
  }
}

export const db = new ArtemisQuiverDB();
