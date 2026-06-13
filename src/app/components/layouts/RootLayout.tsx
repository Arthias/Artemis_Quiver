import { Outlet } from "react-router";
import { Sidebar } from "../navigation/Sidebar";
import { useOnboarding } from "../../context/OnboardingContext";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";

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
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
