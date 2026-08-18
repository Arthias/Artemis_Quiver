import { lazy, Suspense } from "react";
import { createHashRouter } from "react-router";
import { RootLayout } from "./components/layouts/RootLayout";

const AnalysisHub = lazy(() =>
  import("./pages/AnalysisHub").then((m) => ({ default: m.AnalysisHub }))
);
const Profile = lazy(() =>
  import("./pages/Profile").then((m) => ({ default: m.Profile }))
);
const CVBuilder = lazy(() =>
  import("./pages/CVBuilder").then((m) => ({ default: m.CVBuilder }))
);
const CLBuilder = lazy(() =>
  import("./pages/CLBuilder").then((m) => ({ default: m.CLBuilder }))
);
const Config = lazy(() =>
  import("./pages/Config").then((m) => ({ default: m.Config }))
);
const Flow = lazy(() =>
  import("./pages/Flow").then((m) => ({ default: m.Flow }))
);

function PageFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Loading page...</p>
    </div>
  );
}

export const router = createHashRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageFallback />}>
            <AnalysisHub />
          </Suspense>
        ),
      },
      {
        path: "profile",
        element: (
          <Suspense fallback={<PageFallback />}>
            <Profile />
          </Suspense>
        ),
      },
      {
        path: "cv-builder",
        element: (
          <Suspense fallback={<PageFallback />}>
            <CVBuilder />
          </Suspense>
        ),
      },
      {
        path: "cl-builder",
        element: (
          <Suspense fallback={<PageFallback />}>
            <CLBuilder />
          </Suspense>
        ),
      },
      {
        path: "config",
        element: (
          <Suspense fallback={<PageFallback />}>
            <Config />
          </Suspense>
        ),
      },
      {
        path: "flow",
        element: (
          <Suspense fallback={<PageFallback />}>
            <Flow />
          </Suspense>
        ),
      },
    ],
  },
]);
