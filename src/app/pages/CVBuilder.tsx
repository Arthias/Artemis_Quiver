import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { FileText, Download, Wand2, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useConfig } from "../context/ConfigContext";
import { useProfile } from "../context/ProfileContext";
import { useBuilderHandoff } from "../context/BuilderHandoffContext";
import { generateCv } from "../services/cvBuilderService";
import { getActiveEndpoint } from "../services/llmService";
import type { CVContent, ThemeConfig } from "../types/cv";
import { renderCVToHTML } from "../../components/cv/renderingEngine";
import { InteractiveCVPreview } from "../../components/cv/InteractiveCVPreview";
import { extractJsonObject } from "../utils/jsonParse";
import { AppError } from "../utils/errors";
import { logAppError } from "../utils/errorLogger";
import { BuilderAssistantPanel } from "../components/builder/BuilderAssistantPanel";
import { BuilderErrorDisplay } from "../components/builder/BuilderErrorDisplay";
import { ThemeConfigPanel } from "../components/builder/ThemeConfigPanel";

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
  const [jobDescExpanded, setJobDescExpanded] = useState(true);
  const [cvContent, setCvContent] = useState<CVContent | null>(null);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({ primaryColor: "#2563eb", templateId: "modern" });
  const [recs, setRecs] = useState<{ text: string; enabled: boolean; comment: string }[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryableError, setRetryableError] = useState<AppError | null>(null);

  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const [printHtml, setPrintHtml] = useState("");
  const printPendingRef = useRef(false);

  useEffect(() => {
    const handoff = consumeHandoff();
    if (!handoff) return;
    if (handoff.jobPosting) {
      setJobDescription(handoff.jobPosting);
      setJobDescExpanded(false);
    }
    if (handoff.cvRecommendations?.length) {
      setRecs(handoff.cvRecommendations.map((t) => ({ text: t, enabled: true, comment: "" })));
    }
  }, [consumeHandoff]);

  const generateCV = async () => {
    setGenerating(true);
    setError(null);
    try {
      const activeRecs = recs
        .filter((r) => r.enabled)
        .map((r) => (r.comment ? `${r.text}\nAdditional context: ${r.comment}` : r.text));
      const content = await generateCv(
        profile,
        jobDescription || undefined,
        activeRecs.length > 0 ? activeRecs : undefined,
        getActiveEndpoint(config)
      );
      let parsedContent: CVContent;
      try {
        parsedContent = extractJsonObject(content) as CVContent;
      } catch (parseError) {
        throw new Error("Invalid JSON structure generated. Please check console for details.");
      }
      setCvContent(parsedContent);
      setIsGenerated(true);
      window.scrollTo(0, 0);
    } catch (err) {
      logAppError(err, { phase: "generateCV" });
      if (err instanceof AppError) {
        setError(err.userMessage);
        setRetryableError(err.retryable ? err : null);
      } else {
        setError(err instanceof Error ? err.message : "CV generation failed.");
        setRetryableError(null);
      }
    } finally {
      setGenerating(false);
    }
  };

  const downloadMarkdownExport = () => {
    if (!cvContent) return;
    const mdSections: string[] = [];
    cvContent.sections.forEach(section => {
      switch (section.type) {
        case "summary":
          mdSections.push(`## ${section.content || ""}`);
          break;
        case "contact":
          let contactLine = "";
          if (section.email) contactLine += ` Email: ${section.email}   `;
          if (section.phone) contactLine += ` Phone: ${section.phone}   `;
          contactLine.trim();
          mdSections.push(`## Contact${contactLine}`);
          break;
        case "skills":
          const skills = section.skills?.join("   ") || "";
          mdSections.push(`## Skills\n${skills || ""}`);
          break;
        case "experience": {
          mdSections.push(`## Experience`);
          section.experience?.forEach(exp => {
            mdSections.push(`- ${exp.role} at ${exp.company} (${exp.period})`);
            if (exp.description) mdSections.push(`  ${exp.description}`);
          });
          break;
        }
        case "education": {
          mdSections.push(`## Education`);
          section.education?.forEach(edu => {
            mdSections.push(`${edu.degree} • ${edu.institution} (${edu.period})`);
          });
          break;
        }
        case "certifications":
          const certs = section.certifications?.join(" | ") || "";
          mdSections.push(`## Certifications\n${certs || ""}`);
          break;
      }
    });
    const blob = new Blob([mdSections.join("\n\n")], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "cv.md";
    link.click();
  };

  const handleChatSubmit = async (message?: string) => {
    const text = (message ?? chatMessage).trim();
    if (!text || chatLoading) return;
    setChatLoading(true);
    setError(null);
    setChatMessage("");
    try {
      await generateCV();
    } catch (err) {
      setError(err instanceof AppError ? err.message : (err instanceof Error ? err.message : "Could not apply changes."));
      setChatMessage(text);
    } finally {
      setChatLoading(false);
    }
  };

  const handleIframeLoad = useCallback(() => {
    if (printPendingRef.current && printIframeRef.current?.contentWindow) {
      printPendingRef.current = false;
      printIframeRef.current.contentWindow.focus();
      printIframeRef.current.contentWindow.print();
    }
  }, []);

  const printPDF = useCallback(() => {
    if (!cvContent) return;
    const html = renderCVToHTML(cvContent, themeConfig);
    printPendingRef.current = true;
    setPrintHtml(html);
  }, [cvContent, themeConfig]);

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
                <h1 className="text-xl font-semibold">CV Builder (Themed PDF)</h1>
                <p className="text-sm text-muted-foreground">
                  Generate structured CV with themed HTML rendering and PDF export
                </p>
              </div>
            </div>
            {isGenerated && cvContent && (
              <div className="flex gap-2">
                <Button onClick={printPDF} className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><line x1="6" y1="17" x2="6" y2="6"></line><line x1="6" y1="17" x2="18" y2="17"></line></svg>
                  Export PDF
                </Button>
                <Button onClick={downloadMarkdownExport} className="gap-2" variant="outline">
                  <Download className="w-4 h-4" />
                  Export .md (Legacy)
                </Button>
              </div>
            )}
          </div>

          {isGenerated && cvContent && (
            <ThemeConfigPanel config={themeConfig} onChange={(c) => setThemeConfig(c as any)} />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 border-r border-border overflow-auto">
          <div className="p-6">
            <BuilderErrorDisplay error={error} retryableError={retryableError} onRetry={generateCV} />

            {!isGenerated ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Generate Tailored CV</h2>
                  <div className="space-y-4">
                    <div>
                      <button
                        type="button"
                        onClick={() => setJobDescExpanded(!jobDescExpanded)}
                        className="flex items-center gap-2 text-sm font-medium mb-2 hover:text-foreground/80"
                      >
                        {jobDescExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        Job Description
                        {jobDescription ? <span className="text-xs text-muted-foreground font-normal">(pre-filled from analysis)</span> : <span className="text-xs text-muted-foreground font-normal">(Optional)</span>}
                      </button>
                      {jobDescExpanded && (
                        <Textarea
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
                          placeholder="Paste job description to tailor your CV, or leave empty for a general CV..."
                          rows={4}
                          className="w-full bg-input-background border-border resize-none"
                        />
                      )}
                    </div>

                    {recs.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium mb-1">CV Optimization</label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Select which recommendations to apply. Add context about your experience for each.
                        </p>
                        <div className="space-y-3">
                          {recs.map((rec, idx) => (
                            <div key={idx} className="border border-border rounded-lg p-3">
                              <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={rec.enabled}
                                  onChange={() => setRecs((prev) => prev.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r))}
                                  className="mt-0.5 accent-blue-600"
                                />
                                <span className={`text-sm ${rec.enabled ? "" : "text-muted-foreground line-through"}`}>
                                  {rec.text}
                                </span>
                              </label>
                              {rec.enabled && (
                                <Textarea
                                  value={rec.comment}
                                  onChange={(e) => setRecs((prev) => prev.map((r, i) => i === idx ? { ...r, comment: e.target.value } : r))}
                                  placeholder="Add context about your relevant experience..."
                                  rows={2}
                                  className="w-full bg-input-background border-border resize-none mt-2 text-sm"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={generateCV}
                      disabled={generating}
                      className="w-full gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
                      size="lg"
                    >
                      {generating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating structured JSON CV...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          Generate CV with Themed HTML Rendering
                        </>
                      )}
                    </Button>

                    {jobDescription && (
                      <p className="text-xs text-muted-foreground">Tips: Paste a job description to tailor your CV and highlight relevant experience. For general CV, leave it empty.</p>
                    )}
                  </div>
                </Card>

                <Card className="p-6 bg-muted/50 border-dashed">
                  <h3 className="font-medium mb-3 text-sm">How to Use</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">1</Badge><span>Paste a job description (optional) or leave it empty for general CV.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">2</Badge><span>Click "Generate CV" to create structured JSON with AI assistant.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">3</Badge><span>Use chat panel to request modifications after generation.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">4</Badge><span>Export as PDF or Markdown when ready.</span>
                    </li>
                  </ul>
                </Card>
              </div>

            ) : (
              <div className="max-w-4xl mx-auto h-full flex flex-col">
                <div className={`flex-1 overflow-auto mb-4 ${generating ? "animate-pulse" : ""}`}>
                  {!cvContent ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      <p>Generate a CV to see the preview</p>
                    </div>
                  ) : error ? (
                    <Card className="p-4 bg-destructive/10 border-destructive/50">
                      <p className="text-sm text-destructive">Unable to render CV. Please refresh and try again.</p>
                    </Card>
                  ) : (
                    <InteractiveCVPreview
                      content={cvContent}
                      onContentChange={setCvContent}
                      accentColor={themeConfig.primaryColor}
                      templateId={themeConfig.templateId}
                    />
                  )}
                </div>

                <iframe
                  ref={printIframeRef}
                  srcDoc={printHtml || "<!DOCTYPE html><html><head></head><body></body></html>"}
                  onLoad={handleIframeLoad}
                  style={{ position: "absolute", width: 0, height: 0, border: "none" }}
                  title="Print frame"
                />
              </div>
            )}
          </div>
        </div>

        {isGenerated && (
          <BuilderAssistantPanel
            suggestions={CV_SUGGESTIONS}
            chatMessage={chatMessage}
            chatLoading={chatLoading}
            onChatMessageChange={setChatMessage}
            onSubmit={handleChatSubmit}
            accentClass="text-purple-500"
            panelBg="bg-muted/30"
          />
        )}
      </div>
    </div>
  );
}
