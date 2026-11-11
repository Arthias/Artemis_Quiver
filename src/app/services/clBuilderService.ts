import type { ChatMessage, LlmConfig, LlmTask } from "../types/llm";
import { AppError, ErrorCodes, type ErrorCode } from "../utils/errors";
import { runLlmJson } from "./llmJson";
import { extractJsonObject } from "../utils/jsonParse";
import { clGeneratePrompt, clEditPrompt } from "./prompts";
import i18n from "../i18n";

const MAX_RETRIES = 3;

export interface GenerateCoverLetterOptions {
  jobDescription?: string;
  companyName?: string;
  position?: string;
  seedDraft?: string;
  /** Language to write the letter in; defaults to the app's UI language. */
  locale?: string;
}

function parseClJson(raw: string): string {
  let parsed: unknown;
  try {
    parsed = extractJsonObject(raw, ErrorCodes.CL_GENERATION_FAILED);
  } catch {
    throw new AppError(
      ErrorCodes.CL_GENERATION_FAILED,
      "Invalid JSON from model response",
    );
  }
  if (!parsed || typeof parsed !== "object" || !(parsed as Record<string, unknown>).senderName || !Array.isArray((parsed as Record<string, unknown>).bodyParagraphs)) {
    throw new AppError(
      ErrorCodes.CL_GENERATION_FAILED,
      "Invalid cover letter structure: missing senderName or bodyParagraphs",
    );
  }
  return JSON.stringify(parsed);
}

/** A JSON call for a cover letter: up to MAX_RETRIES repairs, then a typed error. */
async function clJson(task: LlmTask, messages: ChatMessage[], llm: LlmConfig, code: ErrorCode, what: string): Promise<string> {
  try {
    return await runLlmJson(task, messages, llm, parseClJson, {
      attempts: MAX_RETRIES + 1,
      onExhausted: () => new AppError(code, `${what} after ${MAX_RETRIES + 1} attempts.`),
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(code, err instanceof Error ? err.message : String(err));
  }
}

export async function generateCoverLetter(
  profileMarkdown: string,
  options: GenerateCoverLetterOptions,
  llm: LlmConfig
): Promise<string> {
  const company = typeof options.companyName === "string" && options.companyName.trim()
    ? options.companyName.trim() : "the company";
  const role = typeof options.position === "string" && options.position.trim()
    ? options.position.trim() : "the role";
  const hasJobDescription = typeof options.jobDescription === "string" && options.jobDescription.trim().length > 0;
  const jobPart = hasJobDescription ? `\n\n## Job description\n\n${options.jobDescription}` : "";
  const seedPart = typeof options.seedDraft === "string" && options.seedDraft.trim().length > 0
    ? `\n\n## Draft to refine (from job analysis)\n\n${options.seedDraft}`
    : "";

  const systemPrompt = clGeneratePrompt(company, role, hasJobDescription, options.locale ?? i18n.language);
  const messages: ChatMessage[] = [
    { role: "system", content: `${systemPrompt}\n\nCompany: ${company}\nPosition: ${role}` },
    { role: "user", content: `## Candidate profile\n\n${profileMarkdown}${jobPart}${seedPart}` },
  ];
  return clJson("clGenerate", messages, llm, ErrorCodes.CL_GENERATION_FAILED, "Cover letter generation failed");
}

export async function editCoverLetter(
  currentLetterJson: string,
  userRequest: string,
  profileMarkdown: string,
  llm: LlmConfig,
  locale: string = i18n.language,
): Promise<string> {
  const systemPrompt = clEditPrompt(userRequest, locale);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `## Master profile\n\n${profileMarkdown}\n\n## Current cover letter JSON\n\n${currentLetterJson}` },
  ];
  return clJson("clEdit", messages, llm, ErrorCodes.CL_EDIT_FAILED, "Cover letter edit failed");
}


