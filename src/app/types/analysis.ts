import type { ChatMessage } from "./llm";

export interface AnalysisResult {
  score: number;
  salaryRange: string;
  tips: string[];
  cvRecommendations: string[];
  coverLetterDraft: string;
  summary?: string;
}

export interface AnalysisSession {
  id: string;
  createdAt: string;
  jobPosting: string;
  result: AnalysisResult;
  markdown: string;
  followUpMessages?: ChatMessage[];
}
