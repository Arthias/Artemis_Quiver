import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Target,
  User,
  FileText,
  Mail,
  Settings,
  Plus,
  MessageSquare,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { useAnalysis } from "../../context/AnalysisContext";
import { useExtensionBridge, type PendingImport } from "../../context/ExtensionBridgeContext";
import { useWorkspace } from "../../context/WorkspaceProfileContext";
import { formatRelativeTime } from "../../utils/relativeTime";
import { ProfileSwitcherModal } from "../workspace/ProfileSwitcherModal";

const navigation = [
  { nameKey: "nav.analysisHub", href: "/", icon: Target },
  { nameKey: "nav.profile", href: "/profile", icon: User },
  { nameKey: "nav.cvBuilder", href: "/cv-builder", icon: FileText },
  { nameKey: "nav.coverLetter", href: "/cl-builder", icon: Mail },
  { nameKey: "nav.settings", href: "/config", icon: Settings },
];

function sessionTitle(jobPosting: string, title?: string, summary?: string): string {
  if (title?.trim()) return title.trim().slice(0, 50);
  if (summary?.trim()) return summary.trim().slice(0, 50);
  const first = jobPosting.trim().split("\n")[0];
  return first?.slice(0, 50) || "Untitled analysis";
}

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessions, loadSession, clearCurrent, activeSessionId, draftJobPosting, setDraftJobPosting } = useAnalysis();
  const { activeProfile, activeInitials } = useWorkspace();
  const { pendingImports, latestImportId, clearPendingImport, markPendingOpen } = useExtensionBridge();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const handleNewAnalysis = () => {
    clearCurrent();
    navigate("/");
  };

  const handleLoadSession = (id: string) => {
    loadSession(id);
    navigate("/");
  };

  const handleRunPending = (pending: PendingImport) => {
    clearCurrent();
    setDraftJobPosting(pending.text);
    markPendingOpen(pending.id);
    navigate("/");
  };

  // Auto-navigate when a new import arrives from extension
  useEffect(() => {
    if (!latestImportId) return;
    const p = pendingImports.find((pi) => pi.id === latestImportId);
    if (p) handleRunPending(p);
  }, [latestImportId]);

  return (
    <>
      <aside className="w-72 border-r border-border bg-sidebar flex flex-col print:hidden">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-foreground">{t("app.name")}</h1>
              <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
            </div>
          </div>
          <Button
            className="w-full justify-start gap-2"
            variant="default"
            onClick={handleNewAnalysis}
          >
            <Plus className="w-4 h-4" />
            {t("app.newAnalysis")}
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
                <span className="text-sm">{t(item.nameKey)}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <Separator className="mx-3" />

        {pendingImports.length > 0 && (
          <div className="px-3 pt-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-1">
              {t("app.pending")}
            </h3>
            <div className="space-y-1">
              {pendingImports.map((p) => (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRunPending(p)}
                    className={`flex-1 min-w-0 text-left flex items-center gap-2 px-2 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors group ${
                      activeSessionId === null && draftJobPosting === p.text ? "bg-sidebar-accent/50" : ""
                    }`}
                  >
                    <Inbox className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-sidebar-foreground truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(p.receivedAt)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => clearPendingImport(p.id)}
                    className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs"
                    title="Dismiss"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("app.recentAnalyses")}
            </h3>
          </div>
          <ScrollArea className="flex-1 px-3">
            <div className="space-y-1 pb-4">
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">{t("app.noAnalysesYet")}</p>
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
              <p className="text-xs text-muted-foreground">{t("app.switchProfile")}</p>
            </div>
          </button>
        </div>
      </aside>

      <ProfileSwitcherModal open={profileModalOpen} onOpenChange={setProfileModalOpen} />
    </>
  );
}
