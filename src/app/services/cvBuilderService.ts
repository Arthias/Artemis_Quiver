import type { LlmConfig } from "../types/llm";
import { chatCompletion } from "./llmService";
import {
  cvGeneratePrompt,
  cvEditPrompt,
  selectPrompt,
  type OptimizationMode,
  type PromptContext,
} from "./prompts";

// ============================================================================
// Normalization - handles LLMs that output key-based sections instead of type-based
// ============================================================================

// Modes that return full CV JSON (vs. text snippets or analysis)
const JSON_MODES: OptimizationMode[] = ["standard", "ats-optimize", "career-transition"];

const SECTION_TYPE_KEYS = ["summary", "contact", "skills", "experience", "education", "certifications"] as const;

function normalizeSection(section: Record<string, unknown>): Record<string, unknown> {
  if (section.type && typeof section.type === "string") return section;

  for (const key of SECTION_TYPE_KEYS) {
    if (key in section) {
      const val = section[key];
      switch (key) {
        case "summary":
          return { type: key, content: typeof val === "string" ? val : String(val ?? "") };
        case "contact":
          return { type: key, ...(typeof val === "object" && val !== null ? val as Record<string, unknown> : {}) };
        case "skills":
          return { type: key, skills: Array.isArray(val) ? val : [] };
        case "experience":
          return { type: key, experience: Array.isArray(val) ? val : [] };
        case "education":
          return { type: key, education: Array.isArray(val) ? val : [] };
        case "certifications":
          return { type: key, certifications: Array.isArray(val) ? val : [] };
      }
    }
  }
  return section;
}

function normalizeCvJson(rawJson: string): string {
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sections)) {
    throw new Error("Invalid CV structure: missing sections array");
  }
  parsed.sections = parsed.sections.map(normalizeSection);
  return JSON.stringify(parsed);
}

// ============================================================================
// Implementation Functions
// ============================================================================

export interface GenerateCvOptions {
  mode?: OptimizationMode;
  targetRole?: string;
  industry?: string;
  previousField?: string;
  newField?: string;
}

export async function generateCv(
  profileMarkdown: string,
  jobDescription: string | undefined,
  cvRecommendations: string[] | undefined,
  config: LlmConfig,
  options?: GenerateCvOptions
): Promise<string> {
  const mode = options?.mode ?? "standard";
  const ctx: PromptContext = {
    targetRole: options?.targetRole,
    industry: options?.industry,
    jobDescription,
    recommendations: cvRecommendations,
    previousField: options?.previousField,
    newField: options?.newField,
  };

  const systemPrompt = selectPrompt(mode, undefined, ctx);

  const jobPart = typeof jobDescription === "string" && 
                  jobDescription.trim().length > 0 
                  ? `\n\n## Target job\n\n${jobDescription}` 
                  : "\n\n(No specific job — general CV from profile.)";

  const recsPart = cvRecommendations?.length
    ? `\n\n## Analysis recommendations to emphasize\n\n${cvRecommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";

  const raw = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user", 
        content: `## Candidate profile\n\n${profileMarkdown}${jobPart}${recsPart}`
      }
    ],
    config
  );

  // Normalize as JSON for modes that produce full CVs; return raw text otherwise
  return JSON_MODES.includes(mode) ? normalizeCvJson(raw) : raw;
}

export async function editCv(
  currentCvJson: string,
  userRequest: string,
  profileMarkdown: string,
  config: LlmConfig
): Promise<string> {
  return normalizeCvJson(
    await chatCompletion(
      [
        { role: "system", content: cvEditPrompt(userRequest) },
        {
          role: "user", 
          content: `## Master profile (reference)\n\n${profileMarkdown}\n\n## Current CV JSON\n\n${currentCvJson}`
        }
      ],
      config
    )
  );
}

/**
 * Targeted optimization that returns text (not JSON).
 * Use for: summary-rewrite, bullet-optimize, audit, headline, hiring-manager,
 *          work-history-align, skills-section
 */
export async function optimizeCv(
  profileMarkdown: string,
  mode: OptimizationMode,
  config: LlmConfig,
  context?: Partial<PromptContext>
): Promise<string> {
  const ctx: PromptContext = {
    targetRole: context?.targetRole,
    industry: context?.industry,
    jobDescription: context?.jobDescription,
    recommendations: context?.recommendations,
    previousField: context?.previousField,
    newField: context?.newField,
  };

  const systemPrompt = selectPrompt(mode, undefined, ctx);

  const contextParts = [];
  if (ctx.targetRole) contextParts.push(`\nTarget role: ${ctx.targetRole}`);
  if (ctx.industry) contextParts.push(`Industry: ${ctx.industry}`);
  if (ctx.previousField) contextParts.push(`Previous field: ${ctx.previousField}`);
  if (ctx.newField) contextParts.push(`Target field: ${ctx.newField}`);
  if (ctx.jobDescription) contextParts.push(`\n## Job description\n\n${ctx.jobDescription}`);

  const contextBlock = contextParts.length > 0 ? `\n\n${contextParts.join("\n")}` : "";

  return chatCompletion(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `## Candidate profile\n\n${profileMarkdown}${contextBlock}`,
      },
    ],
    config
  );
}
