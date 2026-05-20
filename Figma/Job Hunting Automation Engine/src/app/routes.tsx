import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/layouts/RootLayout";
import { AnalysisHub } from "./pages/AnalysisHub";
import { Profile } from "./pages/Profile";
import { CVBuilder } from "./pages/CVBuilder";
import { CLBuilder } from "./pages/CLBuilder";
import { Config } from "./pages/Config";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: AnalysisHub },
      { path: "profile", Component: Profile },
      { path: "cv-builder", Component: CVBuilder },
      { path: "cl-builder", Component: CLBuilder },
      { path: "config", Component: Config },
    ],
  },
]);
