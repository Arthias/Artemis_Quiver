import { useState } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { User, Upload, Save, Sparkles, FileText } from "lucide-react";
import { Badge } from "../components/ui/badge";

const DEFAULT_PROFILE = `# Professional Profile

## Overview
Senior Software Engineer with 8+ years of experience building scalable distributed systems.

## Skills
- **Languages**: JavaScript, TypeScript, Python, Go
- **Frameworks**: React, Node.js, Django, FastAPI
- **Cloud**: AWS (EC2, S3, Lambda), GCP, Docker, Kubernetes
- **Databases**: PostgreSQL, MongoDB, Redis

## Experience

### Senior Software Engineer | Tech Corp
*2021 - Present*
- Led development of microservices architecture serving 10M+ users
- Improved system performance by 40% through optimization initiatives
- Mentored team of 5 junior engineers

### Software Engineer | StartupXYZ
*2018 - 2021*
- Built real-time data processing pipeline handling 1M events/day
- Implemented CI/CD pipeline reducing deployment time by 60%
- Collaborated with product team on feature development

## Education
**Bachelor of Science in Computer Science**
University of Technology, 2018

## Certifications
- AWS Certified Solutions Architect
- Certified Kubernetes Administrator (CKA)
`;

export function Profile() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);

  const handleSave = () => {
    setIsEditing(false);
    // In a real app, this would save to localStorage or a backend
    console.log("Profile saved:", profile);
  };

  const handleChatSubmit = () => {
    if (!chatMessage.trim()) return;

    const newHistory = [
      ...chatHistory,
      { role: "user", content: chatMessage },
      {
        role: "assistant",
        content: "I've analyzed your request. Here are some suggestions for improving your profile:\n\n1. Add quantifiable metrics to your achievements\n2. Include specific technologies used in each role\n3. Expand on leadership and collaboration skills"
      }
    ];

    setChatHistory(newHistory);
    setChatMessage("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
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
                  Manage your master profile and upload context files
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Upload Files
              </Button>
              {isEditing && (
                <Button onClick={handleSave} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Tabs defaultValue="editor" className="space-y-6">
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
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(!isEditing)}
                  >
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
                    <h3 className="font-medium text-sm mb-1">Profile Tips</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Use Markdown formatting for better structure</li>
                      <li>• Include quantifiable achievements and metrics</li>
                      <li>• Keep your skills and experience up to date</li>
                      <li>• Use the AI Assistant tab for optimization suggestions</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="chat" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">AI Profile Assistant</h2>

                {/* Chat History */}
                <div className="space-y-4 mb-6 min-h-[400px] max-h-[500px] overflow-auto">
                  {chatHistory.length === 0 ? (
                    <div className="flex items-center justify-center h-[400px] text-center">
                      <div>
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
                          <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-medium mb-2">Optimize Your Profile</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          Ask questions about how to improve your profile, add missing sections,
                          or get suggestions for better presentation.
                        </p>
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-3 ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div
                          className={`rounded-lg p-4 max-w-[80%] ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {msg.role === "user" && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Chat Input */}
                <div className="flex gap-2">
                  <Textarea
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit();
                      }
                    }}
                    placeholder="Ask for profile improvements, suggestions, or optimization tips..."
                    className="resize-none bg-input-background border-border"
                    rows={3}
                  />
                  <Button
                    onClick={handleChatSubmit}
                    disabled={!chatMessage.trim()}
                    className="self-end"
                  >
                    Send
                  </Button>
                </div>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4 hover:bg-accent/50 cursor-pointer transition-colors">
                  <Badge className="mb-2" variant="secondary">Quick Action</Badge>
                  <p className="text-sm font-medium">Add Skills Section</p>
                </Card>
                <Card className="p-4 hover:bg-accent/50 cursor-pointer transition-colors">
                  <Badge className="mb-2" variant="secondary">Quick Action</Badge>
                  <p className="text-sm font-medium">Improve Achievements</p>
                </Card>
                <Card className="p-4 hover:bg-accent/50 cursor-pointer transition-colors">
                  <Badge className="mb-2" variant="secondary">Quick Action</Badge>
                  <p className="text-sm font-medium">Optimize for ATS</p>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
