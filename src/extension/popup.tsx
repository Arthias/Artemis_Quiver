/// <reference types="chrome" />
import { createRoot } from "react-dom/client";
import { useState, useEffect, useCallback } from "react";

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

const FALLBACK_LABELS: Record<string, string> = {
  basic: "Basic (import only, no AI)",
  secondary: "Use app's secondary model routing",
  primary: "Use app's primary model",
};

function Popup() {
  const [config, setConfig] = useState<OverlayConfig>(defaultConfig);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSite, setNewSite] = useState("");
  const [genStatus, setGenStatus] = useState<"idle" | "generating" | "done" | "error">("idle");

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY).then((result) => {
      const saved = result[STORAGE_KEY] as OverlayConfig | undefined;
      if (saved) setConfig({ ...defaultConfig, ...saved });
    });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
    setDirty(false);
    setSaving(false);
  }, [config]);

  const addSite = useCallback(() => {
    const trimmed = newSite.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!trimmed || config.jobSites.includes(trimmed)) return;
    setConfig((c) => ({ ...c, jobSites: [...c.jobSites, trimmed] }));
    setNewSite("");
    setDirty(true);
  }, [newSite, config.jobSites]);

  const removeSite = useCallback((site: string) => {
    setConfig((c) => ({ ...c, jobSites: c.jobSites.filter((s) => s !== site) }));
    setDirty(true);
  }, []);

  const generateFingerprint = useCallback(async () => {
    setGenStatus("generating");
    try {
      const resp = await chrome.runtime.sendMessage({ type: "ARTEMIS_GENERATE_FINGERPRINT" });
      if (resp?.fingerprint) {
        setConfig((c) => ({ ...c, fingerprint: resp.fingerprint, lastFingerprintUpdate: new Date().toISOString() }));
        setDirty(true);
        setGenStatus("done");
      } else {
        console.error("[Artemis] Fingerprint failed:", resp?.error || "unknown error");
        setGenStatus("error");
      }
    } catch (err) {
      console.error("[Artemis] Fingerprint error:", err);
      setGenStatus("error");
    }
  }, []);

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
          title="Open Artemis Quiver app"
        >
          Open App →
        </button>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => { setConfig((c) => ({ ...c, enabled: e.target.checked })); setDirty(true); }}
          style={{ width: "16px", height: "16px" }}
        />
        <span>Show overlay on job pages</span>
      </label>

      <div>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Profile Fingerprint
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
          {genStatus === "idle" && (config.fingerprint ? "Regenerate fingerprint" : "Generate fingerprint")}
          {genStatus === "generating" && "Generating..."}
          {genStatus === "done" && "✓ Generated"}
          {genStatus === "error" && "Error — try again"}
        </button>
        {config.fingerprint && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#64748b", wordBreak: "break-all" }}>
            {config.fingerprint.slice(0, 100)}...
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Fallback (when Gemini Nano unavailable)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {(["basic", "secondary", "primary"] as const).map((mode) => (
            <label key={mode} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "4px 0" }}>
              <input
                type="radio"
                name="fallback"
                checked={config.fallbackMode === mode}
                onChange={() => { setConfig((c) => ({ ...c, fallbackMode: mode })); setDirty(true); }}
              />
              <span style={{ fontSize: "13px" }}>{FALLBACK_LABELS[mode]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Custom Job Sites
        </div>
        <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
          <input
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSite()}
            placeholder="e.g., myjobboard.com"
            style={{
              flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)",
              background: "#1e293b", color: "#f1f5f9", fontSize: "13px", outline: "none",
            }}
          />
          <button onClick={addSite} style={{
            padding: "6px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px",
            background: "#1e293b", color: "#e2e8f0", fontSize: "13px", cursor: "pointer",
          }}>Add</button>
        </div>
        {config.jobSites.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {config.jobSites.map((site) => (
              <span key={site} style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 8px", borderRadius: "4px", background: "#1e293b",
                fontSize: "12px", color: "#94a3b8",
              }}>
                {site}
                <span onClick={() => removeSite(site)} style={{ cursor: "pointer", color: "#ef4444", fontSize: "14px" }}>×</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={save}
        disabled={!dirty || saving}
        style={{
          padding: "10px", border: "none", borderRadius: "8px",
          background: dirty ? "#3b82f6" : "#1e293b",
          color: dirty ? "#fff" : "#64748b",
          fontSize: "14px", fontWeight: "600", cursor: dirty ? "pointer" : "default",
          transition: "all 0.2s",
        }}
      >
        {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
