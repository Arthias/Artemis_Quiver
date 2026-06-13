import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { db } from "../db/schema";

const ONBOARDING_META_KEY = "artemis:onboardingComplete";

interface OnboardingContextValue {
  onboardingComplete: boolean;
  loading: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const meta = await db.metadata.get(ONBOARDING_META_KEY);
        setOnboardingComplete(meta?.value === true);
      } catch {
        setOnboardingComplete(false);
      } finally {
        setLoading(false);
      }
    }
    check();
  }, []);

  const completeOnboarding = useCallback(async () => {
    await db.metadata.put({ key: ONBOARDING_META_KEY, value: true });
    setOnboardingComplete(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await db.metadata.delete(ONBOARDING_META_KEY);
    setOnboardingComplete(false);
  }, []);

  const value = useMemo(
    () => ({ onboardingComplete, loading, completeOnboarding, resetOnboarding }),
    [onboardingComplete, loading, completeOnboarding, resetOnboarding]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
