import { useState } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { User, Download, Save, Sparkles, FileText } from "lucide-react";
import { useProfile } from "../context/ProfileContext";

export function Profile() {
  const { profile, setProfile, saveProfile, exportProfile, lastSavedAt, isDirty } =
    useProfile();
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    saveProfile();
    setIsEditing(false);
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
          <Tabs defaultValue="editor" className="space-y-6">
            <TabsList>
              <TabsTrigger value="editor" className="gap-2">
                <FileText className="w-4 h-4" />
                Profile Editor
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2" disabled>
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

              <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-1">Profile tips</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• This profile is used for job analysis matching</li>
                      <li>• Export downloads <code className="text-xs">profile.md</code> for backup</li>
                      <li>• Enable auto-save in Settings to persist while editing</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="chat">
              <Card className="p-6 text-sm text-muted-foreground">
                AI profile chat is planned for a later phase. Job analysis is available now.
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
