import type { LlmConfig } from "../types/llm";
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
  const company = options.companyName?.trim() || "the company";
  const role = options.position?.trim() || "the role";
  const jobPart = options.jobDescription?.trim()
    ? `\n\n## Job description\n\n${options.jobDescription}`
    : "";
  const seedPart = options.seedDraft?.trim()
    ? `\n\n## Draft to refine (from job analysis)\n\n${options.seedDraft}`
    : "";

  return chatCompletion(
    [
      { role: "system", content: CL_GENERATE_SYSTEM },
      {
        role: "user",
        content: `## Candidate profile\n\n${profileMarkdown}\n\n## Company: ${company}\n## Position: ${role}${jobPart}${seedPart}`,
      },
    ],
    config
  );
}

export async function editCoverLetter(
  currentLetter: string,
  userRequest: string,
  profileMarkdown: string,
  config: LlmConfig
): Promise<string> {
  return chatCompletion(
    [
      { role: "system", content: CL_EDIT_SYSTEM },
      {
        role: "user",
        content: `## Master profile\n\n${profileMarkdown}\n\n## Current letter\n\n${currentLetter}\n\n## Request\n\n${userRequest}`,
      },
    ],
    config
  );
}
