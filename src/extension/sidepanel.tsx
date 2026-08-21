/// <reference types="chrome" />
import { createRoot } from "react-dom/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { parseSiteEntry, siteToOriginPatterns } from "./job-sites";
import { loadTranslations, t } from "./i18n";
import { extractPageContent } from "./pageExtract";
import { getActiveProfileId, getProfile, saveSession } from "../app/db";
import { analyzeJobPosting } from "../app/services/jobAnalysisService";
import { getActiveEndpoint } from "../app/services/llmService";

function logErrorToApp(message: string, stack?: string, code?: string) {
  try {
    chrome.runtime.sendMessage({
      type: "ARTEMIS_LOG_ERROR",
      payload: { message, stack, source: "background" as const, timestamp: new Date().toISOString(), code, metadata: "sidepanel" },
    }).catch(() => {});
  } catch {}
}

const origConsoleError = console.error.bind(console);
console.error = (...args: any[]) => {
  origConsoleError(...args);
  const msg = args.map((a) => (typeof a === "object" ? (a instanceof Error ? a.message : JSON.stringify(a)) : String(a))).join(" ");
  const stack = args.find((a) => a instanceof Error)?.stack;
  logErrorToApp(msg, stack);
};

const OVERLAY_CONFIG_KEY = "artemis:overlayConfig";
const QUICK_CACHE_KEY = "artemis:quickScoreCache";

interface QuickScoreEntry {
  url: string;
  title: string;
  company: string;
  salary: string;
  score: number | null;
  analyzedAt: string;
  cached?: boolean;
}

function domainMatchesEntry(entry: string, hostname: string): boolean {
  const domain = parseSiteEntry(entry).domain;
  return hostname === domain || hostname.endsWith("." + domain);
}

function scoreColor(score: number): string {
  return score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
}

function Panel() {
  const [translationsReady, setTranslationsReady] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);
  const [currentHost, setCurrentHost] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [entry, setEntry] = useState<QuickScoreEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [togglingAlways, setTogglingAlways] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [deepState, setDeepState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [deepError, setDeepError] = useState("");
  // Auto-analyze fires exactly once, for whatever tab was active when the
  // panel was opened (that click is what grants activeTab access). Switching
  // tabs or navigating afterward does NOT re-fire it — the whole point of
  // "click to look" is browsing on your own time and pressing Analyze on the
  // few postings that look interesting, not scoring every page you pass.
  // That auto-everything behavior is what "Always quick analyze this site"
  // (a per-site opt-in, not a panel-wide default) is for.
  const hasAutoRun = useRef(false);
  const [cacheChecked, setCacheChecked] = useState(false);

  useEffect(() => {
    loadTranslations(navigator.language.split("-")[0] || "en")
      .catch(() => {})
      .finally(() => setTranslationsReady(true));
  }, []);

  const refreshTabInfo = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      setTabId(null);
      setCurrentHost("");
      setCurrentUrl("");
      return;
    }
    try {
      const url = new URL(tab.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        setTabId(null);
        setCurrentHost("");
        setCurrentUrl("");
        return;
      }
      setTabId(tab.id ?? null);
      setCurrentHost(url.hostname);
      setCurrentUrl(tab.url);
    } catch {
      setTabId(null);
      setCurrentHost("");
      setCurrentUrl("");
    }
  }, []);

  useEffect(() => {
    void refreshTabInfo();
  }, [refreshTabInfo]);

  // The panel stays open across tab switches and in-window navigation (that's
  // the whole point vs. the overlay) — so it has to track the active tab
  // itself rather than being reopened per-tab.
  useEffect(() => {
    const onActivated = () => {
      setEntry(null);
      setError(null);
      setDeepState("idle");
      void refreshTabInfo();
    };
    const onUpdated = (_id: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.url) {
        setEntry(null);
        setError(null);
        setDeepState("idle");
        void refreshTabInfo();
      }
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [refreshTabInfo]);

  // "Always quick analyze this site" is the renamed overlay-enable toggle —
  // same per-site list, same permission flow (see Config.tsx / popup.tsx).
  useEffect(() => {
    if (!currentHost) return;
    chrome.storage.local.get(OVERLAY_CONFIG_KEY).then((res) => {
      const cfg = (res as any)[OVERLAY_CONFIG_KEY] || {};
      const sites: string[] = cfg.jobSites || [];
      setAlwaysOn(sites.some((s) => domainMatchesEntry(s, currentHost)));
    });
  }, [currentHost]);

  // Show a cached score immediately, with no LLM call — a fresh score for an
  // "always on" site may already be sitting in the cache from the overlay's
  // own background pass.
  useEffect(() => {
    if (!currentUrl) {
      setEntry(null);
      return;
    }
    setEntry(null);
    setError(null);
    setDeepState("idle");
    setCacheChecked(false);
    chrome.storage.local.get(QUICK_CACHE_KEY).then((res) => {
      const cache = (res as any)[QUICK_CACHE_KEY] || {};
      const hit = cache[currentUrl] as QuickScoreEntry | undefined;
      if (hit) setEntry({ ...hit, cached: true });
      setCacheChecked(true);
    });
  }, [currentUrl]);

  // Live updates pushed from the overlay content script on "always on" sites.
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.type === "ARTEMIS_QUICK_SCORE_PUSH" && msg.payload?.url === currentUrl) {
        setEntry({ ...msg.payload, cached: false });
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [currentUrl]);

  const runQuickAnalyze = useCallback(
    async (force: boolean) => {
      if (!tabId) return;
      setLoading(true);
      setError(null);
      try {
        const resp = await chrome.runtime.sendMessage({ type: "ARTEMIS_QUICK_ANALYZE", payload: { tabId, force } });
        if (resp?.error) {
          setError(String(resp.error));
          return;
        }
        setEntry(resp.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [tabId]
  );

  // One-shot auto-analyze for the tab the panel opened on (see hasAutoRun
  // above) — waits for the cache-lookup effect to settle (`cacheChecked`)
  // first so a cached hit doesn't trigger a redundant LLM call.
  useEffect(() => {
    if (!currentUrl || !tabId || !cacheChecked || hasAutoRun.current) return;
    hasAutoRun.current = true;
    if (entry) return;
    void runQuickAnalyze(false);
  }, [currentUrl, tabId, cacheChecked, entry, runQuickAnalyze]);

  const toggleAlwaysOn = useCallback(async () => {
    if (!currentHost) return;
    setTogglingAlways(true);
    setPermError(null);
    try {
      const res = await chrome.storage.local.get(OVERLAY_CONFIG_KEY);
      const cfg = (res as any)[OVERLAY_CONFIG_KEY] || {};
      const sites: string[] = Array.isArray(cfg.jobSites) ? cfg.jobSites : [];
      if (alwaysOn) {
        cfg.jobSites = sites.filter((s) => !domainMatchesEntry(s, currentHost));
        await chrome.storage.local.set({ [OVERLAY_CONFIG_KEY]: cfg });
        setAlwaysOn(false);
      } else {
        const granted = await chrome.permissions.request({ origins: siteToOriginPatterns(currentHost) });
        if (!granted) {
          setPermError(t("sidepanel.permissionDenied"));
          return;
        }
        if (!sites.some((s) => s === currentHost)) sites.push(currentHost);
        cfg.jobSites = sites;
        cfg.enabled = true;
        await chrome.storage.local.set({ [OVERLAY_CONFIG_KEY]: cfg });
        setAlwaysOn(true);
      }
    } catch {
      setPermError(t("sidepanel.permissionDenied"));
    } finally {
      setTogglingAlways(false);
    }
  }, [alwaysOn, currentHost]);

  const runDeepAnalysis = useCallback(async () => {
    if (!tabId) return;
    setDeepState("running");
    setDeepError("");
    try {
      const [scriptResult] = await chrome.scripting.executeScript({ target: { tabId }, func: extractPageContent });
      const data = scriptResult?.result as { title: string; company: string; text: string; url: string } | undefined;
      if (!data?.text) throw new Error(t("sidepanel.noContent"));

      const activeId = await getActiveProfileId();
      if (!activeId) throw new Error(t("sidepanel.noProfile"));
      const profile = await getProfile(activeId);
      if (!profile) throw new Error(t("sidepanel.noProfile"));

      const endpoint = getActiveEndpoint(profile.settings);
      const { result: analysis, markdown } = await analyzeJobPosting(data.text, profile.profileMarkdown, endpoint);

      const sessionId = crypto.randomUUID();
      await saveSession({
        id: sessionId,
        profileId: activeId,
        createdAt: new Date().toISOString(),
        jobPosting: data.text,
        result: analysis,
        markdown,
        followUpMessages: [],
      });

      const appUrl = chrome.runtime.getURL("index.html");
      const existingTabs = await chrome.tabs.query({ url: appUrl + "*" });
      if (existingTabs.length > 0 && existingTabs[0]?.id) {
        await chrome.tabs.sendMessage(existingTabs[0].id, { type: "ARTEMIS_LOAD_SESSION", payload: { sessionId } });
        await chrome.tabs.update(existingTabs[0].id, { active: true });
      } else {
        await chrome.storage.session.set({ "artemis:pendingSessionId": sessionId });
        await chrome.tabs.create({ url: appUrl });
      }
      setDeepState("done");
    } catch (err) {
      setDeepState("error");
      setDeepError(err instanceof Error ? err.message : String(err));
      logErrorToApp(err instanceof Error ? err.message : String(err), err instanceof Error ? err.stack : undefined, "SIDEPANEL_DEEP_ANALYSIS_FAILED");
    }
  }, [tabId]);

  const openApp = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  }, []);

  if (!translationsReady) {
    return <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>{"..."}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "28px", height: "28px", borderRadius: "6px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "14px", fontWeight: "700",
          }}
        >
          A
        </div>
        <span style={{ fontWeight: "600", fontSize: "16px" }}>{t("sidepanel.title")}</span>
        <button
          onClick={openApp}
          style={{
            marginLeft: "auto", padding: "4px 10px", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "6px", background: "transparent", color: "#93c5fd",
            fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {t("sidepanel.openApp")}
        </button>
      </div>

      {!currentHost ? (
        <div style={{ fontSize: "13px", color: "#64748b", padding: "24px 4px", textAlign: "center" }}>
          {t("sidepanel.noPageToAnalyze")}
        </div>
      ) : (
        <>
          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "14px", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {currentHost}
            </div>

            {loading ? (
              <div style={{ fontSize: "13px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{t("sidepanel.analyzing")}</span>
              </div>
            ) : error ? (
              <div>
                <div style={{ fontSize: "13px", color: "#ef4444", marginBottom: "8px" }}>{error}</div>
                <button
                  onClick={() => runQuickAnalyze(true)}
                  style={{
                    padding: "6px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px",
                    background: "#1e293b", color: "#e2e8f0", fontSize: "12px", cursor: "pointer",
                  }}
                >
                  {t("sidepanel.retry")}
                </button>
              </div>
            ) : entry ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {entry.score != null ? (
                    <div
                      style={{
                        width: "48px", height: "48px", borderRadius: "50%",
                        border: `3px solid ${scoreColor(entry.score)}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "14px", fontWeight: "700", color: scoreColor(entry.score), flexShrink: 0,
                      }}
                    >
                      {entry.score}%
                    </div>
                  ) : (
                    <div
                      style={{
                        width: "48px", height: "48px", borderRadius: "50%", border: "3px solid #475569",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "16px", color: "#94a3b8", flexShrink: 0,
                      }}
                    >
                      ?
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.title || t("sidepanel.untitledJob")}
                    </div>
                    {entry.company && <div style={{ fontSize: "12px", color: "#94a3b8" }}>{entry.company}</div>}
                    {entry.salary && <div style={{ fontSize: "12px", color: "#94a3b8" }}>{entry.salary}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                  <button
                    onClick={() => runQuickAnalyze(true)}
                    style={{
                      flex: 1, padding: "7px 10px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px",
                      background: "#1e293b", color: "#e2e8f0", fontSize: "12px", cursor: "pointer",
                    }}
                  >
                    {t("sidepanel.reanalyze")}
                  </button>
                </div>
                {entry.cached && (
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px" }}>{t("sidepanel.cachedResult")}</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: "#64748b" }}>{t("sidepanel.noScoreYet")}</div>
            )}
          </div>

          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: "500" }}>{t("sidepanel.alwaysOn")}</div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{t("sidepanel.alwaysOnDesc")}</div>
              </div>
              <button
                onClick={toggleAlwaysOn}
                disabled={togglingAlways}
                style={{
                  flexShrink: 0, padding: "6px 12px", borderRadius: "6px", fontSize: "12px",
                  border: alwaysOn ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.15)",
                  background: alwaysOn ? "rgba(34,197,94,0.12)" : "#1e293b",
                  color: alwaysOn ? "#4ade80" : "#e2e8f0",
                  cursor: togglingAlways ? "default" : "pointer",
                }}
              >
                {togglingAlways ? "..." : alwaysOn ? t("sidepanel.on") : t("sidepanel.off")}
              </button>
            </div>
            {permError && <div style={{ marginTop: "6px", fontSize: "11px", color: "#ef4444" }}>{permError}</div>}
          </div>

          <div>
            <button
              onClick={runDeepAnalysis}
              disabled={deepState === "running"}
              style={{
                width: "100%", padding: "10px 14px", border: "none", borderRadius: "8px",
                background: deepState === "running" ? "#2563eb" : "#3b82f6",
                color: "#fff", fontSize: "13px", fontWeight: "600",
                cursor: deepState === "running" ? "default" : "pointer",
              }}
            >
              {deepState === "running" ? t("sidepanel.deepAnalysisRunning") : t("sidepanel.deepAnalysis")}
            </button>
            {deepState === "done" && (
              <div style={{ marginTop: "6px", fontSize: "11px", color: "#22c55e" }}>{t("sidepanel.deepAnalysisDone")}</div>
            )}
            {deepState === "error" && (
              <div style={{ marginTop: "6px", fontSize: "11px", color: "#ef4444", wordBreak: "break-word" }}>{deepError}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Panel />);
