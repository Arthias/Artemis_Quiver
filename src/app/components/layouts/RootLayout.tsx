import { Outlet } from "react-router";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner";
import { Sidebar } from "../navigation/Sidebar";
import { useOnboarding } from "../../context/OnboardingContext";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";

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
