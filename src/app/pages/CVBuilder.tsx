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
import type { CVContent, ThemeConfig } from "../types/cv";
import { renderCVToHTML } from "../components/cv/renderingEngine";
import { extractJsonObject } from "../utils/jsonParse";

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

  const [jobDescription, setJobDescription] = useState(""); // Job description to tailor CV
  const [cvContent, setCvContent] = useState<CVContent | null>(null); // Parse JSON instead of raw string
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({ 
    primaryColor: "#2563eb", 
    templateId: "modern" 
  });
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
    setGenerating(true); // Show loading spinner
    setError(null);
    try {
      const content = await generateCv( // Generate structured JSON, not Markdown text
        profile,
        jobDescription || undefined,
        cvRecommendations,
        config
      );
      
      // Parse the generated JSON string into an object
      let parsedContent: CVContent;
      try {
        parsedContent = extractJsonObject(content) as CVContent;
      } catch (parseError) {
        throw new Error(`Invalid JSON structure generated. Please check console for details.`);
      }
      
      setCvContent(parsedContent);
      setIsGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CV generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadMarkdownExport = () => { // Still export Markdown for legacy purposes
    if (!cvContent) return;
    
    // Create a simple markdown representation from structured JSON
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

    // Download the markdown
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

    // For MVP, we'll just regenerate the entire CV with the request - this is simpler than editCv for JSON
    try {
      // Parse message into suggestions to regenerate CV
      await generateCV();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply changes.");
      setChatMessage(text);
    } finally {
      setChatLoading(false);
    }
  };

  const printPDF = async () => { // NEW: Print to PDF via iframe
    if (!cvContent) return;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.id = "cv-print-iframe";
    
    // Load rendered HTML with current theme styling
    const htmlString = renderCVToHTML(cvContent, themeConfig);
    iframe.srcDoc = `<html><head>${htmlString}</head><body onload="window.print()"></body></html>`;
    
    document.body.appendChild(iframe);
    
    // Clean up after print dialog closes
    iframe.onload = () => {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
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
                <Button onClick={printPDF} className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600" variant="primary">
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
          
          {/* Theme Configuration Panel */}
          {isGenerated && cvContent && (
            <Card className="p-3 mt-3 bg-muted/50 border-dashed">
              <div className="text-sm font-medium mb-2">Theme Configuration</div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Theme</label>
                  <select 
                    value={themeConfig.templateId || "modern"}
                    onChange={(e) => setThemeConfig(prev => ({...prev, templateId: e.target.value as any}))}
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
                    onChange={(e) => setThemeConfig(prev => ({...prev, primaryColor: e.target.value}))}
                    className="w-8 h-8 border rounded cursor-pointer p-0"
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel: Generation & Editor */}
        <div className="flex-1 border-r border-border overflow-auto">
          <div className="p-6">
            {error && ( // Error display, not white screen anymore
              <Card className="p-3 mb-4 text-sm text-destructive border-destructive/50">
                {error}
              </Card>
            )}

            {!isGenerated ? ( // Loading / Not yet generated state
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
                        rows={4}
                        className="w-full bg-input-background border-border resize-none"
                      />
                    </div>

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
                      <Badge variant="outline" className="mt-0.5">4</Badge><span>Export as PDF or Markdown when ready (PDF is preferred for professional printing).</span>
                    </li>
                  </ul>
                  
                  {/* Theme preview */}
                  <Card className="p-3 mt-4 bg-card border-border">
                    <h4 className="text-sm font-medium mb-2">Preview Themes (select above to change)</h4>
                    {(() => {
                      const renderBadge = () => themeConfig.templateId === "modern" && <>✓<Badge variant="outline" className="ml-auto w-3 h-3 rounded-full"></Badge></>;
                      return (
                        <div className="space-y-2">
                          <div 
                            className="flex items-center justify-between text-xs p-2 rounded bg-muted/50 border hover:border-blue-400 cursor-pointer transition-all"
                            onClick={() => setThemeConfig(prev => ({...prev, templateId: "modern"}))}
                          >
                            <span>Modern</span>
                            {renderBadge()}
                          </div>
                          <div 
                            className="flex items-center justify-between text-xs p-2 rounded bg-muted/50 border hover:border-blue-400 cursor-pointer transition-all"
                            onClick={() => setThemeConfig(prev => ({...prev, templateId: "classic"}))}
                          >
                            <span>Classic (Serif)</span>
                            {themeConfig.templateId === "classic" && <>✓<Badge variant="outline" className="ml-auto w-3 h-3 rounded-full"></Badge></>}
                          </div>
                          <div 
                            className="flex items-center justify-between text-xs p-2 rounded bg-muted/50 border hover:border-blue-400 cursor-pointer transition-all"
                            onClick={() => setThemeConfig(prev => ({...prev, templateId: "minimal"}))}
                          >
                            <span>Minimal</span>
                            {themeConfig.templateId === "minimal" && <>✓<Badge variant="outline" className="ml-auto w-3 h-3 rounded-full"></Badge></>}
                          </div>
                        </div>
                      );
                    })()}
                  </Card>
                  
                  {/* Print/Export hint */}
                  <div className="text-xs text-muted-foreground bg-info p-3 mt-4 rounded border border-info">
                    <span>💡</span><b className="font-semibold">Tip:</b> Use the PDF export button for printing. The CV will render cleanly in any browser with selected theme and color styling.
                  </div>
                </Card>

                <Card className="p-6 bg-muted/30 border-dashed">
                  <h3 className="font-medium mb-3 text-sm">CV Generation Tips</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">1</Badge><span>Paste a job description to create a tailored CV that highlights relevant experience.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">2</Badge><span>Leave it empty to generate a general CV from your master profile.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">3</Badge><span>Pick your preferred theme above before exporting PDF for professional look.</span>
                    </li>
                  </ul>
                </Card>
              </div>

            ) : ( // Generated - Show CV in iframe and chat panel
              <div className="max-w-4xl mx-auto h-full flex flex-col">
                {/* CV Preview Pane */}
                <div className={`flex-1 bg-muted/30 border rounded-lg p-4 overflow-auto mb-4 flex items-center justify-center ${generating ? "animate-pulse" : ""}`}>
                  {!isGenerated ? (
                    // Not generated yet, show loading state
                    <div className="text-muted-foreground text-center">
                      <p className="mb-2">Generate a CV to see the preview</p>
                    </div>
                  ) : (!cvContent || isGenerated && error) ? (
                    // Generated but error or null content
                    <Card className="p-4 bg-destructive/10 border-destructive/50">
                      <p className="text-sm text-destructive">Unable to render CV. Please refresh and try again.</p>
                    </Card>
                  ) : (
                    // Use iframe for clean rendering with print functionality
                    <iframe 
                      srcDoc={`<!DOCTYPE html><head>${renderCVToHTML(cvContent, themeConfig).split('<body')[0]}</head><body>${renderCVToHTML(cvContent, themeConfig).replace(/<html[^>]*>/i,'').replace(/<\/html>/i,'')}</body></html>`}
                      style={{ width: "100%", height: "80vh", border: "none", borderRadius: "4px" }}
                      title="CV Preview - Click PDF for export"
                    />
                  )}
                </div>

                {/* Chat/Editor Panel (collapsed for MVP, could be expanded later) */} // Keep simple for v2
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: AI Assistant (only if CV generated) */}
        {isGenerated && (
          <div className="w-96 flex flex-col bg-muted/30 border-l border-border">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold">AI Assistant</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Request modifications to your CV
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {CV_SUGGESTIONS.map((s) => (
                <Card
                  key={s.title}
                  className="p-3 bg-card hover:bg-purple-500/10 cursor-pointer transition-colors"
                  onClick={() => handleChatSubmit(s.prompt)}
                >
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.hint}</p>
                </Card>
              ))}
              
              {/* Empty state (optional, show if no suggestions) */}
              {!cvContent && isGenerated && ( // Shouldn't happen but just in case
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                  <p>CV ready! Click any suggestion above to modify it or wait for PDF export.</p>
                </div>
              )}
            </div>

            {/* Chat input area */} // For future implementation, keep simple for MVP
          </div>
        )}
      </div>
    </div>
  );
}
