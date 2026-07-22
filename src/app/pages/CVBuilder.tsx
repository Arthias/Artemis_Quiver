import { useEffect, useState, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { FileText, Wand2, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useConfig } from "../context/ConfigContext";
import { useProfile } from "../context/ProfileContext";
import { useBuilderHandoff } from "../context/BuilderHandoffContext";
import { generateCv } from "../services/cvBuilderService";
import { getActiveEndpoint } from "../services/llmService";
import type { CVContent } from "../types/cv";
import type { ThemeConfig } from "../components/builder/ThemeConfigPanel";
import { InteractiveCVPreview } from "../../components/cv/InteractiveCVPreview";
import { getCVTheme } from "../../components/cv/cvThemes";
import { extractJsonObject } from "../utils/jsonParse";
import { AppError } from "../utils/errors";
import { logAppError } from "../utils/errorLogger";
import { useTranslation } from "react-i18next";
import { BuilderAssistantPanel } from "../components/builder/BuilderAssistantPanel";
import { BuilderErrorDisplay } from "../components/builder/BuilderErrorDisplay";
import { ThemeConfigPanel } from "../components/builder/ThemeConfigPanel";

export function CVBuilder() {
  const { t } = useTranslation();
  const { config } = useConfig();
  const { profile } = useProfile();
  const { consumeHandoff } = useBuilderHandoff();

  const CV_SUGGESTIONS = [
    { title: t("cv.suggestionMetrics"), hint: t("cv.suggestionMetricsHint"), prompt: "Add more quantifiable metrics and measurable achievements throughout the CV." },
    { title: t("cv.suggestionShorten"), hint: t("cv.suggestionShortenHint"), prompt: "Make the experience section more concise while keeping the strongest points." },
    { title: t("cv.suggestionReorder"), hint: t("cv.suggestionReorderHint"), prompt: "Reorder sections to prioritize the most relevant experience for the target role." },
    { title: t("cv.suggestionFormatting"), hint: t("cv.suggestionFormattingHint"), prompt: "Improve formatting and structure for clarity and scannability." },
  ];

  const [jobDescription, setJobDescription] = useState("");
  const [jobDescExpanded, setJobDescExpanded] = useState(true);
  const [cvContent, setCvContent] = useState<CVContent | null>(null);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
    primaryColor: "#1e293b",
    accentColor: "#2563eb",
    textColor: "#475569",
    headingFont: "'Inter', -apple-system, sans-serif",
    bodyFont: "'Inter', -apple-system, sans-serif",
  });
  const [recs, setRecs] = useState<{ text: string; enabled: boolean; comment: string }[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryableError, setRetryableError] = useState<AppError | null>(null);

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
        throw new Error(t("cv.parseError"));
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
        setError(err instanceof Error ? err.message : t("cv.generationFailed"));
        setRetryableError(null);
      }
    } finally {
      setGenerating(false);
    }
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
      setError(err instanceof AppError ? err.message : (err instanceof Error ? err.message : t("cv.applyChangesFailed")));
      setChatMessage(text);
    } finally {
      setChatLoading(false);
    }
  };

  const printPDF = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <style>{`
        @media print {
          @page { size: A4; margin: 0.15in; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body, #root { background: #fff !important; }
          .cv-preview-card { box-shadow: none !important; border: none !important; border-radius: 0 !important; }
          .cv-preview-card .p-8 { padding: 0.25in 0.35in !important; }
          .cv-preview-card .group:hover .opacity-0 { opacity: 0 !important; }
          .cv-preview-card .group:hover .bg-gray-50 { background: transparent !important; }
          .cv-preview-card .page-keep { page-break-inside: avoid; break-inside: avoid; }
          .cv-preview-card .page-break-before { page-break-before: always; break-before: page; }
        }
      `}</style>
      <div className="border-b border-border bg-card print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{t("cv.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("cv.subtitle")}
                </p>
              </div>
            </div>
            {isGenerated && cvContent && (
              <div className="flex gap-2">
                <Button onClick={printPDF} className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">                  <polyline points="6 9 6 2 18 2 18 9"></polyline><line x1="6" y1="17" x2="6" y2="6"></line><line x1="6" y1="17" x2="18" y2="17"></line></svg>
                  {t("cv.exportPdf")}
                </Button>

              </div>
            )}
          </div>

          {isGenerated && cvContent && (
            <ThemeConfigPanel config={themeConfig} onChange={(c) => setThemeConfig(c as any)} />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex print:overflow-visible print:h-auto">
        <div className="flex-1 border-r border-border overflow-auto print:border-r-0 print:overflow-visible">
          <div className="p-6 print:p-0">
            <div className="print:hidden"><BuilderErrorDisplay error={error} retryableError={retryableError} onRetry={generateCV} /></div>

            {!isGenerated ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">{t("cv.generateCv")}</h2>
                  <div className="space-y-4">
                    <div>
                      <button
                        type="button"
                        onClick={() => setJobDescExpanded(!jobDescExpanded)}
                        className="flex items-center gap-2 text-sm font-medium mb-2 hover:text-foreground/80"
                      >
                        {jobDescExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {t("cv.jobDescription")}
                        {jobDescription ? <span className="text-xs text-muted-foreground font-normal">{t("cv.prefilledFromAnalysis")}</span> : <span className="text-xs text-muted-foreground font-normal">{t("cv.optional")}</span>}
                      </button>
                      {jobDescExpanded && (
                        <Textarea
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
                          placeholder={t("cv.cvPlaceholder")}
                          rows={4}
                          className="w-full bg-input-background border-border resize-none"
                        />
                      )}
                    </div>

                    {recs.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium mb-1">{t("cv.cvOptimization")}</label>
                        <p className="text-xs text-muted-foreground mb-3">
                          {t("cv.recSelectDesc")}
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
                                  placeholder={t("cv.addContextPlaceholder")}
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
                          {t("cv.generatingCv")}
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          {t("cv.generateCvButton")}
                        </>
                      )}
                    </Button>

                    {jobDescription && (
                      <p className="text-xs text-muted-foreground">{t("cv.tips")}</p>
                    )}
                  </div>
                </Card>

                <Card className="p-6 bg-muted/50 border-dashed">
                  <h3 className="font-medium mb-3 text-sm">{t("cv.howToUse")}</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">1</Badge><span>{t("cv.howToUse1")}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">2</Badge><span>{t("cv.howToUse2")}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">3</Badge><span>{t("cv.howToUse3")}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">4</Badge><span>{t("cv.howToUse4")}</span>
                    </li>
                  </ul>
                </Card>
              </div>

            ) : (
              <div className="max-w-4xl mx-auto h-full flex flex-col print:max-w-none print:mx-0 print:h-auto">
                <div className={`flex-1 overflow-auto mb-4 print:overflow-visible print:flex-none print:mb-0 ${generating ? "animate-pulse print:animate-none" : ""}`}>
                  {!cvContent ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground print:hidden">
                      <p>{t("cv.previewEmpty")}</p>
                    </div>
                  ) : error ? (
                    <Card className="p-4 bg-destructive/10 border-destructive/50 print:hidden">
                      <p className="text-sm text-destructive">{t("cv.renderFailed")}</p>
                    </Card>
                  ) : (
                    <InteractiveCVPreview
                      content={cvContent}
                      onContentChange={setCvContent}
                      theme={getCVTheme(themeConfig)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {isGenerated && (
          <div className="print:hidden"><BuilderAssistantPanel
            suggestions={CV_SUGGESTIONS}
            chatMessage={chatMessage}
            chatLoading={chatLoading}
            onChatMessageChange={setChatMessage}
            onSubmit={handleChatSubmit}
            accentClass="text-purple-500"
            panelBg="bg-muted/30"
          /></div>
        )}
      </div>
    </div>
  );
}
