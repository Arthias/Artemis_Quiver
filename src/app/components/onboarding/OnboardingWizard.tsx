import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Loader2, Zap } from "lucide-react";
import { useOnboarding } from "../../context/OnboardingContext";
import { useConfig } from "../../context/ConfigContext";
import { useProfile } from "../../context/ProfileContext";
import { useWorkspace } from "../../context/WorkspaceProfileContext";
import { saveProfile as saveProfileToDb, getProfile } from "../../db";
import type { ProviderType, SecondaryUse } from "../../types/llm";
import { DEFAULT_PRIMARY_ENDPOINT, DEFAULT_SECONDARY_ENDPOINT } from "../../types/llm";
import { testConnection } from "../../services/llmService";
import { getAdapter } from "../../services/provider/registry";
import { WEBLLM_MODELS } from "../../services/provider/WebLLMAdapter";
import type { WebLLMAdapter } from "../../services/provider/WebLLMAdapter";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "../ui/LanguageSelector";

const STEPS = ["Welcome", "AI Setup", "Profile"];



const CLOUD_PROVIDER_OPTIONS: { value: ProviderType; labelKey: string }[] = [
  { value: "openai-compatible", labelKey: "config.openaiCompatible" },
  { value: "anthropic", labelKey: "config.anthropic" },
  { value: "google-gemini", labelKey: "config.googleGemini" },
];

const COMMON_MODELS = [
  { id: "google/gemma-4-e2b", label: "Gemma 4 E2B" },
  { id: "llama3.2:3b", label: "Llama 3.2 (3B)" },
  { id: "llama3.2:1b", label: "Llama 3.2 (1B)" },
  { id: "mistral:7b", label: "Mistral (7B)" },
  { id: "qwen2.5:7b", label: "Qwen 2.5 (7B)" },
  { id: "qwen2.5:1.5b", label: "Qwen 2.5 (1.5B)" },
  { id: "deepseek-r1:7b", label: "DeepSeek R1 (7B)" },
] as const;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i === current ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

function WelcomeStep({ name, setName }: { name: string; setName: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center text-center gap-6 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
        <span className="text-2xl font-bold text-white">AQ</span>
      </div>
      <h2 className="text-2xl font-semibold">{t("onboarding.welcome")}</h2>
      <p className="text-muted-foreground">
        {t("onboarding.welcomeDesc")}
      </p>

      <div className="w-full text-left">
        <Label className="mb-1.5 block text-sm">{t("onboarding.whatsYourName")}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("onboarding.namePlaceholder")}
          className="bg-input-background text-center text-lg py-6"
          autoFocus
        />
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Label className="text-sm whitespace-nowrap">{t("config.language")}:</Label>
        <LanguageSelector />
      </div>

      <div className="grid grid-cols-2 gap-4 w-full mt-2">
        <div className="border rounded-lg p-4 text-left">
          <p className="text-sm font-medium mb-1">{t("onboarding.jobAnalysis")}</p>
          <p className="text-xs text-muted-foreground">{t("onboarding.jobAnalysisDesc")}</p>
        </div>
        <div className="border rounded-lg p-4 text-left">
          <p className="text-sm font-medium mb-1">{t("onboarding.cvLetters")}</p>
          <p className="text-xs text-muted-foreground">{t("onboarding.cvLettersDesc")}</p>
        </div>
        <div className="border rounded-lg p-4 text-left">
          <p className="text-sm font-medium mb-1">{t("onboarding.chromeExt")}</p>
          <p className="text-xs text-muted-foreground">{t("onboarding.chromeExtDesc")}</p>
        </div>
        <div className="border rounded-lg p-4 text-left">
          <p className="text-sm font-medium mb-1">{t("onboarding.local100")}</p>
          <p className="text-xs text-muted-foreground">{t("onboarding.local100Desc")}</p>
        </div>
      </div>
    </div>
  );
}

function AiSetupStep() {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [vramInfo, setVramInfo] = useState<string | null>(null);

  // Clear stale test results when config changes
  const prevConfigRef = useRef({ provider: config.primary.provider, baseUrl: config.primary.baseUrl, model: config.primary.model });
  useEffect(() => {
    const curr = { provider: config.primary.provider, baseUrl: config.primary.baseUrl, model: config.primary.model };
    if (curr.provider !== prevConfigRef.current.provider || curr.baseUrl !== prevConfigRef.current.baseUrl || curr.model !== prevConfigRef.current.model) {
      setTestMessage(null);
      setTestError(null);
      prevConfigRef.current = curr;
    }
  }, [config.primary.provider, config.primary.baseUrl, config.primary.model]);

  // VRAM detection + auto-select best model for local mode
  useEffect(() => {
    if (config.providerMode === "local" && navigator.gpu) {
      import("../../utils/vram").then(({ estimateAvailableVRAM, recommendModel }) => {
        estimateAvailableVRAM().then(info => {
          const recommended = recommendModel(info);
          setVramInfo(`~${info.vramEstimate.toFixed(1)} GB VRAM (${info.vendor})`);
          // Auto-select if current model is not set or is invalid
          const currentModel = config.primary.model;
          if (!currentModel || !isValidWebLLMModel(currentModel)) {
            updateConfig({ primary: { ...config.primary, model: recommended.id } });
          }
        }).catch(() => setVramInfo(null));
      });
    } else {
      setVramInfo(null);
    }
  }, [config.providerMode]);

  function isValidWebLLMModel(modelId: string): boolean {
    return WEBLLM_MODELS.some(m => m.id === modelId);
  }

  // Resolve current WebLLM catalog entry for download button
  const currentWebLLMModelId = config.primary.model && isValidWebLLMModel(config.primary.model)
    ? config.primary.model
    : WEBLLM_MODELS[0].id;
  const currentWebLLMModel = WEBLLM_MODELS.find(m => m.id === currentWebLLMModelId);

  const handleTest = useCallback(async () => {
    setTestMessage(null);
    setTestError(null);
    setTesting(true);
    try {
      const reply = await testConnection(config.primary);
      setTestMessage(`OK: "${reply}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestError(msg || t("config.testFailed"));
    } finally {
      setTesting(false);
    }
  }, [config.primary]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">{t("onboarding.connectAI")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("onboarding.connectAIDesc")}
        </p>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-1">
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
                primary: { ...DEFAULT_PRIMARY_ENDPOINT },
                secondary: { ...DEFAULT_SECONDARY_ENDPOINT },
                secondaryUse: "never" as SecondaryUse,
              });
            }
          }}
        >
          ☁️ {t("config.cloud")}
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
                primary: {
                  label: "Primary",
                  provider: "webllm",
                  model: WEBLLM_MODELS[0].id,
                  baseUrl: "",
                  temperature: 0.7,
                },
                secondaryUse: "never" as SecondaryUse,
              });
            }
          }}
        >
          💻 {t("config.local")}
        </button>
      </div>

      {config.providerMode === "cloud" ? (
        <Card className="p-4 w-full space-y-4">
          <p className="text-sm font-medium">{t("onboarding.primaryModel")}</p>

          <div>
            <Label className="mb-1.5 block text-xs">{t("onboarding.provider")}</Label>
            <Select
              value={config.primary.provider}
              onValueChange={(v) => updateConfig({ primary: { ...config.primary, provider: v as ProviderType } })}
            >
              <SelectTrigger className="bg-input-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {CLOUD_PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">{t("onboarding.baseUrl")}</Label>
            <Input
              value={config.primary.baseUrl}
              onChange={(e) => updateConfig({ primary: { ...config.primary, baseUrl: e.target.value } })}
              placeholder="http://localhost:11434"
              className="bg-input-background"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">{t("onboarding.apiKey")}</Label>
            <Input
              type="password"
              value={config.primary.apiKey ?? ""}
              onChange={(e) => updateConfig({ primary: { ...config.primary, apiKey: e.target.value || undefined } })}
              placeholder="sk-..."
              className="bg-input-background"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">{t("onboarding.model")}</Label>
            <Input
              value={config.primary.model}
              onChange={(e) => updateConfig({ primary: { ...config.primary, model: e.target.value } })}
              placeholder={t("onboarding.model")}
              className="bg-input-background mb-2"
            />
            <div className="flex flex-wrap gap-1">
              {COMMON_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                    config.primary.model === m.id
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                  onClick={() => updateConfig({ primary: { ...config.primary, model: m.id } })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 w-full space-y-4">
          <p className="text-sm font-medium">{t("onboarding.localModelWebGpu")}</p>
          <p className="text-xs text-muted-foreground">
            {t("config.localModelDesc")}
          </p>

          <div>
            <Label className="mb-1.5 block text-xs">{t("onboarding.model")}</Label>
            <Select
              value={currentWebLLMModelId}
              onValueChange={(v) => updateConfig({ primary: { ...config.primary, model: v } })}
            >
              <SelectTrigger className="bg-input-background font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {WEBLLM_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span>{m.name}</span>
                    <span className="text-muted-foreground text-xs ml-2">({m.sizeGB.toFixed(1)} GB)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {vramInfo && (
            <p className="text-xs text-muted-foreground">{vramInfo}</p>
          )}

          <Button
            type="button"
            size="sm"
            onClick={async () => {
              setTestError("");
              setTestMessage(t("config.downloadZero"));
              setTesting(true);
              const targetId = config.primary.model || WEBLLM_MODELS[0].id;
              const target = WEBLLM_MODELS.find(m => m.id === targetId);
              try {
                const adapter = getAdapter("webllm") as unknown as WebLLMAdapter;
                if (adapter.setProgressCallback) {
                  adapter.setProgressCallback((pct: number) => {
                    setTestMessage(t("config.downloadProgress", { name: target?.name || "model", pct }));
                    if (pct >= 100) {
                      setTestMessage(t("config.downloadCompleteCached", { name: target?.name || "model" }));
                      setTesting(false);
                    }
                  });
                }
                if (adapter.onStatus) {
                  adapter.onStatus((event) => {
                    if (event.type === "fatal") {
                      setTestError(event.message);
                      setTesting(false);
                    }
                  });
                }
                await adapter.init({ ...config.primary, model: targetId, baseUrl: "" });
                setTestMessage(t("config.downloadCompleteCached", { name: target?.name || "model" }));
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                setTestError(msg);
              } finally {
                setTesting(false);
              }
            }}
            disabled={testing}
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("onboarding.downloadModel")} ({currentWebLLMModel?.sizeGB.toFixed(1)} GB)
          </Button>
          {testing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const adapter = getAdapter("webllm") as unknown as WebLLMAdapter;
                if (adapter.interruptDownload) await adapter.interruptDownload();
                setTesting(false);
                setTestMessage("Download cancelled.");
              }}
            >
              {t("config.cancel")}
            </Button>
          )}
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {t("onboarding.testConnection")}
        </Button>
      </div>

      {testMessage && <p className="text-sm text-green-700 dark:text-green-400 text-center">{testMessage}</p>}
      {testError && <p className="text-sm text-destructive text-center">{testError}</p>}
    </div>
  );
}

function ProfileStep() {
  const { t } = useTranslation();
  const { profile, setProfile, saveProfile } = useProfile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImportClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setProfile(text);
        saveProfile();
      }
    } catch {
      // Clipboard API may be unavailable
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">{t("onboarding.buildProfile")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("onboarding.buildProfileDesc")}
        </p>
      </div>

      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs text-muted-foreground">{t("onboarding.profileMarkdown")}</Label>
          <Button variant="outline" size="sm" onClick={handleImportClipboard}>
            {t("onboarding.importClipboard")}
          </Button>
        </div>
        <textarea
          ref={textareaRef}
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          className="w-full h-64 p-3 rounded-lg border border-border bg-input-background text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder={t("onboarding.profilePlaceholder")}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t("onboarding.profileAutoSaved")}
      </p>
    </div>
  );
}

export function OnboardingWizard() {
  const { t } = useTranslation();
  const { completeOnboarding } = useOnboarding();
  const { saveProfile } = useProfile();
  const { activeProfileId } = useWorkspace();
  const [step, setStep] = useState(0);
  const [profileName, setProfileName] = useState("");

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  }, [step]);

  const handlePrev = useCallback(() => {
    if (step > 0) {
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleComplete = useCallback(async () => {
    saveProfile();
    const name = profileName.trim();
    if (name) {
      const profile = await getProfile(activeProfileId);
      if (profile) {
        await saveProfileToDb({ ...profile, name: name.slice(0, 40) });
      }
    }
    await completeOnboarding();
    window.location.reload();
  }, [completeOnboarding, saveProfile, profileName, activeProfileId]);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
        {step === 0 && <WelcomeStep name={profileName} setName={setProfileName} />}
        {step === 1 && <AiSetupStep />}
        {step === 2 && <ProfileStep />}
      </div>

      <div className="border-t border-border px-6 py-4 bg-card">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={step === 0}
          >
            {t("onboarding.back")}
          </Button>

          <StepDots current={step} total={STEPS.length} />

          {step < STEPS.length - 1 ? (
            <Button variant="default" size="sm" onClick={handleNext}>
              {t("onboarding.next")}
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleComplete}>
              {t("onboarding.letsGo")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
