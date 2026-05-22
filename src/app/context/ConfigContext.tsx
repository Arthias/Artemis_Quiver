import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LLM_CONFIG, STORAGE_KEYS } from "../config/defaults";
import { testConnection } from "../services/llmService";
import type { LlmConfig } from "../types/llm";
import { loadJson, saveJson } from "../utils/storage";

interface ConfigContextValue {
  config: LlmConfig;
  updateConfig: (patch: Partial<LlmConfig>) => void;
  saveConfig: () => void;
  testLlmConnection: () => Promise<string>;
  isTesting: boolean;
  lastSavedAt: string | null;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LlmConfig>(() =>
    loadJson(STORAGE_KEYS.llmConfig, DEFAULT_LLM_CONFIG)
  );
  const [isTesting, setIsTesting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const updateConfig = useCallback((patch: Partial<LlmConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveConfig = useCallback(() => {
    saveJson(STORAGE_KEYS.llmConfig, config);
    setLastSavedAt(new Date().toISOString());
  }, [config]);

  const testLlmConnection = useCallback(async () => {
    setIsTesting(true);
    try {
      return await testConnection(config);
    } finally {
      setIsTesting(false);
    }
  }, [config]);

  const value = useMemo(
    () => ({
      config,
      updateConfig,
      saveConfig,
      testLlmConnection,
      isTesting,
      lastSavedAt,
    }),
    [config, updateConfig, saveConfig, testLlmConnection, isTesting, lastSavedAt]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return ctx;
}
