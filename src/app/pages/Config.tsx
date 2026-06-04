import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Settings, Zap, ChevronDown, ChevronRight, Loader2, List } from "lucide-react";
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
                  Save profile edits to localStorage after you stop typing
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
        </div>
      </div>
    </div>
  );
}
