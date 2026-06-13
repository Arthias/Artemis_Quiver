import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
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
    <I18nextProvider i18n={i18n}>
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
    </I18nextProvider>
  );
}
