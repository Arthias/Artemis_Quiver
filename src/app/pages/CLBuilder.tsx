import { useEffect, useState, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Mail, Wand2, Copy, Check } from "lucide-react";
import { useConfig } from "../context/ConfigContext";
import { useProfile } from "../context/ProfileContext";
import { useBuilderHandoff } from "../context/BuilderHandoffContext";
import { generateCoverLetter, editCoverLetter } from "../services/clBuilderService";
import { getActiveEndpoint } from "../services/llmService";
import type { CLContent } from "../../types/cl";
import { CLContentSchema } from "../../types/cl";
import { InteractiveCLPreview } from "../../components/cv/InteractiveCLPreview";
import { getCVTheme } from "../../components/cv/cvThemes";
import { AppError } from "../utils/errors";
import { logAppError } from "../utils/errorLogger";
import { toast } from "sonner";
import { parsePlainTextToCLContent } from "../utils/clParser";
import { useTranslation } from "react-i18next";
import { BuilderAssistantPanel } from "../components/builder/BuilderAssistantPanel";
import { BuilderErrorDisplay } from "../components/builder/BuilderErrorDisplay";
import { ThemeConfigPanel } from "../components/builder/ThemeConfigPanel";

export function CLBuilder() {
  const { t } = useTranslation();
  const { config } = useConfig();
  const { profile } = useProfile();
  const { consumeHandoff } = useBuilderHandoff();

  const CL_SUGGESTIONS = [
    { title: t("cl.suggestionFormal"), hint: t("cl.suggestionFormalHint"), prompt: "Make the tone more formal and professional for a corporate setting." },
    { title: t("cl.suggestionShorter"), hint: t("cl.suggestionShorterHint"), prompt: "Shorten the letter to roughly three concise paragraphs." },
    { title: t("cl.suggestionEnthusiasm"), hint: t("cl.suggestionEnthusiasmHint"), prompt: "Add more enthusiasm while staying professional." },
    { title: t("cl.suggestionLeadership"), hint: t("cl.suggestionLeadershipHint"), prompt: "Emphasize leadership and team management experience." },
    { title: t("cl.suggestionTechStack"), hint: t("cl.suggestionTechStackHint"), prompt: "Highlight relevant technical skills and stack from the profile." },
  ];

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
    templateId: "classic" as const,
    primaryColor: "#1e293b",
    accentColor: "#2563eb",
    textColor: "#475569",
    headingFont: "'Inter', -apple-system, sans-serif",
    bodyFont: "'Inter', -apple-system, sans-serif",
  });

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
      toast.success("Cover letter generated");
    } catch (err) {
      logAppError(err, { phase: "generateCoverLetter" });
      if (err instanceof AppError) {
        setRetryableError(err.retryable ? err : null);
        setError(err.userMessage);
      } else {
        setError(err instanceof Error ? err.message : t("cl.generationFailed"));
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
      setError(err instanceof AppError ? err.userMessage : (err instanceof Error ? err.message : t("cl.applyChangesFailed")));
      setChatMessage(text);
    } finally {
      setChatLoading(false);
    }
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
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }, [clContent]);

  const printPDF = useCallback(() => {
    window.print();
    toast.success("PDF sent to printer");
  }, []);

  return (
    <div className="h-full flex flex-col">
      <style>{`
        @media print {
          @page { size: A4; margin: 0.15in; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body, #root { background: #fff !important; }
          .page-break-before { page-break-before: always; break-before: page; }
          .cl-preview-card { box-shadow: none !important; border: none !important; border-radius: 0 !important; }
          .cl-preview-card .p-8 { padding: 0.25in 0.35in !important; }
          .cl-preview-card .group:hover .opacity-0 { opacity: 0 !important; }
          .cl-preview-card hr { display: none !important; }
          .cl-preview-card .cl-add-paragraph { display: none !important; }
        }
      `}</style>
      <div className="cl-ui-header border-b border-border bg-card print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{t("cl.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("cl.subtitle")}
                </p>
              </div>
            </div>
            {isGenerated && clContent && (
              <div className="flex gap-2">
                <Button onClick={copyPlainText} variant="outline" className="gap-2" size="sm">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? t("cl.copied") : t("cl.copyText")}
                </Button>

                <Button onClick={printPDF} className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600" size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><line x1="6" y1="17" x2="6" y2="6"></line><line x1="6" y1="17" x2="18" y2="17"></line></svg>
                  {t("cl.printPdf")}
                </Button>
              </div>
            )}
          </div>

          {isGenerated && clContent && (
            <div className="cl-ui-theme">
              <ThemeConfigPanel config={themeConfig} onChange={(c) => setThemeConfig(c as any)} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex print:overflow-visible print:h-auto">
        <div className="cl-ui-sidebar flex-1 border-r border-border overflow-auto print:border-r-0 print:overflow-visible">
          <div className="p-6 print:p-0">
            <div className="print:hidden"><BuilderErrorDisplay error={error} retryableError={retryableError} onRetry={generateLetter} /></div>

            {!isGenerated ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">{t("cl.generateCl")}</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">{t("cl.companyName")}</label>
                        <Input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder={t("cl.companyPlaceholder")}
                          className="bg-input-background border-border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">{t("cl.position")}</label>
                        <Input
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          placeholder={t("cl.positionPlaceholder")}
                          className="bg-input-background border-border"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">{t("cl.jobDescription")}</label>
                      <Textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder={t("cl.clPlaceholder")}
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
                          {t("cl.generatingCl")}
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          {t("cl.generateClButton")}
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto h-full flex flex-col print:max-w-none print:mx-0 print:h-auto">
                <div className="flex-1 overflow-auto mb-4 print:overflow-visible print:flex-none print:mb-0">
                  {clContent && (
                    <InteractiveCLPreview
                      content={clContent}
                      onContentChange={setClContent}
                      theme={getCVTheme(themeConfig)}
                    />
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

        {isGenerated && (
          <div className="print:hidden">
            <BuilderAssistantPanel
              suggestions={CL_SUGGESTIONS}
              chatMessage={chatMessage}
              chatLoading={chatLoading}
              onChatMessageChange={setChatMessage}
              onSubmit={handleChatSubmit}
              accentClass="text-blue-600"
              panelBg="bg-muted/20"
            />
          </div>
        )}
      </div>
    </div>
  );
}
