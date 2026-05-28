export type LocalLlmProvider = "lmstudio" | "ollama";

export interface LlmConfig {
  provider: LocalLlmProvider;
  serverUrl: string;
  model: string;
  temperature: number;
  autoSaveProfile: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
