import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Mail, Download, Sparkles, Wand2, Copy, Check } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useConfig } from "../context/ConfigContext";
import { useProfile } from "../context/ProfileContext";
import { useBuilderHandoff } from "../context/BuilderHandoffContext";
import { generateCoverLetter, editCoverLetter, parseClJson } from "../services/clBuilderService";
import type { CLContent } from "../../types/cl";
import { CLContentSchema } from "../../types/cl";
import { renderCLToHTML } from "../../components/cv/renderingEngine";
import { InteractiveCLPreview } from "../../components/cv/InteractiveCLPreview";
import { downloadMarkdown } from "../utils/download";
import { AppError, ErrorCodes } from "../utils/errors";
import { logAppError } from "../utils/errorLogger";
import { parsePlainTextToCLContent } from "../utils/clParser";

const CL_SUGGESTIONS = [
  { title: "Make it more formal", hint: "Corporate tone", prompt: "Make the tone more formal and professional for a corporate setting." },
  { title: "Make it shorter", hint: "About 3 paragraphs", prompt: "Shorten the letter to roughly three concise paragraphs." },
  { title: "Add enthusiasm", hint: "Show more excitement", prompt: "Add more enthusiasm while staying professional." },
  { title: "Emphasize leadership", hint: "Highlight management", prompt: "Emphasize leadership and team management experience." },
  { title: "Focus on tech stack", hint: "Mention technologies", prompt: "Highlight relevant technical skills and stack from the profile." },
];

function defaultCLContent(): CLContent {
  return {
    senderName: "",
    salutation: "Dear Hiring Manager,",
    bodyParagraphs: [""],
    closing: "Sincerely,",
  };
}

export function CLBuilder() {
  const { config } = useConfig();
  const { profile } = useProfile();
  const { consumeHandoff } = useBuilderHandoff();

  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [position, setPosition] = useState("");
  const [seedDraft, setSeedDraft] = useState<string | undefined>();
  const [clContent, setClContent] = useState<CLContent | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryableError, setRetryableError] = useState<AppError | null>(null);
  const [copied, setCopied] = useState(false);

  const [themeConfig, setThemeConfig] = useState({
    primaryColor: "#2563eb",
    templateId: "modern" as "modern" | "classic" | "minimal",
  });
  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const [printHtml, setPrintHtml] = useState("");

  useEffect(() => {
    const handoff = consumeHandoff();
    if (!handoff) return;
    if (handoff.jobPosting) setJobDescription(handoff.jobPosting);
    if (handoff.companyName) setCompanyName(handoff.companyName);
    if (handoff.position) setPosition(handoff.position);
    if (handoff.coverLetterDraft) {
      setSeedDraft(handoff.coverLetterDraft);
      setClContent(parsePlainTextToCLContent(handoff.coverLetterDraft));
      setIsGenerated(true);
    }
  }, [consumeHandoff]);

  const generateLetter = async () => {
    setGenerating(true);
    setError(null);
    setRetryableError(null);
    try {
      const content = await generateCoverLetter(
        profile,
        { jobDescription: jobDescription || undefined, companyName, position, seedDraft },
        config
      );
      const parsed = JSON.parse(content) as CLContent;
      const validated = CLContentSchema.parse(parsed);
      setClContent(validated);
      setIsGenerated(true);
    } catch (err) {
      logAppError(err, { phase: "generateCoverLetter" });
      if (err instanceof AppError) {
        setRetryableError(err.retryable ? err : null);
        setError(err.userMessage);
      } else {
        setError(err instanceof Error ? err.message : "Cover letter generation failed.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const retry = () => {
    setError(null);
    setRetryableError(null);
    generateLetter();
  };

  const handleChatSubmit = async (message?: string) => {
    const text = (message ?? chatMessage).trim();
    if (!text || chatLoading || !clContent) return;

    setChatLoading(true);
    setError(null);
    setChatMessage("");

    try {
      const currentJson = JSON.stringify(clContent);
      const updated = await editCoverLetter(currentJson, text, profile, config);
      const parsed = JSON.parse(updated) as CLContent;
      const validated = CLContentSchema.parse(parsed);
      setClContent(validated);
    } catch (err) {
      setError(err instanceof AppError ? err.userMessage : (err instanceof Error ? err.message : "Could not apply changes."));
      setChatMessage(text);
    } finally {
      setChatLoading(false);
    }
  };

  const exportAsMarkdown = () => {
    if (!clContent) return;
    const md = [
      `# Cover Letter: ${clContent.position ?? "Application"}`,
      "",
      clContent.senderName,
      clContent.senderTitle,
      clContent.date,
      "",
      clContent.recipientName ? `To: ${clContent.recipientName}` : "",
      clContent.companyName ? `Company: ${clContent.companyName}` : "",
      "",
      clContent.subject ? `## ${clContent.subject}` : "",
      "",
      clContent.salutation,
      "",
      ...clContent.bodyParagraphs,
      "",
      clContent.closing,
      clContent.senderName,
    ].filter(Boolean).join("\n");
    downloadMarkdown("cover-letter.md", md);
  };

  const copyPlainText = useCallback(() => {
    if (!clContent) return;
    const text = [
      clContent.senderName,
      clContent.senderTitle,
      clContent.date,
      "",
      clContent.recipientName ? `To: ${clContent.recipientName}` : "",
      clContent.companyName ? `Company: ${clContent.companyName}` : "",
      "",
      clContent.subject ? `Re: ${clContent.subject}` : "",
      "",
      clContent.salutation,
      "",
      ...clContent.bodyParagraphs,
      "",
      clContent.closing,
      clContent.senderName,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [clContent]);

  const printPDF = useCallback(() => {
    if (!clContent) return;
    const html = renderCLToHTML(clContent, themeConfig);
    setPrintHtml(html);
    requestAnimationFrame(() => {
      const iframe = printIframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    });
  }, [clContent, themeConfig]);

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
            {isGenerated && clContent && (
              <div className="flex gap-2">
                <Button onClick={copyPlainText} variant="outline" className="gap-2" size="sm">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy text"}
                </Button>
                <Button onClick={exportAsMarkdown} variant="outline" className="gap-2" size="sm">
                  <Download className="w-4 h-4" />
                  Export .md
                </Button>
                <Button onClick={printPDF} className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600" size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><line x1="6" y1="17" x2="6" y2="6"></line><line x1="6" y1="17" x2="18" y2="17"></line></svg>
                  Print / PDF
                </Button>
              </div>
            )}
          </div>

          {isGenerated && clContent && (
            <Card className="p-3 mt-3 bg-muted/50 border-dashed">
              <div className="text-sm font-medium mb-2">Theme Configuration</div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Theme</label>
                  <select
                    value={themeConfig.templateId}
                    onChange={(e) => setThemeConfig(prev => ({ ...prev, templateId: e.target.value as any }))}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="modern">Modern</option>
                    <option value="classic">Classic (Serif)</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Primary Color</label>
                  <input
                    type="color"
                    value={themeConfig.primaryColor}
                    onChange={(e) => setThemeConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-8 h-8 border rounded cursor-pointer p-0"
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 border-r border-border overflow-auto">
          <div className="p-6">
            {error && (
              <Card className="p-3 mb-4 text-sm border-destructive/50 bg-destructive/5">
                <div className="flex items-start gap-2">
                  <pre className="whitespace-pre-wrap font-sans text-destructive flex-1">{error}</pre>
                  {retryableError && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={retry}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {!isGenerated ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Generate Cover Letter</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Company Name (Optional)</label>
                        <Input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g., Google"
                          className="bg-input-background border-border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Position (Optional)</label>
                        <Input
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          placeholder="e.g., Senior Engineer"
                          className="bg-input-background border-border"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Job Description (Optional)</label>
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
                      className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600"
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
              <div className="max-w-4xl mx-auto h-full flex flex-col">
                <div className="flex-1 overflow-auto mb-4">
                  {clContent && (
                    <InteractiveCLPreview
                      content={clContent}
                      onContentChange={setClContent}
                      accentColor={themeConfig.primaryColor}
                    />
                  )}
                </div>
                <iframe
                  ref={printIframeRef}
                  srcDoc={printHtml || "<!DOCTYPE html><html><head></head><body></body></html>"}
                  style={{ position: "absolute", width: 0, height: 0, border: "none" }}
                  title="Print frame"
                />
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
              <p className="text-xs text-muted-foreground mt-1">Request modifications to your cover letter</p>
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
