import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Mail, Download, Wand2, Copy, Check } from "lucide-react";
import { useConfig } from "../context/ConfigContext";
import { useProfile } from "../context/ProfileContext";
import { useBuilderHandoff } from "../context/BuilderHandoffContext";
import { generateCoverLetter, editCoverLetter } from "../services/clBuilderService";
import { getActiveEndpoint } from "../services/llmService";
import type { CLContent } from "../../types/cl";
import { CLContentSchema } from "../../types/cl";
import { renderCLToHTML } from "../../components/cv/renderingEngine";
import { InteractiveCLPreview } from "../../components/cv/InteractiveCLPreview";
import { downloadMarkdown } from "../utils/download";
import { AppError } from "../utils/errors";
import { logAppError } from "../utils/errorLogger";
import { parsePlainTextToCLContent } from "../utils/clParser";
import { BuilderAssistantPanel } from "../components/builder/BuilderAssistantPanel";
import { BuilderErrorDisplay } from "../components/builder/BuilderErrorDisplay";
import { ThemeConfigPanel } from "../components/builder/ThemeConfigPanel";

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
    templateId: "modern" as const,
  });
  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const [printHtml, setPrintHtml] = useState("");

  useEffect(() => {
    if (!printHtml) return;
    const timer = setTimeout(() => {
      printIframeRef.current?.contentWindow?.focus();
      printIframeRef.current?.contentWindow?.print();
    }, 500);
    return () => clearTimeout(timer);
  }, [printHtml]);

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
        getActiveEndpoint(config)
      );
      const parsed = JSON.parse(content) as CLContent;
      const validated = CLContentSchema.parse(parsed);
      setClContent(validated);
      setIsGenerated(true);
      window.scrollTo(0, 0);
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

  const handleChatSubmit = async (message?: string) => {
    const text = (message ?? chatMessage).trim();
    if (!text || chatLoading || !clContent) return;
    setChatLoading(true);
    setError(null);
    setChatMessage("");
    try {
      const currentJson = JSON.stringify(clContent);
      const updated = await editCoverLetter(currentJson, text, profile, getActiveEndpoint(config));
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
            <ThemeConfigPanel config={themeConfig} onChange={(c) => setThemeConfig(c as any)} />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 border-r border-border overflow-auto">
          <div className="p-6">
            <BuilderErrorDisplay error={error} retryableError={retryableError} onRetry={generateLetter} />

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
                      templateId={themeConfig.templateId}
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
          <BuilderAssistantPanel
            suggestions={CL_SUGGESTIONS}
            chatMessage={chatMessage}
            chatLoading={chatLoading}
            onChatMessageChange={setChatMessage}
            onSubmit={handleChatSubmit}
            accentClass="text-blue-600"
            panelBg="bg-muted/20"
          />
        )}
      </div>
    </div>
  );
}
