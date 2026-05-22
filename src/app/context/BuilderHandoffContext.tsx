import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BuilderHandoff } from "../types/workspace";

interface BuilderHandoffContextValue {
  handoff: BuilderHandoff | null;
  setHandoff: (value: BuilderHandoff) => void;
  consumeHandoff: () => BuilderHandoff | null;
}

const BuilderHandoffContext = createContext<BuilderHandoffContextValue | null>(null);

export function BuilderHandoffProvider({ children }: { children: ReactNode }) {
  const [handoff, setHandoffState] = useState<BuilderHandoff | null>(null);

  const setHandoff = useCallback((value: BuilderHandoff) => {
    setHandoffState(value);
  }, []);

  const consumeHandoff = useCallback(() => {
    const current = handoff;
    setHandoffState(null);
    return current;
  }, [handoff]);

  const value = useMemo(
    () => ({ handoff, setHandoff, consumeHandoff }),
    [handoff, setHandoff, consumeHandoff]
  );

  return (
    <BuilderHandoffContext.Provider value={value}>{children}</BuilderHandoffContext.Provider>
  );
}

export function useBuilderHandoff() {
  const ctx = useContext(BuilderHandoffContext);
  if (!ctx) {
    throw new Error("useBuilderHandoff must be used within BuilderHandoffProvider");
  }
  return ctx;
}
