/// <reference types="chrome" />
import { createRoot } from "react-dom/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { parseSiteEntry, siteToOriginPatterns, urlToSiteEntry, entryFromUrlInput } from "./job-sites";
import { loadTranslations, t } from "./i18n";

function logErrorToApp(message: string, stack?: string, code?: string) {
  try {
    chrome.runtime.sendMessage({
      type: "ARTEMIS_LOG_ERROR",
      payload: { message, stack, source: "popup", timestamp: new Date().toISOString(), code },
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

const STORAGE_KEY = "artemis:overlayConfig";

interface OverlayConfig {
  enabled: boolean;
  jobSites: string[];
  fallbackMode: "basic" | "secondary" | "primary";
  fingerprint?: string;
  lastFingerprintUpdate?: string;
}

const defaultConfig: OverlayConfig = {
  enabled: true,
  jobSites: [],
  fallbackMode: "basic",
};

function domainMatchesEntry(entry: string, hostname: string): boolean {
  const domain = parseSiteEntry(entry).domain;
  return hostname === domain || hostname.endsWith("." + domain);
}

function Popup() {
  const [translationsReady, setTranslationsReady] = useState(false);
  const [config, setConfig] = useState<OverlayConfig>(defaultConfig);
  const [currentHost, setCurrentHost] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [importState, setImportState] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [importError, setImportError] = useState("");
  const [enableState, setEnableState] = useState<"idle" | "working" | "done">("idle");
  const [permError, setPermError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | undefined>(undefined);
  const [fingerprintDate, setFingerprintDate] = useState<string | undefined>(undefined);
  const enableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadTranslations(navigator.language.split("-")[0] || "en")
      .catch(() => {})
      .finally(() => setTranslationsReady(true));
  }, []);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY).then((result) => {
      const saved = result[STORAGE_KEY] as OverlayConfig | undefined;
      if (saved) {
        setConfig({ ...defaultConfig, ...saved });
        setFingerprint(saved.fingerprint);
        setFingerprintDate(saved.lastFingerprintUpdate);
      }
    });
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        try {
          const url = new URL(tab.url);
          if (url.protocol === "http:" || url.protocol === "https:") {
            setCurrentHost(url.hostname);
            setCurrentUrl(url.href);
            setSiteUrlInput(`${url.protocol}//${url.hostname}`);
          }
        } catch {}
      }
    });
  }, []);

  // React to config changes made in the app's Settings page while the popup is open.
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "local") return;
      const change = changes[STORAGE_KEY];
      if (!change) return;
      const next = (change.newValue || change.oldValue) as OverlayConfig | undefined;
      if (!next) return;
      setConfig({ ...defaultConfig, ...next });
      setFingerprint(next.fingerprint);
      setFingerprintDate(next.lastFingerprintUpdate);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const saveConfig = useCallback((updater: (prev: OverlayConfig) => OverlayConfig) => {
    setConfig((prev) => {
      const updated = updater(prev);
      chrome.storage.local.get(STORAGE_KEY).then((res) => {
        const stored = (res[STORAGE_KEY] || {}) as Partial<OverlayConfig>;
        chrome.storage.local.set({ [STORAGE_KEY]: { ...stored, ...updated } });
      });
      return updated;
    });
  }, []);

  const importJob = useCallback(async () => {
    if (importState === "importing") return;
    setImportState("importing");
    setImportError("");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const resp = await chrome.runtime.sendMessage({
        type: "ARTEMIS_EXTRACT_AND_IMPORT",
        // The popup is not a tab context, so _sender.tab is undefined in the
        // background. Query the active tab ourselves and pass its id along.
        payload: tab?.id ? { tabId: tab.id } : undefined,
      });
      if (resp && (resp as any).error) {
        setImportState("error");
        setImportError(String((resp as any).error));
      } else {
        setImportState("done");
      }
    } catch (err) {
      setImportState("error");
      setImportError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [importState]);

  const overlayEnabledHere =
    config.enabled &&
    currentHost !== "" &&
    config.jobSites.some((s) => domainMatchesEntry(s, currentHost));

  const enableOverlayHere = useCallback(async () => {
    const entry = entryFromUrlInput(siteUrlInput) || urlToSiteEntry(currentUrl);
    if (!entry) return;
    if (config.jobSites.some((s) => s === entry)) {
      setEnableState("done");
      return;
    }
    setEnableState("working");
    setPermError(null);
    try {
      const granted = await chrome.permissions.request({ origins: siteToOriginPatterns(entry) });
      if (!granted) {
        setPermError(t("extension.permissionDenied"));
        setEnableState("idle");
        return;
      }
      saveConfig((c) => ({ ...c, jobSites: [...c.jobSites, entry] }));
      setEnableState("done");
      if (enableTimerRef.current) clearTimeout(enableTimerRef.current);
      enableTimerRef.current = setTimeout(() => setEnableState("idle"), 4000);
    } catch {
      setEnableState("idle");
    }
  }, [siteUrlInput, currentUrl, config.jobSites, saveConfig]);

  const setOverlayEnabled = useCallback((enabled: boolean) => {
    saveConfig((c) => ({ ...c, enabled }));
  }, [saveConfig]);

  const openApp = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  }, []);

  const openSettings = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html#/config") });
  }, []);

  if (!translationsReady) {
    return <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>Loading...</div>;
  }

  const fpStatus = fingerprint
    ? fingerprintDate
      ? `${t("extension.fingerprintReady")} · ${new Date(fingerprintDate).toLocaleDateString()}`
      : t("extension.fingerprintReady")
    : t("extension.fingerprintMissing");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "6px",
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: "14px", fontWeight: "700",
        }}>A</div>
        <span style={{ fontWeight: "600", fontSize: "16px" }}>Artemis Quiver</span>
        <button
          onClick={openApp}
          style={{
            marginLeft: "auto", padding: "4px 10px", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "6px", background: "transparent", color: "#93c5fd",
            fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
          }}
          title={t("extension.openAppTitle")}
        >
          {t("extension.openApp")}
        </button>
      </div>

      {/* Hero: import current page */}
      <button
        onClick={importJob}
        disabled={importState === "importing"}
        style={{
          padding: "12px 16px", border: "none", borderRadius: "10px",
          background: importState === "importing" ? "#2563eb" : "#3b82f6",
          color: "#fff", fontSize: "14px", fontWeight: "600",
          cursor: importState === "importing" ? "default" : "pointer",
          transition: "background 0.2s", width: "100%", textAlign: "center",
        }}
      >
        {importState === "importing" && t("extension.importingJob")}
        {importState === "done" && t("extension.imported")}
        {importState === "error" && t("extension.importFailed")}
        {importState === "idle" && t("extension.importJob")}
      </button>
      {importState === "error" && importError && (
        <div style={{ fontSize: "11px", color: "#ef4444", wordBreak: "break-word" }}>
          {importError}
        </div>
      )}
      {importState === "done" && (
        <div style={{ fontSize: "11px", color: "#22c55e" }}>
          {t("extension.imported")}
        </div>
      )}

      {/* Overlay status */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {t("extension.showOverlay")}
        </div>
        {!config.enabled ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>{t("extension.overlayInactive")}</span>
            <button
              onClick={() => setOverlayEnabled(true)}
              style={{
                padding: "5px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px",
                background: "#1e293b", color: "#e2e8f0", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {t("extension.enableOverlay")}
            </button>
          </div>
        ) : overlayEnabledHere ? (
          <div style={{ fontSize: "13px", color: "#22c55e" }}>
            {t("extension.overlayActive")} · {currentHost}
          </div>
        ) : currentHost ? (
          <div>
            <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
              {t("extension.overlayInactive")} · {currentHost}
            </div>
            <input
              value={siteUrlInput}
              onChange={(e) => setSiteUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enableOverlayHere()}
              disabled={enableState === "working"}
              spellCheck={false}
              placeholder="https://example.com/jobs/*"
              style={{
                width: "100%", padding: "7px 10px", borderRadius: "6px",
                background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)",
                color: "#e2e8f0", fontSize: "12px", marginBottom: "4px",
                boxSizing: "border-box", outline: "none",
              }}
            />
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
              {t("extension.siteUrlHint")}
            </div>
            <button
              onClick={enableOverlayHere}
              disabled={enableState === "working"}
              style={{
                padding: "6px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px",
                background: "#1e293b", color: "#e2e8f0", fontSize: "12px",
                cursor: enableState === "working" ? "default" : "pointer", whiteSpace: "nowrap",
              }}
            >
              {enableState === "working" ? "..." : t("extension.enableOverlay")}
            </button>
            {enableState === "done" && (
              <div style={{ marginTop: "6px", fontSize: "11px", color: "#22c55e" }}>
                {t("extension.reloadHint")}
              </div>
            )}
            {permError && (
              <div style={{ marginTop: "6px", fontSize: "11px", color: "#ef4444", wordBreak: "break-word" }}>
                {permError}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            {t("extension.overlayInactive")}
          </div>
        )}
      </div>

      {/* Fingerprint status */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {t("extension.profileFingerprint")}
        </div>
        <div style={{ fontSize: "13px", color: "#e2e8f0" }}>
          {fingerprint ? (
            <span style={{ color: "#22c55e" }}>✓ {fpStatus}</span>
          ) : (
            <span style={{ color: "#94a3b8" }}>{fpStatus}</span>
          )}
        </div>
        {fingerprint && (
          <div style={{ marginTop: "4px", fontSize: "11px", color: "#64748b", wordBreak: "break-all" }}>
            {fingerprint.slice(0, 120)}...
          </div>
        )}
      </div>

      {/* Settings link */}
      <button
        onClick={openSettings}
        style={{
          padding: "9px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
          background: "transparent", color: "#93c5fd", fontSize: "12px", cursor: "pointer", width: "100%", textAlign: "center",
        }}
      >
        {t("extension.openSettings")} →
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
