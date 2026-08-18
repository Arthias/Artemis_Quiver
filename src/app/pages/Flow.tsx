import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Workflow, Play, Pause, RefreshCw, Loader2 } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useConfig } from "../context/ConfigContext";
import { BuilderAssistantPanel } from "../components/builder/BuilderAssistantPanel";
import {
  checkFlowHealth,
  getFlowDigest,
  getRankStatus,
  startRank,
  stopRank,
  getSearchStatus,
  startSearch,
  stopSearch,
  type FlowStatus,
  type FlowJobSummary,
  type FlowRankStatus,
  type FlowSearchStatus,
} from "../services/flowBridge";
import { submitFlowFeedback } from "../services/flowChatService";

function scoreClass(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-blue-600 dark:text-blue-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function FlowHeader({
  t,
  status,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  status: FlowStatus | null;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t("flow.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {status?.connected
                ? t("flow.totalJobs", { n: status.totalJobs ?? 0 })
                : t("flow.subtitle")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlBlock({
  label,
  status,
  busy,
  unavailable,
  onToggle,
  t,
}: {
  label: string;
  status: { running: boolean; phase?: string; message?: string; error?: string } | null;
  busy: boolean;
  unavailable: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const running = !!status?.running;
  return (
    <div className="rounded border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <Button size="sm" variant="outline" onClick={onToggle} disabled={busy || unavailable}>
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : running ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {running ? t("flow.pause") : t("flow.start")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {unavailable
          ? t("flow.controlUnavailable")
          : running
            ? status?.message || status?.phase || t("flow.running")
            : t("flow.idle")}
      </p>
      {status?.error && <p className="text-xs text-destructive">{status.error}</p>}
    </div>
  );
}

export function Flow() {
  const { t } = useTranslation();
  const { config } = useConfig();
  const flowBaseUrl = config.flowBaseUrl;

  const [status, setStatus] = useState<FlowStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [digest, setDigest] = useState<FlowJobSummary[]>([]);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [rankStatus, setRankStatus] = useState<FlowRankStatus | null>(null);
  const [searchStatus, setSearchStatus] = useState<FlowSearchStatus | null>(null);
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [rankBusy, setRankBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = status?.connected ?? false;

  const refresh = useCallback(async () => {
    if (!flowBaseUrl) {
      setChecking(false);
      return;
    }
    setChecking(true);
    const s = await checkFlowHealth(flowBaseUrl);
    setStatus(s);
    setChecking(false);
    if (!s.connected) return;

    try {
      const d = await getFlowDigest(flowBaseUrl);
      setDigest(d.jobs);
      setDigestError(null);
    } catch (err) {
      setDigestError(err instanceof Error ? err.message : String(err));
    }

    try {
      setRankStatus(await getRankStatus(flowBaseUrl));
    } catch {
      setRankStatus(null);
    }

    // Search stop/status is Flow's Phase 2 work — not built yet on some deployments.
    try {
      setSearchStatus(await getSearchStatus(flowBaseUrl));
      setSearchAvailable(true);
    } catch {
      setSearchStatus(null);
      setSearchAvailable(false);
    }
  }, [flowBaseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const anyRunning = !!rankStatus?.running || !!searchStatus?.running;

  useEffect(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    if (!connected || !anyRunning) return;
    pollTimer.current = setInterval(refresh, 2000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [connected, anyRunning, refresh]);

  async function handleToggleRank() {
    if (!flowBaseUrl) return;
    setRankBusy(true);
    try {
      if (rankStatus?.running) await stopRank(flowBaseUrl);
      else await startRank(flowBaseUrl);
      await refresh();
    } finally {
      setRankBusy(false);
    }
  }

  async function handleToggleSearch() {
    if (!flowBaseUrl) return;
    setSearchBusy(true);
    try {
      if (searchStatus?.running) await stopSearch(flowBaseUrl);
      else await startSearch(flowBaseUrl);
      await refresh();
    } finally {
      setSearchBusy(false);
    }
  }

  async function handleChatSubmit(message?: string) {
    const text = (message ?? chatMessage).trim();
    if (!text || !flowBaseUrl) return;
    setChatLoading(true);
    setChatError(null);
    setChatResult(null);
    setChatMessage("");
    try {
      const result = await submitFlowFeedback(flowBaseUrl, text);
      setChatResult(result.strategy?.reasoning || t("flow.chatApplied"));
      await refresh();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatLoading(false);
    }
  }

  if (!flowBaseUrl || (!checking && !connected)) {
    return (
      <div className="h-full flex flex-col">
        <FlowHeader t={t} status={null} />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="p-8 max-w-md text-center space-y-3">
            <Workflow className="w-8 h-8 mx-auto text-teal-500" />
            <h2 className="text-lg font-semibold">{t("flow.notConnectedTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("flow.notConnectedDesc")}</p>
            <Button asChild>
              <Link to="/config">{t("flow.goToSettings")}</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const chatSuggestions = [
    { title: t("flow.suggestionRemote"), hint: t("flow.suggestionRemoteHint"), prompt: "I'd like to focus on fully remote roles only from now on." },
    { title: t("flow.suggestionEurope"), hint: t("flow.suggestionEuropeHint"), prompt: "Expand the search to include roles across Italy and the rest of Europe, remote ideally." },
    { title: t("flow.suggestionExclude"), hint: t("flow.suggestionExcludeHint"), prompt: "Exclude staffing agencies and recruiter-posted listings from the results." },
  ];

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <FlowHeader t={t} status={status} />
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">{t("flow.controls")}</h2>
              <div className="grid grid-cols-2 gap-4">
                <ControlBlock
                  label={t("flow.search")}
                  status={searchStatus}
                  busy={searchBusy}
                  unavailable={!searchAvailable}
                  onToggle={handleToggleSearch}
                  t={t}
                />
                <ControlBlock
                  label={t("flow.scoring")}
                  status={rankStatus}
                  busy={rankBusy}
                  unavailable={false}
                  onToggle={handleToggleRank}
                  t={t}
                />
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t("flow.digest")}</h2>
                <Button size="sm" variant="ghost" onClick={refresh}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              {digestError && <p className="text-sm text-destructive">{digestError}</p>}
              {digest.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("flow.digestEmpty")}</p>
              ) : (
                <div className="space-y-2">
                  {digest.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-3 rounded border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {job.company} · {job.location}
                          {job.is_remote ? ` · ${t("flow.remote")}` : ""}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${scoreClass(job.score)}`}>
                        {Math.round(job.score)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <BuilderAssistantPanel
          suggestions={chatSuggestions}
          chatMessage={chatMessage}
          chatLoading={chatLoading}
          onChatMessageChange={setChatMessage}
          onSubmit={handleChatSubmit}
          accentClass="text-teal-500"
          panelBg="bg-muted/30"
        />
        {(chatResult || chatError) && (
          <div className="px-4 pb-4 bg-muted/30 border-l border-border">
            {chatResult && <p className="text-xs text-muted-foreground">{chatResult}</p>}
            {chatError && <p className="text-xs text-destructive">{chatError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
