import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Mail, Download, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { useConfig } from "../context/ConfigContext";
import { useProfile } from "../context/ProfileContext";
import { useBuilderHandoff } from "../context/BuilderHandoffContext";
import { generateCoverLetter, editCoverLetter } from "../services/clBuilderService";
import { downloadMarkdown } from "../utils/download";

const CL_SUGGESTIONS = [
  { title: "Make it more formal", hint: "Corporate tone", prompt: "Make the tone more formal and professional for a corporate setting." },
  { title: "Make it shorter", hint: "About 3 paragraphs", prompt: "Shorten the letter to roughly three concise paragraphs." },
  { title: "Add enthusiasm", hint: "Show more excitement", prompt: "Add more enthusiasm while staying professional." },
  { title: "Emphasize leadership", hint: "Highlight management", prompt: "Emphasize leadership and team management experience." },
  { title: "Focus on tech stack", hint: "Mention technologies", prompt: "Highlight relevant technical skills and stack from the profile." },
];

export function CLBuilder() {
  const { config } = useConfig();
  const { profile } = useProfile();
  const { consumeHandoff } = useBuilderHandoff();

  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [position, setPosition] = useState("");
  const [letterContent, setLetterContent] = useState("");
  const [seedDraft, setSeedDraft] = useState<string | undefined>();
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handoff = consumeHandoff();
    if (!handoff) return;
    if (handoff.jobPosting) setJobDescription(handoff.jobPosting);
    if (handoff.coverLetterDraft) {
      setSeedDraft(handoff.coverLetterDraft);
      setLetterContent(handoff.coverLetterDraft);
      setIsGenerated(true);
    }
    if (handoff.companyName) setCompanyName(handoff.companyName);
    if (handoff.position) setPosition(handoff.position);
  }, [consumeHandoff]);

  const generateLetter = async () => {
    setGenerating(true);
    setError(null);
    try {
      const content = await generateCoverLetter(
        profile,
        {
          jobDescription: jobDescription || undefined,
          companyName,
          position,
          seedDraft,
        },
        config
      );
      setLetterContent(content.trim());
      setIsGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover letter generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadMarkdownExport = () => {
    downloadMarkdown("cover-letter.md", letterContent);
  };

  const handleChatSubmit = async (message?: string) => {
    const text = (message ?? chatMessage).trim();
    if (!text || chatLoading) return;

    setChatLoading(true);
    setError(null);
    setChatMessage("");

    try {
      const updated = await editCoverLetter(letterContent, text, profile, config);
      setLetterContent(updated.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply changes.");
      setChatMessage(text);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Cover Letter Builder</h1>
                <p className="text-sm text-muted-foreground">
                  Create compelling cover letters with AI assistance
                </p>
              </div>
            </div>
            {isGenerated && (
              <Button onClick={downloadMarkdownExport} className="gap-2" variant="outline">
                <Download className="w-4 h-4" />
                Export .md
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 border-r border-border overflow-auto">
          <div className="p-6">
            {error && (
              <Card className="p-3 mb-4 text-sm text-destructive border-destructive/50">
                {error}
              </Card>
            )}
            {!isGenerated ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Generate Cover Letter</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Company Name (Optional)
                        </label>
                        <Input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g., Google"
                          className="bg-input-background border-border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Position (Optional)
                        </label>
                        <Input
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          placeholder="e.g., Senior Engineer"
                          className="bg-input-background border-border"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Job Description (Optional)
                      </label>
                      <Textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste job description for a tailored cover letter, or leave empty for a general letter..."
                        className="min-h-[200px] resize-none bg-input-background border-border"
                      />
                    </div>

                    <Button
                      onClick={generateLetter}
                      disabled={generating}
                      className="w-full gap-2"
                      size="lg"
                    >
                      {generating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating Cover Letter...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          Generate Cover Letter
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <Card className="p-8 bg-white dark:bg-card">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {letterContent}
                  </pre>
                </Card>
              </div>
            )}
          </div>
        </div>

        {isGenerated && (
          <div className="w-96 flex flex-col bg-muted/20">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">AI Assistant</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Request modifications to your cover letter
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-3">
                {CL_SUGGESTIONS.map((s) => (
                  <Card
                    key={s.title}
                    className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => handleChatSubmit(s.prompt)}
                  >
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.hint}</p>
                  </Card>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <Textarea
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                placeholder="Request changes..."
                className="resize-none bg-input-background border-border text-sm"
                rows={3}
                disabled={chatLoading}
              />
              <Button
                onClick={() => handleChatSubmit()}
                disabled={!chatMessage.trim() || chatLoading}
                className="w-full mt-2"
                size="sm"
              >
                {chatLoading ? "Applying..." : "Apply Changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
