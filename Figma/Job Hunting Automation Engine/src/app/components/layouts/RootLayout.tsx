import { Outlet } from "react-router";
import { Sidebar } from "../navigation/Sidebar";

export function RootLayout() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
