import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner";
import { Sidebar } from "../navigation/Sidebar";
import { useOnboarding } from "../../context/OnboardingContext";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";
import { useBuilderHandoff } from "../../context/BuilderHandoffContext";
import type { BuilderHandoff } from "../../types/workspace";

function PageErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}

export function RootLayout() {
  const { onboardingComplete, loading } = useOnboarding();
  const navigate = useNavigate();
  const { setHandoff } = useBuilderHandoff();

  // Picks up a "Build CV" / "Build Cover Letter" handoff from the side
  // panel's deep-analysis result card (sidepanel.tsx) — mirrors the
  // pendingSessionId pattern in AnalysisContext (stash in
  // chrome.storage.session for a fresh tab, live message for an already-open
  // one), just carrying a BuilderHandoff + target route instead of a session
  // id, since the target page differs (cv-builder vs cl-builder).
  useEffect(() => {
    const isExtension = typeof chrome !== "undefined" && chrome.runtime?.id;
    if (!isExtension) return;

    function applyHandoff(target: string, handoff: BuilderHandoff) {
      setHandoff(handoff);
      navigate(`/${target}`);
    }

    chrome.storage.session.get("artemis:pendingBuilderHandoff").then((stored) => {
      const pending = (stored as any)["artemis:pendingBuilderHandoff"] as
        | { target: string; handoff: BuilderHandoff }
        | undefined;
      if (pending) {
        chrome.storage.session.remove("artemis:pendingBuilderHandoff");
        applyHandoff(pending.target, pending.handoff);
      }
    });

    const listener = (msg: any) => {
      if (msg?.type === "ARTEMIS_LOAD_BUILDER_HANDOFF" && msg.payload?.target && msg.payload?.handoff) {
        applyHandoff(msg.payload.target, msg.payload.handoff);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [navigate, setHandoff]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!onboardingComplete) {
    return <OnboardingWizard />;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden print:h-auto print:bg-white print:overflow-visible">
      <Sidebar />
      <main className="flex-1 overflow-auto print:overflow-visible">
        <ErrorBoundary FallbackComponent={PageErrorFallback}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
