import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { analyzeJobPosting, followUpChat } from "../services/jobAnalysisService";
import type { AnalysisResult, AnalysisSession } from "../types/analysis";
import type { ChatMessage } from "../types/llm";
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
  followUpMessages: ChatMessage[];
  followUpLoading: boolean;
  sendFollowUpMessage: (text: string) => Promise<void>;
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
  const [followUpMessages, setFollowUpMessages] = useState<ChatMessage[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  useEffect(() => {
    setDraftJobPosting(profileData.draftJobPosting);
    setSessions(profileData.analysisSessions);
    setCurrentResult(null);
    setCurrentMarkdown(null);
    setActiveSessionId(null);
    setError(null);
    setFollowUpMessages([]);
  }, [activeProfileId]);

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
      setFollowUpMessages([]);
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
    setFollowUpMessages([]);
    setDraftJobPosting("");
    persistAnalysisState("", sessions);
  }, [sessions, persistAnalysisState]);

  const persistFollowUp = useCallback(
    (messages: ChatMessage[]) => {
      if (!activeSessionId) return;
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === activeSessionId ? { ...s, followUpMessages: messages } : s
        );
        persistAnalysisState(draftJobPosting, next);
        return next;
      });
    },
    [activeSessionId, draftJobPosting, persistAnalysisState]
  );

  const sendFollowUpMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || followUpLoading || !draftJobPosting) return;

      const userMsg: ChatMessage = { role: "user", content: text };
      const updatedMessages = [...followUpMessages, userMsg];
      setFollowUpMessages(updatedMessages);
      setFollowUpLoading(true);
      setError(null);

      try {
        const reply = await followUpChat(
          draftJobPosting,
          profile,
          updatedMessages,
          config
        );
        const assistantMsg: ChatMessage = { role: "assistant", content: reply };
        const finalMessages = [...updatedMessages, assistantMsg];
        setFollowUpMessages(finalMessages);
        persistFollowUp(finalMessages);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Follow-up chat failed."
        );
        setFollowUpMessages(updatedMessages);
      } finally {
        setFollowUpLoading(false);
      }
    },
    [followUpMessages, followUpLoading, draftJobPosting, profile, config, persistFollowUp]
  );

  const loadSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (!session) return;
      setDraftJobPosting(session.jobPosting);
      setCurrentResult(session.result);
      setCurrentMarkdown(session.markdown);
      setActiveSessionId(id);
      setError(null);
      setFollowUpMessages(session.followUpMessages ?? []);
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
      followUpMessages,
      followUpLoading,
      sendFollowUpMessage,
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
      followUpMessages,
      followUpLoading,
      sendFollowUpMessage,
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
