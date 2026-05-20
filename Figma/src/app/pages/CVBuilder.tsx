import { useState } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { FileText, Download, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "../components/ui/badge";

export function CVBuilder() {
  const [jobDescription, setJobDescription] = useState("");
  const [cvContent, setCvContent] = useState("");
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

  const generateCV = async () => {
    setGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    setCvContent(`JOHN DOE
Senior Software Engineer
john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe

PROFESSIONAL SUMMARY
Results-driven Senior Software Engineer with 8+ years of experience in building scalable distributed systems and leading cross-functional teams. Proven track record of improving system performance by 40% and delivering high-impact solutions for 10M+ users.

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, Go
Frameworks: React, Node.js, Django, FastAPI
Cloud & DevOps: AWS (EC2, S3, Lambda), Docker, Kubernetes, CI/CD
Databases: PostgreSQL, MongoDB, Redis

PROFESSIONAL EXPERIENCE

Senior Software Engineer | Tech Corp | 2021 - Present
• Led development of microservices architecture serving 10M+ daily active users
• Improved system performance by 40% through optimization and caching strategies
• Mentored team of 5 junior engineers, conducting code reviews and technical training
• Implemented monitoring and alerting systems reducing incident response time by 60%

Software Engineer | StartupXYZ | 2018 - 2021
• Built real-time data processing pipeline handling 1M+ events per day
• Developed CI/CD pipeline reducing deployment time from 2 hours to 20 minutes
• Collaborated with product team on feature development in Agile environment
• Reduced production bugs by 35% through comprehensive testing strategies

EDUCATION
Bachelor of Science in Computer Science
University of Technology | 2018

CERTIFICATIONS
• AWS Certified Solutions Architect - Professional
• Certified Kubernetes Administrator (CKA)
`);

    setIsGenerated(true);
    setGenerating(false);
  };

  const downloadPDF = () => {
    alert("PDF download would be implemented here using a library like react-pdf or jspdf");
  };

  const handleChatSubmit = () => {
    if (!chatMessage.trim()) return;
    alert(`AI would process: "${chatMessage}" and update the CV accordingly`);
    setChatMessage("");
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
                <h1 className="text-xl font-semibold">CV Builder</h1>
                <p className="text-sm text-muted-foreground">
                  Generate and refine your CV with AI assistance
                </p>
              </div>
            </div>
            {isGenerated && (
              <Button onClick={downloadPDF} className="gap-2">
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - CV Preview */}
        <div className="flex-1 border-r border-border overflow-auto">
          <div className="p-6">
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
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {cvContent}
                    </pre>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - AI Chat */}
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
                <Card className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <p className="text-sm font-medium">Add more metrics</p>
                  <p className="text-xs text-muted-foreground">Include quantifiable achievements</p>
                </Card>
                <Card className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <p className="text-sm font-medium">Shorten experience</p>
                  <p className="text-xs text-muted-foreground">Make it more concise</p>
                </Card>
                <Card className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <p className="text-sm font-medium">Reorder sections</p>
                  <p className="text-xs text-muted-foreground">Prioritize key information</p>
                </Card>
                <Card className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <p className="text-sm font-medium">Change formatting</p>
                  <p className="text-xs text-muted-foreground">Adjust layout and style</p>
                </Card>
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
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
                />
              </div>
              <Button
                onClick={handleChatSubmit}
                disabled={!chatMessage.trim()}
                className="w-full mt-2"
                size="sm"
              >
                Apply Changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
