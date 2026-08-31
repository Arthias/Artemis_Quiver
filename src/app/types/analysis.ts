import type { ChatMessage } from "./llm";
import type { CVContent, ThemeConfig } from "./cv";

export interface AnalysisResult {
  score: number;
  salaryRange: string;
  tips: string[];
  cvRecommendations: string[];
  coverLetterDraft: string;
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
