import type { ModelEndpoint } from "../types/llm";
import { AppError, ErrorCodes } from "../utils/errors";
import { chatCompletion } from "./llmService";

const MERGE_SYSTEM_PROMPT = `You are a career profile editor. Merge uploaded text into an existing Markdown profile.
Rules:
- Extract only factual information present in the upload or existing profile.
- Do not invent skills, jobs, or credentials.
- Output the complete updated profile as Markdown only (no fences, no commentary).
- Preserve clear sections: Overview, Skills, Experience, Education.`;

export async function mergeProfileFromUpload(
  currentProfile: string,
  uploadedText: string,
  endpoint: ModelEndpoint
): Promise<string> {
  try {
    const content = await chatCompletion(
      [
        { role: "system", content: MERGE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `## Current profile\n\n${currentProfile}\n\n## Uploaded content\n\n${uploadedText}`,
        },
      ],
      endpoint
    );
    return content.trim();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCodes.PROFILE_MERGE_FAILED, err instanceof Error ? err.message : String(err));
  }
}
