// Keeps Flow holding what Quiver has (Profile-Management-Spec §6), and asks
// the user when it can't decide alone: a first sync with a Flow that already
// has settings (import them?), or a Flow that holds another workspace profile.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../context/WorkspaceProfileContext";
import {
  ensureFlowSynced,
  FlowSyncError,
  getBacklogConfig,
  getFlowLlm,
  getFlowSyncState,
  getPreferences,
  type FlowSyncSource,
  type FlowSyncState,
} from "../services/flowBridge";
import { defaultFlowRunConfig, ProfilePreferencesSchema, type FlowRunConfig } from "../types/preferences";
import { makeLayer, masterHash } from "../services/profileLayers";

export function useFlowSync({ auto = false }: { auto?: boolean } = {}) {
  const { activeProfile, profileData, updateProfileData } = useWorkspace();
  const baseUrl = profileData.settings.flowBaseUrl;
  const [state, setState] = useState<FlowSyncState | null>(null);
  const [problem, setProblem] = useState<FlowSyncError | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const source: FlowSyncSource = useMemo(
    () => ({
      name: activeProfile.name,
      profileMarkdown: profileData.profileMarkdown,
      settings: profileData.settings,
      preferences: profileData.preferences,
      fingerprint: profileData.fingerprint,
    }),
    [activeProfile.name, profileData.profileMarkdown, profileData.settings, profileData.preferences, profileData.fingerprint]
  );

  const run = useCallback(
    async (opts: { replace?: boolean; force?: boolean } = {}) => {
      if (!baseUrl) return;
      setSyncing(true);
      setError(null);
      try {
        await ensureFlowSynced(baseUrl, { source, ...opts });
        setProblem(null);
        setState(await getFlowSyncState(baseUrl));
        if (!profileData.settings.flowConfiguredAt) {
          updateProfileData({ settings: { ...profileData.settings, flowConfiguredAt: new Date().toISOString() } });
        }
      } catch (err) {
        if (err instanceof FlowSyncError) setProblem(err);
        else setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSyncing(false);
      }
    },
    [baseUrl, source, profileData.settings, updateProfileData]
  );

  // Debounced, so typing in a settings field sends one bundle, not one per key.
  useEffect(() => {
    if (!auto || !baseUrl) return;
    const id = setTimeout(() => void run(), 1500);
    return () => clearTimeout(id);
  }, [auto, baseUrl, run]);

  /** First sync of an existing install: take Flow's current settings into
   * this profile, so the sync that follows doesn't reset Flow to defaults. */
  const importFromFlow = useCallback(async () => {
    if (!baseUrl) return;
    setSyncing(true);
    setError(null);
    try {
      const [prefs, backlog, llm, st] = await Promise.all([
        getPreferences(baseUrl), getBacklogConfig(baseUrl), getFlowLlm(baseUrl).catch(() => null), getFlowSyncState(baseUrl),
      ]);
      const defaults = defaultFlowRunConfig();
      const flow: FlowRunConfig = {
        ...defaults,
        softModel: llm?.soft_model ?? "",
        hardModel: llm?.hard_model ?? "",
        backlog: { ...defaults.backlog, ...backlog, skip_aggregator_boards: !!backlog.skip_aggregator_boards },
        apply: st.apply ?? defaults.apply,
        prescore: st.prescore ?? defaults.prescore,
      };
      const parsed = ProfilePreferencesSchema.safeParse(prefs);
      updateProfileData({
        settings: { ...profileData.settings, flow },
        ...(profileData.preferences || !parsed.success
          ? {}
          : { preferences: makeLayer(parsed.data, "manual", await masterHash(profileData.profileMarkdown)) }),
      });
      setProblem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [baseUrl, profileData, updateProfileData]);

  /** First sync, the other way: start from Quiver's defaults and replace Flow's. */
  const keepQuiverSettings = useCallback(() => {
    updateProfileData({ settings: { ...profileData.settings, flow: profileData.settings.flow ?? defaultFlowRunConfig() } });
    setProblem(null);
  }, [profileData.settings, updateProfileData]);

  return {
    state, problem, error, syncing,
    syncNow: () => run({ force: true }),
    replace: () => run({ replace: true }),
    importFromFlow,
    keepQuiverSettings,
  };
}

/** Mounted once in AppProviders: syncs after any saved change while Flow is connected. */
export function FlowAutoSync() {
  useFlowSync({ auto: true });
  return null;
}
