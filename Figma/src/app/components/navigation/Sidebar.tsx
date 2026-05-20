import { NavLink } from "react-router";
import {
  Target,
  User,
  FileText,
  Mail,
  Settings,
  Plus,
  MessageSquare,
  ChevronRight
} from "lucide-react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { useState } from "react";

const navigation = [
  { name: "Analysis Hub", href: "/", icon: Target },
  { name: "Profile", href: "/profile", icon: User },
  { name: "CV Builder", href: "/cv-builder", icon: FileText },
  { name: "Cover Letter", href: "/cl-builder", icon: Mail },
  { name: "Settings", href: "/config", icon: Settings },
];

interface ChatSession {
  id: string;
  title: string;
  date: string;
}

export function Sidebar() {
  const [chatHistory] = useState<ChatSession[]>([
    { id: "1", title: "Senior Software Engineer at Google", date: "2 hours ago" },
    { id: "2", title: "Product Manager - AI/ML", date: "Yesterday" },
    { id: "3", title: "Full Stack Developer", date: "2 days ago" },
  ]);

  return (
    <aside className="w-72 border-r border-border bg-sidebar flex flex-col">
      {/* Header */}
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
        <Button className="w-full justify-start gap-2" variant="default">
          <Plus className="w-4 h-4" />
          New Analysis
        </Button>
      </div>

      {/* Navigation */}
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

      {/* Chat History */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Analyses
          </h3>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-4">
            {chatHistory.map((chat) => (
              <button
                key={chat.id}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-sidebar-foreground truncate">
                      {chat.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{chat.date}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/30">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              John Doe
            </p>
            <p className="text-xs text-muted-foreground">Free Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
