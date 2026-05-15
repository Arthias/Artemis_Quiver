import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artemis Quiver",
  description: "AI-driven job hunting automation engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen bg-background text-foreground">
          {/* Sidebar */}
          <aside className="w-64 border-r bg-card p-4 flex flex-col gap-4">
            <h2 className="font-bold text-lg">Artemis Quiver</h2>
            <nav className="flex flex-col gap-2">
              <a href="/" className="text-sm hover:underline">Analysis Hub</a>
              <a href="/profile" className="text-sm hover:underline">Profile Workspace</a>
              <a href="/cv-builder" className="text-sm hover:underline">CV Studio</a>
              <a href="/cl-builder" className="text-sm hover:underline">CL Studio</a>
              <a href="/config" className="text-sm hover:underline">System Settings</a>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
