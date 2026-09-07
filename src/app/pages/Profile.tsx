import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { User, Download, Save, Sparkles, FileText, Upload, Loader2 } from "lucide-react";
import { AppError } from "../utils/errors";
import { useProfile } from "../context/ProfileContext";
import { useConfig } from "../context/ConfigContext";
import { useWorkspace } from "../context/WorkspaceProfileContext";
import { getActiveEndpoint } from "../services/llmService";
import {
  extractUpdatedProfile,
  profileChat,
} from "../services/profileChatService";
import type { ChatMessage } from "../types/llm";

export function Profile() {
  const { t } = useTranslation();
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

  // Import is a plain file read: the file's text goes straight into the editor.
  // No model call, no merge, no truncated review step — the user sees exactly
  // what the file contained and edits it themselves. Nothing is persisted until
  // they press Save.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "md" && ext !== "txt") {
      setChatError(t("profile.onlyMdTxt"));
      return;
    }
    if (file.size > 500_000) {
      setChatError(t("profile.fileTooLarge"));
      return;
    }
    setChatError(null);
    try {
      const text = await file.text();
      setProfile(text);
      setIsEditing(true);
      setActiveTab("editor");
    } catch (err) {
      setChatError(err instanceof Error ? err.message : t("profile.readFailed"));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
      const reply = await profileChat(nextMessages, profile, getActiveEndpoint(config));
      const assistantMsg: ChatMessage = { role: "assistant", content: reply };
      persistChat([...nextMessages, assistantMsg]);
    } catch (err) {
      setChatError(err instanceof AppError ? err.userMessage : err instanceof Error ? err.message : t("profile.chatFailed"));
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
                <h1 className="text-xl font-semibold">{t("profile.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("profile.subtitle")}
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
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {t("profile.importFile")}
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportProfile}>
                <Download className="w-4 h-4" />
                {t("profile.exportProfile")}
              </Button>
              {(isEditing || isDirty) && (
                <Button onClick={handleSave} className="gap-2">
                  <Save className="w-4 h-4" />
                  {t("profile.saveChanges")}
                </Button>
              )}
            </div>
          </div>
          {lastSavedAt && (
            <p className="text-xs text-muted-foreground mt-2 max-w-6xl mx-auto px-6 pb-2">
              {t("profile.lastSaved")} {new Date(lastSavedAt).toLocaleString()}
              {isDirty ? ` · ${t("profile.unsavedChanges")}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {showOnboarding && (
            <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{t("profile.newProfile")}</strong> {t("profile.newProfileHint")}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setShowOnboarding(false)}
              >
                {t("app.dismiss")}
              </Button>
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
                  {t("profile.profileEditor")}
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  {t("profile.aiAssistant")}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{t("profile.masterProfile")}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t("profile.editHint")}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                    {isEditing ? t("profile.preview") : t("profile.edit")}
                  </Button>
                </div>

                {isEditing ? (
                  <Textarea
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    className="min-h-[600px] font-mono text-sm resize-none bg-input-background border-border"
                  />
                ) : profile.trim() ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {profile}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-6 text-sm text-muted-foreground">
                    {t("profile.previewEmpty")}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="chat" className="space-y-4">
              <Card className="p-6 flex flex-col min-h-[500px]">
                <div className="flex-1 overflow-auto space-y-4 mb-4">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("profile.assistantHint")}
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
                            {t("profile.applyToEditor")}
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("profile.thinking")}
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
                    placeholder={t("profile.chatPlaceholder")}
                    className="resize-none bg-input-background"
                    rows={2}
                  />
                  <Button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || chatLoading}
                  >
                    {t("profile.send")}
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
