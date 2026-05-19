export default function Page() {
  'use client'; // Makes this page a Client Component, allowing hooks and event handlers

  import { useState } from "react";
  import ScoreBadge from "@/components/ScoreBadge";
  import { analyzeJobPost, initializeLLMClient } from "@/lib/job_analyzer"; // Import core logic

  // Placeholder for a global configuration state hook (In production this would come from a context or local storage)
  const useConfig = () => {
    // Simulate fetching the API key and provider from a persistent source (like a dedicated config store)
    return {
      apiKey: "dummy-key-12345", // Use dummy key for now
      provider: "OpenRouter"
    };
  };

  export default function Page() {
    const [jobInput, setJobInput] = useState("");
    const [analysisResult, setAnalysisResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const config = useConfig();

    const handleAnalyzeJobPosting = async () => {
      if (!jobInput) return;
      setLoading(true);
      setAnalysisResult(null);
      try {
        // 1. Initialize LLM Client using stored config
        const llmClient = initializeLLMClient(config.apiKey); // This throws if API key is missing
        console.log("API Client Ready:");

        // 2. Call the core analysis function
        const result: any = await analyzeJobPost(llmClient, jobInput, "Placeholder Master Profile Content (Needs to be fetched from /profile)");
        setAnalysisResult(result);
      } catch (error) {
        console.error("Error during analysis:", error);
        alert(`Analysis Failed: ${(error as Error).message}`); // Show user a friendly error message
      } finally {
        setLoading(false);
      }
    };

    return (
    <div className="max-w-2xl mx-auto space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Analysis Hub</h1>
        <p className="text-muted-foreground text-sm font-medium">Paste a job description below to initiate the matching engine and get actionable insights.</p>
      </header>

        {/* Input Section */}
      <section className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-lg transition-all hover:shadow-xl">
          <label htmlFor="job-input" className="sr-only">Job Posting Input</label>
          <textarea
            id="job-input"
            placeholder="Paste the job description here..."
              value={jobInput}
              onChange={(e) => setJobInput(e.target.value)}
            className="w-full min-h-[250px] rounded-md border-none bg-transparent p-3 text-sm ring-offset-background focus:ring-primary focus:border-primary placeholder:text-muted-foreground/50"
          />
        </div>

        <button
            onClick={handleAnalyzeJobPosting}
            disabled={loading || !jobInput} // Disable if loading or no input
            className={`w-full rounded-md px-4 py-3 text-base font-semibold shadow transition-all active:scale-[0.98] ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} text-primary-foreground`}
        >
            {loading ? "Analyzing..." : "Initiate Analysis"}
        </button>
      </section>

        {/* Results Display */}
        {analysisResult ? (
          <div className="space-y-4 border p-6 rounded-xl border-border bg-card/50 shadow-inner">
        <h2 className="text-xl font-semibold text-foreground">Analysis Results</h2>
            <p className='text-sm text-muted-foreground'>Analysis completed successfully!</p>

            {/* Score Card */}
            <div className="pt-4 border-t border-border flex justify-between items-center">
              <div>Match Score: <ScoreBadge score={analysisResult.score} /></div>
              <button className="bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 px-4 py-2 rounded transition-colors">Go to CV Builder</button>
        </div>

            {/* Tips Section */}
            <div>
              <h3 className='text-lg font-medium mt-6 mb-2 text-foreground'>Actionable Recommendations</h3>
              <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                {analysisResult.tips.map((tip, index) => (
                  <li key={index} className='text-muted-foreground'>{tip}</li>
                ))}
              </ul>
    </div>
          </div>
        )
        : !loading && ( // Display placeholder if no results and not loading
          <div className="space-y-4 border p-6 rounded-xl border-border bg-card/50 shadow-inner">
            <h2 className="text-xl font-semibold text-foreground">Analysis Results</h2>
            <p className='text-sm text-muted-foreground'>*Results will appear here after running analysis.*</p>
          </div>
        )
      </div>
  );
}
}

