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
  initializeWorkspace,
  loadProfileData,
  MAX_WORKSPACE_PROFILES,
  profileDataKey,
  profileInitials,
  saveManifest,
  saveProfileData,
} from "../utils/workspaceStorage";

interface WorkspaceProfileContextValue {
  manifest: WorkspaceManifest;
  profiles: WorkspaceProfileMeta[];
  activeProfileId: string;
  activeProfile: WorkspaceProfileMeta;
  activeInitials: string;
  profileData: ProfileWorkspaceData;
  switchProfile: (id: string) => void;
  createProfile: (name: string) => string;
  updateProfileData: (patch: Partial<ProfileWorkspaceData>) => void;
  updateSettings: (patch: Partial<ProfileSettings>) => void;
  persistActiveProfile: () => void;
  touchLastUsed: () => void;
}

const WorkspaceProfileContext = createContext<WorkspaceProfileContextValue | null>(null);

export function WorkspaceProfileProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => initializeWorkspace(), []);
  const [manifest, setManifest] = useState<WorkspaceManifest>(initial.manifest);
  const [profileData, setProfileData] = useState<ProfileWorkspaceData>(initial.activeData);

  useEffect(() => {
    applyTheme(initial.activeData.settings.theme);
  }, []);

  const activeProfile = useMemo(
    () => manifest.profiles.find((p) => p.id === manifest.activeProfileId)!,
    [manifest]
  );

  const persistMeta = useCallback((nextManifest: WorkspaceManifest) => {
    setManifest(nextManifest);
    saveManifest(nextManifest);
  }, []);

  const persistActiveProfile = useCallback(() => {
    saveProfileData(manifest.activeProfileId, profileData);
  }, [manifest.activeProfileId, profileData]);

  const touchLastUsed = useCallback(() => {
    const now = new Date().toISOString();
    const nextProfiles = manifest.profiles.map((p) =>
      p.id === manifest.activeProfileId ? { ...p, lastUsedAt: now } : p
    );
    persistMeta({ ...manifest, profiles: nextProfiles });
  }, [manifest, persistMeta]);

  const switchProfile = useCallback(
    (id: string) => {
      if (id === manifest.activeProfileId) return;
      saveProfileData(manifest.activeProfileId, profileData);
      const target = manifest.profiles.find((p) => p.id === id);
      if (!target) return;

      const loaded = loadProfileData(id);
      const now = new Date().toISOString();
      const nextProfiles = manifest.profiles.map((p) =>
        p.id === id ? { ...p, lastUsedAt: now } : p
      );
      persistMeta({ activeProfileId: id, profiles: nextProfiles });
      setProfileData(loaded);
      applyTheme(loaded.settings.theme);
    },
    [manifest, profileData, persistMeta]
  );

  const createProfile = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Profile name is required.");

      saveProfileData(manifest.activeProfileId, profileData);

      const now = new Date().toISOString();
      let nextProfiles = [...manifest.profiles];

      if (nextProfiles.length >= MAX_WORKSPACE_PROFILES) {
        const evicted = [...nextProfiles].sort(
          (a, b) => new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime()
        )[0];
        console.info(
          `[Artemis Quiver] Profile limit (${MAX_WORKSPACE_PROFILES}) reached. Evicting "${evicted.name}" (${evicted.id}).`
        );
        localStorage.removeItem(profileDataKey(evicted.id));
        nextProfiles = nextProfiles.filter((p) => p.id !== evicted.id);
      }

      const meta: WorkspaceProfileMeta = {
        id: crypto.randomUUID(),
        name: trimmed.slice(0, 40),
        createdAt: now,
        lastUsedAt: now,
        lastModifiedAt: now,
      };

      const empty = createEmptyProfileData();
      saveProfileData(meta.id, empty);

      persistMeta({
        activeProfileId: meta.id,
        profiles: [...nextProfiles, meta],
      });
      setProfileData(empty);
      applyTheme(empty.settings.theme);
      return meta.id;
    },
    [manifest, profileData, persistMeta]
  );

  const updateProfileData = useCallback((patch: Partial<ProfileWorkspaceData>) => {
    setProfileData((prev) => {
      const next = { ...prev, ...patch };
      const now = new Date().toISOString();
      setManifest((m) => {
        const updated = {
          ...m,
          profiles: m.profiles.map((p) =>
            p.id === m.activeProfileId ? { ...p, lastModifiedAt: now } : p
          ),
        };
        saveManifest(updated);
        return updated;
      });
      return next;
    });
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<ProfileSettings>) => {
      setProfileData((prev) => {
        const nextSettings = { ...prev.settings, ...patch };
        if (patch.theme) applyTheme(patch.theme);
        return { ...prev, settings: nextSettings };
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      manifest,
      profiles: manifest.profiles,
      activeProfileId: manifest.activeProfileId,
      activeProfile,
      activeInitials: profileInitials(activeProfile.name),
      profileData,
      switchProfile,
      createProfile,
      updateProfileData,
      updateSettings,
      persistActiveProfile,
      touchLastUsed,
    }),
    [
      manifest,
      activeProfile,
      profileData,
      switchProfile,
      createProfile,
      updateProfileData,
      updateSettings,
      persistActiveProfile,
      touchLastUsed,
    ]
  );

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
