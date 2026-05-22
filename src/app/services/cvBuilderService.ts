import type { LlmConfig } from "../types/llm";
import { chatCompletion } from "./llmService";

const CV_GENERATE_SYSTEM = `You are an expert CV writer. Create a professional CV in plain text/Markdown format from the candidate profile.
Use clear sections: contact line, summary, skills, experience, education, certifications if relevant.
Be factual — only include information from the profile. Tailor emphasis to the job when a description is provided.`;

const CV_EDIT_SYSTEM = `You are an expert CV editor. Apply the user's requested changes to the CV.
Return only the full revised CV text, no commentary.`;

export async function generateCv(
  profileMarkdown: string,
  jobDescription: string | undefined,
  cvRecommendations: string[] | undefined,
  config: LlmConfig
): Promise<string> {
  const jobPart = jobDescription?.trim()
    ? `\n\n## Target job\n\n${jobDescription}`
    : "\n\n(No specific job — general CV from profile.)";
  const recsPart =
    cvRecommendations?.length ?
      `\n\n## Analysis recommendations to emphasize\n\n${cvRecommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";

  return chatCompletion(
    [
      { role: "system", content: CV_GENERATE_SYSTEM },
      {
        role: "user",
        content: `## Candidate profile\n\n${profileMarkdown}${jobPart}${recsPart}`,
      },
    ],
    config
  );
}

export async function editCv(
  currentCv: string,
  userRequest: string,
  profileMarkdown: string,
  config: LlmConfig
): Promise<string> {
  return chatCompletion(
    [
      { role: "system", content: CV_EDIT_SYSTEM },
      {
        role: "user",
        content: `## Master profile (reference)\n\n${profileMarkdown}\n\n## Current CV\n\n${currentCv}\n\n## Requested change\n\n${userRequest}`,
      },
    ],
    config
  );
}
