import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Settings, Zap, Save, Loader2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
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
import type { LocalLlmProvider } from "../types/llm";
import type { ThemeMode } from "../types/workspace";

export function Config() {
  const { config, updateConfig, saveConfig, testLlmConnection, isTesting, lastSavedAt } =
    useConfig();
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleSave = () => {
    saveConfig();
    setTestMessage("Settings saved.");
    setTestError(null);
  };

  const handleTest = async () => {
    setTestMessage(null);
    setTestError(null);
    try {
      const reply = await testLlmConnection();
      setTestMessage(`Connection OK. Model replied: "${reply}"`);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Connection test failed.");
    }
  };

  const defaultServerUrl =
    config.provider === "lmstudio" ? "/api/lmstudio" : "/api/ollama";

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Configure local LLM providers (LMStudio, Ollama)
                </p>
              </div>
            </div>
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Tabs defaultValue="provider" className="space-y-6">
            <TabsList>
              <TabsTrigger value="provider" className="gap-2">
                <Zap className="w-4 h-4" />
                LLM Provider
              </TabsTrigger>
              <TabsTrigger value="general" className="gap-2">
                <Settings className="w-4 h-4" />
                General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="provider" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Local LLM Configuration</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  MVP uses local models only. In dev, use the proxy paths{" "}
                  <code className="text-xs">/api/lmstudio</code> or{" "}
                  <code className="text-xs">/api/ollama</code> to avoid browser CORS issues.
                </p>

                <div className="space-y-6">
                  <div>
                    <Label className="mb-2 block">Provider</Label>
                    <Select
                      value={config.provider}
                      onValueChange={(value) =>
                        updateConfig({
                          provider: value as LocalLlmProvider,
                          serverUrl: value === "lmstudio" ? "/api/lmstudio" : "/api/ollama",
                        })
                      }
                    >
                      <SelectTrigger className="bg-input-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lmstudio">LMStudio</SelectItem>
                        <SelectItem value="ollama">Ollama</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block">Server URL</Label>
                    <Input
                      type="text"
                      value={config.serverUrl}
                      onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                      placeholder={defaultServerUrl}
                      className="bg-input-background border-border"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Dev default proxies to your LAN LMStudio at 192.168.8.171:1234. Use a
                      full URL only if CORS is enabled on the server.
                    </p>
                  </div>

                  <div>
                    <Label className="mb-2 block">Model</Label>
                    <Input
                      type="text"
                      value={config.model}
                      onChange={(e) => updateConfig({ model: e.target.value })}
                      placeholder="google/gemma-4-e2b"
                      className="bg-input-background border-border"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Must match the model id loaded in LMStudio or pulled in Ollama.
                    </p>
                  </div>

                  <div>
                    <Label className="mb-2 block">
                      Temperature: {config.temperature.toFixed(1)}
                    </Label>
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) =>
                        updateConfig({ temperature: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <div className="flex gap-2 items-center">
                    <Button variant="outline" onClick={handleTest} disabled={isTesting}>
                      {isTesting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test connection"
                      )}
                    </Button>
                    {lastSavedAt && (
                      <span className="text-xs text-muted-foreground">
                        Last saved {new Date(lastSavedAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {testMessage && (
                    <p className="text-sm text-green-700 dark:text-green-400">{testMessage}</p>
                  )}
                  {testError && (
                    <p className="text-sm text-destructive">{testError}</p>
                  )}
                </div>
              </Card>

              <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <div className="flex items-start gap-3">
                  <Badge variant="secondary">MVP</Badge>
                  <p className="text-sm text-muted-foreground">
                    Cloud providers are deferred. Job analysis and profile data stay in your
                    browser (localStorage) and can be exported as .md files.
                  </p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="general" className="space-y-4">
              <Card className="p-6 space-y-6">
                <h2 className="text-lg font-semibold">General Settings</h2>

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
                      setTimeout(() => saveConfig(), 0);
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
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
