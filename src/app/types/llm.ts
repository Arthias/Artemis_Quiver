export type ProviderType = "openai-compatible" | "anthropic" | "google-gemini";

export interface ModelEndpoint {
  label: string;
  provider: ProviderType;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens?: number;
}

export type SecondaryUse = "never" | "fallback" | "quick-tasks" | "always";

export interface LlmConfig {
  primary: ModelEndpoint;
  secondary: ModelEndpoint;
  secondaryUse: SecondaryUse;
  autoSaveProfile: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const DEFAULT_PRIMARY_ENDPOINT: ModelEndpoint = {
  label: "Primary",
  provider: "openai-compatible",
  baseUrl: "/api/lmstudio",
  model: "google/gemma-4-e2b",
  temperature: 0.7,
};

export const DEFAULT_SECONDARY_ENDPOINT: ModelEndpoint = {
  label: "Secondary",
  provider: "openai-compatible",
  baseUrl: "/api/ollama",
  model: "llama3.2:3b",
  temperature: 0.7,
};
