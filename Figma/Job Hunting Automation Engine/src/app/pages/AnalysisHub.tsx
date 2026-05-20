import { useState } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Sparkles, TrendingUp, FileText, Mail, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";

interface AnalysisResult {
  score: number;
  salaryRange: string;
  tips: string[];
  cvRecommendations: string[];
  coverLetterDraft: string;
}

export function AnalysisHub() {
  const [jobPosting, setJobPosting] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const navigate = useNavigate();

  const analyzeJob = async () => {
    setAnalyzing(true);

    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 2000));

    setResult({
      score: 87,
      salaryRange: "$120,000 - $160,000",
      tips: [
        "Highlight your experience with distributed systems",
        "Emphasize leadership in cross-functional teams",
        "Mention specific scalability projects you've worked on"
      ],
      cvRecommendations: [
        "Add metrics to your recent projects (e.g., 'Improved performance by 40%')",
        "Expand on your AWS/cloud infrastructure experience",
        "Include certifications section if you have relevant ones"
      ],
      coverLetterDraft: "Dear Hiring Manager,\n\nI am excited to apply for the Senior Software Engineer position. With over 8 years of experience building scalable distributed systems, I am confident in my ability to contribute to your team's mission of delivering high-performance solutions.\n\nMy recent work on a microservices architecture serving 10M+ users aligns perfectly with your requirements for someone who can design and implement robust backend systems. I'm particularly drawn to your company's commitment to innovation and technical excellence.\n\nI look forward to discussing how my background in cloud infrastructure and team leadership can help drive your engineering goals forward.\n\nBest regards"
    });

    setAnalyzing(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Job Analysis</h1>
              <p className="text-sm text-muted-foreground">
                Paste a job posting to get instant insights and recommendations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {!result ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Job Posting
                </label>
                <Textarea
                  value={jobPosting}
                  onChange={(e) => setJobPosting(e.target.value)}
                  placeholder="Paste the full job description here..."
                  className="min-h-[300px] resize-none bg-input-background border-border"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={analyzeJob}
                  disabled={!jobPosting.trim() || analyzing}
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

              {/* Empty state guide */}
              <Card className="p-6 bg-muted/30 border-dashed">
                <h3 className="font-medium mb-2">What happens next?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-blue-600">1</span>
                    </div>
                    <span>AI analyzes the job requirements and matches them against your profile</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-blue-600">2</span>
                    </div>
                    <span>Get a match score, salary insights, and interview preparation tips</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-blue-600">3</span>
                    </div>
                    <span>Receive tailored CV recommendations and a draft cover letter</span>
                  </li>
                </ul>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Match Score */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Match Analysis</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResult(null);
                      setJobPosting("");
                    }}
                  >
                    New Analysis
                  </Button>
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
                      Strong Match
                    </Badge>
                    <p className="text-muted-foreground mb-3">
                      Your profile aligns well with this position. Focus on highlighting relevant experience.
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="font-medium">Salary Range:</span>
                      <span className="text-muted-foreground">{result.salaryRange}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Interview Tips */}
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

              {/* CV Recommendations */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">CV Optimization</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate("/cv-builder")}
                  >
                    <FileText className="w-4 h-4" />
                    Open CV Builder
                    <ArrowRight className="w-4 h-4" />
                  </Button>
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

              {/* Cover Letter Draft */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Cover Letter Draft</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate("/cl-builder")}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
