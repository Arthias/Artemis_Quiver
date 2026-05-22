import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { User, Download, Save, Sparkles, FileText, Upload, Loader2 } from "lucide-react";
import { useProfile } from "../context/ProfileContext";
import { useConfig } from "../context/ConfigContext";
import { useWorkspace } from "../context/WorkspaceProfileContext";
import { mergeProfileFromUpload } from "../services/profileMergeService";
import {
  extractUpdatedProfile,
  profileChat,
} from "../services/profileChatService";
import type { ChatMessage } from "../types/llm";

export function Profile() {
  const location = useLocation();
  const navState = location.state as { edit?: boolean; isNewProfile?: boolean } | null;
  const { profile, setProfile, saveProfile, exportProfile, lastSavedAt, isDirty } =
    useProfile();
  const { config } = useConfig();
  const { profileData, updateProfileData, persistActiveProfile } = useWorkspace();

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("editor");
  const [showOnboarding, setShowOnboarding] = useState(!!navState?.isNewProfile);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [mergePreview, setMergePreview] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = profileData.profileChat;

  useEffect(() => {
    if (navState?.edit) {
      setIsEditing(true);
      setActiveTab("editor");
    }
  }, [navState?.edit]);

  const persistChat = (next: ChatMessage[]) => {
    updateProfileData({ profileChat: next });
    persistActiveProfile();
  };

  const handleSave = () => {
    saveProfile();
    setIsEditing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "md" && ext !== "txt") {
      setChatError("Only .md and .txt files are supported.");
      return;
    }
    if (file.size > 500_000) {
      setChatError("File is too large (max 500KB). Consider splitting the content.");
      return;
    }
    setChatError(null);
    setMerging(true);
    try {
      const text = await file.text();
      const merged = await mergeProfileFromUpload(profile, text, config);
      setMergePreview(merged);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Merge failed.");
    } finally {
      setMerging(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const applyMerge = () => {
    if (!mergePreview) return;
    setProfile(mergePreview);
    setMergePreview(null);
    setIsEditing(true);
  };

  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    persistChat(nextMessages);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const reply = await profileChat(nextMessages, profile, config);
      const assistantMsg: ChatMessage = { role: "assistant", content: reply };
      persistChat([...nextMessages, assistantMsg]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Chat failed.");
    } finally {
      setChatLoading(false);
    }
  };

  const applyAssistantProfile = (content: string) => {
    const updated = extractUpdatedProfile(content);
    if (updated) {
      setProfile(updated);
      setIsEditing(true);
      setActiveTab("editor");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Profile Management</h1>
                <p className="text-sm text-muted-foreground">
                  Master profile stored as Markdown in your browser
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,text/plain,text/markdown"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                className="gap-2"
                disabled={merging}
                onClick={() => fileInputRef.current?.click()}
              >
                {merging ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Import file
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportProfile}>
                <Download className="w-4 h-4" />
                Export profile.md
              </Button>
              {(isEditing || isDirty) && (
                <Button onClick={handleSave} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
              )}
            </div>
          </div>
          {lastSavedAt && (
            <p className="text-xs text-muted-foreground mt-2 max-w-6xl mx-auto px-6 pb-2">
              Last saved {new Date(lastSavedAt).toLocaleString()}
              {isDirty ? " · unsaved changes" : ""}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {showOnboarding && (
            <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">New profile.</strong> Paste your CV or
                resume below, or use Import file to merge an existing .md or .txt document.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setShowOnboarding(false)}
              >
                Dismiss
              </Button>
            </Card>
          )}

          {mergePreview && (
            <Card className="p-4 mb-6 border-primary/30">
              <h3 className="font-medium mb-2">Review merged profile</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Confirm before replacing your current profile.
              </p>
              <pre className="text-xs bg-muted/30 p-3 rounded max-h-48 overflow-auto whitespace-pre-wrap mb-3">
                {mergePreview.slice(0, 2000)}
                {mergePreview.length > 2000 ? "\n…" : ""}
              </pre>
              <div className="flex gap-2">
                <Button onClick={applyMerge}>Apply merge</Button>
                <Button variant="outline" onClick={() => setMergePreview(null)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {chatError && (
            <Card className="p-3 mb-4 border-destructive/50 text-sm text-destructive">
              {chatError}
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="editor" className="gap-2">
                <FileText className="w-4 h-4" />
                Profile Editor
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <Sparkles className="w-4 h-4" />
                AI Assistant
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Master Profile</h2>
                    <p className="text-sm text-muted-foreground">
                      Edit your professional profile in Markdown format
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                    {isEditing ? "Preview" : "Edit"}
                  </Button>
                </div>

                {isEditing ? (
                  <Textarea
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    className="min-h-[600px] font-mono text-sm resize-none bg-input-background border-border"
                  />
                ) : (
                  <div className="prose prose-sm max-w-none bg-muted/30 rounded-lg p-6">
                    <div className="whitespace-pre-wrap">{profile}</div>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="chat" className="space-y-4">
              <Card className="p-6 flex flex-col min-h-[500px]">
                <div className="flex-1 overflow-auto space-y-4 mb-4">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Ask the assistant to improve sections, add metrics, or reorganize your
                      profile. When it suggests an update, use Apply to editor.
                    </p>
                  ) : (
                    messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`rounded-lg p-3 text-sm ${
                          msg.role === "user" ?
                            "bg-primary/10 ml-8"
                          : "bg-muted/50 mr-8"
                        }`}
                      >
                        <p className="text-xs font-medium mb-1 capitalize text-muted-foreground">
                          {msg.role}
                        </p>
                        <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                        {msg.role === "assistant" && extractUpdatedProfile(msg.content) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => applyAssistantProfile(msg.content)}
                          >
                            Apply to editor
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking...
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSend();
                      }
                    }}
                    placeholder="Ask to improve your profile..."
                    className="resize-none bg-input-background"
                    rows={2}
                  />
                  <Button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || chatLoading}
                  >
                    Send
                  </Button>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
