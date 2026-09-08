import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Settings, Zap, ChevronDown, ChevronRight, Loader2, List, Globe, Plus, X, Bug, Trash2, Pencil, Check, AlertTriangle, Fingerprint, Workflow, Send, CheckCircle2, XCircle, Cloud, Laptop } from "lucide-react";
import { useErrorLog } from "../context/ErrorLogContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useConfig } from "../context/ConfigContext";
import { useProfile } from "../context/ProfileContext";
import { useWorkspace } from "../context/WorkspaceProfileContext";
import { chatCompletion, listModels as listModelsApi, testConnection } from "../services/llmService";
import {
  checkFlowHealth,
  sendProfileToFlow,
  sendConfigToFlow,
  testEndpointFromFlow,
  getBacklogConfig,
  updateBacklogConfig,
  type FlowStatus,
  type FlowBacklogConfig,
} from "../services/flowBridge";
import type { ProviderType, SecondaryUse, ModelEndpoint } from "../types/llm";
import { DEFAULT_PRIMARY_ENDPOINT, DEFAULT_SECONDARY_ENDPOINT } from "../types/llm";
import { PROVIDER_DEFAULT_BASE_URLS } from "../config/defaults";
import type { ThemeMode } from "../types/workspace";
import { DEFAULT_JOB_SITES, siteToOriginPatterns } from "../../extension/job-sites";
import { getAdapter } from "../services/provider/registry";
import { WEBLLM_MODELS } from "../services/provider/WebLLMAdapter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { clearAllData } from "../db";
import { ensureDbInitialized } from "../db";
import { useOnboarding } from "../context/OnboardingContext";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "../components/ui/LanguageSelector";
import { toast } from "sonner";
import { AppError } from "../utils/errors";

function ExtensionSettingsCard() {
  const { t } = useTranslation();
  const configCtx = useConfig();
  const workspace = useWorkspace();
  const [customSites, setCustomSites] = useState<string[]>([]);
  const [excludedSites, setExcludedSites] = useState<string[]>([]);
  const [newSite, setNewSite] = useState("");
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [fallbackMode, setFallbackMode] = useState<"basic" | "secondary" | "primary">("basic");
  const [hasSecondary, setHasSecondary] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpStorageKey, setFpStorageKey] = useState<string | null>(null);
  // Whether the extension actually holds the optional host permission for
  // each configured site — being in jobSites/DEFAULT_JOB_SITES does NOT mean
  // the overlay will show up there. chrome.scripting.registerContentScripts()
  // silently no-ops without this permission (see background.ts), which is
  // why the overlay can "not pop up" on a site that looks configured here —
  // most visibly for the 13 DEFAULT_JOB_SITES, which are listed as available
  // out of the box but never actually had permission requested for them.
  const [sitePermissions, setSitePermissions] = useState<Record<string, boolean>>({});
  const [grantingSite, setGrantingSite] = useState<string | null>(null);

  useEffect(() => {
    const isExt = typeof chrome !== "undefined" && chrome.storage?.local;
    if (!isExt) return;
    chrome.storage.local.get("artemis:overlayConfig").then((result) => {
      const cfg = (result as any)["artemis:overlayConfig"] || {};
      setFingerprint(cfg.fingerprint ?? null);
      setFpStorageKey(cfg.lastFingerprintUpdate ?? null);
    });
  }, []);

  async function generateFingerprint() {
    setFpLoading(true);
    setFpError(null);
    const isExt = typeof chrome !== "undefined" && chrome.storage?.local;

    try {
      const markdown = workspace.profileData?.profileMarkdown;
      const endpoint = configCtx.config.primary;
      if (!markdown) { setFpError(t("config.fingerprintNoProfile")); return; }
      if (!endpoint.baseUrl || !endpoint.model) { setFpError(t("config.fingerprintNoEndpoint")); return; }

      const prompt = `Produce a single-line fingerprint of this profile for matching against job postings. Format: Role | Skills (pipe-separated, max 5) | YoE | Industries. Keep under 300 chars. No preamble, no explanation, no markdown.\n\nProfile:\n${markdown.slice(0, 4000)}`;
      const result = await chatCompletion([{ role: "user", content: prompt }], endpoint, { timeoutMs: 120000 });

      setFingerprint(result);

      if (isExt) {
        const stored = await chrome.storage.local.get("artemis:overlayConfig");
        const cfg: any = stored["artemis:overlayConfig"] || {};
        cfg.fingerprint = result;
        cfg.lastFingerprintUpdate = new Date().toISOString();
        cfg.primaryEndpoint = { ...endpoint };
        if (configCtx.config.secondary?.baseUrl) {
          cfg.secondaryEndpoint = { ...configCtx.config.secondary };
        }
        await chrome.storage.local.set({ "artemis:overlayConfig": cfg });
        setFpStorageKey(cfg.lastFingerprintUpdate);
      }
    } catch (err) {
      setFpError(err instanceof Error ? err.message : String(err));
    } finally {
      setFpLoading(false);
    }
  }

  useEffect(() => {
    const isExt = typeof chrome !== "undefined" && chrome.storage?.local;
    if (!isExt) return;
    chrome.storage.local.get("artemis:overlayConfig").then((result) => {
      const cfg = (result as any)["artemis:overlayConfig"] || {};
      setCustomSites(cfg.jobSites || []);
      setExcludedSites(cfg.excludedSites || []);
      setOverlayEnabled(cfg.enabled !== false);
      const fm = cfg.fallbackMode;
      setFallbackMode(fm === "secondary" || fm === "primary" ? fm : "basic");
      setHasSecondary(!!cfg.secondaryEndpoint || !!configCtx.config.secondary?.baseUrl);
    });
  }, []);

  function save(newCustom: string[], newExcluded: string[]) {
    const isExt = typeof chrome !== "undefined" && chrome.storage?.local;
    if (!isExt) return;
    chrome.storage.local.get("artemis:overlayConfig").then((result) => {
      const cfg = (result as any)["artemis:overlayConfig"] || {};
      cfg.jobSites = newCustom;
      cfg.excludedSites = newExcluded;
      cfg.enabled = overlayEnabled;
      cfg.fallbackMode = fallbackMode;
      chrome.storage.local.set({ "artemis:overlayConfig": cfg });
    });
  }

  // Request host permission for the site's origins so the background can
  // register a content script for it. The background auto-reconciles on the
  // storage write (storage.onChanged) once permission is granted.
  async function requestSitePermission(entry: string): Promise<boolean> {
    const isExt = typeof chrome !== "undefined" && chrome.permissions?.request;
    if (!isExt) return true;
    try {
      const granted = await chrome.permissions.request({ origins: siteToOriginPatterns(entry) });
      if (!granted) setPermError(t("config.permissionDenied"));
      return granted;
    } catch {
      return true; // API hiccup — don't block configuring the site
    }
  }

  async function addSite() {
    const trimmed = newSite.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!trimmed || allSites.includes(trimmed)) return;
    setPermError(null);
    const granted = await requestSitePermission(trimmed);
    if (!granted) return;
    const next = [...customSites, trimmed];
    setCustomSites(next);
    setNewSite("");
    save(next, excludedSites);
  }

  function setFallback(mode: "basic" | "secondary" | "primary") {
    setFallbackMode(mode);
    const isExt = typeof chrome !== "undefined" && chrome.storage?.local;
    if (!isExt) return;
    chrome.storage.local.get("artemis:overlayConfig").then((result) => {
      const cfg = (result as any)["artemis:overlayConfig"] || {};
      cfg.fallbackMode = mode;
      chrome.storage.local.set({ "artemis:overlayConfig": cfg });
    });
  }

  const allSites = [
    ...DEFAULT_JOB_SITES.filter((s) => !excludedSites.includes(s)),
    ...customSites,
  ];

  useEffect(() => {
    const isExt = typeof chrome !== "undefined" && chrome.permissions?.contains;
    if (!isExt || allSites.length === 0) return;
    let cancelled = false;
    Promise.all(
      allSites.map(async (site) => {
        try {
          const granted = await chrome.permissions.contains({ origins: siteToOriginPatterns(site) });
          return [site, granted] as const;
        } catch {
          return [site, true] as const; // API hiccup — don't show a false warning
        }
      })
    ).then((results) => {
      if (cancelled) return;
      setSitePermissions(Object.fromEntries(results));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customSites, excludedSites]);

  async function grantSitePermission(site: string) {
    setGrantingSite(site);
    setPermError(null);
    try {
      const granted = await chrome.permissions.request({ origins: siteToOriginPatterns(site) });
      if (!granted) {
        setPermError(t("config.permissionDenied"));
        return;
      }
      setSitePermissions((prev) => ({ ...prev, [site]: true }));
    } catch {
      setPermError(t("config.permissionDenied"));
    } finally {
      setGrantingSite(null);
    }
  }

  function removeSite(site: string) {
    if (DEFAULT_JOB_SITES.includes(site)) {
      const nextExcluded = [...excludedSites, site];
      setExcludedSites(nextExcluded);
      save(customSites, nextExcluded);
    } else {
      const next = customSites.filter((s) => s !== site);
      setCustomSites(next);
      save(next, excludedSites);
    }
  }

  function startEdit(site: string) {
    setEditingSite(site);
    setEditValue(site);
  }

  function saveEdit() {
    if (editingSite === null) return;
    const trimmed = editValue.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!trimmed || trimmed === editingSite) {
      setEditingSite(null);
      setEditValue("");
      return;
    }
    if (DEFAULT_JOB_SITES.includes(editingSite)) {
      const nextCustom = [...customSites, trimmed];
      const nextExcluded = [...excludedSites, editingSite];
      setCustomSites(nextCustom);
      setExcludedSites(nextExcluded);
      save(nextCustom, nextExcluded);
    } else {
      const next = customSites.map((s) => (s === editingSite ? trimmed : s));
      setCustomSites(next);
      save(next, excludedSites);
    }
    setEditingSite(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingSite(null);
    setEditValue("");
  }

  const isExt = typeof chrome !== "undefined" && chrome.storage?.local;

  if (!isExt) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">{t("config.extension")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("config.extensionNotAvailable")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-semibold">{t("config.extensionOverlay")}</h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>{t("config.showOverlay")}</Label>
          <p className="text-sm text-muted-foreground">
            {t("config.showOverlayDesc")}
          </p>
        </div>
        <Switch
          checked={overlayEnabled}
          onCheckedChange={(v) => {
            setOverlayEnabled(v);
            chrome.storage.local.get("artemis:overlayConfig").then((result) => {
              const cfg = (result as any)["artemis:overlayConfig"] || {};
              cfg.enabled = v;
              chrome.storage.local.set({ "artemis:overlayConfig": cfg });
            });
          }}
        />
      </div>

      <div>
        <Label className="mb-2 block">{t("config.jobSites")}</Label>
        <p className="text-xs text-muted-foreground mb-3">
          {t("config.jobSitesDesc")}
        </p>
        <div className="flex flex-wrap gap-2">
          {allSites.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("config.noJobSites")}</p>
          ) : (
            allSites.map((site) =>
              editingSite === site ? (
                <span key={site} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="w-48 h-6 text-xs"
                    autoFocus
                  />
                  <button onClick={saveEdit} className="text-green-500 hover:text-green-600">
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : (
                <span
                  key={site}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    sitePermissions[site] === false ? "bg-amber-500/10 border border-amber-500/30" : "bg-muted"
                  }`}
                  title={sitePermissions[site] === false ? t("config.sitePermissionMissing") : undefined}
                >
                  {sitePermissions[site] === false && (
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                  )}
                  {site}
                  {sitePermissions[site] === false && (
                    <button
                      onClick={() => grantSitePermission(site)}
                      disabled={grantingSite === site}
                      className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium underline underline-offset-2"
                    >
                      {grantingSite === site ? "…" : t("config.grantAccess")}
                    </button>
                  )}
                  <button onClick={() => startEdit(site)} className="text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeSite(site)} className="text-destructive hover:text-destructive/80">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            )
          )}
        </div>
        {Object.values(sitePermissions).some((granted) => granted === false) && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {t("config.sitePermissionMissingHint")}
          </p>
        )}
      </div>

      <div>
        <Label className="mb-2 block">{t("config.addCustomSite")}</Label>
        {permError && (
          <p className="text-xs text-destructive mb-2">{permError}</p>
        )}
        <div className="flex gap-2">
          <Input
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSite()}
            placeholder={t("config.sitePlaceholder")}
            className="bg-input-background flex-1"
          />
          <Button variant="outline" size="icon" onClick={addSite}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <hr className="border-t border-border" />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Fingerprint className="w-5 h-5 text-purple-500" />
          <h3 className="text-base font-semibold">{t("config.profileFingerprint")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("config.fingerprintDesc")}
        </p>

        {fingerprint && (
          <div className="bg-muted rounded p-3 text-xs font-mono break-all">
            {fingerprint}
          </div>
        )}
        {fpError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-xs text-destructive">
            {fpError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={generateFingerprint}
            disabled={fpLoading}
          >
            {fpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
            {fpLoading ? t("config.generating") : t("config.generateFingerprint")}
          </Button>
          {fingerprint && fpStorageKey && (
            <span className="text-xs text-muted-foreground">
              {t("config.updated")} {new Date(fpStorageKey).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <hr className="border-t border-border" />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-500" />
          <h3 className="text-base font-semibold">{t("config.overlayFallback")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("config.overlayFallbackDesc")}
        </p>
        <div className="flex flex-col gap-2">
          {([
            { mode: "basic" as const, label: t("config.fallbackBasic") },
            { mode: "secondary" as const, label: t("config.fallbackSecondary") },
            { mode: "primary" as const, label: t("config.fallbackPrimary") },
          ]).map(({ mode, label }) => {
            const disabled = mode === "secondary" && !hasSecondary;
            return (
              <label
                key={mode}
                className={`flex items-center gap-2 text-sm ${disabled ? "text-muted-foreground/60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name="overlayFallback"
                  checked={fallbackMode === mode}
                  disabled={disabled}
                  onChange={() => setFallback(mode)}
                />
                {label}
              </label>
            );
          })}
          {fallbackMode === "secondary" && !hasSecondary && (
            <p className="text-xs text-muted-foreground">{t("config.fallbackSecondaryUnavailable")}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function FlowEndpointRow({
  endpoint,
  label,
  flowBaseUrl,
  connected,
  onSent,
}: {
  endpoint: ModelEndpoint;
  label: string;
  flowBaseUrl: string;
  connected: boolean;
  onSent: () => void;
}) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [testingQuiver, setTestingQuiver] = useState(false);
  const [testingFlow, setTestingFlow] = useState(false);
  const [quiverResult, setQuiverResult] = useState<"ok" | "fail" | null>(null);
  const [flowResult, setFlowResult] = useState<"ok" | "fail" | null>(null);

  const supported = endpoint.provider === "anthropic" || endpoint.provider === "openai-compatible";

  async function handleSend() {
    setSending(true);
    setSendError(null);
    try {
      await sendConfigToFlow(flowBaseUrl, endpoint);
      setSent(true);
      onSent();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function handleTestQuiver() {
    setTestingQuiver(true);
    setQuiverResult(null);
    try {
      await testConnection(endpoint);
      setQuiverResult("ok");
    } catch {
      setQuiverResult("fail");
    } finally {
      setTestingQuiver(false);
    }
  }

  async function handleTestFlow() {
    setTestingFlow(true);
    setFlowResult(null);
    const result = await testEndpointFromFlow(flowBaseUrl, endpoint);
    setFlowResult(result.reachable ? "ok" : "fail");
    setTestingFlow(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {endpoint.provider} · {endpoint.model || t("config.flowNoModel")}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!connected || !supported || sending}
          onClick={handleSend}
          title={!supported ? t("config.flowProviderUnsupported") : undefined}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sent ? t("config.flowSent") : t("config.flowSend")}
        </Button>
      </div>
      {!supported && (
        <p className="text-xs text-muted-foreground">{t("config.flowProviderUnsupported")}</p>
      )}
      {sendError && <p className="text-xs text-destructive">{sendError}</p>}
      <div className="flex items-center gap-4 text-xs">
        <button
          type="button"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={handleTestQuiver}
          disabled={testingQuiver}
        >
          {testingQuiver ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : quiverResult === "ok" ? (
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          ) : quiverResult === "fail" ? (
            <XCircle className="w-3 h-3 text-destructive" />
          ) : null}
          {t("config.flowTestFromQuiver")}
        </button>
        <button
          type="button"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={handleTestFlow}
          disabled={testingFlow || !connected}
        >
          {testingFlow ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : flowResult === "ok" ? (
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          ) : flowResult === "fail" ? (
            <XCircle className="w-3 h-3 text-destructive" />
          ) : null}
          {t("config.flowTestFromFlow")}
        </button>
      </div>
    </div>
  );
}

function FlowSettingsCard() {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();
  const { profile } = useProfile();
  const [flowBaseUrlInput, setFlowBaseUrlInput] = useState(config.flowBaseUrl || "http://localhost:8000");
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<FlowStatus | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [profilePushed, setProfilePushed] = useState(false);
  const [primaryPushed, setPrimaryPushed] = useState(false);
  const [secondaryPushed, setSecondaryPushed] = useState(false);
  const [pushingProfile, setPushingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const connected = status?.connected ?? false;
  const canStart = Boolean(config.flowConfiguredAt) || (profilePushed && (primaryPushed || secondaryPushed));

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    updateConfig({ flowBaseUrl: flowBaseUrlInput });
    const result = await checkFlowHealth(flowBaseUrlInput);
    setStatus(result);
    if (!result.connected) setConnectError(t("config.flowNotFound"));
    setConnecting(false);
  }

  async function handleSendProfile() {
    if (!config.flowBaseUrl) return;
    setPushingProfile(true);
    setProfileError(null);
    try {
      await sendProfileToFlow(config.flowBaseUrl, profile);
      setProfilePushed(true);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : String(err));
    } finally {
      setPushingProfile(false);
    }
  }

  useEffect(() => {
    if (profilePushed && (primaryPushed || secondaryPushed) && !config.flowConfiguredAt) {
      updateConfig({ flowConfiguredAt: new Date().toISOString() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePushed, primaryPushed, secondaryPushed]);

  async function handleStart() {
    if (!config.flowBaseUrl) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`${config.flowBaseUrl}/api/pipeline/search`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed to start Flow: ${res.statusText}`);
      setStarted(true);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Workflow className="w-5 h-5 text-teal-500" />
        <h2 className="text-lg font-semibold">{t("config.flowTitle")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("config.flowDesc")}</p>

      <div className="flex items-center gap-2">
        <Input
          value={flowBaseUrlInput}
          onChange={(e) => setFlowBaseUrlInput(e.target.value)}
          placeholder="http://localhost:8000"
          className="bg-input-background flex-1"
        />
        <Button size="sm" onClick={handleConnect} disabled={connecting}>
          {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("config.flowConnect")}
        </Button>
      </div>

      {connectError && <p className="text-xs text-destructive">{connectError}</p>}

      {status && (
        <div className="flex items-center gap-2 text-sm">
          {connected ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-destructive" />
          )}
          <span>{connected ? t("config.flowConnected") : t("config.flowDisconnected")}</span>
          {connected && typeof status.totalJobs === "number" && (
            <span className="text-muted-foreground">· {t("config.flowTotalJobs", { n: status.totalJobs })}</span>
          )}
        </div>
      )}

      {connected && (
        <>
          <hr className="border-t border-border" />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>{t("config.flowSendProfile")}</Label>
                <p className="text-xs text-muted-foreground">{t("config.flowSendProfileDesc")}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleSendProfile} disabled={pushingProfile}>
                {pushingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {profilePushed ? t("config.flowSent") : t("config.flowSend")}
              </Button>
            </div>
            {profileError && <p className="text-xs text-destructive">{profileError}</p>}
          </div>

          <div className="space-y-2">
            <Label className="mb-1 block">{t("config.flowSendConfig")}</Label>
            <FlowEndpointRow
              endpoint={config.primary}
              label={t("config.primaryModel")}
              flowBaseUrl={config.flowBaseUrl!}
              connected={connected}
              onSent={() => setPrimaryPushed(true)}
            />
            <FlowEndpointRow
              endpoint={config.secondary}
              label={t("config.secondaryModel")}
              flowBaseUrl={config.flowBaseUrl!}
              connected={connected}
              onSent={() => setSecondaryPushed(true)}
            />
          </div>

          <hr className="border-t border-border" />

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>{t("config.flowStart")}</Label>
              <p className="text-xs text-muted-foreground">
                {canStart ? t("config.flowStartReady") : t("config.flowStartBlocked")}
              </p>
            </div>
            <Button size="sm" onClick={handleStart} disabled={!canStart || starting || started}>
              {starting && <Loader2 className="w-4 h-4 animate-spin" />}
              {started ? t("config.flowStarted") : t("config.flowStart")}
            </Button>
          </div>
          {startError && <p className="text-xs text-destructive">{startError}</p>}

          <hr className="border-t border-border" />

          <BacklogSettingsSection flowBaseUrl={config.flowBaseUrl!} />
        </>
      )}
    </Card>
  );
}

function BacklogSettingsSection({ flowBaseUrl }: { flowBaseUrl: string }) {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<FlowBacklogConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBacklogConfig(flowBaseUrl)
      .then((c) => !cancelled && setCfg(c))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowBaseUrl]);

  function field(key: keyof FlowBacklogConfig, value: string) {
    if (!cfg) return;
    const num = Number(value);
    setCfg({ ...cfg, [key]: Number.isFinite(num) ? num : cfg[key] });
    setSaved(false);
  }

  async function handleSave() {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBacklogConfig(flowBaseUrl, cfg);
      setCfg(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("config.flowBacklogLoading")}
      </div>
    );
  }
  if (!cfg) return error ? <p className="text-xs text-destructive">{error}</p> : null;

  return (
    <div className="space-y-3">
      <div>
        <Label>{t("config.flowBacklogTitle")}</Label>
        <p className="text-xs text-muted-foreground">{t("config.flowBacklogDesc")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">{t("config.flowSoftCap")}</Label>
          <Input
            type="number"
            min={1}
            value={cfg.soft_cap}
            onChange={(e) => field("soft_cap", e.target.value)}
            className="bg-input-background"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("config.flowHardCap")}</Label>
          <Input
            type="number"
            min={1}
            value={cfg.hard_cap}
            onChange={(e) => field("hard_cap", e.target.value)}
            className="bg-input-background"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("config.flowArchiveRetention")}</Label>
          <Input
            type="number"
            min={1}
            value={cfg.archive_retention_days}
            onChange={(e) => field("archive_retention_days", e.target.value)}
            className="bg-input-background"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("config.flowArchiveThreshold")}</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={cfg.archive_score_threshold}
            onChange={(e) => field("archive_score_threshold", e.target.value)}
            className="bg-input-background"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saved ? t("config.flowBacklogSaved") : t("config.flowBacklogSave")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function isValidWebLLMModel(modelId: string): boolean {
  return WEBLLM_MODELS.some(m => m.id === modelId);
}

/** Detect raw WebGPU device-lost / DXGI errors and replace with a user-friendly message */
function formatTestError(raw: unknown, tFn: (key: string) => string): string {
  const msg = raw instanceof Error ? raw.message : raw != null ? String(raw) : "";
  if (/device lost|device removed|requestDevice|DXGI_ERROR/i.test(msg)) {
    return "WebGPU device crashed. Auto-downgrading to a smaller model. Close other GPU-heavy tabs, restart Chrome if this persists.";
  }
  return msg || tFn("config.testFailed");
}

function isWebLLMCached(modelId: string): boolean {
  if (!isValidWebLLMModel(modelId)) return false;
  try {
    const cached = JSON.parse(localStorage.getItem("artemis:webllmCache") || "{}");
    return !!cached[modelId];
  } catch { return false; }
}

function setWebLLMCache(modelId: string, val: boolean) {
  try {
    const cached = JSON.parse(localStorage.getItem("artemis:webllmCache") || "{}");
    if (val) cached[modelId] = Date.now();
    else delete cached[modelId];
    localStorage.setItem("artemis:webllmCache", JSON.stringify(cached));
  } catch {}
}

const PROVIDER_OPTIONS: { value: ProviderType; labelKey: string }[] = [
  { value: "openai-compatible", labelKey: "config.openaiCompatible" },
  { value: "anthropic", labelKey: "config.anthropic" },
  { value: "google-gemini", labelKey: "config.googleGemini" },
  { value: "webllm", labelKey: "config.webllm" },
];

const CLOUD_PROVIDER_OPTIONS = PROVIDER_OPTIONS.filter(o => o.value !== "webllm");

const SECONDARY_USE_OPTIONS: { value: SecondaryUse; labelKey: string; descKey: string }[] = [
  { value: "never", labelKey: "config.never", descKey: "config.neverDesc" },
  { value: "fallback", labelKey: "config.fallback", descKey: "config.fallbackDesc" },
  { value: "quick-tasks", labelKey: "config.quickTasks", descKey: "config.quickTasksDesc" },
  { value: "always", labelKey: "config.always", descKey: "config.alwaysDesc" },
];

function ModelEndpointCard({
  label,
  endpoint,
  onChange,
  providerOptions = PROVIDER_OPTIONS,
}: {
  label: string;
  endpoint: ModelEndpoint;
  onChange: (patch: Partial<ModelEndpoint>) => void;
  providerOptions?: { value: ProviderType; labelKey: string }[];
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [models, setModels] = useState<string[] | null>(null);
  const [listingModels, setListingModels] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [vramInfo, setVramInfo] = useState<string | null>(null);

  useEffect(() => {
    if (endpoint.provider === "webllm" && navigator.gpu) {
      import("../utils/vram").then(({ estimateAvailableVRAM, recommendModel }) => {
        estimateAvailableVRAM().then(info => {
          const modelName = recommendModel(info).name;
          setVramInfo(`~${info.vramEstimate.toFixed(1)} GB VRAM (${info.vendor}) — recommend: ${modelName}`);
        }).catch(() => setVramInfo(null));
      });
    } else {
      setVramInfo(null);
    }
  }, [endpoint.provider]);

  const handleTest = async () => {
    setTestMessage(null);
    setTestError(null);
    setTesting(true);
    try {
      const reply = await testConnection(endpoint);
      setTestMessage(t("config.testOk", { reply }));
    } catch (err) {
      setTestError(formatTestError(err, t));
    } finally {
      setTesting(false);
    }
  };

  const handleListModels = async () => {
    if (models !== null) { setModels(null); return; }
    setListingModels(true);
    try {
      const list = await listModelsApi(endpoint);
      setModels(list);
    } catch (err) {
      setModels([]);
      setTestError(formatTestError(err, t));
    } finally {
      setListingModels(false);
    }
  };

  return (
    <Card className="p-4">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left font-medium mb-2"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {label}
      </button>

      {expanded && (
        <div className="space-y-4 pl-6">
          <div>
            <Label className="mb-2 block">{t("config.provider")}</Label>
            <Select
              value={endpoint.provider}
              onValueChange={(v) => {
                const patch: Partial<ModelEndpoint> = { provider: v as ProviderType };
                if (v === "webllm" && !isValidWebLLMModel(endpoint.model || "")) {
                  patch.model = WEBLLM_MODELS[0].id;
                }
                const defaultBaseUrl = PROVIDER_DEFAULT_BASE_URLS[v as ProviderType];
                if (defaultBaseUrl && !endpoint.baseUrl) {
                  patch.baseUrl = defaultBaseUrl;
                }
                onChange(patch);
              }}
            >
              <SelectTrigger className="bg-input-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {endpoint.provider !== "webllm" && (
            <>
              <div>
                <Label className="mb-2 block">{t("config.baseUrl")}</Label>
                <Input
                  type="text"
                  value={endpoint.baseUrl}
                  onChange={(e) => onChange({ baseUrl: e.target.value })}
                  placeholder={PROVIDER_DEFAULT_BASE_URLS[endpoint.provider] || "http://localhost:11434"}
                  className="bg-input-background border-border"
                />
              </div>

              <div>
                <Label className="mb-2 block">{t("config.apiKey")}</Label>
                <Input
                  type="password"
                  value={endpoint.apiKey ?? ""}
                  onChange={(e) => onChange({ apiKey: e.target.value || undefined })}
                  placeholder={t("config.apiKeyPlaceholder")}
                  className="bg-input-background border-border"
                />
              </div>
            </>
          )}

          <div>
            <Label className="mb-2 block">{t("config.model")}</Label>

            {endpoint.provider === "webllm" ? (
              <div className="flex flex-col gap-2">
                <Select
                  value={isValidWebLLMModel(endpoint.model || "") ? endpoint.model! : WEBLLM_MODELS[0].id}
                  onValueChange={(v) => onChange({ model: v })}
                >
                  <SelectTrigger className="bg-input-background font-mono text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEBLLM_MODELS.map((m, i) => (
                      <SelectItem key={i} value={m.id} className="text-xs">
                        <div className="flex items-center justify-between w-full gap-3">
                          <span>{m.name}</span>
                          <span className="text-muted-foreground text-xs">({m.sizeGB.toFixed(1)} GB)</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {vramInfo && (
                  <p className="text-xs text-muted-foreground">{vramInfo}</p>
                )}

                <div className="flex items-center gap-2">
                  {!isWebLLMCached(endpoint.model || WEBLLM_MODELS[0].id) ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          setTestError("");
                          setTestMessage(t("config.downloadZero"));
                          setTesting(true);
                          const targetId = endpoint.model || WEBLLM_MODELS[0].id;
                          const target = WEBLLM_MODELS.find(m => m.id === targetId);
                          try {
                            const adapter = getAdapter("webllm") as any;
                            if (adapter.setProgressCallback) {
                              adapter.setProgressCallback((pct: number) => {
                                setTestMessage(t("config.downloadProgress", { name: target?.name || "model", pct }));
                                if (pct >= 100) {
                                  setTestMessage(t("config.downloadCompleteCached", { name: target?.name || "model" }));
                                  setWebLLMCache(targetId, true);
                                  setTesting(false);
                                }
                              });
                            }
                            if (adapter.onStatus) {
                              adapter.onStatus((event: { type: string; message?: string }) => {
                                if (event.type === "fatal") {
                                  setTestError(event.message || t("config.testFailed"));
                                  setTesting(false);
                                }
                              });
                            }
                            await adapter.init({ ...endpoint, model: targetId, baseUrl: "" });
                            setTestMessage(t("config.downloadCompleteCached", { name: target?.name || "model" }));
                            setWebLLMCache(targetId, true);
                            setTesting(false);
                          } catch (err: any) {
                            setTestError(formatTestError(err, t));
                            setTesting(false);
                          }
                        }}
                        disabled={testing}
                      >
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        📥 {t("config.downloadModel")}
                        {(() => { const m = WEBLLM_MODELS.find(mm => mm.id === (endpoint.model || WEBLLM_MODELS[0].id)); return m ? ` (${m.sizeGB.toFixed(1)} GB)` : ""; })()}
                      </Button>
                      {testing && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const adapter = getAdapter("webllm") as any;
                            if (adapter.interruptDownload) await adapter.interruptDownload();
                            setTesting(false);
                            setTestMessage("Download cancelled.");
                          }}
                        >
                          {t("config.cancel")}
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-600 font-medium">✅ {t("config.modelCached")}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const adapter = getAdapter("webllm") as any;
                          if (adapter.unload) await adapter.unload();
                          setWebLLMCache(endpoint.model || WEBLLM_MODELS[0].id, false);
                          setTestMessage(t("config.modelDeletedFromCache"));
                        }}
                      >
                        {t("config.delete")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={endpoint.model}
                    onChange={(e) => onChange({ model: e.target.value })}
                    placeholder={t("config.model")}
                    className="bg-input-background border-border flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={handleListModels} disabled={listingModels}>
                    {listingModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
                    {models ? t("config.closeModelList") : t("config.listModels")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("config.listModelsHint")}</p>
              </div>
            )}

            {models && endpoint.provider !== "webllm" && (
              <div className="mt-2 max-h-32 overflow-y-auto border rounded p-2 text-xs space-y-1">
                {models.length === 0 ? (
                  <p className="text-muted-foreground">{t("config.noModelsListed")}</p>
                ) : (
                  models.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="block w-full text-left hover:bg-accent rounded px-1 py-0.5"
                      onClick={() => { onChange({ model: m }); setModels(null); }}
                    >
                      {m}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">
              {t("config.temperature")}: {endpoint.temperature.toFixed(1)}
            </Label>
            <Input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={endpoint.temperature}
              onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {t("config.test")}
            </Button>
          </div>

          {testMessage && (
            <p className="text-sm text-green-700 dark:text-green-400">{testMessage}</p>
          )}
          {testError && (
            <p className="text-sm text-destructive">{testError}</p>
          )}
        </div>
      )}
    </Card>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  app: "text-blue-500",
  overlay: "text-purple-500",
  popup: "text-pink-500",
  background: "text-orange-500",
  llm: "text-red-500",
};

function DevModeLogViewer() {
  const { t } = useTranslation();
  const { devMode, setDevMode, logs, clearLogs } = useErrorLog();

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bug className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold">{t("config.devMode")}</h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>{t("config.errorLog")}</Label>
          <p className="text-sm text-muted-foreground">
            {t("config.errorLogDesc")}
          </p>
        </div>
        <Switch checked={devMode} onCheckedChange={setDevMode} />
      </div>

      {devMode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t("config.entries", { n: logs.length })}</span>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="w-3 h-3 mr-1" />
              {t("config.clearLog")}
            </Button>
          </div>

          <div
            className="border rounded-lg bg-background p-2 overflow-auto"
            style={{ maxHeight: "400px", fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "12px", lineHeight: "1.5" }}
          >
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t("config.noErrors")}</p>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className="border-b border-border last:border-0 py-2 px-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase ${SOURCE_COLORS[entry.source] || "text-muted-foreground"}`}>
                      {entry.source}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.code && (
                      <span className="text-[10px] bg-destructive/10 text-destructive px-1 rounded">
                        {entry.code}
                      </span>
                    )}
                    {entry.severity && (
                      <span className={`text-[10px] ${entry.severity === "CRITICAL" ? "text-red-500" : entry.severity === "WARNING" ? "text-yellow-500" : "text-muted-foreground"}`}>
                        {entry.severity}
                      </span>
                    )}
                  </div>
                  <div className="text-foreground break-all">{entry.message}</div>
                  {entry.stack && (
                    <details className="mt-1">
                      <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">{t("config.stack")}</summary>
                      <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all max-h-24 overflow-auto">{entry.stack}</pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ClearAllDataSection() {
  const { t } = useTranslation();
  const { resetOnboarding } = useOnboarding();
  const [showDialog, setShowDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (confirmText !== "DELETE" || clearing) return;
    setClearing(true);
    try {
      await clearAllData();
      await ensureDbInitialized();
      await resetOnboarding();
      window.location.reload();
    } catch (err) {
      setClearing(false);
      setShowDialog(false);
      toast.error(err instanceof AppError ? err.userMessage : t("config.clearAllDataFailed"));
    }
  };

  return (
    <>
      <Card className="p-6 border-destructive/30">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">{t("config.dangerZone")}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("config.dangerZoneDesc")}
        </p>
        <Button
          variant="destructive"
          onClick={() => setShowDialog(true)}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          {t("config.clearAllData")}
        </Button>
      </Card>

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open && !clearing) { setShowDialog(false); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("config.clearAllDataTitle")}</DialogTitle>
            <DialogDescription>
              {t("config.clearAllDataDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("config.typeToConfirm")} <span className="font-mono text-destructive">DELETE</span> {t("config.toConfirm")}
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t("config.typeToConfirm")}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowDialog(false); setConfirmText(""); }}
              disabled={clearing}
            >
              {t("config.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "DELETE" || clearing}
              onClick={handleClear}
            >
              {clearing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("config.clearing")}
                </>
              ) : (
                t("config.clearEverything")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Config() {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Migrate stale webllm model IDs on mount
  useEffect(() => {
    let dirty = false;
    if (config.primary.provider === "webllm" && !isValidWebLLMModel(config.primary.model || "")) {
      updateConfig({ primary: { ...config.primary, model: WEBLLM_MODELS[0].id } });
      dirty = true;
    }
    if (config.secondary.provider === "webllm" && !isValidWebLLMModel(config.secondary.model || "")) {
      updateConfig({ secondary: { ...config.secondary, model: WEBLLM_MODELS[0].id } });
      dirty = true;
    }
    if (dirty) {
      // Clear stale localStorage cache keys
      Object.keys(localStorage).forEach(k => {
        if (k === "artemis:webllmCache") {
          try {
            const cached = JSON.parse(localStorage.getItem(k) || "{}");
            const clean = Object.fromEntries(
              Object.entries(cached).filter(([id]) => isValidWebLLMModel(id))
            );
            localStorage.setItem(k, JSON.stringify(clean));
          } catch {}
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTest = async () => {
    setTestMessage(null);
    setTestError(null);
    setTesting(true);
    const testBoth = config.secondaryUse !== "never";
    const results: string[] = [];
    const errors: string[] = [];

    for (const ep of testBoth
      ? [config.primary, config.secondary]
      : [config.primary]
    ) {
      try {
        const reply = await testConnection(ep);
        results.push(`${ep.label} (${ep.model}): ${t("config.testOk", { reply })}`);
      } catch (err) {
        errors.push(`${ep.label}: ${formatTestError(err, t)}`);
      }
    }

    if (results.length > 0) setTestMessage(results.join("\n"));
    if (errors.length > 0) setTestError(errors.join("\n"));
    setTesting(false);
  };

  const updatePrimary = (patch: Partial<ModelEndpoint>) => {
    updateConfig({ primary: { ...config.primary, ...patch } });
  };

  const updateSecondary = (patch: Partial<ModelEndpoint>) => {
    updateConfig({ secondary: { ...config.secondary, ...patch } });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{t("config.title")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("config.autoSave")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Tabs defaultValue="ai">
            <TabsList className="mb-6">
              <TabsTrigger value="ai">{t("config.tabModel")}</TabsTrigger>
              <TabsTrigger value="general">{t("config.tabGeneral")}</TabsTrigger>
              <TabsTrigger value="extension">{t("config.tabExtension")}</TabsTrigger>
              <TabsTrigger value="flow">{t("config.tabFlow")}</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="space-y-6">
              <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold">{t("config.llmProvider")}</h2>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1 w-fit">
              <button
                type="button"
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  config.providerMode === "cloud"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  if (config.providerMode === "local") {
                    updateConfig({
                      providerMode: "cloud",
                      ...(config.savedCloudEndpoints ?? {
                        primary: { ...DEFAULT_PRIMARY_ENDPOINT },
                        secondary: { ...DEFAULT_SECONDARY_ENDPOINT },
                        secondaryUse: "never" as SecondaryUse,
                      }),
                      savedCloudEndpoints: undefined,
                    });
                  }
                }}
              >
                <Cloud className="inline w-4 h-4 -mt-0.5 mr-1.5" />
                {t("config.cloud")}
              </button>
              <button
                type="button"
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  config.providerMode === "local"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  if (config.providerMode === "cloud") {
                    updateConfig({
                      providerMode: "local",
                      savedCloudEndpoints: {
                        primary: { ...config.primary },
                        secondary: { ...config.secondary },
                        secondaryUse: config.secondaryUse,
                      },
                      primary: {
                        label: "Primary",
                        provider: "webllm",
                        model: WEBLLM_MODELS[0].id,
                        baseUrl: "",
                        temperature: 0.7,
                      },
                      secondary: { ...config.secondary, provider: "webllm" },
                      secondaryUse: "never" as SecondaryUse,
                    });
                  }
                }}
              >
                <Laptop className="inline w-4 h-4 -mt-0.5 mr-1.5" />
                {t("config.local")}
              </button>
            </div>

            {config.providerMode === "cloud" ? (
              /* ── Cloud mode ── */
              <div className="space-y-4">
                <ModelEndpointCard
                  label={t("config.primaryModel")}
                  endpoint={config.primary}
                  onChange={updatePrimary}
                  providerOptions={CLOUD_PROVIDER_OPTIONS}
                />

                <ModelEndpointCard
                  label={t("config.secondaryModel")}
                  endpoint={config.secondary}
                  onChange={updateSecondary}
                  providerOptions={CLOUD_PROVIDER_OPTIONS}
                />

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <Label className="mb-1 block">{t("config.secondaryUse")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("config.secondaryUseDesc")}
                    </p>
                  </div>
                  <Select
                    value={config.secondaryUse}
                    onValueChange={(v) => updateConfig({ secondaryUse: v as SecondaryUse })}
                  >
                    <SelectTrigger className="w-[180px] bg-input-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECONDARY_USE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  {t(SECONDARY_USE_OPTIONS.find((o) => o.value === config.secondaryUse)?.descKey || "")}
                </p>

                <div className="flex gap-2 items-center pt-2 border-t">
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("config.testingModels")}
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        {t("config.testModels")}
                      </>
                    )}
                  </Button>
                </div>

                {testMessage && (
                  <p className="text-sm text-green-700 dark:text-green-400">{testMessage}</p>
                )}
                {testError && (
                  <p className="text-sm text-destructive">{testError}</p>
                )}
              </div>
            ) : (
              /* ── Local mode ── */
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("config.localModelDesc")}
                </p>
                <ModelEndpointCard
                  label={t("config.localModel")}
                  endpoint={config.primary}
                  onChange={updatePrimary}
                  providerOptions={[{ value: "webllm" as ProviderType, labelKey: "config.webllm" }]}
                />

                <div className="flex gap-2 items-center pt-2 border-t">
                  <Button variant="outline" onClick={async () => {
                    setTestMessage(null);
                    setTestError(null);
                    setTesting(true);
                    try {
                      const reply = await testConnection(config.primary);
                      setTestMessage(t("config.testOk", { reply }));
                    } catch (err) {
                      setTestError(formatTestError(err, t));
                    } finally {
                      setTesting(false);
                    }
                  }} disabled={testing}>
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("config.testing")}
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        {t("config.testModel")}
                      </>
                    )}
                  </Button>
                </div>

                {testMessage && (
                  <p className="text-sm text-green-700 dark:text-green-400">{testMessage}</p>
                )}
                {testError && (
                  <p className="text-sm text-destructive">{testError}</p>
                )}
              </div>
            )}
              </Card>
            </TabsContent>

            <TabsContent value="general" className="space-y-6">
              <Card className="p-6 space-y-6">
                <h2 className="text-lg font-semibold">{t("config.general")}</h2>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>{t("config.theme")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("config.themeDesc")}
                </p>
              </div>
              <Select
                value={config.theme}
                onValueChange={(value: ThemeMode) => {
                  updateConfig({ theme: value });
                }}
              >
                <SelectTrigger className="w-[140px] bg-input-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("config.light")}</SelectItem>
                  <SelectItem value="dark">{t("config.dark")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>{t("config.language")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("config.languageDesc")}
                </p>
              </div>
              <LanguageSelector />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t("config.autoSaveProfile")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("config.autoSaveProfileDesc")}
                </p>
              </div>
              <Switch
                checked={config.autoSaveProfile}
                onCheckedChange={(checked) =>
                  updateConfig({ autoSaveProfile: checked })
                }
              />
            </div>
              </Card>
              <DevModeLogViewer />
              <ClearAllDataSection />
            </TabsContent>

            <TabsContent value="extension" className="space-y-6">
              <ExtensionSettingsCard />
            </TabsContent>

            <TabsContent value="flow" className="space-y-6">
              <FlowSettingsCard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
