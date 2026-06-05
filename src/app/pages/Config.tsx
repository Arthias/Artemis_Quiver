import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Settings, Zap, ChevronDown, ChevronRight, Loader2, List, Globe, Plus, X, Bug, Trash2 } from "lucide-react";
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
import { useConfig } from "../context/ConfigContext";
import { listModels as listModelsApi } from "../services/llmService";
import type { ProviderType, SecondaryUse, ModelEndpoint } from "../types/llm";
import type { ThemeMode } from "../types/workspace";

const DEFAULT_KNOWN_SITES = [
  "linkedin.com", "indeed.com", "glassdoor.com", "monster.com",
  "ziprecruiter.com", "careerbuilder.com", "dice.com", "simplyhired.com",
  "upwork.com", "freelancer.com", "stackoverflow.com", "weworkremotely.com", "remoteok.com",
];

function ExtensionSettingsCard() {
  const [customSites, setCustomSites] = useState<string[]>([]);
  const [newSite, setNewSite] = useState("");
  const [overlayEnabled, setOverlayEnabled] = useState(true);

  useEffect(() => {
    const isExt = typeof chrome !== "undefined" && chrome.storage?.local;
    if (!isExt) return;
    chrome.storage.local.get("artemis:overlayConfig").then((result) => {
      const cfg = (result as any)["artemis:overlayConfig"] || {};
      setCustomSites(cfg.jobSites || []);
      setOverlayEnabled(cfg.enabled !== false);
    });
  }, []);

  function save(newCustom: string[]) {
    const isExt = typeof chrome !== "undefined" && chrome.storage?.local;
    if (!isExt) return;
    chrome.storage.local.get("artemis:overlayConfig").then((result) => {
      const cfg = (result as any)["artemis:overlayConfig"] || {};
      cfg.jobSites = newCustom;
      cfg.enabled = overlayEnabled;
      chrome.storage.local.set({ "artemis:overlayConfig": cfg });
    });
  }

  function addSite() {
    const trimmed = newSite.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!trimmed || customSites.includes(trimmed) || DEFAULT_KNOWN_SITES.includes(trimmed)) return;
    const next = [...customSites, trimmed];
    setCustomSites(next);
    setNewSite("");
    save(next);
  }

  function removeSite(site: string) {
    const next = customSites.filter((s) => s !== site);
    setCustomSites(next);
    save(next);
  }

  const isExt = typeof chrome !== "undefined" && chrome.storage?.local;

  if (!isExt) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Extension</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Extension settings are available when running as a Chrome extension.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-semibold">Extension Overlay</h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Show overlay on job sites</Label>
          <p className="text-sm text-muted-foreground">
            Floating badge with match scoring and import
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
        <Label className="mb-2 block">Known job sites</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {DEFAULT_KNOWN_SITES.map((site) => (
            <span key={site} className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
              {site}
            </span>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Custom sites</Label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSite()}
            placeholder="myjobboard.com"
            className="bg-input-background flex-1"
          />
          <Button variant="outline" size="icon" onClick={addSite}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {customSites.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customSites.map((site) => (
              <span key={site} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                {site}
                <button onClick={() => removeSite(site)} className="text-destructive hover:text-destructive/80">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        The extension overlay appears on these sites when you visit job pages.
        Configure fallback AI and fingerprint in the extension popup.
      </p>
    </Card>
  );
}

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: "openai-compatible", label: "OpenAI Compatible" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google-gemini", label: "Google Gemini" },
];

const SECONDARY_USE_OPTIONS: { value: SecondaryUse; label: string; desc: string }[] = [
  { value: "never", label: "Never", desc: "Always use primary model" },
  { value: "fallback", label: "Fallback", desc: "Use secondary if primary fails" },
  { value: "quick-tasks", label: "Quick Tasks", desc: "Classification/scoring to secondary" },
  { value: "always", label: "Always", desc: "Always use secondary model" },
];

function ModelEndpointCard({
  label,
  endpoint,
  onChange,
}: {
  label: string;
  endpoint: ModelEndpoint;
  onChange: (patch: Partial<ModelEndpoint>) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [models, setModels] = useState<string[] | null>(null);
  const [listingModels, setListingModels] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTestMessage(null);
    setTestError(null);
    setTesting(true);
    try {
      const { testConnection } = await import("../services/llmService");
      const reply = await testConnection(endpoint);
      setTestMessage(`OK: "${reply}"`);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Connection test failed.");
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
      setTestError(err instanceof Error ? err.message : "Failed to list models.");
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
            <Label className="mb-2 block">Provider</Label>
            <Select
              value={endpoint.provider}
              onValueChange={(v) => onChange({ provider: v as ProviderType })}
            >
              <SelectTrigger className="bg-input-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Base URL</Label>
            <Input
              type="text"
              value={endpoint.baseUrl}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="bg-input-background border-border"
            />
          </div>

          <div>
            <Label className="mb-2 block">API Key</Label>
            <Input
              type="password"
              value={endpoint.apiKey ?? ""}
              onChange={(e) => onChange({ apiKey: e.target.value || undefined })}
              placeholder="sk-... (leave blank for local servers)"
              className="bg-input-background border-border"
            />
          </div>

          <div>
            <Label className="mb-2 block">Model</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={endpoint.model}
                onChange={(e) => onChange({ model: e.target.value })}
                placeholder="google/gemma-4-e2b"
                className="bg-input-background border-border flex-1"
              />
                <Button variant="outline" size="icon" onClick={handleListModels} disabled={listingModels} title={models ? "Close model list" : "List available models"}>
                {listingModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
              </Button>
            </div>
            {models && (
              <div className="mt-2 max-h-32 overflow-y-auto border rounded p-2 text-xs space-y-1">
                {models.length === 0 ? (
                  <p className="text-muted-foreground">No models listed</p>
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
              Temperature: {endpoint.temperature.toFixed(1)}
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
              Test
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
  const { devMode, setDevMode, logs, clearLogs } = useErrorLog();

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bug className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold">Developer Mode</h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Error Log</Label>
          <p className="text-sm text-muted-foreground">
            Captures errors from the app, LLM connections, overlay, and popup
          </p>
        </div>
        <Switch checked={devMode} onCheckedChange={setDevMode} />
      </div>

      {devMode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{logs.length} entries</span>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="w-3 h-3 mr-1" />
              Clear Log
            </Button>
          </div>

          <div
            className="border rounded-lg bg-background p-2 overflow-auto"
            style={{ maxHeight: "400px", fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "12px", lineHeight: "1.5" }}
          >
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No errors captured yet</p>
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
                      <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Stack</summary>
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

export function Config() {
  const { config, updateConfig } = useConfig();
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = async () => {
    setTestMessage(null);
    setTestError(null);
    setTesting(true);
    const { testConnection } = await import("../services/llmService");
    const testBoth = config.secondaryUse !== "never";
    const results: string[] = [];
    const errors: string[] = [];

    for (const ep of testBoth
      ? [config.primary, config.secondary]
      : [config.primary]
    ) {
      try {
        const reply = await testConnection(ep);
        results.push(`${ep.label} (${ep.model}): OK ("${reply}")`);
      } catch (err) {
        errors.push(`${ep.label}: ${err instanceof Error ? err.message : "Failed"}`);
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
              <h1 className="text-xl font-semibold">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Changes saved automatically
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold">LLM Provider</h2>
            </div>

            <div className="space-y-4">
              <ModelEndpointCard
                label="Primary Model"
                endpoint={config.primary}
                onChange={updatePrimary}
              />

              <ModelEndpointCard
                label="Secondary Model"
                endpoint={config.secondary}
                onChange={updateSecondary}
              />

              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <Label className="mb-1 block">Secondary Use</Label>
                  <p className="text-xs text-muted-foreground">
                    How should the secondary model be used?
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
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                {SECONDARY_USE_OPTIONS.find((o) => o.value === config.secondaryUse)?.desc}
              </p>

              <div className="flex gap-2 items-center pt-2 border-t">
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing models...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Test Models
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
          </Card>

          <Card className="p-6 space-y-6">
            <h2 className="text-lg font-semibold">General</h2>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Light or dark appearance for this profile
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
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-save profile</Label>
                <p className="text-sm text-muted-foreground">
                  Save profile edits to IndexedDB after you stop typing
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

          <ExtensionSettingsCard />
          <DevModeLogViewer />
        </div>
      </div>
    </div>
  );
}
