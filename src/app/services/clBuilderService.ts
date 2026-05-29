import type { LlmConfig } from "../types/llm";
import { AppError, ErrorCodes } from "../utils/errors";
import { chatCompletion } from "./llmService";

const CL_GENERATE_SYSTEM = `You are an expert cover letter writer. Write a professional business letter in plain text.
Use only facts from the candidate profile. Match tone to the role when a job description is provided.`;

const CL_EDIT_SYSTEM = `You are a cover letter editor. Apply the user's requested changes.
Return only the full revised letter, no commentary.`;

export async function generateCoverLetter(
  profileMarkdown: string,
  options: {
    jobDescription?: string;
    companyName?: string;
    position?: string;
    seedDraft?: string;
  },
  config: LlmConfig
): Promise<string> {
  const company = typeof options.companyName === "string" && options.companyName.trim() ? options.companyName.trim() : "the company";
  const role = typeof options.position === "string" && options.position.trim() ? options.position.trim() : "the role";
  const jobPart = typeof options.jobDescription === "string" && options.jobDescription.trim().length > 0
    ? `\n\n## Job description\n\n${options.jobDescription}`
    : "";
  const seedPart = typeof options.seedDraft === "string" && options.seedDraft.trim().length > 0
    ? `\n\n## Draft to refine (from job analysis)\n\n${options.seedDraft}`
    : "";

  try {
    return await chatCompletion(
      [
        { role: "system", content: CL_GENERATE_SYSTEM },
        {
          role: "user",
          content: `## Candidate profile\n\n${profileMarkdown}\n\n## Company: ${company}\n## Position: ${role}${jobPart}${seedPart}`,
        },
      ],
      config
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCodes.CL_GENERATION_FAILED, err instanceof Error ? err.message : String(err));
  }
}

export async function editCoverLetter(
  currentLetter: string,
  userRequest: string,
  profileMarkdown: string,
  config: LlmConfig
): Promise<string> {
  try {
    return await chatCompletion(
      [
        { role: "system", content: CL_EDIT_SYSTEM },
        {
          role: "user",
          content: `## Master profile\n\n${profileMarkdown}\n\n## Current letter\n\n${currentLetter}\n\n## Request\n\n${userRequest}`,
        },
      ],
      config
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCodes.CL_EDIT_FAILED, err instanceof Error ? err.message : String(err));
  }
}
