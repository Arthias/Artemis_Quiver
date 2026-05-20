import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Settings, Key, Zap, Save, Eye, EyeOff } from "lucide-react";
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

export function Config() {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-3-sonnet");
  const [temperature, setTemperature] = useState("0.7");
  const [autoSave, setAutoSave] = useState(true);

  const handleSave = () => {
    console.log("Saving configuration...");
    alert("Configuration saved successfully!");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
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
                  Configure API keys and LLM providers
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Tabs defaultValue="api-keys" className="space-y-6">
            <TabsList>
              <TabsTrigger value="api-keys" className="gap-2">
                <Key className="w-4 h-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="provider" className="gap-2">
                <Zap className="w-4 h-4" />
                LLM Provider
              </TabsTrigger>
              <TabsTrigger value="general" className="gap-2">
                <Settings className="w-4 h-4" />
                General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="api-keys" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">API Keys</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure your API keys for different AI providers. Keys are stored locally and never sent to external servers.
                </p>

                <div className="space-y-6">
                  {/* Anthropic API Key */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Anthropic API Key</Label>
                      <Badge variant="secondary">Recommended</Badge>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showAnthropicKey ? "text" : "password"}
                          value={anthropicKey}
                          onChange={(e) => setAnthropicKey(e.target.value)}
                          placeholder="sk-ant-..."
                          className="bg-input-background border-border pr-10"
                        />
                        <button
                          onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showAnthropicKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <Button variant="outline">Test</Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Get your API key from{" "}
                      <a href="https://console.anthropic.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                        console.anthropic.com
                      </a>
                    </p>
                  </div>

                  {/* Google Gemini API Key */}
                  <div>
                    <Label className="mb-2 block">Google Gemini API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showGeminiKey ? "text" : "password"}
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                          placeholder="AIza..."
                          className="bg-input-background border-border pr-10"
                        />
                        <button
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showGeminiKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <Button variant="outline">Test</Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Get your API key from{" "}
                      <a href="https://makersuite.google.com/app/apikey" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                        Google AI Studio
                      </a>
                    </p>
                  </div>

                  {/* OpenRouter API Key */}
                  <div>
                    <Label className="mb-2 block">OpenRouter API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showOpenRouterKey ? "text" : "password"}
                          value={openRouterKey}
                          onChange={(e) => setOpenRouterKey(e.target.value)}
                          placeholder="sk-or-..."
                          className="bg-input-background border-border pr-10"
                        />
                        <button
                          onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showOpenRouterKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <Button variant="outline">Test</Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Access multiple models through{" "}
                      <a href="https://openrouter.ai/keys" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                        openrouter.ai
                      </a>
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-1">Security Note</h3>
                    <p className="text-sm text-muted-foreground">
                      API keys are stored locally in your browser and are never transmitted to external servers.
                      Always keep your API keys secure and do not share them.
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="provider" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">LLM Provider Configuration</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Choose your preferred AI provider and model settings.
                </p>

                <div className="space-y-6">
                  <div>
                    <Label className="mb-2 block">Provider</Label>
                    <Select value={provider} onValueChange={setProvider}>
                      <SelectTrigger className="bg-input-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                        <SelectItem value="lmstudio">LMStudio (Local)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block">Model</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="bg-input-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {provider === "anthropic" && (
                          <>
                            <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                            <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                            <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                          </>
                        )}
                        {provider === "gemini" && (
                          <>
                            <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                            <SelectItem value="gemini-pro-vision">Gemini Pro Vision</SelectItem>
                          </>
                        )}
                        {provider === "openrouter" && (
                          <>
                            <SelectItem value="openai/gpt-4">GPT-4</SelectItem>
                            <SelectItem value="anthropic/claude-3-opus">Claude 3 Opus</SelectItem>
                            <SelectItem value="google/gemini-pro">Gemini Pro</SelectItem>
                          </>
                        )}
                        {provider === "lmstudio" && (
                          <SelectItem value="local-model">Local Model</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block">Temperature: {temperature}</Label>
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>More Focused</span>
                      <span>More Creative</span>
                    </div>
                  </div>

                  {provider === "lmstudio" && (
                    <div>
                      <Label className="mb-2 block">LMStudio Server URL</Label>
                      <Input
                        type="text"
                        placeholder="http://localhost:1234"
                        className="bg-input-background border-border"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Make sure LMStudio is running locally
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="general" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">General Settings</h2>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-save Profile Changes</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically save changes to your profile
                      </p>
                    </div>
                    <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Analytics</Label>
                      <p className="text-sm text-muted-foreground">
                        Help improve the app by sharing anonymous usage data
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Use dark theme throughout the application
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Data Management</h2>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    Export All Data
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    Import Data
                  </Button>
                  <Button variant="destructive" className="w-full justify-start">
                    Clear All Data
                  </Button>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
