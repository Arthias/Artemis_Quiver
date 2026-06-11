import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Settings, Zap, ChevronDown, ChevronRight, Loader2, List, Globe, Plus, X, Bug, Trash2, Pencil, Check } from "lucide-react";
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
import { listModels as listModelsApi, testConnection } from "../services/llmService";
import type { ProviderType, SecondaryUse, ModelEndpoint } from "../types/llm";
import { DEFAULT_PRIMARY_ENDPOINT, DEFAULT_SECONDARY_ENDPOINT } from "../types/llm";
import type { ThemeMode } from "../types/workspace";
import { DEFAULT_JOB_SITES } from "../../extension/job-sites";
import { getAdapter } from "../services/provider/registry";

function ExtensionSettingsCard() {
  const [customSites, setCustomSites] = useState<string[]>([]);
  const [excludedSites, setExcludedSites] = useState<string[]>([]);
  const [newSite, setNewSite] = useState("");
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    const isExt = typeof chrome !== "undefined" && chrome.storage?.local;
    if (!isExt) return;
    chrome.storage.local.get("artemis:overlayConfig").then((result) => {
      const cfg = (result as any)["artemis:overlayConfig"] || {};
      setCustomSites(cfg.jobSites || []);
      setExcludedSites(cfg.excludedSites || []);
      setOverlayEnabled(cfg.enabled !== false);
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
      chrome.storage.local.set({ "artemis:overlayConfig": cfg });
    });
  }

  const allSites = [
    ...DEFAULT_JOB_SITES.filter((s) => !excludedSites.includes(s)),
    ...customSites,
  ];

  function addSite() {
    const trimmed = newSite.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!trimmed || allSites.includes(trimmed)) return;
    const next = [...customSites, trimmed];
    setCustomSites(next);
    setNewSite("");
    save(next, excludedSites);
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
        <Label className="mb-2 block">Job sites</Label>
        <p className="text-xs text-muted-foreground mb-3">
          The extension overlay appears on these sites when you visit job pages.
        </p>
        <div className="flex flex-wrap gap-2">
          {allSites.length === 0 ? (
            <p className="text-xs text-muted-foreground">No job sites configured. Add one below.</p>
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
                <span key={site} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                  {site}
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
      </div>

      <div>
        <Label className="mb-2 block">Add custom site</Label>
        <div className="flex gap-2">
          <Input
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSite()}
            placeholder="linkedin.com/jobs/*"
            className="bg-input-background flex-1"
          />
          <Button variant="outline" size="icon" onClick={addSite}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Models that @mlc-ai/web-llm actually supports */
const WEBLLM_CATALOG = [
  { id: "Llama-3.2-3B-Instruct-q4f32_1-MLC", name: "Llama 3.2 (3B)", sizeGB: 2.3, desc: "(2.3 GB download - Recommended)" },
  { id: "Llama-3.2-1B-Instruct-q4f32_1-MLC", name: "Llama 3.2 (1B)", sizeGB: 0.88, desc: "(0.88 GB download - Lightweight)" },
  { id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC", name: "DeepSeek R1 (7B)", sizeGB: 4.8, desc: "(4.8 GB - Advanced)" },
  { id: "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC", name: "Hermes 2 Pro (8B)", sizeGB: 5.5, desc: "(5.5 GB - Expert)" },
] as const;

/** Common models for non-WebLLM providers (Ollama, LM Studio, etc.) */
const COMMON_MODELS = [
  { id: "google/gemma-4-e2b", label: "Gemma 4 E2B" },
  { id: "llama3.2:3b", label: "Llama 3.2 (3B)" },
  { id: "llama3.2:1b", label: "Llama 3.2 (1B)" },
  { id: "mistral:7b", label: "Mistral (7B)" },
  { id: "qwen2.5:7b", label: "Qwen 2.5 (7B)" },
  { id: "qwen2.5:1.5b", label: "Qwen 2.5 (1.5B)" },
  { id: "deepseek-r1:7b", label: "DeepSeek R1 (7B)" },
] as const;

/** Detect raw WebGPU device-lost / DXGI errors and replace with a user-friendly message */
function formatTestError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : raw != null ? String(raw) : "";
  if (/device lost|device removed|requestDevice|DXGI_ERROR/i.test(msg)) {
    return "WebGPU device crashed. Close other GPU-heavy tabs, restart Chrome, and try a smaller model.";
  }
  return msg || "Test failed.";
}

/** Check if a model ID is in our known catalog (reject stale IDs from prior versions) */
function isValidWebLLMModel(modelId: string): boolean {
  return WEBLLM_CATALOG.some(m => m.id === modelId);
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

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: "openai-compatible", label: "OpenAI Compatible (LM Studio, Ollama, OpenAI)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "google-gemini", label: "Google Gemini" },
  { value: "webllm", label: "Use Local Model (in-browser, no API key)" },
];

const CLOUD_PROVIDER_OPTIONS = PROVIDER_OPTIONS.filter(o => o.value !== "webllm");

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
  providerOptions = PROVIDER_OPTIONS,
}: {
  label: string;
  endpoint: ModelEndpoint;
  onChange: (patch: Partial<ModelEndpoint>) => void;
  providerOptions?: { value: ProviderType; label: string }[];
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
      const reply = await testConnection(endpoint);
      setTestMessage(`OK: "${reply}"`);
    } catch (err) {
      setTestError(formatTestError(err));
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
      setTestError(formatTestError(err));
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
              onValueChange={(v) => {
                const patch: Partial<ModelEndpoint> = { provider: v as ProviderType };
                if (v === "webllm" && !isValidWebLLMModel(endpoint.model || "")) {
                  patch.model = WEBLLM_CATALOG[0].id;
                }
                onChange(patch);
              }}
            >
              <SelectTrigger className="bg-input-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {endpoint.provider !== "webllm" && (
            <>
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
            </>
          )}

          <div>
            <Label className="mb-2 block">Model</Label>

            {endpoint.provider === "webllm" ? (
              <div className="flex flex-col gap-2">
                <Select
                  value={isValidWebLLMModel(endpoint.model || "") ? endpoint.model! : WEBLLM_CATALOG[0].id}
                  onValueChange={(v) => onChange({ model: v })}
                >
                  <SelectTrigger className="bg-input-background font-mono text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEBLLM_CATALOG.map((m, i) => (
                      <SelectItem key={i} value={m.id} className="text-xs">
                        <div className="flex items-center justify-between w-full gap-3">
                          <span>{m.name}</span>
                          <span className="text-muted-foreground text-xs">{m.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  {!isWebLLMCached(endpoint.model || WEBLLM_CATALOG[0].id) ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        setTestError("");
                        setTestMessage("Downloading... 0%");
                        setTesting(true);
                        const targetId = endpoint.model || WEBLLM_CATALOG[0].id;
                        const target = WEBLLM_CATALOG.find(m => m.id === targetId);
                        try {
                          const adapter = getAdapter("webllm") as any;
                          if (adapter.setProgressCallback) {
                            adapter.setProgressCallback((pct: number) => {
                              setTestMessage(`Downloading ${target?.name || "model"}... ${pct}%`);
                              if (pct >= 100) {
                                setTestMessage(`Download complete! ${target?.name} cached in browser.`);
                                setWebLLMCache(targetId, true);
                                setTesting(false);
                              }
                            });
                          }
                          await adapter.init({ ...endpoint, model: targetId, baseUrl: "" });
                          setTestMessage(`Download complete! ${target?.name} cached in browser.`);
                          setWebLLMCache(targetId, true);
                          setTesting(false);
                        } catch (err: any) {
                          setTestError(formatTestError(err));
                          setTesting(false);
                        }
                      }}
                      disabled={testing}
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      📥 Download Model
                      {WEBLLM_CATALOG.find(m => m.id === (endpoint.model || WEBLLM_CATALOG[0].id))?.sizeGB
                        ? ` (${WEBLLM_CATALOG.find(m => m.id === (endpoint.model || WEBLLM_CATALOG[0].id))!.sizeGB.toFixed(1)} GB)`
                        : ""}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-600 font-medium">✅ Model cached</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setWebLLMCache(endpoint.model || WEBLLM_CATALOG[0].id, false);
                          setTestMessage("Model deleted from cache.");
                        }}
                      >
                        Delete
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
                    placeholder="google/gemma-4-e2b"
                    className="bg-input-background border-border flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={handleListModels} disabled={listingModels} title={models ? "Close model list" : "List available models"}>
                    {listingModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {COMMON_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        endpoint.model === m.id
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                      onClick={() => onChange({ model: m.id })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {models && endpoint.provider !== "webllm" && (
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

  // Migrate stale webllm model IDs on mount
  useEffect(() => {
    let dirty = false;
    if (config.primary.provider === "webllm" && !isValidWebLLMModel(config.primary.model || "")) {
      updateConfig({ primary: { ...config.primary, model: WEBLLM_CATALOG[0].id } });
      dirty = true;
    }
    if (config.secondary.provider === "webllm" && !isValidWebLLMModel(config.secondary.model || "")) {
      updateConfig({ secondary: { ...config.secondary, model: WEBLLM_CATALOG[0].id } });
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
        results.push(`${ep.label} (${ep.model}): OK ("${reply}")`);
      } catch (err) {
        errors.push(`${ep.label}: ${formatTestError(err)}`);
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
                ☁️ Cloud
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
                        model: WEBLLM_CATALOG[0].id,
                        baseUrl: "",
                        temperature: 0.7,
                      },
                      secondary: { ...config.secondary, provider: "webllm" },
                      secondaryUse: "never" as SecondaryUse,
                    });
                  }
                }}
              >
                💻 Local
              </button>
            </div>

            {config.providerMode === "cloud" ? (
              /* ── Cloud mode ── */
              <div className="space-y-4">
                <ModelEndpointCard
                  label="Primary Model"
                  endpoint={config.primary}
                  onChange={updatePrimary}
                  providerOptions={CLOUD_PROVIDER_OPTIONS}
                />

                <ModelEndpointCard
                  label="Secondary Model"
                  endpoint={config.secondary}
                  onChange={updateSecondary}
                  providerOptions={CLOUD_PROVIDER_OPTIONS}
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
            ) : (
              /* ── Local mode ── */
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Download a model to run entirely in-browser via WebGPU. No API key or external server needed.
                </p>
                <ModelEndpointCard
                  label="Local Model"
                  endpoint={config.primary}
                  onChange={updatePrimary}
                  providerOptions={[{ value: "webllm" as ProviderType, label: "Use Local Model (in-browser, no API key)" }]}
                />

                <div className="flex gap-2 items-center pt-2 border-t">
                  <Button variant="outline" onClick={async () => {
                    setTestMessage(null);
                    setTestError(null);
                    setTesting(true);
                    try {
                      const reply = await testConnection(config.primary);
                      setTestMessage(`OK: "${reply}"`);
                    } catch (err) {
                      setTestError(formatTestError(err));
                    } finally {
                      setTesting(false);
                    }
                  }} disabled={testing}>
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Test Model
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
