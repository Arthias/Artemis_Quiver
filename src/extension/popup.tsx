/// <reference types="chrome" />
import { createRoot } from "react-dom/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { parseSiteEntry } from "./job-sites";
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

function Popup() {
  const [config, setConfig] = useState<OverlayConfig>(defaultConfig);
  const [newSite, setNewSite] = useState("");
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [genStatus, setGenStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [genError, setGenError] = useState("");
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveConfig = useCallback((updater: (prev: OverlayConfig) => OverlayConfig) => {
    setConfig((prev) => {
      const updated = updater(prev);
      chrome.storage.local.set({ [STORAGE_KEY]: updated });
      return updated;
    });
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
  }, []);

  useEffect(() => {
    loadTranslations(navigator.language.split("-")[0] || "en").catch(() => {});
  }, []);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY).then((result) => {
      const saved = result[STORAGE_KEY] as OverlayConfig | undefined;
      if (saved) setConfig({ ...defaultConfig, ...saved });
    });
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        try {
          const url = new URL(tab.url);
          if (url.protocol === "http:" || url.protocol === "https:") {
            const pathParts = url.pathname.split("/").filter(Boolean).slice(0, 2);
            const path = pathParts.length > 0 ? "/" + pathParts.join("/") : "";
            setNewSite(url.hostname + path);
          }
        } catch {}
      }
    });
  }, []);

  const addSite = useCallback(() => {
    const trimmed = newSite.trim().toLowerCase().replace(/^https?:\/\//, "");
    if (!trimmed || config.jobSites.includes(trimmed)) return;
    setNewSite("");
    saveConfig((c) => ({ ...c, jobSites: [...c.jobSites, trimmed] }));
  }, [newSite, config.jobSites, saveConfig]);

  const removeSite = useCallback((site: string) => {
    saveConfig((c) => ({ ...c, jobSites: c.jobSites.filter((s) => s !== site) }));
  }, [saveConfig]);

  const saveEdit = useCallback((originalSite: string) => {
    const trimmed = editValue.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!trimmed || trimmed === originalSite) {
      setEditingSite(null);
      return;
    }
    if (!config.jobSites.includes(trimmed)) {
      saveConfig((c) => ({ ...c, jobSites: c.jobSites.map((s) => s === originalSite ? trimmed : s) }));
    }
    setEditingSite(null);
  }, [editValue, config.jobSites, saveConfig]);

  const generateFingerprint = useCallback(async () => {
    setGenStatus("generating");
    setGenError("");
    try {
      const resp = await chrome.runtime.sendMessage({ type: "ARTEMIS_GENERATE_FINGERPRINT" });
      if (resp?.fingerprint) {
        saveConfig((c) => ({ ...c, fingerprint: resp.fingerprint, lastFingerprintUpdate: new Date().toISOString() }));
        setGenStatus("done");
      } else {
        console.error("[Artemis] Fingerprint failed:", resp?.error || "unknown error");
        setGenStatus("error");
        setGenError(resp?.error || "Unknown error");
      }
    } catch (err) {
      console.error("[Artemis] Fingerprint error:", err);
      setGenStatus("error");
      setGenError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [saveConfig]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "6px",
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: "14px", fontWeight: "700",
        }}>A</div>
        <span style={{ fontWeight: "600", fontSize: "16px" }}>Artemis Quiver</span>
        <button
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("index.html") })}
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

      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => { saveConfig((c) => ({ ...c, enabled: e.target.checked })); }}
          style={{ width: "16px", height: "16px" }}
        />
        <span>{t("extension.showOverlay")}</span>
      </label>

      <div>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {t("extension.profileFingerprint")}
        </div>
        <button
          onClick={generateFingerprint}
          disabled={genStatus === "generating"}
          style={{
            padding: "8px 16px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
            background: genStatus === "generating" ? "#1e293b" : "#1e293b",
            color: genStatus === "generating" ? "#64748b" : "#e2e8f0",
            fontSize: "13px", cursor: genStatus === "generating" ? "default" : "pointer",
            width: "100%", textAlign: "center",
          }}
        >
          {genStatus === "idle" && (config.fingerprint ? t("extension.regenerateFingerprint") : t("extension.generateFingerprint"))}
          {genStatus === "generating" && t("extension.generating")}
          {genStatus === "done" && t("extension.generated")}
          {genStatus === "error" && t("extension.errorTryAgain")}
        </button>
        {genStatus === "error" && genError && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#ef4444", wordBreak: "break-word" }}>
            {genError}
          </div>
        )}
        {config.fingerprint && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#64748b", wordBreak: "break-all" }}>
            {config.fingerprint.slice(0, 100)}...
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {t("extension.fallbackWhenUnavailable")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {(["basic", "secondary", "primary"] as const).map((mode) => (
            <label key={mode} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "4px 0" }}>
              <input
                type="radio"
                name="fallback"
                checked={config.fallbackMode === mode}
                onChange={() => { saveConfig((c) => ({ ...c, fallbackMode: mode })); }}
              />
              <span style={{ fontSize: "13px" }}>{mode === "basic" ? t("extension.basic") : mode === "secondary" ? t("extension.secondary") : t("extension.primary")}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {t("extension.customJobSites")}
        </div>
        <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
          <input
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSite()}
            placeholder={t("extension.sitePlaceholder")}
            style={{
              flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)",
              background: "#1e293b", color: "#f1f5f9", fontSize: "13px", outline: "none",
            }}
          />
          <button onClick={addSite} style={{
            padding: "6px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px",
            background: "#1e293b", color: "#e2e8f0", fontSize: "13px", cursor: "pointer",
          }}>{t("extension.add")}</button>
        </div>
        {config.jobSites.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {config.jobSites.map((site) => {
              const parsed = parseSiteEntry(site);
              const hasPath = !!parsed.pathPattern;
              return editingSite === site ? (
                <span key={site} style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  padding: "3px 8px", borderRadius: "4px", background: "#1e293b",
                  fontSize: "12px",
                }}>
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { saveEdit(site); }
                      if (e.key === "Escape") { setEditingSite(null); }
                    }}
                    style={{
                      width: "140px", padding: "2px 4px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.15)",
                      background: "#0f172a", color: "#f1f5f9", fontSize: "12px", outline: "none",
                    }}
                    autoFocus
                  />
                  <span onClick={() => saveEdit(site)} style={{ cursor: "pointer", color: "#22c55e", fontSize: "14px", fontWeight: "700" }}>&#10003;</span>
                  <span onClick={() => setEditingSite(null)} style={{ cursor: "pointer", color: "#ef4444", fontSize: "14px" }}>&#10005;</span>
                </span>
              ) : (
                <span key={site} style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  padding: "3px 8px", borderRadius: "4px", background: "#1e293b",
                  fontSize: "12px", color: "#94a3b8",
                }}>
                  <span>{parsed.domain}</span>
                  {hasPath && <span style={{ color: "#93c5fd" }}>{parsed.pathPattern}</span>}
                  <span onClick={() => { setEditingSite(site); setEditValue(site); }} style={{ cursor: "pointer", color: "#94a3b8", fontSize: "12px", marginLeft: "2px" }}>&#9998;</span>
                  <span onClick={() => removeSite(site)} style={{ cursor: "pointer", color: "#ef4444", fontSize: "14px" }}>&#10005;</span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {saved && (
        <div style={{ textAlign: "center", fontSize: "12px", color: "#22c55e", padding: "6px" }}>
          {t("extension.saved")}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
