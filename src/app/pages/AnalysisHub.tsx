import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Sparkles,
  TrendingUp,
  FileText,
  Mail,
  ArrowRight,
  Download,
  AlertCircle,
  User,
  ChevronDown,
  ChevronRight,
  Send,
  MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useAnalysis } from "../context/AnalysisContext";
import { useBuilderHandoff } from "../context/BuilderHandoffContext";
import { useExtensionBridge } from "../context/ExtensionBridgeContext";

function matchLabel(score: number): string {
  if (score >= 80) return "Strong Match";
  if (score >= 60) return "Good Match";
  if (score >= 40) return "Moderate Match";
  return "Stretch Role";
}

export function AnalysisHub() {
  const navigate = useNavigate();
  const {
    draftJobPosting,
    setDraftJobPosting,
    currentResult,
    analyzing,
    error,
    analyze,
    clearCurrent,
    exportCurrentAnalysis,
    activeSessionId,
    followUpMessages,
    followUpLoading,
    sendFollowUpMessage,
  } = useAnalysis();
  const { setHandoff } = useBuilderHandoff();

  const hasResult = currentResult !== null;
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [followUpInput, setFollowUpInput] = useState("");

  const followUpSuggestions = [
    'Why do you want to work at this company?',
    'What are the top 3 skills I should highlight in an interview?',
    'Draft a follow-up thank-you email after applying',
    'What questions should I ask the interviewer?',
    'Summarize the company culture from this posting',
  ];

  const handleFollowUpSubmit = async () => {
    const text = followUpInput.trim();
    if (!text || followUpLoading) return;
    setFollowUpInput("");
    await sendFollowUpMessage(text);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Job Analysis</h1>
              <p className="text-sm text-muted-foreground">
                Analyze postings against your saved profile via local LLM
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">


          {!hasResult ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Job Posting</label>
                <Textarea
                  value={draftJobPosting}
                  onChange={(e) => setDraftJobPosting(e.target.value)}
                  placeholder="Paste the full job description here..."
                  className="min-h-[300px] resize-none bg-input-background border-border"
                />
              </div>

              {error && (
                <Card className="p-4 border-destructive/50 bg-destructive/5">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Analysis failed</p>
                      <p className="mt-1 text-destructive/90">{error}</p>
                      <p className="mt-2 text-muted-foreground">
                        Check Settings → Test connection. Ensure LMStudio is running with model{" "}
                        <code className="text-xs">google/gemma-4-e2b</code>.
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => analyze()}
                  disabled={!draftJobPosting.trim() || analyzing}
                  className="gap-2"
                  size="lg"
                >
                  {analyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyze Job Posting
                    </>
                  )}
                </Button>
              </div>

              <Card className="p-6 bg-muted/30 border-dashed">
                <h3 className="font-medium mb-2">What happens next?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Your saved profile is sent to the local LLM configured in Settings.</li>
                  <li>Results are stored in the browser and exported as Markdown.</li>
                  <li>First run: open Settings and run Test connection before analyzing.</li>
                </ul>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="p-4">
                <button
                  type="button"
                  onClick={() => setPromptExpanded(!promptExpanded)}
                  className="w-full flex items-center gap-2 text-left"
                >
                  {promptExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium">Analyzed Job Posting</span>
                </button>
                <div
                  className={`overflow-auto transition-all ${
                    promptExpanded ? "max-h-[500px] mt-3" : "max-h-20 mt-3"
                  }`}
                >
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 rounded p-3">
                    {draftJobPosting}
                  </pre>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="text-lg font-semibold">Match Analysis</h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={exportCurrentAnalysis}
                    >
                      <Download className="w-4 h-4" />
                      Export .md
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearCurrent}>
                      New Analysis
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-muted"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        strokeDashoffset={`${2 * Math.PI * 56 * (1 - result.score / 100)}`}
                        className="text-blue-500 transition-all duration-1000"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-3xl font-bold">{result.score}%</span>
                      <span className="text-xs text-muted-foreground">Match</span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <Badge className="mb-2" variant="secondary">
                      {matchLabel(result.score)}
                    </Badge>
                    <p className="text-muted-foreground mb-3">
                      {result.summary ??
                        "Your profile has been compared against this job posting."}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="font-medium">Salary Range:</span>
                      <span className="text-muted-foreground">{result.salaryRange}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Interview Preparation Tips</h2>
                <ul className="space-y-3">
                  {result.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-blue-600">{idx + 1}</span>
                      </div>
                      <span className="text-muted-foreground">{tip}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">CV Optimization</h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        navigate("/profile");
                      }}
                    >
                      <User className="w-4 h-4" />
                      Edit Profile
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setHandoff({
                          jobPosting: draftJobPosting,
                          cvRecommendations: result.cvRecommendations,
                          sourceSessionId: activeSessionId ?? undefined,
                          autoGenerate: true,
                        });
                        navigate("/cv-builder");
                      }}
                    >
                      <FileText className="w-4 h-4" />
                      Generate CV with Recommendations
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <ul className="space-y-3">
                  {result.cvRecommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-3 h-3 text-purple-600" />
                      </div>
                      <span className="text-muted-foreground">{rec}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Cover Letter Draft</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setHandoff({
                        jobPosting: draftJobPosting,
                        coverLetterDraft: result.coverLetterDraft,
                        sourceSessionId: activeSessionId ?? undefined,
                      });
                      navigate("/cl-builder");
                    }}
                  >
                    <Mail className="w-4 h-4" />
                    Edit in Builder
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans">
                    {result.coverLetterDraft}
                  </pre>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold">Follow-up Questions</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask follow-up questions about this job posting, practice interview answers, or generate side content.
                </p>

                <div className="space-y-3 mb-4">
                  <p className="text-xs text-muted-foreground font-medium">Quick questions</p>
                  <div className="flex flex-wrap gap-2">
                    {followUpSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={followUpLoading}
                        onClick={() => {
                          setFollowUpInput(suggestion);
                        }}
                        className="text-xs bg-muted/50 hover:bg-muted border border-border rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-border rounded-lg bg-card mb-4 max-h-[400px] overflow-y-auto">
                  {followUpMessages.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>No follow-up questions yet. Pick a suggestion above or type your own.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {followUpMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-4 ${msg.role === "user" ? "bg-muted/20" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                msg.role === "user"
                                  ? "bg-blue-500/10"
                                  : "bg-purple-500/10"
                              }`}
                            >
                              <span
                                className={`text-xs font-medium ${
                                  msg.role === "user"
                                    ? "text-blue-600"
                                    : "text-purple-600"
                                }`}
                              >
                                {msg.role === "user" ? "U" : "A"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-1">
                                {msg.role === "user" ? "You" : "Assistant"}
                              </p>
                              <pre className="whitespace-pre-wrap text-sm font-sans text-foreground">
                                {msg.content}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                      {followUpLoading && (
                        <div className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                              <div className="w-3 h-3 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
                            </div>
                            <span className="text-sm text-muted-foreground">Thinking...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleFollowUpSubmit();
                      }
                    }}
                    placeholder="Ask a follow-up question..."
                    className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-input-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    disabled={followUpLoading}
                  />
                  <Button
                    onClick={handleFollowUpSubmit}
                    disabled={!followUpInput.trim() || followUpLoading}
                    size="sm"
                    className="gap-1"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
