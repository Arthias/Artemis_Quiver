import type { LlmConfig } from "../types/llm";
import type { ChatMessage } from "../types/llm";
import { AppError, ErrorCodes } from "../utils/errors";
import { chatCompletion } from "./llmService";
import { clGeneratePrompt, clEditPrompt } from "./prompts";
import type { CLContent } from "../types/cl";

const MAX_RETRIES = 3;

export interface GenerateCoverLetterOptions {
  jobDescription?: string;
  companyName?: string;
  position?: string;
  seedDraft?: string;
}

function parseClJson(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
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
  return raw;
}

export async function generateCoverLetter(
  profileMarkdown: string,
  options: GenerateCoverLetterOptions,
  config: LlmConfig
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

  const systemPrompt = clGeneratePrompt(company, role, hasJobDescription);

  let lastRaw = "";
  let lastErrorMessage = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messages: ChatMessage[] = [
        { role: "system", content: `${systemPrompt}\n\nCompany: ${company}\nPosition: ${role}` },
        { role: "user", content: `## Candidate profile\n\n${profileMarkdown}${jobPart}${seedPart}` },
      ];

      if (attempt >= 2 && lastRaw) {
        messages.push(
          { role: "assistant", content: lastRaw },
          { role: "user", content: `Fix the JSON formatting error above: ${lastErrorMessage}. Return ONLY valid JSON. No markdown fences.` }
        );
      }

      const raw = await chatCompletion(messages, config);

      try {
        return parseClJson(raw);
      } catch (parseErr) {
        lastRaw = raw;
        lastErrorMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
        if (attempt < MAX_RETRIES) continue;
        throw new AppError(
          ErrorCodes.CL_GENERATION_FAILED,
          `Cover letter generation failed after ${MAX_RETRIES + 1} attempts.`,
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        ErrorCodes.CL_GENERATION_FAILED,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  throw new AppError(ErrorCodes.UNKNOWN, "Cover letter generation failed unexpectedly.");
}

export async function editCoverLetter(
  currentLetterJson: string,
  userRequest: string,
  profileMarkdown: string,
  config: LlmConfig
): Promise<string> {
  const systemPrompt = clEditPrompt(userRequest);
  let lastRaw = "";
  let lastErrorMessage = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `## Master profile\n\n${profileMarkdown}\n\n## Current cover letter JSON\n\n${currentLetterJson}` },
      ];

      if (attempt >= 2 && lastRaw) {
        messages.push(
          { role: "assistant", content: lastRaw },
          { role: "user", content: `Fix the JSON error above: ${lastErrorMessage}. Return ONLY valid JSON.` }
        );
      }

      const raw = await chatCompletion(messages, config);

      try {
        return parseClJson(raw);
      } catch (parseErr) {
        lastRaw = raw;
        lastErrorMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
        if (attempt < MAX_RETRIES) continue;
        throw new AppError(
          ErrorCodes.CL_EDIT_FAILED,
          `Cover letter edit failed after ${MAX_RETRIES + 1} attempts.`,
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        ErrorCodes.CL_EDIT_FAILED,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  throw new AppError(ErrorCodes.UNKNOWN, "Cover letter edit failed unexpectedly.");
}

export { parseClJson };
export type { CLContent } from "../types/cl";
