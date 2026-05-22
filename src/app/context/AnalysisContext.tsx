import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STORAGE_KEYS } from "../config/defaults";
import { analyzeJobPosting } from "../services/jobAnalysisService";
import type { AnalysisResult, AnalysisSession } from "../types/analysis";
import { useConfig } from "./ConfigContext";
import { useProfile } from "./ProfileContext";
import { downloadMarkdown } from "../utils/download";
import { loadJson, loadText, saveJson, saveText } from "../utils/storage";

interface AnalysisContextValue {
  draftJobPosting: string;
  setDraftJobPosting: (value: string) => void;
  sessions: AnalysisSession[];
  currentResult: AnalysisResult | null;
  currentMarkdown: string | null;
  analyzing: boolean;
  error: string | null;
  analyze: () => Promise<void>;
  clearCurrent: () => void;
  loadSession: (id: string) => void;
  exportCurrentAnalysis: () => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const { profile } = useProfile();
  const [draftJobPosting, setDraftJobPosting] = useState(() =>
    loadText(STORAGE_KEYS.draftJobPosting, "")
  );
  const [sessions, setSessions] = useState<AnalysisSession[]>(() =>
    loadJson<AnalysisSession[]>(STORAGE_KEYS.analysisSessions, [])
  );
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [currentMarkdown, setCurrentMarkdown] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistDraft = useCallback((value: string) => {
    setDraftJobPosting(value);
    saveText(STORAGE_KEYS.draftJobPosting, value);
  }, []);

  const persistSessions = useCallback((next: AnalysisSession[]) => {
    setSessions(next);
    saveJson(STORAGE_KEYS.analysisSessions, next);
  }, []);

  const analyze = useCallback(async () => {
    const trimmed = draftJobPosting.trim();
    if (!trimmed) return;

    setAnalyzing(true);
    setError(null);

    try {
      const { result, markdown } = await analyzeJobPosting(trimmed, profile, config);
      const session: AnalysisSession = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        jobPosting: trimmed,
        result,
        markdown,
      };

      setCurrentResult(result);
      setCurrentMarkdown(markdown);
      setSessions((prev) => {
        const next = [session, ...prev].slice(0, 50);
        saveJson(STORAGE_KEYS.analysisSessions, next);
        return next;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Analysis failed. Check LLM settings.";
      setError(message);
      setCurrentResult(null);
      setCurrentMarkdown(null);
    } finally {
      setAnalyzing(false);
    }
  }, [draftJobPosting, profile, config]);

  const clearCurrent = useCallback(() => {
    setCurrentResult(null);
    setCurrentMarkdown(null);
    setError(null);
    persistDraft("");
  }, [persistDraft]);

  const loadSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (!session) return;
      persistDraft(session.jobPosting);
      setCurrentResult(session.result);
      setCurrentMarkdown(session.markdown);
      setError(null);
    },
    [sessions, persistDraft]
  );

  const exportCurrentAnalysis = useCallback(() => {
    if (!currentMarkdown) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadMarkdown(`job-analysis-${stamp}.md`, currentMarkdown);
  }, [currentMarkdown]);

  const value = useMemo(
    () => ({
      draftJobPosting,
      setDraftJobPosting: persistDraft,
      sessions,
      currentResult,
      currentMarkdown,
      analyzing,
      error,
      analyze,
      clearCurrent,
      loadSession,
      exportCurrentAnalysis,
    }),
    [
      draftJobPosting,
      persistDraft,
      sessions,
      currentResult,
      currentMarkdown,
      analyzing,
      error,
      analyze,
      clearCurrent,
      loadSession,
      exportCurrentAnalysis,
    ]
  );

  return (
    <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysis must be used within AnalysisProvider");
  }
  return ctx;
}
