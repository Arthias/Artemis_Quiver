import type { ChatMessage } from "./llm";
import type { CVContent, ThemeConfig } from "./cv";
import type { CLContent } from "../../types/cl";

export interface AnalysisResult {
  score: number;
  salaryRange: string;
  tips: string[];
  cvRecommendations: string[];
  /** Plain text of the letter, for display and export. Empty if it could not be drafted. */
  coverLetterDraft: string;
  /** The structured letter (absent on sessions saved before 2026-11-16). */
  coverLetter?: CLContent;
  summary?: string;
  title?: string;
}

export interface GeneratedCv {
  content: CVContent;
  themeConfig: ThemeConfig;
  updatedAt: string;
}

export interface AnalysisSession {
  id: string;
  createdAt: string;
  jobPosting: string;
  result: AnalysisResult;
  markdown: string;
  followUpMessages?: ChatMessage[];
  generatedCv?: GeneratedCv;
}
