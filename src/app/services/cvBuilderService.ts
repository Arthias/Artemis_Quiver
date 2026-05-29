import type { LlmConfig } from "../types/llm";
import type { ChatMessage } from "../types/llm";
import { chatCompletion } from "./llmService";
import { AppError, ErrorCodes } from "../utils/errors";
import {
  cvGeneratePrompt,
  cvEditPrompt,
  selectPrompt,
  type OptimizationMode,
  type PromptContext,
} from "./prompts";

const JSON_MODES: OptimizationMode[] = ["standard", "ats-optimize", "career-transition"];
const MAX_RETRIES = 3;
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
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    throw new AppError(
      ErrorCodes.CV_JSON_PARSE,
      `Invalid JSON from model: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sections)) {
    throw new AppError(
      ErrorCodes.CV_SCHEMA_INVALID,
      "Invalid CV structure: missing sections array",
    );
  }
  parsed.sections = parsed.sections.map(normalizeSection);
  return JSON.stringify(parsed);
}

export interface GenerateCvOptions {
  mode?: OptimizationMode;
  targetRole?: string;
  industry?: string;
  previousField?: string;
  newField?: string;
}

function buildMessages(
  profileMarkdown: string,
  jobDescription: string | undefined,
  cvRecommendations: string[] | undefined,
  mode: OptimizationMode,
  options?: GenerateCvOptions,
): ChatMessage[] {
  const ctx: PromptContext = {
    targetRole: options?.targetRole,
    industry: options?.industry,
    jobDescription,
    recommendations: cvRecommendations,
    previousField: options?.previousField,
    newField: options?.newField,
  };

  const systemPrompt = selectPrompt(mode, undefined, ctx);

  const jobPart = typeof jobDescription === "string" && jobDescription.trim().length > 0
    ? `\n\n## Target job\n\n${jobDescription}`
    : "\n\n(No specific job — general CV from profile.)";

  const recsPart = cvRecommendations?.length
    ? `\n\n## Analysis recommendations to emphasize\n\n${cvRecommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";

  return [
    { role: "system", content: systemPrompt },
    { role: "user" as const, content: `## Candidate profile\n\n${profileMarkdown}${jobPart}${recsPart}` },
  ];
}

export async function generateCv(
  profileMarkdown: string,
  jobDescription: string | undefined,
  cvRecommendations: string[] | undefined,
  config: LlmConfig,
  options?: GenerateCvOptions
): Promise<string> {
  const mode = options?.mode ?? "standard";
  const isJsonMode = JSON_MODES.includes(mode);

  let lastRaw = "";
  let lastErrorMessage = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messages = buildMessages(profileMarkdown, jobDescription, cvRecommendations, mode, options);

      // Attempt 3+: send corrective feedback with the model's broken output
      if (attempt >= 2 && lastRaw) {
        messages.push(
          { role: "assistant", content: lastRaw },
          { role: "user", content: `Fix the JSON formatting error above: ${lastErrorMessage}. Return ONLY valid JSON. No markdown fences.` }
        );
      }

      const raw = await chatCompletion(messages, config);

      if (!isJsonMode) return raw;

      try {
        return normalizeCvJson(raw);
      } catch (normalizeErr) {
        lastRaw = raw;
        lastErrorMessage = normalizeErr instanceof Error ? normalizeErr.message : String(normalizeErr);
        if (attempt < MAX_RETRIES) continue;
        throw new AppError(
          ErrorCodes.CV_GENERATION_FAILED,
          `CV generation failed after ${MAX_RETRIES + 1} attempts.`,
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        ErrorCodes.LLM_API_FAILURE,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  throw new AppError(ErrorCodes.UNKNOWN, "CV generation failed unexpectedly.");
}

export async function editCv(
  currentCvJson: string,
  userRequest: string,
  profileMarkdown: string,
  config: LlmConfig
): Promise<string> {
  let lastRaw = "";
  let lastErrorMessage = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messages: ChatMessage[] = [
        { role: "system", content: cvEditPrompt(userRequest) },
        { role: "user", content: `## Master profile (reference)\n\n${profileMarkdown}\n\n## Current CV JSON\n\n${currentCvJson}` },
      ];

      if (attempt >= 2 && lastRaw) {
        messages.push(
          { role: "assistant", content: lastRaw },
          { role: "user", content: `Fix the JSON error above: ${lastErrorMessage}. Return ONLY valid JSON.` }
        );
      }

      const raw = await chatCompletion(messages, config);

      try {
        return normalizeCvJson(raw);
      } catch (normalizeErr) {
        lastRaw = raw;
        lastErrorMessage = normalizeErr instanceof Error ? normalizeErr.message : String(normalizeErr);
        if (attempt < MAX_RETRIES) continue;
        throw new AppError(
          ErrorCodes.CV_GENERATION_FAILED,
          `CV edit failed after ${MAX_RETRIES + 1} attempts.`,
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        ErrorCodes.LLM_API_FAILURE,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  throw new AppError(ErrorCodes.UNKNOWN, "CV edit failed unexpectedly.");
}

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
      { role: "user", content: `## Candidate profile\n\n${profileMarkdown}${contextBlock}` },
    ],
    config
  );
}
