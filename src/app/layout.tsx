import type { Metadata } from "next";
import Link from "next/link";
import { Search, User, FileText, PenTool, Settings } from "lucide-react";
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
    <html lang="__en">
      <body className="antialiased">
        <div className="flex min-h-screen bg-background text-foreground">
          {/* Sidebar */}
          <aside className="w-64 border-r border-border bg-card p-6 flex flex-col gap-8">
            <div className="px-2">
              <h2 className="font-bold text-xl tracking-tight text-primary">Artemis Quiver</h2>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mt-1">Automation Engine</p>
            </div>

            <nav className="flex flex-col gap-1 px-2">
              <Link href="/" className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                <Search className="h-4 w-arg4 text-muted-foreground group-hover:text-primary" />
                Analysis Hub
              </Link>
              <Link href="/profile" className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                <User className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                Profile Workspace
              </Link>
              <Link href="/cv-builder" className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                CV Studio
              </Link>
              <Link href="/cl-builder" className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                <PenTool className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                CL Studio
              </Link>
              <Link href="/config" className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                <Settings className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                System Settings
              </Link>
            </nav>

            <div className="mt-auto px-2 pt-4 border-t border-border/50">
               <p className="text-[10px] text-muted-foreground italic">v1.0.0 Engine Active</p>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-8 bg-background/50">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
