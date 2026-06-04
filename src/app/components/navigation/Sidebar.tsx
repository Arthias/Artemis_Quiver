import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  Target,
  User,
  FileText,
  Mail,
  Settings,
  Plus,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { useAnalysis } from "../../context/AnalysisContext";
import { useWorkspace } from "../../context/WorkspaceProfileContext";
import { formatRelativeTime } from "../../utils/relativeTime";
import { ProfileSwitcherModal } from "../workspace/ProfileSwitcherModal";

const navigation = [
  { name: "Analysis Hub", href: "/", icon: Target },
  { name: "Profile", href: "/profile", icon: User },
  { name: "CV Builder", href: "/cv-builder", icon: FileText },
  { name: "Cover Letter", href: "/cl-builder", icon: Mail },
  { name: "Settings", href: "/config", icon: Settings },
];

function sessionTitle(jobPosting: string, title?: string, summary?: string): string {
  if (title?.trim()) return title.trim().slice(0, 50);
  if (summary?.trim()) return summary.trim().slice(0, 50);
  const first = jobPosting.trim().split("\n")[0];
  return first?.slice(0, 50) || "Untitled analysis";
}

export function Sidebar() {
  const navigate = useNavigate();
  const { sessions, loadSession, clearCurrent, activeSessionId } = useAnalysis();
  const { activeProfile, activeInitials } = useWorkspace();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const handleNewAnalysis = () => {
    clearCurrent();
    navigate("/");
  };

  const handleLoadSession = (id: string) => {
    loadSession(id);
    navigate("/");
  };

  return (
    <>
      <aside className="w-72 border-r border-border bg-sidebar flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-foreground">Artemis Quiver</h1>
              <p className="text-xs text-muted-foreground">Job Hunting Engine</p>
            </div>
          </div>
          <Button
            className="w-full justify-start gap-2"
            variant="default"
            onClick={handleNewAnalysis}
          >
            <Plus className="w-4 h-4" />
            New Analysis
          </Button>
        </div>

        <div className="px-3 py-4">
          <nav className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm">{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <Separator className="mx-3" />

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Analyses
            </h3>
          </div>
          <ScrollArea className="flex-1 px-3">
            <div className="space-y-1 pb-4">
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">No analyses yet</p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleLoadSession(session.id)}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors group ${
                      activeSessionId === session.id ? "bg-sidebar-accent/70" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-sidebar-foreground truncate">
                          {sessionTitle(session.jobPosting, session.result.title, session.result.summary)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(session.createdAt)} · {session.result.score}%
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-3 border-t border-sidebar-border">
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
              {activeInitials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {activeProfile.name}
              </p>
              <p className="text-xs text-muted-foreground">Switch profile</p>
            </div>
          </button>
        </div>
      </aside>

      <ProfileSwitcherModal open={profileModalOpen} onOpenChange={setProfileModalOpen} />
    </>
  );
}
