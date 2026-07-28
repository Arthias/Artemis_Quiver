import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useConfig } from "./ConfigContext";
import { useWorkspace } from "./WorkspaceProfileContext";
import { toast } from "sonner";
import { downloadMarkdown } from "../utils/download";

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
  const { activeProfileId, profileData, updateProfileData, persistActiveProfile, touchLastUsed } =
    useWorkspace();

  const [profile, setProfileState] = useState(profileData.profileMarkdown);
  const [savedProfile, setSavedProfile] = useState(profileData.profileMarkdown);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setProfileState(profileData.profileMarkdown);
    setSavedProfile(profileData.profileMarkdown);
    setLastSavedAt(null);
  }, [activeProfileId, profileData.profileMarkdown]);

  const isDirty = profile !== savedProfile;

  const saveProfile = useCallback(() => {
    updateProfileData({ profileMarkdown: profile });
    persistActiveProfile();
    touchLastUsed();
    setSavedProfile(profile);
    setLastSavedAt(new Date().toISOString());
    toast.success("Profile saved");
  }, [profile, updateProfileData, persistActiveProfile, touchLastUsed]);

  const setProfile = useCallback((value: string) => {
    setProfileState(value);
  }, []);

  const exportProfile = useCallback(() => {
    downloadMarkdown("profile.md", profile);
    toast.success("Profile exported");
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
