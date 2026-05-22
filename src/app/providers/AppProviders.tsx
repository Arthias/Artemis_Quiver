import type { ReactNode } from "react";
import { AnalysisProvider } from "../context/AnalysisContext";
import { BuilderHandoffProvider } from "../context/BuilderHandoffContext";
import { ConfigProvider } from "../context/ConfigContext";
import { ProfileProvider } from "../context/ProfileContext";
import { WorkspaceProfileProvider } from "../context/WorkspaceProfileContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProfileProvider>
      <ConfigProvider>
        <ProfileProvider>
          <AnalysisProvider>
            <BuilderHandoffProvider>{children}</BuilderHandoffProvider>
          </AnalysisProvider>
        </ProfileProvider>
      </ConfigProvider>
    </WorkspaceProfileProvider>
  );
}
