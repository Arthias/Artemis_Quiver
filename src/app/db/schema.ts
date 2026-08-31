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
  generatedCv?: AnalysisSession["generatedCv"];
}

interface AppMetadataRecord {
  key: string;
  value: any;
}

export interface ErrorLogRecord {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  source: "app" | "overlay" | "popup" | "background" | "llm" | "flow" | "unknown";
  code?: string;
  numericCode?: number;
  severity?: string;
  metadata?: Record<string, unknown>;
}

class ArtemisQuiverDB extends Dexie {
  profiles!: Table<ProfileRecord, string>;
  analysisSessions!: Table<AnalysisSessionRecord, string>;
  metadata!: Table<AppMetadataRecord, string>;
  errorLogs!: Table<ErrorLogRecord, string>;

  constructor() {
    super("ArtemisQuiverDB");
    this.version(1).stores({
      profiles: "id, name, lastUsedAt",
      analysisSessions: "id, profileId, createdAt",
      metadata: "key",
    });
    this.version(2).stores({
      profiles: "id, name, lastUsedAt",
      analysisSessions: "id, profileId, createdAt",
      metadata: "key",
      errorLogs: "id, timestamp, source, code",
    });
    this.version(3).stores({
      profiles: "id, name, lastUsedAt",
      analysisSessions: "id, profileId, createdAt",
      metadata: "key",
      errorLogs: "id, timestamp, source, code, numericCode",
    });
  }
}

export const db = new ArtemisQuiverDB();
