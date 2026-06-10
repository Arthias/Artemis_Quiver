import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import type { ErrorLogRecord } from "../db/schema";
import { db } from "../db/schema";



interface ErrorLogValue {
  logs: ErrorLogRecord[];
  devMode: boolean;
  setDevMode: (on: boolean) => void;
  clearLogs: () => void;
}

const ErrorLogContext = createContext<ErrorLogValue | null>(null);

export function ErrorLogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<ErrorLogRecord[]>([]);
  const [devMode, setDevModeState] = useState(false);

  const addLog = useCallback(async (entry: Omit<ErrorLogRecord, "id">) => {
    const { addErrorLog, getErrorLogs } = await import("../db/errorLogRepo");
    await addErrorLog(entry);
    const updated = await getErrorLogs();
    setLogs(updated);
  }, []);

  const clearLogs = useCallback(async () => {
    const { clearErrorLogs } = await import("../db/errorLogRepo");
    await clearErrorLogs();
    setLogs([]);
  }, []);

  const setDevMode = useCallback(async (on: boolean) => {
    setDevModeState(on);
    await db.metadata.put({ key: "artemis:devMode", value: on });
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | undefined;

    void import("../db/errorLogRepo").then(({ getErrorLogs, onErrorLogUpdate: subscribe }) => {
      if (!mounted) return;
      getErrorLogs().then((existing) => { if (mounted) setLogs(existing); });
      unsub = subscribe(async () => {
        const updated = await getErrorLogs();
        if (mounted) setLogs(updated);
      });
    });

    db.metadata.get("artemis:devMode").then((stored) => {
      if (stored?.value === true && mounted) setDevModeState(true);
    });

    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const origOnError = window.onerror;
    window.onerror = (_event, _source, _lineno, _colno, error) => {
      void addLog({
        timestamp: new Date().toISOString(),
        message: error?.message || String(_event),
        stack: error?.stack,
        source: "app",
        code: undefined,
        severity: "ERROR",
      });
    };
    const handler = (event: PromiseRejectionEvent) => {
      void addLog({
        timestamp: new Date().toISOString(),
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        source: "app",
        severity: "ERROR",
      });
    };
    window.addEventListener("unhandledrejection", handler);

    return () => {
      window.onerror = origOnError;
      window.removeEventListener("unhandledrejection", handler);
    };
  }, [addLog]);

  useEffect(() => {
    const isExt = typeof chrome !== "undefined" && chrome.runtime?.id;
    if (!isExt) return;

    const msgHandler = (msg: { type: string; payload: { timestamp?: string; message: string; stack?: string; source?: string; code?: string; severity?: string; metadata?: Record<string, unknown> } }) => {
      if (msg.type === "ARTEMIS_LOG_ERROR") {
        const p = msg.payload;
        void addLog({
          timestamp: p.timestamp || new Date().toISOString(),
          message: p.message,
          stack: p.stack,
          source: p.source || "unknown",
          code: p.code,
          severity: p.severity || "ERROR",
          metadata: p.metadata,
        });
      }
    };
    chrome.runtime.onMessage.addListener(msgHandler);
    return () => chrome.runtime.onMessage.removeListener(msgHandler);
  }, [addLog]);

  const value = useMemo(() => ({ logs, devMode, setDevMode, clearLogs }), [logs, devMode, setDevMode, clearLogs]);

  return (
    <ErrorLogContext.Provider value={value}>
      {children}
    </ErrorLogContext.Provider>
  );
}

export function useErrorLog() {
  const ctx = useContext(ErrorLogContext);
  if (!ctx) throw new Error("useErrorLog must be used within ErrorLogProvider");
  return ctx;
}
