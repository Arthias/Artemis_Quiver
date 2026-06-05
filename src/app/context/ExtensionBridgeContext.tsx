/// <reference types="chrome" />
import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";

interface PendingImport {
  id: string;
  title: string;
  text: string;
  url: string;
  receivedAt: string;
}

interface ExtensionBridgeValue {
  pendingImports: PendingImport[];
  clearPendingImport: (id: string) => void;
  runPendingImport: (id: string) => void;
  onRunPending: (fn: (text: string) => void) => void;
}

const ExtensionBridgeContext = createContext<ExtensionBridgeValue | null>(null);

export function ExtensionBridgeProvider({ children }: { children: ReactNode }) {
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const [runHandler, setRunHandler] = useState<((text: string) => void) | null>(null);

  useEffect(() => {
    const isExtension = typeof chrome !== "undefined" && chrome.runtime?.id;
    if (!isExtension) return;

    // Pick up any stored pending import
    chrome.storage.session.get("artemis:pendingImport").then((stored) => {
      const payload = (stored as any)["artemis:pendingImport"] as { title: string; text: string; url: string } | undefined;
      if (payload) {
        chrome.storage.session.remove("artemis:pendingImport");
        addPending(payload);
      }
    });

    // Listen for live messages
    const handler = (msg: any) => {
      if (msg.type === "ARTEMIS_IMPORT") {
        addPending(msg.payload);
      }
      if (msg.type === "ARTEMIS_REQUEST_PROFILE") {
        return respondWithProfile();
      }
    };
    chrome.runtime.onMessage.addListener(handler);

    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  function addPending(payload: { title: string; text: string; url: string }) {
    const id = crypto.randomUUID();
    setPendingImports((prev) => {
      if (prev.some((p) => p.url === payload.url && p.title === payload.title)) return prev;
      return [...prev, { id, ...payload, receivedAt: new Date().toISOString() }];
    });
  }

  async function respondWithProfile(): Promise<{ profileMarkdown: string; primaryEndpoint?: any; secondaryEndpoint?: any } | { error: string }> {
    try {
      const { getActiveProfileId, getProfile } = await import("../db");
      const activeProfileId = await getActiveProfileId();
      if (!activeProfileId) return { error: "No active profile" };
      const profile = await getProfile(activeProfileId);
      if (!profile) return { error: "Profile not found" };
      const s = profile.settings;
      return {
        profileMarkdown: profile.profileMarkdown,
        primaryEndpoint: s?.primary ? { baseUrl: s.primary.baseUrl, model: s.primary.model, apiKey: s.primary.apiKey } : undefined,
        secondaryEndpoint: s?.secondary ? { baseUrl: s.secondary.baseUrl, model: s.secondary.model, apiKey: s.secondary.apiKey } : undefined,
      };
    } catch (err) {
      console.error("[ExtensionBridge] Failed to read profile:", err);
      return { error: String(err) };
    }
  }

  const clearPendingImport = useCallback((id: string) => {
    setPendingImports((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const runPendingImport = useCallback((id: string) => {
    const pending = pendingImports.find((p) => p.id === id);
    if (pending && runHandler) {
      runHandler(pending.text);
      setPendingImports((prev) => prev.filter((p) => p.id !== id));
    }
  }, [pendingImports, runHandler]);

  const onRunPending = useCallback((fn: (text: string) => void) => {
    setRunHandler(() => fn);
  }, []);

  const value = useMemo(() => ({
    pendingImports,
    clearPendingImport,
    runPendingImport,
    onRunPending,
  }), [pendingImports, clearPendingImport, runPendingImport, onRunPending]);

  return (
    <ExtensionBridgeContext.Provider value={value}>
      {children}
    </ExtensionBridgeContext.Provider>
  );
}

export function useExtensionBridge() {
  const ctx = useContext(ExtensionBridgeContext);
  if (!ctx) throw new Error("useExtensionBridge must be used within ExtensionBridgeProvider");
  return ctx;
}
