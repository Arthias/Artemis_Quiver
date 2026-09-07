import type { ModelEndpoint } from "../types/llm";
import type { ChatMessage } from "../types/llm";
import { chatCompletion } from "./llmService";
import { AppError, ErrorCodes, type ErrorCode } from "../utils/errors";
import { extractJsonObject } from "../utils/jsonParse";
import {
  cvEditPrompt,
  selectPrompt,
  localeInstruction,
  type OptimizationMode,
  type PromptContext,
} from "./prompts";
import i18n from "../i18n";

const JSON_MODES: OptimizationMode[] = ["standard", "ats-optimize"];
const MAX_RETRIES = 3;

const SECTION_NORMALIZERS: Record<string, (val: unknown) => Record<string, unknown>> = {
  summary: (val) => ({ type: "summary", content: typeof val === "string" ? val : String(val ?? "") }),
  contact: (val) => ({ type: "contact", ...(typeof val === "object" && val !== null ? val as Record<string, unknown> : {}) }),
  skills: (val) => ({ type: "skills", skills: Array.isArray(val) ? val : [] }),
  experience: (val) => ({ type: "experience", experience: Array.isArray(val) ? val : [] }),
  education: (val) => ({ type: "education", education: Array.isArray(val) ? val : [] }),
  certifications: (val) => ({ type: "certifications", certifications: Array.isArray(val) ? val : [] }),
};

function normalizeSection(section: Record<string, unknown>): Record<string, unknown> {
  if (section.type && typeof section.type === "string") return section;
  for (const [key, normalizer] of Object.entries(SECTION_NORMALIZERS)) {
    if (key in section) return normalizer(section[key]);
  }
  return section;
}

function normalizeCvJson(rawJson: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(rawJson, ErrorCodes.CV_JSON_PARSE) as Record<string, unknown>;
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
    locale: i18n.language,
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

async function withJsonRetry(
  buildMessages: (attempt: number, lastRaw: string, lastError: string) => ChatMessage[],
  endpoint: ModelEndpoint,
  errorCode: ErrorCode,
  errorMessage: string,
): Promise<string> {
  let lastRaw = "";
  let lastErrorMessage = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messages = buildMessages(attempt, lastRaw, lastErrorMessage);
      const raw = await chatCompletion(messages, endpoint);

      try {
        return normalizeCvJson(raw);
      } catch (normalizeErr) {
        lastRaw = raw;
        lastErrorMessage = normalizeErr instanceof Error ? normalizeErr.message : String(normalizeErr);
        if (attempt < MAX_RETRIES) continue;
        throw new AppError(errorCode, `${errorMessage} after ${MAX_RETRIES + 1} attempts.`);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorCodes.LLM_API_FAILURE, err instanceof Error ? err.message : String(err));
    }
  }
  throw new AppError(ErrorCodes.UNKNOWN, errorMessage);
}

export async function generateCv(
  profileMarkdown: string,
  jobDescription: string | undefined,
  cvRecommendations: string[] | undefined,
  endpoint: ModelEndpoint,
  options?: GenerateCvOptions
): Promise<string> {
  const mode = options?.mode ?? "standard";
  if (!JSON_MODES.includes(mode)) {
    const messages = buildMessages(profileMarkdown, jobDescription, cvRecommendations, mode, options);
    return chatCompletion(messages, endpoint);
  }

  return withJsonRetry(
    (attempt, lastRaw, lastError) => {
      const messages = buildMessages(profileMarkdown, jobDescription, cvRecommendations, mode, options);
      if (attempt >= 2 && lastRaw) {
        messages.push(
          { role: "assistant", content: lastRaw },
          { role: "user", content: `Fix the JSON formatting error above: ${lastError}. Return ONLY valid JSON. No markdown fences.` }
        );
      }
      return messages;
    },
    endpoint,
    ErrorCodes.CV_GENERATION_FAILED,
    "CV generation failed",
  );
}

export async function editCv(
  currentCvJson: string,
  userRequest: string,
  profileMarkdown: string,
  endpoint: ModelEndpoint
): Promise<string> {
  return withJsonRetry(
    (attempt, lastRaw, lastError) => {
      const messages: ChatMessage[] = [
        { role: "system", content: `${cvEditPrompt(userRequest)}${localeInstruction(i18n.language)}` },
        { role: "user", content: `## Master profile (reference)\n\n${profileMarkdown}\n\n## Current CV JSON\n\n${currentCvJson}` },
      ];
      if (attempt >= 2 && lastRaw) {
        messages.push(
          { role: "assistant", content: lastRaw },
          { role: "user", content: `Fix the JSON error above: ${lastError}. Return ONLY valid JSON.` }
        );
      }
      return messages;
    },
    endpoint,
    ErrorCodes.CV_GENERATION_FAILED,
    "CV edit failed",
  );
}

export async function optimizeCv(
  profileMarkdown: string,
  mode: OptimizationMode,
  endpoint: ModelEndpoint,
  context?: Partial<PromptContext>
): Promise<string> {
  const ctx: PromptContext = {
    targetRole: context?.targetRole,
    industry: context?.industry,
    jobDescription: context?.jobDescription,
    recommendations: context?.recommendations,
    locale: i18n.language,
  };

  const systemPrompt = selectPrompt(mode, undefined, ctx);

  const contextParts = [];
  if (ctx.targetRole) contextParts.push(`\nTarget role: ${ctx.targetRole}`);
  if (ctx.industry) contextParts.push(`Industry: ${ctx.industry}`);
  if (ctx.jobDescription) contextParts.push(`\n## Job description\n\n${ctx.jobDescription}`);

  const contextBlock = contextParts.length > 0 ? `\n\n${contextParts.join("\n")}` : "";

  return chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `## Candidate profile\n\n${profileMarkdown}${contextBlock}` },
    ],
    endpoint
  );
}
