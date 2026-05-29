import type { ChatMessage, LlmConfig } from "../types/llm";
import { AppError, ErrorCodes } from "../utils/errors";
import { chatCompletion } from "./llmService";

const PROFILE_CHAT_SYSTEM = `You are a career coach helping refine a candidate's Markdown master profile.
Suggest concrete edits based on the user's request. When proposing profile changes, include a section:
UPDATED_PROFILE:
followed by the full revised Markdown profile.
Do not invent experience. Only use information from the current profile and user messages.`;

export async function profileChat(
  messages: ChatMessage[],
  profileMarkdown: string,
  config: LlmConfig
): Promise<string> {
  try {
    return await chatCompletion(
      [
        { role: "system", content: `${PROFILE_CHAT_SYSTEM}\n\n## Current profile\n\n${profileMarkdown}` },
        ...messages,
      ],
      config
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCodes.PROFILE_CHAT_FAILED, err instanceof Error ? err.message : String(err));
  }
}

export function extractUpdatedProfile(reply: string): string | null {
  const marker = "UPDATED_PROFILE:";
  const idx = reply.indexOf(marker);
  if (idx === -1) return null;
  return reply.slice(idx + marker.length).trim();
}
