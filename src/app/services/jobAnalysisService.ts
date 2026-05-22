import type { AnalysisResult } from "../types/analysis";
import type { LlmConfig } from "../types/llm";
import { extractJsonObject } from "../utils/jsonParse";
import { chatCompletion } from "./llmService";

const ANALYSIS_SYSTEM_PROMPT = `You are a job application coach. Analyze job postings against a candidate profile.
Respond with a single JSON object only (no markdown fences, no extra text).
Use this exact schema:
{
  "score": <number 0-100>,
  "salaryRange": "<estimated range as string>",
  "summary": "<2-3 sentence match summary>",
  "tips": ["<interview tip>", ...],
  "cvRecommendations": ["<cv improvement>", ...],
  "coverLetterDraft": "<full cover letter text>"
}
Provide 3-5 tips and 3-5 cvRecommendations. Be specific to the job and profile.`;

function validateAnalysisResult(data: unknown): AnalysisResult {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid analysis response shape.");
  }

  const obj = data as Record<string, unknown>;
  const score = Number(obj.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("Analysis response missing a valid score (0-100).");
  }

  const salaryRange = String(obj.salaryRange ?? "Not estimated");
  const tips = Array.isArray(obj.tips) ? obj.tips.map(String) : [];
  const cvRecommendations = Array.isArray(obj.cvRecommendations)
    ? obj.cvRecommendations.map(String)
    : [];
  const coverLetterDraft = String(obj.coverLetterDraft ?? "");
  const summary = obj.summary != null ? String(obj.summary) : undefined;

  if (!tips.length || !cvRecommendations.length || !coverLetterDraft) {
    throw new Error("Analysis response is missing required fields.");
  }

  return {
    score: Math.round(score),
    salaryRange,
    tips,
    cvRecommendations,
    coverLetterDraft,
    summary,
  };
}

export function analysisToMarkdown(
  jobPosting: string,
  result: AnalysisResult,
  analyzedAt = new Date()
): string {
  const date = analyzedAt.toISOString();
  const tips = result.tips.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const cvRecs = result.cvRecommendations.map((r, i) => `${i + 1}. ${r}`).join("\n");

  return `# Job Analysis

**Analyzed:** ${date}  
**Match score:** ${result.score}%  
**Salary range:** ${result.salaryRange}

## Summary

${result.summary ?? "_No summary provided._"}

## Job posting

\`\`\`
${jobPosting.trim()}
\`\`\`

## Interview preparation tips

${tips}

## CV recommendations

${cvRecs}

## Cover letter draft

${result.coverLetterDraft}
`;
}

export async function analyzeJobPosting(
  jobPosting: string,
  profileMarkdown: string,
  config: LlmConfig
): Promise<{ result: AnalysisResult; markdown: string }> {
  const content = await chatCompletion(
    [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      {
        role: "user",
        content: `## Candidate profile\n\n${profileMarkdown}\n\n## Job posting\n\n${jobPosting}`,
      },
    ],
    config
  );

  const parsed = validateAnalysisResult(extractJsonObject(content));
  const markdown = analysisToMarkdown(jobPosting, parsed);
  return { result: parsed, markdown };
}
