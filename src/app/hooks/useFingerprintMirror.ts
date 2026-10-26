// The overlay runs inside job-site pages and cannot read Quiver's IndexedDB,
// so the overlay, side panel and background read the fingerprint from
// chrome.storage (`artemis:overlayConfig`). The profile record is the source
// (Profile-Management-Spec §3); this mirrors the active profile's saved
// fingerprint, and the endpoints the overlay's remote fallback calls, into
// that key. Nothing else writes the fingerprint.
import { useEffect } from "react";
import { useWorkspace } from "../context/WorkspaceProfileContext";

const STORAGE_KEY = "artemis:overlayConfig";

export function FingerprintMirror() {
  const { profileData } = useWorkspace();
  const layer = profileData.fingerprint;
  const { primary, secondary, secondaryUse } = profileData.settings;

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    void chrome.storage.local.get(STORAGE_KEY).then((res) => {
      const cfg = { ...((res as Record<string, unknown>)[STORAGE_KEY] as Record<string, unknown> | undefined) };
      if (layer?.value) {
        cfg.fingerprint = layer.value;
        cfg.lastFingerprintUpdate = layer.updatedAt;
        cfg.fingerprintSource = "profile";
      } else if (cfg.fingerprintSource === "profile") {
        // Another profile's fingerprint must not score for this one. A
        // fingerprint from before 2026-10-26 (no source) is left until replaced.
        delete cfg.fingerprint;
        delete cfg.lastFingerprintUpdate;
        delete cfg.fingerprintSource;
      }
      if (primary?.baseUrl) cfg.primaryEndpoint = { ...primary };
      if (secondary?.baseUrl) cfg.secondaryEndpoint = { ...secondary };
      cfg.secondaryUse = secondaryUse;
      return chrome.storage.local.set({ [STORAGE_KEY]: cfg });
    }).catch(() => {});
  }, [layer?.value, layer?.updatedAt, primary, secondary, secondaryUse]);

  return null;
}
