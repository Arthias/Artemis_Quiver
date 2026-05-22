import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { analyzeJobPosting } from "../services/jobAnalysisService";
import type { AnalysisResult, AnalysisSession } from "../types/analysis";
import { useConfig } from "./ConfigContext";
import { useProfile } from "./ProfileContext";
import { useWorkspace } from "./WorkspaceProfileContext";
import { downloadMarkdown } from "../utils/download";

interface AnalysisContextValue {
  draftJobPosting: string;
  setDraftJobPosting: (value: string) => void;
  sessions: AnalysisSession[];
  currentResult: AnalysisResult | null;
  currentMarkdown: string | null;
  activeSessionId: string | null;
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
  const { activeProfileId, profileData, updateProfileData, persistActiveProfile, touchLastUsed } =
    useWorkspace();

  const [draftJobPosting, setDraftJobPosting] = useState(profileData.draftJobPosting);
  const [sessions, setSessions] = useState<AnalysisSession[]>(profileData.analysisSessions);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [currentMarkdown, setCurrentMarkdown] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftJobPosting(profileData.draftJobPosting);
    setSessions(profileData.analysisSessions);
    setCurrentResult(null);
    setCurrentMarkdown(null);
    setActiveSessionId(null);
    setError(null);
  }, [activeProfileId, profileData.draftJobPosting, profileData.analysisSessions]);

  const persistAnalysisState = useCallback(
    (draft: string, nextSessions: AnalysisSession[]) => {
      updateProfileData({
        draftJobPosting: draft,
        analysisSessions: nextSessions,
      });
      persistActiveProfile();
    },
    [updateProfileData, persistActiveProfile]
  );

  const persistDraft = useCallback(
    (value: string) => {
      setDraftJobPosting(value);
      persistAnalysisState(value, sessions);
    },
    [sessions, persistAnalysisState]
  );

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
      setActiveSessionId(session.id);
      setSessions((prev) => {
        const next = [session, ...prev].slice(0, 50);
        persistAnalysisState(trimmed, next);
        return next;
      });
      touchLastUsed();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Analysis failed. Check LLM settings.";
      setError(message);
      setCurrentResult(null);
      setCurrentMarkdown(null);
      setActiveSessionId(null);
    } finally {
      setAnalyzing(false);
    }
  }, [draftJobPosting, profile, config, persistAnalysisState, touchLastUsed]);

  const clearCurrent = useCallback(() => {
    setCurrentResult(null);
    setCurrentMarkdown(null);
    setActiveSessionId(null);
    setError(null);
    setDraftJobPosting("");
    persistAnalysisState("", sessions);
  }, [sessions, persistAnalysisState]);

  const loadSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (!session) return;
      setDraftJobPosting(session.jobPosting);
      setCurrentResult(session.result);
      setCurrentMarkdown(session.markdown);
      setActiveSessionId(id);
      setError(null);
      persistAnalysisState(session.jobPosting, sessions);
      touchLastUsed();
    },
    [sessions, persistAnalysisState, touchLastUsed]
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
      activeSessionId,
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
      activeSessionId,
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
