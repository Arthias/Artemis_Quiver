import type { ChatMessage, LlmConfig, LlmTask } from "../types/llm";
import { runLlm } from "./llmService";
import { runLlmJson } from "./llmJson";
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
  languages: (val) => ({ type: "languages", languages: Array.isArray(val) ? val : [] }),
};

// Models return languages as strings or as {language, level} objects; the CV
// stores "Spanish (Native)" strings.
function languageToString(item: unknown): string {
  if (typeof item === "string") return item;
  if (typeof item !== "object" || item === null) return "";
  const o = item as Record<string, unknown>;
  const name = [o.language, o.name].find((v) => typeof v === "string") as string | undefined;
  const level = [o.level, o.proficiency].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  if (!name) return "";
  return level ? `${name} (${level})` : name;
}

// Weaker models tend to fill optional fields they can't answer (e.g. a
// missing location) with a literal placeholder instead of omitting them,
// which then renders verbatim in the exported document. Strip those so the
// existing `{item.location && ...}`-style guards in the CV renderers hide
// the field as if it were never provided.
const PLACEHOLDER_VALUES = new Set([
  "n/a", "na", "none", "unknown", "tbd", "-", "--", "not specified", "not provided",
]);

function isPlaceholder(value: unknown): boolean {
  return typeof value === "string" && PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function stripPlaceholderFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  let result = obj;
  for (const field of fields) {
    if (isPlaceholder(result[field])) {
      if (result === obj) result = { ...obj };
      delete result[field];
    }
  }
  return result;
}

function sanitizeSectionPlaceholders(section: Record<string, unknown>): Record<string, unknown> {
  switch (section.type) {
    case "contact":
      return stripPlaceholderFields(section, ["email", "phone", "linkedin", "website", "location"]);
    case "experience":
      if (!Array.isArray(section.experience)) return section;
      return {
        ...section,
        experience: section.experience.map((item) =>
          typeof item === "object" && item !== null
            ? stripPlaceholderFields(item as Record<string, unknown>, ["location"])
            : item
        ),
      };
    case "education":
      if (!Array.isArray(section.education)) return section;
      return {
        ...section,
        education: section.education.map((item) =>
          typeof item === "object" && item !== null
            ? stripPlaceholderFields(item as Record<string, unknown>, ["location"])
            : item
        ),
      };
    case "languages":
      if (!Array.isArray(section.languages)) return section;
      return { ...section, languages: section.languages.map(languageToString).filter(Boolean) };
    default:
      return section;
  }
}

function normalizeSection(section: Record<string, unknown>): Record<string, unknown> {
  if (section.type && typeof section.type === "string") return sanitizeSectionPlaceholders(section);
  for (const [key, normalizer] of Object.entries(SECTION_NORMALIZERS)) {
    if (key in section) return sanitizeSectionPlaceholders(normalizer(section[key]));
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
  /** Language to write the CV in; defaults to the app's UI language. */
  locale?: string;
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
    locale: options?.locale ?? i18n.language,
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

/** A JSON call for a CV: up to MAX_RETRIES repairs, then a typed error. */
async function cvJson(task: LlmTask, messages: ChatMessage[], llm: LlmConfig, errorCode: ErrorCode, errorMessage: string): Promise<string> {
  try {
    return await runLlmJson(task, messages, llm, normalizeCvJson, {
      attempts: MAX_RETRIES + 1,
      onExhausted: () => new AppError(errorCode, `${errorMessage} after ${MAX_RETRIES + 1} attempts.`),
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCodes.LLM_API_FAILURE, err instanceof Error ? err.message : String(err));
  }
}

export async function generateCv(
  profileMarkdown: string,
  jobDescription: string | undefined,
  cvRecommendations: string[] | undefined,
  llm: LlmConfig,
  options?: GenerateCvOptions
): Promise<string> {
  const mode = options?.mode ?? "standard";
  const messages = buildMessages(profileMarkdown, jobDescription, cvRecommendations, mode, options);
  if (!JSON_MODES.includes(mode)) return runLlm("cvGenerate", messages, llm);
  return cvJson("cvGenerate", messages, llm, ErrorCodes.CV_GENERATION_FAILED, "CV generation failed");
}

export async function editCv(
  currentCvJson: string,
  userRequest: string,
  profileMarkdown: string,
  llm: LlmConfig,
  locale: string = i18n.language,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: `${cvEditPrompt(userRequest)}${localeInstruction(locale)}` },
    { role: "user", content: `## Master profile (reference)\n\n${profileMarkdown}\n\n## Current CV JSON\n\n${currentCvJson}` },
  ];
  return cvJson("cvEdit", messages, llm, ErrorCodes.CV_GENERATION_FAILED, "CV edit failed");
}

export async function optimizeCv(
  profileMarkdown: string,
  mode: OptimizationMode,
  llm: LlmConfig,
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

  return runLlm(
    "cvOptimize",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `## Candidate profile\n\n${profileMarkdown}${contextBlock}` },
    ],
    llm
  );
}
