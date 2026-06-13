import type { ReactNode } from "react";
import { AnalysisProvider } from "../context/AnalysisContext";
import { BuilderHandoffProvider } from "../context/BuilderHandoffContext";
import { ConfigProvider } from "../context/ConfigContext";
import { ProfileProvider } from "../context/ProfileContext";
import { WorkspaceProfileProvider } from "../context/WorkspaceProfileContext";
import { ExtensionBridgeProvider } from "../context/ExtensionBridgeContext";
import { ErrorLogProvider } from "../context/ErrorLogContext";
import { OnboardingProvider } from "../context/OnboardingContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorLogProvider>
      <WorkspaceProfileProvider>
        <OnboardingProvider>
          <ConfigProvider>
            <ProfileProvider>
              <AnalysisProvider>
                <BuilderHandoffProvider>
                  <ExtensionBridgeProvider>{children}</ExtensionBridgeProvider>
                </BuilderHandoffProvider>
              </AnalysisProvider>
            </ProfileProvider>
          </ConfigProvider>
        </OnboardingProvider>
      </WorkspaceProfileProvider>
    </ErrorLogProvider>
  );
}
