export type ProviderType = "openai-compatible" | "ollama" | "anthropic" | "google-gemini" | "webllm";

export interface ModelEndpoint {
  label: string;
  provider: ProviderType;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  /** "none" turns a thinking model's reasoning off (sent as `reasoning_effort`). Unset = not sent. */
  reasoningEffort?: "none";
}

/**
 * Every kind of LLM call the app makes, named by purpose. Callers say which
 * task they are; `runLlm` decides which model serves it.
 */
export type LlmTask =
  | "jobAnalysis" | "jobFollowUp"
  | "cvGenerate" | "cvEdit" | "cvOptimize"
  | "clGenerate" | "clEdit"
  | "profileChat" | "profileImport" | "profilePreferences" | "profileLists"
  | "assistMatchFields" | "assistExtractValues" | "assistDraftAnswer";

export type SecondaryUse ="never" | "fallback" | "quick-tasks" | "always";

export type ProviderMode = "cloud" | "local";

export interface LlmConfig {
  providerMode: ProviderMode;
  primary: ModelEndpoint;
  secondary: ModelEndpoint;
  secondaryUse: SecondaryUse;
  /** Snapshot of cloud endpoints saved when switching to local mode */
  savedCloudEndpoints?: {
    primary: ModelEndpoint;
    secondary: ModelEndpoint;
    secondaryUse: SecondaryUse;
  };
  autoSaveProfile: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const DEFAULT_PRIMARY_ENDPOINT: ModelEndpoint = {
  label: "Primary",
  provider: "openai-compatible",
  baseUrl: "",
  model: "",
  temperature: 0.7,
};

export const DEFAULT_SECONDARY_ENDPOINT: ModelEndpoint = {
  label: "Secondary",
  provider: "openai-compatible",
  baseUrl: "",
  model: "",
  temperature: 0.7,
};
