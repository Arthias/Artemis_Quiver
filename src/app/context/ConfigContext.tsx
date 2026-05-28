import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProfileSettings } from "../types/workspace";
import { testConnection } from "../services/llmService";
import { useWorkspace } from "./WorkspaceProfileContext";

interface ConfigContextValue {
  config: ProfileSettings;
  updateConfig: (patch: Partial<ProfileSettings>) => void;
  saveConfig: () => void;
  testLlmConnection: () => Promise<string>;
  isTesting: boolean;
  lastSavedAt: string | null;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { profileData, updateSettings, persistActiveProfile, touchLastUsed } =
    useWorkspace();
  const [isTesting, setIsTesting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const config = profileData.settings;

  const persist = useCallback(() => {
    persistActiveProfile();
    touchLastUsed();
    setLastSavedAt(new Date().toISOString());
  }, [persistActiveProfile, touchLastUsed]);

  const updateConfig = useCallback(
    (patch: Partial<ProfileSettings>) => {
      updateSettings(patch);
      persist();
    },
    [updateSettings, persist]
  );

  const saveConfig = useCallback(() => {
    persist();
  }, [persist]);

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
