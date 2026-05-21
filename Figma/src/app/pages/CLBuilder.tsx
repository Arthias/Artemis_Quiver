import { useState } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Mail, Download, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";

export function CLBuilder() {
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [position, setPosition] = useState("");
  const [letterContent, setLetterContent] = useState("");
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

  const generateLetter = async () => {
    setGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const company = companyName || "the Company";
    const role = position || "this position";

    setLetterContent(`Dear Hiring Manager,

I am writing to express my strong interest in the ${role} at ${company}. With over 8 years of experience in software engineering and a proven track record of building scalable distributed systems, I am confident that my skills and background align perfectly with your team's needs.

Throughout my career, I have specialized in developing high-performance backend systems and microservices architectures. At my current role at Tech Corp, I led the development of a microservices platform that serves over 10 million daily active users, improving overall system performance by 40% through strategic optimization and caching strategies. This experience has given me deep expertise in cloud infrastructure, distributed systems design, and scalable architecture patterns.

What particularly excites me about this opportunity is the chance to contribute to ${company}'s mission and work on challenging technical problems at scale. I am impressed by your commitment to innovation and technical excellence, and I believe my background in leading cross-functional teams and mentoring junior engineers would enable me to make meaningful contributions from day one.

In my previous role at StartupXYZ, I built a real-time data processing pipeline handling over 1 million events daily and developed a comprehensive CI/CD pipeline that reduced deployment time by 60%. These experiences have taught me the importance of building robust, maintainable systems while maintaining high development velocity.

I am particularly drawn to this role because it aligns with my passion for solving complex technical challenges and my desire to work with a team that values engineering excellence. I am excited about the opportunity to bring my expertise in distributed systems, cloud infrastructure, and team leadership to ${company}.

Thank you for considering my application. I look forward to the opportunity to discuss how my experience and skills can contribute to your team's success.

Best regards,
John Doe`);

    setIsGenerated(true);
    setGenerating(false);
  };

  const downloadPDF = () => {
    alert("PDF download would be implemented here using a library like react-pdf or jspdf");
  };

  const handleChatSubmit = () => {
    if (!chatMessage.trim()) return;
    alert(`AI would process: "${chatMessage}" and update the cover letter accordingly`);
    setChatMessage("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
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
        {/* Left Panel - Letter Preview */}
        <div className="flex-1 border-r border-border overflow-auto">
          <div className="p-6">
            {!isGenerated ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Generate Cover Letter</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Company Name (Optional)
                        </label>
                        <Input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g., Google"
                          className="bg-input-background border-border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Position (Optional)
                        </label>
                        <Input
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          placeholder="e.g., Senior Engineer"
                          className="bg-input-background border-border"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Job Description (Optional)
                      </label>
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
                      className="w-full gap-2"
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

                <Card className="p-6 bg-muted/30 border-dashed">
                  <h3 className="font-medium mb-3">Cover Letter Tips</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">1</Badge>
                      <span>Provide company and position for personalized content</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">2</Badge>
                      <span>Include job description to highlight relevant skills and experience</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">3</Badge>
                      <span>Use the chat panel to refine tone, length, or specific sections</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">4</Badge>
                      <span>Generated content is based on your master profile</span>
                    </li>
                  </ul>
                </Card>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <Card className="p-8 bg-white dark:bg-card">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {letterContent}
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
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">AI Assistant</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Request modifications to your cover letter
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-3">
                <Card className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <p className="text-sm font-medium">Make it more formal</p>
                  <p className="text-xs text-muted-foreground">Adjust tone for corporate setting</p>
                </Card>
                <Card className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <p className="text-sm font-medium">Make it shorter</p>
                  <p className="text-xs text-muted-foreground">Reduce to 3 paragraphs</p>
                </Card>
                <Card className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <p className="text-sm font-medium">Add enthusiasm</p>
                  <p className="text-xs text-muted-foreground">Show more excitement</p>
                </Card>
                <Card className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <p className="text-sm font-medium">Emphasize leadership</p>
                  <p className="text-xs text-muted-foreground">Highlight management skills</p>
                </Card>
                <Card className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <p className="text-sm font-medium">Focus on tech stack</p>
                  <p className="text-xs text-muted-foreground">Mention specific technologies</p>
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
                  placeholder="Request changes..."
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
