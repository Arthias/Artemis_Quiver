import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { FileText, Download, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useConfig } from "../context/ConfigContext";
import { useProfile } from "../context/ProfileContext";
import { useBuilderHandoff } from "../context/BuilderHandoffContext";
import { generateCv, editCv } from "../services/cvBuilderService";
import { downloadMarkdown } from "../utils/download";

const CV_SUGGESTIONS = [
  { title: "Add more metrics", hint: "Include quantifiable achievements", prompt: "Add more quantifiable metrics and measurable achievements throughout the CV." },
  { title: "Shorten experience", hint: "Make it more concise", prompt: "Make the experience section more concise while keeping the strongest points." },
  { title: "Reorder sections", hint: "Prioritize key information", prompt: "Reorder sections to prioritize the most relevant experience for the target role." },
  { title: "Change formatting", hint: "Adjust layout and style", prompt: "Improve formatting and structure for clarity and scannability." },
];

export function CVBuilder() {
  const { config } = useConfig();
  const { profile } = useProfile();
  const { consumeHandoff } = useBuilderHandoff();

  const [jobDescription, setJobDescription] = useState("");
  const [cvContent, setCvContent] = useState("");
  const [cvRecommendations, setCvRecommendations] = useState<string[] | undefined>();
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handoff = consumeHandoff();
    if (!handoff) return;
    if (handoff.jobPosting) setJobDescription(handoff.jobPosting);
    if (handoff.cvRecommendations?.length) setCvRecommendations(handoff.cvRecommendations);
  }, [consumeHandoff]);

  const generateCV = async () => {
    setGenerating(true);
    setError(null);
    try {
      const content = await generateCv(
        profile,
        jobDescription || undefined,
        cvRecommendations,
        config
      );
      setCvContent(content.trim());
      setIsGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CV generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadMarkdownExport = () => {
    downloadMarkdown("cv.md", cvContent);
  };

  const handleChatSubmit = async (message?: string) => {
    const text = (message ?? chatMessage).trim();
    if (!text || chatLoading) return;

    setChatLoading(true);
    setError(null);
    setChatMessage("");

    try {
      const updated = await editCv(cvContent, text, profile, config);
      setCvContent(updated.trim());
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
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">CV Builder</h1>
                <p className="text-sm text-muted-foreground">
                  Generate and refine your CV with AI assistance
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
                  <h2 className="text-lg font-semibold mb-4">Generate Tailored CV</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Job Description (Optional)
                      </label>
                      <Textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste job description to tailor your CV, or leave empty for a general CV..."
                        className="min-h-[200px] resize-none bg-input-background border-border"
                      />
                    </div>

                    <Button
                      onClick={generateCV}
                      disabled={generating}
                      className="w-full gap-2"
                      size="lg"
                    >
                      {generating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating CV...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          Generate CV
                        </>
                      )}
                    </Button>
                  </div>
                </Card>

                <Card className="p-6 bg-muted/30 border-dashed">
                  <h3 className="font-medium mb-3">CV Generation Tips</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">1</Badge>
                      <span>Paste a job description to create a tailored CV that highlights relevant experience</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">2</Badge>
                      <span>Leave it empty to generate a general CV from your master profile</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">3</Badge>
                      <span>Use the chat panel to request specific modifications after generation</span>
                    </li>
                  </ul>
                </Card>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <Card className="p-8 bg-white dark:bg-card">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {cvContent}
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
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold">AI Assistant</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Request modifications to your CV
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-3">
                {CV_SUGGESTIONS.map((s) => (
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
                placeholder="Ask for changes..."
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
