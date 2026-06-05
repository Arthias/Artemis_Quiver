import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ProfileSettings,
  ProfileWorkspaceData,
  WorkspaceManifest,
  WorkspaceProfileMeta,
} from "../types/workspace";
import { applyTheme } from "../utils/theme";
import {
  createEmptyProfileData,
  MAX_WORKSPACE_PROFILES,
  profileInitials,
} from "../utils/profileDefaults";
import {
  getActiveProfileId,
  setActiveProfileId,
  getProfiles,
  getProfile,
  saveProfile,
  deleteProfile as deleteProfileFromDb,
  ensureDbInitialized,
} from "../db";
import { Loader2 } from "lucide-react";

interface WorkspaceProfileContextValue {
  manifest: WorkspaceManifest;
  profiles: WorkspaceProfileMeta[];
  activeProfileId: string;
  activeProfile: WorkspaceProfileMeta;
  activeInitials: string;
  profileData: ProfileWorkspaceData;
  switchProfile: (id: string) => Promise<void>;
  createProfile: (name: string) => Promise<string>;
  deleteProfile: (id: string) => Promise<void>;
  updateProfileData: (patch: Partial<ProfileWorkspaceData>) => void;
  updateSettings: (patch: Partial<ProfileSettings>) => void;
  persistActiveProfile: () => Promise<void>;
  touchLastUsed: () => Promise<void>;
}

const WorkspaceProfileContext = createContext<WorkspaceProfileContextValue | null>(null);

export function WorkspaceProfileProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [manifest, setManifest] = useState<WorkspaceManifest | null>(null);
  const [profileData, setProfileData] = useState<ProfileWorkspaceData | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await ensureDbInitialized();
        const activeId = await getActiveProfileId();
        const profilesList = await getProfiles();

        if (!activeId || profilesList.length === 0) {
          throw new Error("Initialization failed to set default active profile.");
        }

        const activeProf = profilesList.find((p) => p.id === activeId) || profilesList[0];
        const loadedData = await getProfile(activeProf.id);

        if (!loadedData) {
          throw new Error("Failed to load active profile data.");
        }

        setManifest({
          activeProfileId: activeProf.id,
          profiles: profilesList.map((p) => ({
            id: p.id,
            name: p.name,
            createdAt: p.createdAt,
            lastUsedAt: p.lastUsedAt,
            lastModifiedAt: p.lastModifiedAt,
          })),
        });

        setProfileData({
          profileMarkdown: loadedData.profileMarkdown,
          settings: loadedData.settings,
          analysisSessions: [],
          draftJobPosting: loadedData.draftJobPosting,
          profileChat: loadedData.profileChat,
        });

        applyTheme(loadedData.settings.theme);
      } catch (err) {
        console.error("[WorkspaceProfileContext] Init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const activeProfile = useMemo(() => {
    if (!manifest) return null;
    return manifest.profiles.find((p) => p.id === manifest.activeProfileId) || null;
  }, [manifest]);

  const persistActiveProfile = useCallback(async () => {
    if (!manifest || !profileData || !activeProfile) return;
    await saveProfile({
      id: manifest.activeProfileId,
      name: activeProfile.name,
      createdAt: activeProfile.createdAt,
      lastUsedAt: activeProfile.lastUsedAt,
      lastModifiedAt: activeProfile.lastModifiedAt,
      profileMarkdown: profileData.profileMarkdown,
      settings: profileData.settings,
      draftJobPosting: profileData.draftJobPosting,
      profileChat: profileData.profileChat,
    });
  }, [manifest, profileData, activeProfile]);

  const touchLastUsed = useCallback(async () => {
    if (!manifest || !profileData || !activeProfile) return;
    const now = new Date().toISOString();
    const nextProfiles = manifest.profiles.map((p) =>
      p.id === manifest.activeProfileId ? { ...p, lastUsedAt: now } : p
    );
    
    setManifest({ ...manifest, profiles: nextProfiles });
    await saveProfile({
      id: manifest.activeProfileId,
      name: activeProfile.name,
      createdAt: activeProfile.createdAt,
      lastUsedAt: now,
      lastModifiedAt: activeProfile.lastModifiedAt,
      profileMarkdown: profileData.profileMarkdown,
      settings: profileData.settings,
      draftJobPosting: profileData.draftJobPosting,
      profileChat: profileData.profileChat,
    });
  }, [manifest, profileData, activeProfile]);

  const switchProfile = useCallback(
    async (id: string) => {
      if (!manifest || !profileData || !activeProfile || id === manifest.activeProfileId) return;

      // Save current active profile before switching
      await saveProfile({
        id: manifest.activeProfileId,
        name: activeProfile.name,
        createdAt: activeProfile.createdAt,
        lastUsedAt: activeProfile.lastUsedAt,
        lastModifiedAt: activeProfile.lastModifiedAt,
        profileMarkdown: profileData.profileMarkdown,
        settings: profileData.settings,
        draftJobPosting: profileData.draftJobPosting,
        profileChat: profileData.profileChat,
      });

      const target = await getProfile(id);
      if (!target) return;

      const now = new Date().toISOString();
      const updatedTarget = { ...target, lastUsedAt: now };
      await saveProfile(updatedTarget);
      await setActiveProfileId(id);

      const allProfiles = await getProfiles();

      setManifest({
        activeProfileId: id,
        profiles: allProfiles.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          lastUsedAt: p.lastUsedAt,
          lastModifiedAt: p.lastModifiedAt,
        })),
      });

      setProfileData({
        profileMarkdown: updatedTarget.profileMarkdown,
        settings: updatedTarget.settings,
        analysisSessions: [], // Decoupled/handled in AnalysisContext
        draftJobPosting: updatedTarget.draftJobPosting,
        profileChat: updatedTarget.profileChat,
      });

      applyTheme(updatedTarget.settings.theme);
    },
    [manifest, profileData, activeProfile]
  );

  const createProfile = useCallback(
    async (name: string): Promise<string> => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Profile name is required.");
      if (!manifest || !profileData || !activeProfile) return "";

      // Save current active profile first
      await saveProfile({
        id: manifest.activeProfileId,
        name: activeProfile.name,
        createdAt: activeProfile.createdAt,
        lastUsedAt: activeProfile.lastUsedAt,
        lastModifiedAt: activeProfile.lastModifiedAt,
        profileMarkdown: profileData.profileMarkdown,
        settings: profileData.settings,
        draftJobPosting: profileData.draftJobPosting,
        profileChat: profileData.profileChat,
      });

      const now = new Date().toISOString();
      const newId = crypto.randomUUID();

      // Handle eviction limit if profile count >= 3
      let currentProfiles = await getProfiles();
      if (currentProfiles.length >= MAX_WORKSPACE_PROFILES) {
        const evicted = [...currentProfiles].sort(
          (a, b) => new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime()
        )[0];
        console.info(
          `[Artemis Quiver] Profile limit (${MAX_WORKSPACE_PROFILES}) reached. Evicting "${evicted.name}" (${evicted.id}).`
        );
        await deleteProfile(evicted.id);
      }

      const emptyData = createEmptyProfileData();
      await saveProfile({
        id: newId,
        name: trimmed.slice(0, 40),
        createdAt: now,
        lastUsedAt: now,
        lastModifiedAt: now,
        profileMarkdown: emptyData.profileMarkdown,
        settings: emptyData.settings,
        draftJobPosting: emptyData.draftJobPosting,
        profileChat: emptyData.profileChat,
      });
      await setActiveProfileId(newId);

      const allProfiles = await getProfiles();

      setManifest({
        activeProfileId: newId,
        profiles: allProfiles.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          lastUsedAt: p.lastUsedAt,
          lastModifiedAt: p.lastModifiedAt,
        })),
      });

      setProfileData({
        profileMarkdown: emptyData.profileMarkdown,
        settings: emptyData.settings,
        analysisSessions: [],
        draftJobPosting: emptyData.draftJobPosting,
        profileChat: emptyData.profileChat,
      });

      applyTheme(emptyData.settings.theme);
      return newId;
    },
    [manifest, profileData, activeProfile]
  );

  const deleteProfile = useCallback(
    async (id: string): Promise<void> => {
      if (!manifest || !profileData || !activeProfile) return;
      if (manifest.profiles.length <= 1) return;

      await deleteProfileFromDb(id);

      const remaining = await getProfiles();
      let nextActiveId = manifest.activeProfileId;

      if (id === manifest.activeProfileId) {
        nextActiveId = remaining[0].id;
        const target = await getProfile(nextActiveId);
        if (target) {
          const now = new Date().toISOString();
          const updatedTarget = { ...target, lastUsedAt: now };
          await saveProfile(updatedTarget);
          await setActiveProfileId(nextActiveId);
          setProfileData({
            profileMarkdown: updatedTarget.profileMarkdown,
            settings: updatedTarget.settings,
            analysisSessions: [],
            draftJobPosting: updatedTarget.draftJobPosting,
            profileChat: updatedTarget.profileChat,
          });
          applyTheme(updatedTarget.settings.theme);
        }
      }

      setManifest({
        activeProfileId: nextActiveId,
        profiles: remaining.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          lastUsedAt: p.lastUsedAt,
          lastModifiedAt: p.lastModifiedAt,
        })),
      });
    },
    [manifest, profileData, activeProfile]
  );

  const updateProfileData = useCallback(
    (patch: Partial<ProfileWorkspaceData>) => {
      setProfileData((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        const now = new Date().toISOString();

        setManifest((m) => {
          if (!m) return m;
          const updated = {
            ...m,
            profiles: m.profiles.map((p) =>
              p.id === m.activeProfileId ? { ...p, lastModifiedAt: now } : p
            ),
          };
          return updated;
        });

        // Async save to db
        if (manifest && activeProfile) {
          saveProfile({
            id: manifest.activeProfileId,
            name: activeProfile.name,
            createdAt: activeProfile.createdAt,
            lastUsedAt: activeProfile.lastUsedAt,
            lastModifiedAt: now,
            profileMarkdown: next.profileMarkdown,
            settings: next.settings,
            draftJobPosting: next.draftJobPosting,
            profileChat: next.profileChat,
          });
        }

        return next;
      });
    },
    [manifest, activeProfile]
  );

  const updateSettings = useCallback((patch: Partial<ProfileSettings>) => {
    setProfileData((prev) => {
      if (!prev) return prev;
      const nextSettings = { ...prev.settings, ...patch };
      if (patch.theme) applyTheme(patch.theme);
      
      const next = { ...prev, settings: nextSettings };
      
      // Async save to db is triggered via updateProfileData flow or we can do it directly:
      // Note: Components call updateSettings, and the settings are part of profileData.
      return next;
    });
  }, []);

  // Make sure we auto-save settings changes when settings change
  useEffect(() => {
    if (!manifest || !profileData || !activeProfile) return;
    saveProfile({
      id: manifest.activeProfileId,
      name: activeProfile.name,
      createdAt: activeProfile.createdAt,
      lastUsedAt: activeProfile.lastUsedAt,
      lastModifiedAt: activeProfile.lastModifiedAt,
      profileMarkdown: profileData.profileMarkdown,
      settings: profileData.settings,
      draftJobPosting: profileData.draftJobPosting,
      profileChat: profileData.profileChat,
    });
  }, [profileData?.settings]);

  const value = useMemo(() => {
    if (loading || !manifest || !profileData || !activeProfile) return null;
    return {
      manifest,
      profiles: manifest.profiles,
      activeProfileId: manifest.activeProfileId,
      activeProfile,
      activeInitials: profileInitials(activeProfile.name),
      profileData,
      switchProfile,
      createProfile,
      deleteProfile,
      updateProfileData,
      updateSettings,
      persistActiveProfile,
      touchLastUsed,
    };
  }, [
    loading,
    manifest,
    activeProfile,
    profileData,
    switchProfile,
    createProfile,
    deleteProfile,
    updateProfileData,
    updateSettings,
    persistActiveProfile,
    touchLastUsed,
  ]);

  if (loading || !value) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Loading Workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceProfileContext.Provider value={value}>
      {children}
    </WorkspaceProfileContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceProfileContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProfileProvider");
  }
  return ctx;
}
