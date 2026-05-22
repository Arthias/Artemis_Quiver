import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_PROFILE_MARKDOWN, STORAGE_KEYS } from "../config/defaults";
import { useConfig } from "./ConfigContext";
import { downloadMarkdown } from "../utils/download";
import { loadText, saveText } from "../utils/storage";

interface ProfileContextValue {
  profile: string;
  setProfile: (value: string) => void;
  saveProfile: () => void;
  exportProfile: () => void;
  lastSavedAt: string | null;
  isDirty: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const [profile, setProfileState] = useState(() =>
    loadText(STORAGE_KEYS.profile, DEFAULT_PROFILE_MARKDOWN)
  );
  const [savedProfile, setSavedProfile] = useState(profile);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const isDirty = profile !== savedProfile;

  const saveProfile = useCallback(() => {
    saveText(STORAGE_KEYS.profile, profile);
    setSavedProfile(profile);
    setLastSavedAt(new Date().toISOString());
  }, [profile]);

  const setProfile = useCallback((value: string) => {
    setProfileState(value);
  }, []);

  const exportProfile = useCallback(() => {
    downloadMarkdown("profile.md", profile);
  }, [profile]);

  useEffect(() => {
    if (!config.autoSaveProfile || !isDirty) return;
    const timer = setTimeout(() => saveProfile(), 800);
    return () => clearTimeout(timer);
  }, [config.autoSaveProfile, isDirty, profile, saveProfile]);

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      saveProfile,
      exportProfile,
      lastSavedAt,
      isDirty,
    }),
    [profile, setProfile, saveProfile, exportProfile, lastSavedAt, isDirty]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return ctx;
}
