import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "../navigation/Sidebar";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "../ui/sheet";
import { useMediaQuery } from "../../hooks/useMediaQuery";
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
  const { t } = useTranslation();
  const { onboardingComplete, loading } = useOnboarding();
  const navigate = useNavigate();
  const { setHandoff } = useBuilderHandoff();
  const isDesktopNav = useMediaQuery("(min-width: 768px)");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
      {isDesktopNav ? (
        <Sidebar />
      ) : (
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-auto max-w-[85vw] border-r-0 p-0" showClose={false}>
            <SheetTitle className="sr-only">{t("app.name")}</SheetTitle>
            <SheetDescription className="sr-only">{t("app.mainNavigation")}</SheetDescription>
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!isDesktopNav && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 print:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)} aria-label={t("app.openMenu")}>
              <Menu className="w-5 h-5" />
            </Button>
            <span className="text-sm font-semibold">{t("app.name")}</span>
          </div>
        )}
        <main className="flex-1 overflow-auto print:overflow-visible">
          <ErrorBoundary FallbackComponent={PageErrorFallback}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
