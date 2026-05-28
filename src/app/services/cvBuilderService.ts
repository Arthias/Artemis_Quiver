import type { LlmConfig } from "../types/llm";
import { chatCompletion } from "./llmService";

// ============================================================================
// SYSTEM PROMPTS for Structured JSON generation (NOT Markdown)
// ============================================================================

/**
 * System prompt instructing LLM to generate structured JSON format
 * Uses Zod schema information for reliable output
 */
const CV_GENERATE_SYSTEM = `You are an expert CV writer. Generate a professional CV in STRUCTURED JSON format from the candidate profile.

IMPORTANT - You MUST return ONLY a valid JSON object. No markdown fences, no text outside the JSON.

Each section in the "sections" array MUST have a "type" field that identifies the section kind.

EXAMPLE of the exact format required:
{
  "sections": [
    { "type": "summary", "content": "Professional summary text here" },
    { "type": "contact", "email": "user@example.com", "phone": "+1 234 567 890", "linkedin": "https://linkedin.com/in/user", "website": "https://user.com" },
    { "type": "skills", "skills": ["JavaScript", "Python", "React"] },
    { "type": "experience", "experience": [{"role": "Senior Dev", "company": "Acme", "period": "2020-2023", "description": "Led development"}] },
    { "type": "education", "education": [{"degree": "BSc Computer Science", "institution": "MIT", "period": "2012-2016"}] },
    { "type": "certifications", "certifications": ["AWS Solutions Architect"] }
  ]
}

SECTION TYPES:
1. "summary" - object with "content" string
2. "contact" - object with optional email, phone, linkedin, website, location strings
3. "skills" - object with "skills" array of strings
4. "experience" - object with "experience" array of {role, company, period, description}
5. "education" - object with "education" array of {degree, institution, period}
6. "certifications" - object with "certifications" array of strings

RULES:
- Be FACTUAL — only include information from the profile
- Tailor emphasis to target job when a description is provided
- Return ONLY the JSON object, no text/comments/formatting around it
`;

/**
 * System prompt for editing CV JSON structure
 */
const CV_EDIT_SYSTEM = `You are an expert CV editor. Apply these requested changes to the CV and return only the revised VALID JSON object. Return only JSON — no markdown wrappers, text, or commentary.`;

// ============================================================================
// Normalization - handles LLMs that output key-based sections instead of type-based
// ============================================================================

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
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sections)) {
    throw new Error("Invalid CV structure: missing sections array");
  }
  parsed.sections = parsed.sections.map(normalizeSection);
  return JSON.stringify(parsed);
}

// ============================================================================
// Implementation Functions
// ============================================================================

export async function generateCv(
  profileMarkdown: string,
  jobDescription: string | undefined,
  cvRecommendations: string[] | undefined,
  config: LlmConfig
): Promise<string> {
  
  // Build contextual message with job description if provided
  const jobPart = typeof jobDescription === "string" && 
                  jobDescription.trim().length > 0 
                  ? `\n\n## Target job\n\n${jobDescription}` 
                  : "\n\n(No specific job — general CV from profile.)";
  
  // Add recommendations if any, prefixed with # markers for JSON parsing
  const recsPart = cvRecommendations?.length
    ? `\n\n## Analysis recommendations to emphasize\n\n${cvRecommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";

  const raw = await chatCompletion(
    [
      { role: "system", content: CV_GENERATE_SYSTEM },
      { 
        role: "system", 
        content: `\nAlways return valid JSON with "type" field in each section, matching the example format.` 
      },
      {
        role: "user", 
        content: `## Candidate profile\n\n${profileMarkdown}${jobPart}${recsPart}`
      }
    ],
    config
  );
  return normalizeCvJson(raw);
}

export async function editCv(
  currentCvJson: string, // Now receives JSON string instead of Markdown  
  userRequest: string, // User's requested change request
  profileMarkdown: string, // Master profile for reference
  config: LlmConfig
): Promise<string> {
  return normalizeCvJson(
    await chatCompletion(
      [
        { role: "system", content: CV_EDIT_SYSTEM },
        { 
          role: "system", 
          content: `\nEach section MUST have a "type" field matching the example format.` 
        },
        {
          role: "user", 
          content: `## Master profile (reference)\n\n${profileMarkdown}\n\n## Current CV JSON\n\n${currentCvJson}\n\n## Requested change\n\n${userRequest}`
        }
      ],
      config
    )
  );
}
