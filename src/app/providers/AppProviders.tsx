import type { ReactNode } from "react";
import { AnalysisProvider } from "../context/AnalysisContext";
import { ConfigProvider } from "../context/ConfigContext";
import { ProfileProvider } from "../context/ProfileContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider>
      <ProfileProvider>
        <AnalysisProvider>{children}</AnalysisProvider>
      </ProfileProvider>
    </ConfigProvider>
  );
}
